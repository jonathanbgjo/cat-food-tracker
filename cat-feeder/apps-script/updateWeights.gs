/**
 * Cat Food Tracker — Apps Script
 *
 * Two parts:
 *   1. doPost / doGet — the feeding webhook (unchanged): Supabase POSTs each new
 *      feeding and it gets appended as a row.
 *   2. updateWeights() — fills the "Umi weight" / "Ebi Weight" columns with each
 *      day's weight in lb, pulled from Supabase. Put this on a DAILY trigger that
 *      runs AFTER the Litter-Robot sync (the Whisker cron runs ~11:00 UTC / 7am ET,
 *      so schedule updateWeights for ~8am ET). Running once a day is enough.
 *
 * Setup for the weights part:
 *   - Set SUPABASE_ANON_KEY below (same anon key the app uses).
 *   - Triggers > Add Trigger > choose updateWeights > Time-driven > Day timer > 8-9am.
 */

const SHARED_SECRET = "CHANGE_ME_to_a_long_random_string";
const TIME_ZONE = "America/New_York";

// Divider line drawn above the first feeding row of each new day.
const DIVIDER_COLOR = "#999999";

// For updateWeights():
const SUPABASE_URL = "https://mfinezpdsjjfknvqmjvf.supabase.co";
const SUPABASE_ANON_KEY = "PASTE_YOUR_ANON_KEY"; // same anon key the app uses
const G_PER_LB = 453.59237;

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    const provided =
      (e.parameter && e.parameter.secret) ||
      (body && body.secret) ||
      "";
    if (provided !== SHARED_SECRET) {
      return json({ ok: false, error: "unauthorized" });
    }

    const rec = body.record || {};
    const id = rec.id || "";
    const fedAtIso = rec.fed_at || "";
    const mealType = rec.meal_type || "";
    if (!id) return json({ ok: false, error: "no record" });

    const d = fedAtIso ? new Date(fedAtIso) : new Date();
    const readable = Utilities.formatDate(d, TIME_ZONE, "MMM d, yyyy h:mm a");

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    sheet.appendRow([id, fedAtIso, mealType, readable]);
    // Draw a divider if this feeding starts a new day. Never fail the insert over it.
    try { addDayDividerIfNewDay(sheet); } catch (e) {}

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, msg: "feeding webhook alive" });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fill "Umi weight" / "Ebi Weight" on the first feeding row of each day.
 * Weights are stored in grams (one median point per cat per day, from the
 * Litter-Robot) and written here in lb.
 */
function updateWeights() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return; // header only

  const header = data[0].map(function (h) { return String(h).trim(); });
  const colFedAt = header.indexOf("fed_at");
  const colUmi = header.indexOf("Umi weight");
  const colEbi = header.indexOf("Ebi Weight");
  if (colFedAt < 0 || colUmi < 0 || colEbi < 0) {
    throw new Error('Missing a column: need fed_at, "Umi weight", "Ebi Weight"');
  }

  // Pull daily weights from Supabase -> byDay[day] = { umi: lb, ebi: lb }.
  // A weight's `day` is stored at noon UTC, so its calendar date matches the
  // TIME_ZONE date below — the two line up without extra conversion.
  const res = UrlFetchApp.fetch(
    SUPABASE_URL + "/rest/v1/weights?select=cat,grams,day&order=day.asc",
    {
      method: "get",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
      muteHttpExceptions: true,
    }
  );
  if (res.getResponseCode() !== 200) {
    throw new Error("Supabase weights fetch failed: " + res.getContentText());
  }

  const byDay = {};
  JSON.parse(res.getContentText()).forEach(function (w) {
    const lb = Math.round((w.grams / G_PER_LB) * 10) / 10; // one decimal
    if (!byDay[w.day]) byDay[w.day] = {};
    byDay[w.day][w.cat] = lb;
  });

  // Walk rows; for the FIRST feeding row of each day (in TIME_ZONE), write weights.
  const seen = {};
  for (var r = 1; r < data.length; r++) {
    const fedAt = data[r][colFedAt];
    if (!fedAt) continue;

    const day = localDay(fedAt);
    if (seen[day]) continue; // only the first feeding row of the day
    seen[day] = true;

    const w = byDay[day];
    if (!w) continue;

    // getRange is 1-indexed; +1 offsets the header row and 0-based column index.
    if (w.umi != null) sheet.getRange(r + 1, colUmi + 1).setValue(w.umi);
    if (w.ebi != null) sheet.getRange(r + 1, colEbi + 1).setValue(w.ebi);
  }
}

// Bucket a fed_at timestamp by its calendar date in TIME_ZONE, matching fed_at_est.
function localDay(val) {
  const d = (val instanceof Date) ? val : new Date(val);
  return Utilities.formatDate(d, TIME_ZONE, "yyyy-MM-dd");
}

// Called from doPost: if the just-appended (last) row is a different day than the
// row above it, draw a divider line across the top of the new row.
function addDayDividerIfNewDay(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return; // need header + at least 2 data rows to compare
  const lastCol = sheet.getLastColumn();

  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  const colFedAt = header.indexOf("fed_at") + 1;
  if (colFedAt < 1) return;

  const curr = sheet.getRange(lastRow, colFedAt).getValue();
  const prev = sheet.getRange(lastRow - 1, colFedAt).getValue();
  if (!curr || !prev) return;

  if (localDay(curr) !== localDay(prev)) {
    sheet.getRange(lastRow, 1, 1, lastCol).setBorder(
      true, null, null, null, null, null,
      DIVIDER_COLOR, SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );
  }
}

// Run once (or on a daily trigger) to (re)draw dividers across the whole sheet.
// Idempotent: clears existing top borders on the data block, then redraws them at
// each day boundary. Safe to re-run any time.
function applyDayDividers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 3) return;

  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  const colFedAt = header.indexOf("fed_at");
  if (colFedAt < 0) throw new Error("no fed_at column");

  const n = lastRow - 1; // number of data rows (row 2 .. lastRow)
  const fed = sheet.getRange(2, colFedAt + 1, n, 1).getValues();

  // Clear existing top borders on the data block first.
  sheet.getRange(2, 1, n, lastCol)
    .setBorder(false, null, null, null, null, null, null, null);

  var prevDay = null;
  for (var i = 0; i < n; i++) {
    if (!fed[i][0]) { prevDay = null; continue; }
    var day = localDay(fed[i][0]);
    if (prevDay !== null && day !== prevDay) {
      sheet.getRange(i + 2, 1, 1, lastCol).setBorder(
        true, null, null, null, null, null,
        DIVIDER_COLOR, SpreadsheetApp.BorderStyle.SOLID_MEDIUM
      );
    }
    prevDay = day;
  }
}
