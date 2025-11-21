// ======================================================
// LOG
// ======================================================
function log() {
  const args = Array.prototype.slice.call(arguments);
  console.log.apply(console, ["🟦 [PLUGIN]"].concat(args));
}

// ======================================================
// Load fonts
// ======================================================
function loadAllFonts(node) {
  return new Promise(function (resolve) {
    try {
      const fonts = node.getRangeAllFontNames(0, node.characters.length);
      let i = 0;

      (function next() {
        if (i >= fonts.length) return resolve();
        figma.loadFontAsync(fonts[i]).then(function () {
          i++;
          next();
        }).catch(function () {
          resolve();
        });
      })();
    } catch (err) {
      if (node.fontName && node.fontName !== figma.mixed) {
        figma.loadFontAsync(node.fontName).then(resolve).catch(() => resolve());
      } else {
        resolve();
      }
    }
  });
}

// ======================================================
// Set text
// ======================================================
function setTextIfExists(parent, name, value) {
  return new Promise(function (resolve) {
    const node = parent.findOne(n => n.name === name && n.type === "TEXT");
    if (!node) return resolve();

    loadAllFonts(node).then(function () {
      try { node.characters = value; } catch (err) {}
      resolve();
    });
  });
}

// ======================================================
// Apply QR image
// ======================================================
function setQrImage(frame, url, nodeName) {
  return new Promise(function (resolve) {
    const qrNode = frame.findOne(n => n.name === nodeName && n.fills !== undefined);
    if (!qrNode) return resolve();

    fetch(url)
      .then(res => res.ok ? res.arrayBuffer() : null)
      .then(buf => {
        if (!buf) return resolve();
        const img = figma.createImage(new Uint8Array(buf));

        qrNode.fills = [{
          type: "IMAGE",
          scaleMode: "FILL",
          imageHash: img.hash
        }];

        resolve();
      })
      .catch(() => resolve());
  });
}

// ======================================================
// Clean external_ref → number
// ======================================================
function sanitizeExternalRef(ref) {
  if (!ref) return "Panel";
  const i = ref.indexOf("#");
  if (i === -1) return "Panel";
  const num = ref.substring(i + 1).trim();
  return num === "" ? "Panel" : num;
}

// ======================================================
// UI
// ======================================================
figma.showUI(__html__, { width: 340, height: 340 });

// ======================================================
// MAIN
// ======================================================
figma.ui.onmessage = async function (msg) {
  if (msg.type === "close") {
    figma.closePlugin();
    return;
  }
  if (msg.type !== "generate") return;

  // ============================================
  // Normalize airport (avoids "mrs" vs "MRS")
  // ============================================
  let airport = msg.airport;
  airport = airport.trim().toUpperCase();

  const targetPageName = msg.targetPage;

  if (!airport) {
    figma.notify("❌ Airport code is required");
    return;
  }
  if (!targetPageName) {
    figma.notify("❌ Target Page is required");
    return;
  }

  // ============================================
  // Source page selection
  // ============================================
  const sourcePageName =
      airport === "MRS" ? "MRS_Prod" :
      airport === "BVA" ? "BVA_Prod" :
      null;

  if (!sourcePageName) {
    figma.notify("❌ Unknown airport: " + airport + " (supported: MRS, BVA)");
    return;
  }

  const sourcePage = figma.root.findOne(n =>
    n.type === "PAGE" && n.name === sourcePageName
  );

  if (!sourcePage) {
    figma.notify("❌ Source page not found: " + sourcePageName);
    return;
  }

  // ============================================
  // Templates from source page
  // ============================================
  function find(name) {
    return sourcePage.findOne(n => n.name === name && n.type === "FRAME");
  }

  const templateFemale = find("Template_Female");
  const templateFemaleBack = find("Template_Female_Back");
  const templateMale = find("Template_Male");
  const templateMaleBack = find("Template_Male_Back");

  const hasFemale = !!templateFemale && !!templateFemaleBack;
  const hasMale   = !!templateMale && !!templateMaleBack;

  if (!hasFemale && !hasMale) {
    figma.notify("❌ No usable templates found in: " + sourcePageName);
    return;
  }

  // ============================================
  // Fetch webhook data
  // ============================================
  const webhook = "https://" + airport + ".hubway.ai/api/webhooks/touchpoints";
  log("Webhook:", webhook);

  let touchpoints;
  try {
    const res = await fetch(webhook);
    touchpoints = await res.json();
  } catch (err) {
    figma.notify("❌ Fetch error / CORS problem");
    return;
  }

  if (!Array.isArray(touchpoints)) {
    figma.notify("❌ Invalid webhook data");
    return;
  }

  // ============================================
  // Target page (where we clone templates)
  // ============================================
  let page = figma.root.findOne(n =>
    n.type === "PAGE" && n.name === targetPageName
  );
  if (!page) {
    page = figma.createPage();
    page.name = targetPageName;
  }

  // ============================================
  // Layout configuration
  // ============================================
  const startX = 120;
  const startY = 120;
  const spacingX = 260;
  const verticalGap = 40;
  const itemsPerRow = 6;

  // ============================================
  // Generate
  // ============================================
  for (let i = 0; i < touchpoints.length; i++) {

    const tp = touchpoints[i];
    const id = tp.public_id;
    const qr = tp.qr_image_url + "?type=png";
    const org = tp.org_name || "";
    const ref = sanitizeExternalRef(tp.external_ref);
    const name = ref + " — " + org + " — " + id;

    const isMale = tp.avatar_genre === "male";

    const rectoTemplate = (isMale && hasMale) ? templateMale : templateFemale;
    const versoTemplate = (isMale && hasMale) ? templateMaleBack : templateFemaleBack;

    const col = i % itemsPerRow;
    const row = Math.floor(i / itemsPerRow);

    const x = startX + col * spacingX;
    const rectoY = startY + row * 600;
    const versoY = rectoY + rectoTemplate.height + verticalGap;

    // RECTO
    const recto = rectoTemplate.clone();
    page.appendChild(recto);
    recto.x = x;
    recto.y = rectoY;
    recto.name = name;

    await setTextIfExists(recto, "ID_TEXT", id);
    await setQrImage(recto, qr, "QR_IMAGE");

    // VERSO
    const verso = versoTemplate.clone();
    page.appendChild(verso);
    verso.x = x;
    verso.y = versoY;
    verso.name = name + " — Back";

    await setTextIfExists(verso, "ID_TEXT_V", id);
    await setQrImage(verso, qr, "QR_IMAGE_V");
  }

  figma.notify("🎉 Panels generated successfully!");
};
