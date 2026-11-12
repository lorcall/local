/**
 * LoCal — personal calorie tracker on Google Apps Script.
 * Code.gs: web app entry, page includes, and the server functions the page calls
 * with google.script.run. Sheets I/O lives in sheets.gs, Gemini in gemini.gs.
 *
 * Script Properties (Project Settings > Script Properties):
 *   GEMINI_API_KEY  required for photo analysis. From aistudio.google.com/apikey.
 *   GEMINI_MODEL    optional. Overrides the model list in gemini.gs.
 *   SHEET_ID        set automatically on first run (or set it to use an existing Sheet).
 *   FOLDER_ID       set automatically on first run.
 *   ICON_URL        optional. A public PNG URL used as the browser tab icon.
 */

function doGet() {
  var out = HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('LoCal')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  // Optional home-screen hints. Apps Script only allows a few meta tags, so skip any it refuses.
  [['mobile-web-app-capable', 'yes'], ['apple-mobile-web-app-capable', 'yes']].forEach(function (t) {
    try { out.addMetaTag(t[0], t[1]); } catch (e) { /* not allowed here */ }
  });
  var icon = prop_('ICON_URL');
  if (icon) { try { out.setFaviconUrl(icon); } catch (e) { /* bad URL */ } }
  return out;
}

/** Apps Script include pattern: <?!= include('styles') ?> */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ---------- server API (called from the page) ---------- */

/** Everything the page needs in one round trip. Doesn't create anything. */
function bootstrap() {
  var ss = getSpreadsheet_(false);
  if (!ss) return {data: {meals: [], entries: [], favorites: [], targets: [], weight: [], settings: {}}, meta: meta_(null)};
  ensureSheets_(ss);
  return {data: lightData_(readAll_(ss)), meta: meta_(ss)};
}

/** Thumbnails stay out of the first load; the page asks for the ones it shows. */
function lightData_(d) {
  d.meals.forEach(function (m) { m.has_thumb = !!m.thumb; delete m.thumb; });
  return d;
}

/** ids: meal ids on screen. Returns {meal_id: thumbnail data URL}. */
function getThumbs(ids) {
  var want = {}, out = {};
  (ids || []).forEach(function (id) { want[id] = true; });
  readTab_(getSpreadsheet_(true), 'Meals').forEach(function (m) { if (want[m.meal_id] && m.thumb) out[m.meal_id] = m.thumb; });
  return out;
}

/** The full photo from the LoCal photos folder, only when someone opens it. p: {url} */
function getPhoto(p) {
  var m = String(p && p.url || '').match(/[-\w]{25,}/);
  if (!m) return null;
  try {
    var file = DriveApp.getFileById(m[0]);
    // Never serve a file just because the caller named its id: it must be a meal photo
    // this user's own LoCal photos folder holds, and it must actually be an image.
    if (!inPhotoFolder_(file)) return null;
    var blob = file.getBlob();
    if (String(blob.getContentType() || '').indexOf('image/') !== 0) return null;
    return {data: Utilities.base64Encode(blob.getBytes()), mime: blob.getContentType()};
  } catch (e) { return null; }
}

/** First run: creates (or adopts) the Sheet and the photo folder, seeds the Filipino dishes. */
function setup(seedFavorites) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = getSpreadsheet_(true);
    ensureSheets_(ss);
    getFolder_();
    var sh = ss.getSheetByName('Favorites');
    if (sh.getLastRow() < 2 && seedFavorites && seedFavorites.length) {
      appendRows_(ss, 'Favorites', seedFavorites.map(function (f) {
        f.is_local_dish = !!f.is_local_dish; f.pinned = !!f.pinned; f.user_corrected = false; return f;
      }));
    }
    var s = readSettings_(ss), defaults = {week_start: 'Monday', rice_serving: '1 cup, 160 g', units: 'kg and cm'};
    Object.keys(defaults).forEach(function (k) { if (s[k] == null || s[k] === '') upsertSetting_(ss, k, defaults[k]); });
    return {data: lightData_(readAll_(ss)), meta: meta_(ss)};
  } finally { lock.releaseLock(); }
}

