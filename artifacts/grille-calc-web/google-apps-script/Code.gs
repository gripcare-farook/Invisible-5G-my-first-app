/**
 * 5G Invisible Grille — Google Apps Script
 * Deploy as Web App: Execute as Me, Access: Anyone
 *
 * Required Google Sheet tabs:
 *   Projects | OpeningDetails | WeeklySettlement | Stock
 *
 * Stock sheet format (A:D):
 *   item_code | item_name | unit | quantity
 *   SSWIRE_2MM | SS Wire 2mm | meters | <current_qty>
 *   CHANNEL_STD | Channel 10ft | pcs | <current_qty>
 *   FASTENER_STD | Fastener | pcs | <current_qty>
 *   STIFFNER_STD | Stiffner | meters | <current_qty>
 */

// ─── Health check (GET) ──────────────────────────────────────────────────────

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "5G Grille Apps Script is running." }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Main entry point (POST) ─────────────────────────────────────────────────

function doPost(e) {
  try {
    var raw = "{}";

    if (e && e.parameter && e.parameter.data) {
      raw = e.parameter.data;
    } else if (e && e.postData && e.postData.contents) {
      raw = e.postData.contents;
    }

    var data = JSON.parse(raw);
   var ss = SpreadsheetApp.openById("1DjsyPAZDp-pjojnlCBPb3ECaF3LrGEDKTJEs2lNHAiU");

    if (data.action !== "saveFullProject") {
      return respond(false, "Unknown action: " + data.action);
    }

    saveToProjects(ss, data);
    saveToOpeningDetails(ss, data);
    saveToWeeklySettlement(ss, data);
    var stockMsg = deductFromStock(ss, data);

    return respond(true, "Project saved. " + stockMsg);
  } catch (err) {
    return respond(false, "Error: " + err.message);
  }
}

