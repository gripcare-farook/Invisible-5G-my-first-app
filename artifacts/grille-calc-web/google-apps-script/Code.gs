/**
 * 5G Invisible Grille — Google Apps Script
 * Deploy as Web App: Execute as Me, Access: Anyone
 *
 * Required Google Sheet tabs:
 *   Projects | OpeningDetails | WeeklySettlement | Stock | Transport
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

    if (data.action === "saveTransportRows") {
      var rowsAdded = saveToTransport(ss, data);
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, message: "Transport rows saved.", rowsAdded: rowsAdded }))
        .setMimeType(ContentService.MimeType.JSON);
    }

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
  "saved_at", "project_id", "project_name", "client_name", "Mobile Number", "site_location",
  "openings_count", "total_sqft", "total_rope_lines", "total_rope_meters",
  "total_channel_feet", "total_channel_pcs", "total_fasteners", "total_stiffner_meters",
  "labour_cost", "shipping_cost", "misc_cost", "total_cost", "cost_per_sqft",
  "selling_price", "recommended_selling_price", "total_profit", "profit_per_sqft",
  "stock_sync_status", "stock_sync_message", "notes"
];

function saveToProjects(ss, data) {
  var sheet = getOrCreateSheet(ss, "Projects", PROJECTS_HEADERS);
  var headers = ensureProjectMobileHeader(sheet);
  var values = {
    saved_at: data.savedAt, project_id: data.projectId, project_name: data.projectName,
    client_name: data.clientName || "", "Mobile Number": data.mobileNumber || "",
    site_location: data.siteLocation || "", openings_count: data.openingsCount,
    total_sqft: data.totalSqft, total_rope_lines: data.totalRopeLines,
    total_rope_meters: data.totalRopeMeters, total_channel_feet: data.totalChannelFeet,
    total_channel_pcs: data.totalChannelPcs, total_fasteners: data.totalFasteners,
    total_stiffner_meters: data.totalStiffnerMeters, labour_cost: data.labourCost,
    shipping_cost: data.shippingCost, misc_cost: data.miscCost, total_cost: data.totalCost,
    cost_per_sqft: data.costPerSqft, selling_price: data.sellingPrice,
    recommended_selling_price: data.recommendedSellingPrice, total_profit: data.totalProfit,
    profit_per_sqft: data.profitPerSqft, stock_sync_status: "synced",
    stock_sync_message: "Stock deducted successfully", notes: data.notes || ""
  };
  var row = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(values, header) ? values[header] : "";
  });
  var nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, headers.indexOf("Mobile Number") + 1).setNumberFormat("@");
  sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
}

function ensureProjectMobileHeader(sheet) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  if (headers.indexOf("Mobile Number") < 0) {
    var clientNameColumn = headers.indexOf("client_name") + 1;
    if (clientNameColumn < 1) throw new Error("Projects sheet is missing client_name.");
    sheet.insertColumnAfter(clientNameColumn);
    sheet.getRange(1, clientNameColumn + 1).setValue("Mobile Number");
    headers.splice(clientNameColumn, 0, "Mobile Number");
  }
  return headers;
}

// ─── OpeningDetails sheet ─────────────────────────────────────────────────────

var OPENING_HEADERS = [
  "project_id", "saved_at", "opening_index", "opening_label",
  "width_ft", "height_ft", "quantity", "sqft", "model_type", "gap_inches",
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
      o.quantity || 1,
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

var TRANSPORT_HEADERS = [
  "Date", "Source File", "Row Number", "Starting Point", "Ending Point", "Raw OCR Line", "Review Needed"
];

function saveToTransport(ss, data) {
  var sheet = getOrCreateSheet(ss, "Transport", TRANSPORT_HEADERS);
  var rows = data.rows || [];
  var values = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    values.push([
      data.savedAt || new Date().toISOString(),
      data.sourceFile || "",
      row.rowNumber,
      row.startingPoint || "",
      row.endingPoint || "",
      row.rawOcrLine || "",
      row.reviewNeeded || "NO"
    ]);
  }

  if (values.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, TRANSPORT_HEADERS.length).setValues(values);
  }

  return values.length;
}

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
