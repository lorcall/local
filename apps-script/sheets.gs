/**
 * sheets.gs — the Google Sheet is LoCal's database. One tab per kind of row.
 * Columns are matched by header name, so you can reorder columns or add your own.
 */

var SCHEMA = {
  Meals: ['meal_id', 'date', 'time', 'meal_type', 'photo_url', 'note', 'confidence', 'confidence_reason', 'source', 'edited', 'thumb'],
  Entries: ['entry_id', 'meal_id', 'name', 'category', 'serving_unit', 'grams_per_unit', 'serving_label', 'quantity',
    'kcal', 'protein_g', 'carbs_g', 'fat_g', 'sugar_g', 'fiber_g', 'sodium_mg', 'confidence', 'edited', 'reason'],
  Favorites: ['food_id', 'name', 'category', 'serving_unit', 'grams_per_unit', 'serving_label',
    'kcal', 'protein_g', 'carbs_g', 'fat_g', 'sugar_g', 'fiber_g', 'sodium_mg',
    'pinned', 'use_count', 'usual_hour', 'last_used', 'is_local_dish', 'dish_group', 'user_corrected'],
  Targets: ['effective_date', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_min_g', 'sugar_max_g', 'sodium_max_mg'],
  Weight: ['date', 'kg', 'note'],
  Settings: ['key', 'value']
};
/* Stored as plain text so Sheets never turns them into dates, times or numbers. */
var APP_FOLDER_NAME = 'LoCal App';
var PHOTO_FOLDER_NAME = 'LoCal photos';
var TEXT_COLUMNS = ['meal_id', 'entry_id', 'food_id', 'date', 'time', 'effective_date', 'key', 'value', 'last_used', 'note', 'name', 'serving_label'];

function getSpreadsheet_(create) {
  var id = userProp_('SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { if (!create) throw new Error('Your LoCal Sheet can\'t be opened.'); }
  }
  // A script made from the Sheet (Extensions > Apps Script) uses that Sheet.
  var bound = null;
  try { bound = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { bound = null; }
  if (bound) { setUserProp_('SHEET_ID', bound.getId()); return bound; }
  if (!create) return null;
  var ss = SpreadsheetApp.create('LoCal log');
  setUserProp_('SHEET_ID', ss.getId());
  moveIntoAppFolder_(ss.getId());
  return ss;
}