function respond(success, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: success, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Projects sheet ──────────────────────────────────────────────────────────

var PROJECTS_HEADERS = [
  "saved_at", "project_id", "project_name", "client_name", "site_location",
  "openings_count", "total_sqft", "total_rope_lines", "total_rope_meters",
  "total_channel_feet", "total_channel_pcs", "total_fasteners", "total_stiffner_meters",
  "labour_cost", "shipping_cost", "misc_cost", "total_cost", "cost_per_sqft",
  "selling_price", "recommended_selling_price", "total_profit", "profit_per_sqft",
  "stock_sync_status", "stock_sync_message", "notes"
];

function saveToProjects(ss, data) {
  var sheet = getOrCreateSheet(ss, "Projects", PROJECTS_HEADERS);

  var row = [
    data.savedAt,
    data.projectId,
    data.projectName,
    data.clientName || "",
    data.siteLocation || "",
    data.openingsCount,
    data.totalSqft,
    data.totalRopeLines,
    data.totalRopeMeters,
    data.totalChannelFeet,
    data.totalChannelPcs,
    data.totalFasteners,
    data.totalStiffnerMeters,
    data.labourCost,
    data.shippingCost,
    data.miscCost,
    data.totalCost,
    data.costPerSqft,
    data.sellingPrice,
    data.recommendedSellingPrice,
    data.totalProfit,
    data.profitPerSqft,
    "synced",
    "Stock deducted successfully",
    data.notes || ""
  ];

  sheet.appendRow(row);
}

// ─── OpeningDetails sheet ─────────────────────────────────────────────────────

var OPENING_HEADERS = [
  "project_id", "saved_at", "opening_index", "opening_label",
  "width_ft", "height_ft", "sqft", "model_type", "gap_inches",
  "rope_lines", "rope_meters", "channel_pcs", "channel_feet",
  "fasteners", "stiffner_lines", "stiffner_meters",
  "wire_cost", "channel_cost", "fastener_cost", "stiffner_cost", "labour_cost", "subtotal"
];

function saveToOpeningDetails(ss, data) {
  var sheet = getOrCreateSheet(ss, "OpeningDetails", OPENING_HEADERS);

  var openings = data.openings || [];
  for (var i = 0; i < openings.length; i++) {
    var o = openings[i];
    sheet.appendRow([
      o.projectId,
      o.savedAt,
      o.openingIndex,
      o.label,
      o.widthFt,
      o.heightFt,
      o.sqft,
      o.modelType,
      o.gapInches,
      o.ropeLines,
      o.ropeMeters,
      o.channelPcs,
      o.channelFeet,
      o.fasteners,
      o.stiffnerLines,
      o.stiffnerMeters,
      o.wireCost,
      o.channelCost,
      o.fastenerCost,
      o.stiffnerCost,
      o.labourCost,
      o.subtotal
    ]);
  }
}

// ─── WeeklySettlement sheet ───────────────────────────────────────────────────

var SETTLEMENT_HEADERS = [
  "saved_at", "project_id", "project_name", "expense_type", "expense_category", "amount"
];

function saveToWeeklySettlement(ss, data) {
  var sheet = getOrCreateSheet(ss, "WeeklySettlement", SETTLEMENT_HEADERS);

  // Labour row (save only if amount > 0)
  if (data.labourCost > 0) {
    sheet.appendRow([
      data.savedAt, data.projectId, data.projectName,
      "Labour", "Working Cost", data.labourCost
    ]);
  }

  // Shipping row (save only if amount > 0)
  if (data.shippingCost > 0) {
    sheet.appendRow([
      data.savedAt, data.projectId, data.projectName,
      "Shipping", "Transport", data.shippingCost
    ]);
  }

  // Misc row (save only if amount > 0)
  if (data.miscCost > 0) {
    sheet.appendRow([
      data.savedAt, data.projectId, data.projectName,
      "Misc", "Other Expense", data.miscCost
    ]);
  }
}

// ─── Stock deduction ──────────────────────────────────────────────────────────

function deductFromStock(ss, data) {
  var sheet = ss.getSheetByName("Stock");
  if (!sheet) {
    return "Stock sheet not found — skipped stock deduction.";
  }

  var deductions = [
    { code: "SSWIRE_2MM",   qty: data.totalRopeMeters   },
    { code: "CHANNEL_STD",  qty: data.totalChannelPcs   },
    { code: "FASTENER_STD", qty: data.totalFasteners     },
    { code: "STIFFNER_STD", qty: data.totalStiffnerMeters }
  ];

  var stockData = sheet.getDataRange().getValues();
  var messages = [];

  for (var d = 0; d < deductions.length; d++) {
    var code = deductions[d].code;
    var qty  = deductions[d].qty;
    if (!qty || qty <= 0) continue;

    var found = false;
    for (var r = 0; r < stockData.length; r++) {
      if (String(stockData[r][0]).trim() === code) {
        var currentQty = parseFloat(stockData[r][3]) || 0;
        var newQty = currentQty - qty;
        // Column D = index 3, spreadsheet col = 4 (1-based), row = r+1
        sheet.getRange(r + 1, 4).setValue(newQty);
        stockData[r][3] = newQty; // keep local copy in sync
        messages.push(code + ": " + currentQty + " -> " + newQty.toFixed(2));
        found = true;
        break;
      }
    }
    if (!found) {
      messages.push(code + ": not found in stock sheet");
    }
  }

  return messages.length > 0 ? "Stock: " + messages.join(", ") : "No stock deductions needed.";
}

// ─── Helper: get or create sheet with headers ─────────────────────────────────

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    // Freeze header row and bold it
    sheet.setFrozenRows(1);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#1e3a8a");
    headerRange.setFontColor("#ffffff");
  } else {
    // If sheet exists but is empty, add headers
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      var hr = sheet.getRange(1, 1, 1, headers.length);
      hr.setFontWeight("bold");
      hr.setBackground("#1e3a8a");
      hr.setFontColor("#ffffff");
    }
  }
  return sheet;
}
