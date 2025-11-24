# ✨ Figma Plugin

A Figma plugin that automatically generates **front & back touchpoint panels** using airport-specific templates and live Hubway API data.

---

## 📁 Required File Structure

### **1️⃣ Source Pages**

Each organization must have a page named: <ORG>_Prod

Examples:
- `MRS_Prod`
- `BVA_Prod`

---

### **2️⃣ Mandatory Template Frames**

Inside each `<ORG>_Prod` page, define templates with **exact names**:

| Template Type        | Frame Name             | Required |
|----------------------|------------------------|----------|
| 👩 Female — Front    | `Template_Female`       | ✔ Yes |
| 👩 Female — Back     | `Template_Female_Back`  | ✔ Yes |
| 👨 Male — Front      | `Template_Male`         | Optional |
| 👨 Male — Back       | `Template_Male_Back`    | Optional |

> If male templates do not exist, the plugin **automatically falls back to female templates**.

---

### **3️⃣ Required Nodes Inside Each Template**

Each template frame must include:

| Purpose              | Node Name   | Type |
|----------------------|-------------|------|
| QR code (front)      | `QR_IMAGE`  | IMAGE/RECTANGLE |
| QR code (back)       | `QR_IMAGE_V`| IMAGE/RECTANGLE |
| Touchpoint ID (front)| `ID_TEXT`   | TEXT |
| Touchpoint ID (back) | `ID_TEXT_V` | TEXT |

These names must match **exactly**.

---

## 🎯 Target Pages

Generated panels are placed in: <ORG>_ToBePrinted

Examples:
- `MRS_ToBePrinted`
- `BVA_ToBePrinted`

If the page does not exist, the plugin automatically creates it.

---

## 🚀 How to Use the Plugin

1. Open the plugin  
   `Plugins → Touchpoint Panel Generator`
2. Select your **airport/organization**
3. Enter the **target page name**
4. Click **Generate**

The plugin will:

- Fetch touchpoint data from Hubway  
- Pick the correct Male/Female template  
- Insert ID + QR code  
- Generate **recto & verso frames**  
- Arrange all panels automatically in a clean grid  

---

## ⚙️ Plugin Logic

### Template Selection

| Touchpoint Field         | Template Used |
|---------------------------|----------------|
| `avatar_genre = "male"`   | Male templates (if available) |
| `avatar_genre = "female"` | Female templates |
| Male templates missing    | Fallback → female |

---

### ID Extraction Logic

From: external_ref = "AMP #42"

The plugin extracts: 42

If nothing is found → `"Panel"`.

---

### Webhook URL Format

https://<ORG>.hubway.ai/api/webhooks/touchpoints

Example: https://mrs.hubway.ai/api/webhooks/touchpoints
---

## ❗ Error Messages

| Message | Meaning |
|---------|---------|
| ❌ Unknown airport | Selected organization is not supported |
| ❌ Source page not found | Missing `<ORG>_Prod` page |
| ❌ No usable templates | Female templates missing (mandatory) |
| ❌ Invalid webhook data | API response incorrect |
| ❌ Target Page required | Field empty |

---


## 🧪 Best Practices

✔ Template frame names MUST match exactly  
✔ Keep ID + QR layers intact and not renamed  
✔ Lock layers inside templates to avoid accidental changes  
✔ Use identical names across all airport pages  
✔ Avoid grouping templates — each must be a standalone frame  

---