/** Everything LoCal makes lives in one "LoCal App" folder, so a user's Drive stays tidy. */
function appFolder_() {
  var id = userProp_('APP_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* recreate below */ } }
  var it = DriveApp.getFoldersByName(APP_FOLDER_NAME);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(APP_FOLDER_NAME);
  setUserProp_('APP_FOLDER_ID', folder.getId());
  return folder;
}

function moveIntoAppFolder_(fileId) {
  try { DriveApp.getFileById(fileId).moveTo(appFolder_()); } catch (e) { /* not fatal */ }
}

/** True only when the file sits in this user's own LoCal photos folder. */
function inPhotoFolder_(file) {
  var want = getFolder_().getId(), parents = file.getParents();
  while (parents.hasNext()) { if (parents.next().getId() === want) return true; }
  return false;
}

function getFolder_() {
  var id = userProp_('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* recreate below */ } }
  var parent = appFolder_(), it = parent.getFoldersByName(PHOTO_FOLDER_NAME);
  if (!it.hasNext()) { var loose = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME); it = loose; }
  var folder = it.hasNext() ? it.next() : parent.createFolder(PHOTO_FOLDER_NAME);
  try { if (folder.getParents().next().getId() !== parent.getId()) folder.moveTo(parent); } catch (e) { /* leave it where it is */ }
  setUserProp_('FOLDER_ID', folder.getId());
  return folder;
}

/** Creates missing tabs and adds any missing header columns. Safe to run every time. */
function ensureSheets_(ss) {
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    var cols = SCHEMA[name];
    var lastCol = sh.getLastColumn();
    var header = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    var missing = cols.filter(function (c) { return header.indexOf(c) < 0; });
    if (!missing.length) return;
    var start = header.filter(String).length + 1;
    if (sh.getMaxColumns() < start + missing.length - 1) sh.insertColumnsAfter(sh.getMaxColumns(), start + missing.length - 1 - sh.getMaxColumns());
    sh.getRange(1, start, 1, missing.length).setValues([missing]).setFontWeight('bold');
    sh.setFrozenRows(1);
    missing.forEach(function (c, i) {
      if (TEXT_COLUMNS.indexOf(c) >= 0) sh.getRange(2, start + i, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  });
  var first = ss.getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
}

function headerOf_(sh) {
  var lastCol = sh.getLastColumn();
  return lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
}

function readTab_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var header = values.shift().map(String), tz = Session.getScriptTimeZone();
  return values.filter(function (r) { return r.some(function (v) { return v !== ''; }); }).map(function (r) {
    var o = {};
    header.forEach(function (h, i) {
      if (!h) return;
      var v = r[i];
      if (v instanceof Date) v = (h === 'time') ? Utilities.formatDate(v, tz, 'HH:mm') : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      o[h] = v;
    });
    return o;
  });
}

function readSettings_(ss) {
  var out = {};
  readTab_(ss, 'Settings').forEach(function (r) { if (r.key) out[r.key] = r.value; });
  return out;
}

function readAll_(ss) {
  return {
    meals: readTab_(ss, 'Meals'),
    entries: readTab_(ss, 'Entries'),
    favorites: readTab_(ss, 'Favorites'),
    targets: readTab_(ss, 'Targets'),
    weight: readTab_(ss, 'Weight'),
    settings: readSettings_(ss)
  };
}

function rowFor_(header, obj) {
  return header.map(function (h) { return obj.hasOwnProperty(h) ? obj[h] : ''; });
}

function appendRows_(ss, name, objs) {
  if (!objs || !objs.length) return;
  var sh = ss.getSheetByName(name), header = headerOf_(sh);
  var rows = objs.map(function (o) { return rowFor_(header, o); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, header.length).setValues(rows);
}

/** Updates the row whose keyCol matches, keeping columns the object doesn't mention. */
function upsertRow_(ss, name, keyCol, obj) {
  var sh = ss.getSheetByName(name), header = headerOf_(sh), k = header.indexOf(keyCol);
  if (k < 0) throw new Error('Column ' + keyCol + ' is missing in ' + name + '.');
  var n = sh.getLastRow() - 1;
  if (n > 0) {
    var keys = sh.getRange(2, k + 1, n, 1).getDisplayValues();
    for (var i = 0; i < n; i++) {
      if (String(keys[i][0]) === String(obj[keyCol])) {
        var range = sh.getRange(i + 2, 1, 1, header.length), cur = range.getValues()[0];
        range.setValues([header.map(function (h, j) { return obj.hasOwnProperty(h) ? obj[h] : cur[j]; })]);
        return;
      }
    }
  }
  appendRows_(ss, name, [obj]);
}

function deleteWhere_(ss, name, keyCol, value) {
  var sh = ss.getSheetByName(name), header = headerOf_(sh), k = header.indexOf(keyCol);
  var n = sh.getLastRow() - 1;
  if (k < 0 || n < 1) return;
  var keys = sh.getRange(2, k + 1, n, 1).getDisplayValues();
  for (var i = n - 1; i >= 0; i--) {
    if (String(keys[i][0]) === String(value)) {
      // delete a run of matching rows in one call
      var end = i;
      while (i - 1 >= 0 && String(keys[i - 1][0]) === String(value)) i--;
      sh.deleteRows(i + 2, end - i + 1);
    }
  }
}

function upsertSetting_(ss, key, value) {
  upsertRow_(ss, 'Settings', 'key', {key: key, value: value == null ? '' : String(value)});
}
