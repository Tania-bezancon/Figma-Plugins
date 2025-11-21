// ======================================================
// LOG
// ======================================================
function log() {
  var args = Array.prototype.slice.call(arguments);
  console.log.apply(console, ["🟦 [PLUGIN]"].concat(args));
}

// ======================================================
// Load fonts
// ======================================================
function loadAllFonts(node) {
  return new Promise(function (resolve) {
    try {
      var fonts = node.getRangeAllFontNames(0, node.characters.length);
      var i = 0;
      (function next() {
        if (i >= fonts.length) return resolve();
        figma.loadFontAsync(fonts[i]).then(function () {
          i++;
          next();
        });
      })();
    } catch (err) {
      if (node.fontName && node.fontName !== figma.mixed) {
        figma.loadFontAsync(node.fontName).then(resolve);
      } else {
        resolve();
      }
    }
  });
}

// ======================================================
// Set text by name
// ======================================================
function setTextIfExists(parent, name, value) {
  return new Promise(function (resolve) {
    var node = parent.findOne(function (n) {
      return n.name === name && n.type === "TEXT";
    });

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
    var qrNode = frame.findOne(function (n) {
      return n.name === nodeName && n.fills !== undefined;
    });
    if (!qrNode) return resolve();

    fetch(url)
      .then(function (res) {
        if (!res.ok) return resolve();
        return res.arrayBuffer();
      })
      .then(function (buf) {
        var bytes = new Uint8Array(buf);
        var img = figma.createImage(bytes);

        qrNode.fills = [{
          type: "IMAGE",
          scaleMode: "FILL",
          imageHash: img.hash
        }];
        resolve();
      })
      .catch(function () { resolve(); });
  });
}

// ======================================================
// Clean external_ref → number after #
// ======================================================
function sanitizeExternalRef(ref) {
  if (!ref) return "Panel";
  var i = ref.indexOf("#");
  if (i === -1) return "Panel";
  var num = ref.substring(i + 1).trim();
  return num === "" ? "Panel" : num;
}

// ======================================================
// UI
// ======================================================
figma.showUI(__html__, { width: 340, height: 340 });

// ======================================================
// MAIN
// ======================================================
figma.ui.onmessage = function (msg) {

  if (msg.type === "close") {
    figma.closePlugin();
    return;
  }

  if (msg.type !== "generate") return;

  var airport = msg.airport;
  var targetPageName = msg.targetPage;

  if (!airport) {
    figma.notify("❌ Airport code is required");
    return;
  }

  if (!targetPageName) {
    figma.notify("❌ Target Page is required");
    return;
  }

  var webhook = "https://" + airport + ".hubway.ai/api/webhooks/touchpoints";
  log("Webhook:", webhook);

  fetch(webhook)
    .then(function (res) { return res.json(); })
    .then(function (touchpoints) {

      if (!Array.isArray(touchpoints)) {
        figma.notify("❌ Invalid webhook data");
        return;
      }

      // Target page
      var page = figma.root.findOne(function (n) {
        return n.type === "PAGE" && n.name === targetPageName;
      });
      if (!page) {
        page = figma.createPage();
        page.name = targetPageName;
      }

      var xRecto = 50;
      var yOffset = 50;
      var horizontalSpacing = 150;
      var verticalSpacing = 400;

      touchpoints.forEach(function (tp) {

        var id = tp.public_id;
        var qr = tp.qr_image_url + "?type=png";
        var org = tp.org_name || "";
        var ref = sanitizeExternalRef(tp.external_ref);
        var name = ref + " — " + org + " — " + id;

        var gender = tp.avatar_genre === "male" ? "Male" : "Female";

        var rectoTemplate = figma.root.findOne(function (n) {
          return n.name === (gender === "Male" ? "Template_Male" : "Template_Female");
        });

        var versoTemplate = figma.root.findOne(function (n) {
          return n.name === (gender === "Male" ? "Template_Male_Back" : "Template_Female_Back");
        });

        if (!rectoTemplate || !versoTemplate) return;

        // RECTO
        var recto = rectoTemplate.clone();
        page.appendChild(recto);
        recto.name = name;
        recto.x = xRecto;
        recto.y = yOffset;

        setTextIfExists(recto, "ID_TEXT", id)
          .then(function () { return setQrImage(recto, qr, "QR_IMAGE"); })
          .then(function () {

            var bounds = recto.absoluteRenderBounds;
            var rectoWidth = bounds ? bounds.width : recto.width;

            // VERSO
            var verso = versoTemplate.clone();
            page.appendChild(verso);
            verso.name = name + " — Back";
            verso.x = recto.x + rectoWidth + horizontalSpacing;
            verso.y = recto.y;

            return setTextIfExists(verso, "ID_TEXT_V", id)
              .then(function () { return setQrImage(verso, qr, "QR_IMAGE_V"); });
          });

        yOffset += verticalSpacing;
      });

      figma.notify("🎉 Panes generated!");
    })
    .catch(function () {
      figma.notify("❌ Fetch failed — check CORS or domain access.");
    });
};