/** Saves a meal row and replaces its item rows. */
function saveMeal(p) {
  if (!p || !p.meal || !p.meal.meal_id) throw new Error('Missing meal.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = getSpreadsheet_(true);
    var meal = clean_(p.meal);
    if (meal.thumb && String(meal.thumb).length > 45000) meal.thumb = '';
    upsertRow_(ss, 'Meals', 'meal_id', meal);
    deleteWhere_(ss, 'Entries', 'meal_id', meal.meal_id);
    var entries = (p.entries || []).map(function (e) { e = clean_(e); e.meal_id = meal.meal_id; return e; });
    appendRows_(ss, 'Entries', entries);
    return {meal: meal, entries: entries};
  } finally { lock.releaseLock(); }
}

/** Removes the meal's row and its item rows. The photo stays in Drive. */
function deleteMeal(mealId) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = getSpreadsheet_(true);
    deleteWhere_(ss, 'Meals', 'meal_id', mealId);
    deleteWhere_(ss, 'Entries', 'meal_id', mealId);
    return true;
  } finally { lock.releaseLock(); }
}

function saveFavorite(f) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { upsertRow_(getSpreadsheet_(true), 'Favorites', 'food_id', clean_(f)); return f; } finally { lock.releaseLock(); }
}

/** Targets are versioned by effective_date; past days keep the target they had. */
function saveTargets(t) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { upsertRow_(getSpreadsheet_(true), 'Targets', 'effective_date', clean_(t)); return t; } finally { lock.releaseLock(); }
}

function addWeight(w) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { upsertRow_(getSpreadsheet_(true), 'Weight', 'date', clean_(w)); return w; } finally { lock.releaseLock(); }
}

function saveSettings(obj) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = getSpreadsheet_(true);
    Object.keys(obj || {}).forEach(function (k) { upsertSetting_(ss, k, obj[k]); });
    return readSettings_(ss);
  } finally { lock.releaseLock(); }
}

/* ---------- helpers ---------- */

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }

/**
 * Per-user state (SHEET_ID, FOLDER_ID, analysis counts).
 * Script Properties are a single slot shared by everyone who opens the web app, so under a
 * multi-user deployment the first person to run would hand their Sheet id to every other user.
 * These read the user's own store, falling back once to the script store and migrating the
 * value, so an existing single-user install keeps the Sheet and folder it already has.
 */
function userProp_(k) {
  var up = PropertiesService.getUserProperties(), v = up.getProperty(k);
  if (v) return v;
  var legacy = PropertiesService.getScriptProperties().getProperty(k);
  if (legacy) { up.setProperty(k, legacy); return legacy; }
  return null;
}
function setUserProp_(k, v) { PropertiesService.getUserProperties().setProperty(k, v); }
function todayKey_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

function meta_(ss) {
  var folderUrl = '';
  try { var fid = userProp_('FOLDER_ID'); if (fid) folderUrl = DriveApp.getFolderById(fid).getUrl(); } catch (e) { /* folder may have been removed */ }
  var count = analysesToday_();
  return {
    demo: false,
    sheetUrl: ss ? ss.getUrl() : '',
    folderUrl: folderUrl,
    hasKey: !!prop_('GEMINI_API_KEY'),
    model: modelLabel_(),
    analysesToday: count
  };
}

/** Keeps only plain values the Sheet can hold. */
function clean_(o) {
  var out = {};
  Object.keys(o || {}).forEach(function (k) {
    var v = o[k];
    if (v === null || v === undefined) v = '';
    if (typeof v === 'object') v = JSON.stringify(v);
    // Never let typed or model-returned text become a live formula. Sheets starts a formula
    // on = + - @ and on a leading tab or carriage return; plain negative numbers are left alone.
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) && !/^[+-]?\d+(\.\d+)?$/.test(v)) v = "'" + v;
    out[k] = v;
  });
  return out;
}
