/**
 * proxy.gs — the only server LoCal still needs.
 *
 * The web build runs entirely in the browser and keeps each user's data in their own Drive.
 * The one thing it cannot do there is hold the Gemini API key: anything shipped to the page
 * is public. So this stays on Apps Script, holds the key, and calls Gemini on a user's behalf
 * once it is satisfied the request came from someone allowed to use it.
 *
 * DEPLOY THIS AS ITS OWN APPS SCRIPT PROJECT, separate from the LoCal app.
 * It must be reachable by anyone (that is the point), and you do not want "anyone" access
 * pointed at a project that also contains saveMeal, deleteMeal and your own Sheet.
 *
 *   Deploy > New deployment > Web app
 *   Execute as:     Me            (so the Gemini key and the Access sheet are yours)
 *   Who has access: Anyone        (the gate is the token check below, not Google's)
 *
 * Script Properties:
 *   GEMINI_API_KEY   required. From aistudio.google.com/apikey.
 *   CLIENT_ID        required. The same OAuth client ID the web app uses. Without this the
 *                    audience check cannot run and any Google token would be accepted.
 *   ACCESS_SHEET_ID  required. A Sheet whose first tab has "Email" and "Status" header columns
 *                    (extra columns are fine, and the order does not matter).
 *   OWNER_EMAIL      optional. Where approval requests are sent. Defaults to the deployer.
 *   APPROVE_SECRET   optional. Set any random string; used to sign approval links.
 *
 * This file calls estimateMeal_, readLabel_, analyzeItem, weeklySummary and adjustTargets, so copy gemini.gs
 * into the same project alongside it.
 */

var TOKENINFO = 'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=';
var ACCESS_TAB = '';            // blank: use the spreadsheet's first tab, whatever it is called
var ACCESS_COLS = ['email', 'status'];
var CACHE_SECONDS = 300;
// New access requests: at most this many new rows (and owner emails) a day, so someone with a pile
// of Google accounts can't flood the sheet or the owner's inbox. Raise it if you invite a crowd.
var MAX_NEW_REQUESTS_PER_DAY = 10;
// What a photo may be, and how big. The app sends a 768 px JPEG of about 150 KB.
var IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
var MAX_IMAGE_CHARS = 4 * 1024 * 1024;

/* ---------- entry point ---------- */

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var who = verify_(req.token); // throws on anything it cannot vouch for

    var status = accessStatus_(who.email);
    if (status !== 'approved') {
      if (status === 'none') requestAccess_(who.email);   // first sign-in: add a pending row and email the owner
      return reply_({pending: true, denied: status === 'denied', error: status === 'denied'
        ? 'This account doesn\'t have access to LoCal.'
        : 'Your request has been sent to the owner. Try again once they\'ve approved it.'});
    }

    // The app asks this once at sign-in, before it opens or creates anything in the user's Drive.
    if (req.action === 'access') return reply_({result: {approved: true, email: who.email}});
    return reply_({result: run_(req.action, req.payload || {})});
  } catch (err) {
    return reply_({error: String(err && err.message || err)});
  }
}

/** Approval links land here. A GET must never approve on its own: mail scanners follow links. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.email || !p.sig) return page_('LoCal', 'Nothing to do here.');
  if (p.sig !== sign_(p.email)) return page_('LoCal', 'That approval link isn\'t valid.');

  if (p.confirm === '1') {
    setStatus_(p.email, 'approved');
    notifyApproved_(p.email);
    return page_('Approved', html_(p.email) + ' can now use LoCal.');
  }
  if (p.confirm === 'no') {
    setStatus_(p.email, 'denied');
    return page_('Declined', html_(p.email) + ' has been denied.');
  }
  var base = ScriptApp.getService().getUrl() + '?email=' + encodeURIComponent(p.email) + '&sig=' + encodeURIComponent(p.sig);
  return page_('Approve ' + html_(p.email) + '?',
    '<p>They asked to use LoCal. Approving lets them analyse meals with your Gemini key.</p>' +
    '<p><a class="b" href="' + html_(base) + '&amp;confirm=1" target="_top">Approve</a> <a class="b no" href="' + html_(base) + '&amp;confirm=no" target="_top">Decline</a></p>');
}

/* ---------- identity ---------- */

/**
 * Checks the access token with Google and returns {email}.
 * The audience check is the one that matters: without it any valid Google token from any
 * app in the world would open this door. Everything else here is secondary.
 */
function verify_(token) {
  if (!token) throw new Error('Not signed in.');
  // Garbage is turned away before it costs a call to Google (the daily fetch quota is shared).
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096 || !/^[\w.~+\/=-]+$/.test(token)) throw new Error('Not signed in.');
  var clientId = prop_('CLIENT_ID');
  if (!clientId) throw new Error('This proxy has no CLIENT_ID set.');

  var cache = CacheService.getScriptCache(), key = 'tok_' + Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var res = UrlFetchApp.fetch(TOKENINFO + encodeURIComponent(token), {muteHttpExceptions: true});
  if (res.getResponseCode() !== 200) throw new Error('Your session expired. Open LoCal again.');
  var info = JSON.parse(res.getContentText());

  if (String(info.aud) !== String(clientId)) throw new Error('That sign-in came from somewhere else.');
  if (String(info.email_verified) !== 'true' || !info.email) throw new Error('That Google account has no verified email.');
  if (Number(info.exp) * 1000 < Date.now()) throw new Error('Your session expired. Open LoCal again.');

  var who = {email: String(info.email).toLowerCase()};
  cache.put(key, JSON.stringify(who), Math.min(CACHE_SECONDS, Math.max(60, Number(info.expires_in) || 60)));
  return who;
}

/* ---------- the allowlist ---------- */

/**
 * The allowlist sheet. Uses the first tab unless ACCESS_TAB names one, so whatever the
 * sheet's tab happens to be called works without configuring anything.
 */
function accessSheet_() {
  var id = prop_('ACCESS_SHEET_ID');
  if (!id) throw new Error('This proxy has no ACCESS_SHEET_ID set.');
  var ss = SpreadsheetApp.openById(id);
  var sh = ACCESS_TAB ? ss.getSheetByName(ACCESS_TAB) : ss.getSheets()[0];
  if (!sh) sh = ss.getSheets()[0];
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, ACCESS_COLS.length).setValues([['Email', 'Status']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Finds the email and status columns by their header text, so the sheet can be laid out
 * however the owner likes and the headers can be capitalised or not.
 */
function accessCols_(sh) {
  var width = Math.max(1, sh.getLastColumn());
  var head = sh.getRange(1, 1, 1, width).getDisplayValues()[0].map(function (h) {
    return String(h || '').trim().toLowerCase();
  });
  var find = function (names) {
    for (var i = 0; i < head.length; i++) if (names.indexOf(head[i]) >= 0) return i + 1;
    return 0;
  };
  var email = find(['email', 'e-mail', 'email address', 'address']);
  var status = find(['status', 'state', 'approved']);
  if (!email) throw new Error('The access sheet has no "Email" column in row 1.');
  if (!status) throw new Error('The access sheet has no "Status" column in row 1.');
  return {email: email, status: status, width: width};
}

/* The owner types the status by hand, so accept the obvious words for each, in any case. */
var APPROVED_WORDS = ['approved', 'approve', 'allowed', 'allow', 'yes', 'y', 'ok', 'okay', 'active'];
var DENIED_WORDS = ['denied', 'deny', 'blocked', 'block', 'no', 'n', 'removed', 'revoked'];
function normStatus_(v) {
  var s = String(v || '').trim().toLowerCase();
  if (APPROVED_WORDS.indexOf(s) >= 0) return 'approved';
  if (DENIED_WORDS.indexOf(s) >= 0) return 'denied';
  return 'pending';
}

/** 'approved', 'pending', 'denied' or 'none'. Cached briefly so a photo doesn't wait on a read. */
function accessStatus_(email) {
  var cache = CacheService.getScriptCache(), key = 'acc_' + email;
  var hit = cache.get(key);
  if (hit) return hit;

  var sh = accessSheet_(), c = accessCols_(sh), n = sh.getLastRow() - 1, status = 'none';
  if (n > 0) {
    var rows = sh.getRange(2, 1, n, c.width).getDisplayValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][c.email - 1]).trim().toLowerCase() === email) {
        status = normStatus_(rows[i][c.status - 1]);
        break;
      }
    }
  }
  // Only a settled answer is worth caching; a pending row changes the moment you approve it.
  if (status === 'approved' || status === 'denied') cache.put(key, status, CACHE_SECONDS);
  return status;
}

function setStatus_(email, status) {
  var sh = accessSheet_(), c = accessCols_(sh), n = sh.getLastRow() - 1;
  email = String(email).trim().toLowerCase();
  if (n > 0) {
    var rows = sh.getRange(2, 1, n, c.width).getDisplayValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][c.email - 1]).trim().toLowerCase() === email) {
        sh.getRange(i + 2, c.status).setValue(status);
        CacheService.getScriptCache().remove('acc_' + email);
        return;
      }
    }
  }
  addRow_(sh, c, email, status);
  CacheService.getScriptCache().remove('acc_' + email);
}

/** Writes a row with the email and status in whichever columns they live in. */
function addRow_(sh, c, email, status) {
  var row = sh.getLastRow() + 1;
  sh.getRange(row, c.email).setValue(email);
  sh.getRange(row, c.status).setValue(status);
}

/** Counts today's new requests; false once the day's allowance is used. Runs under the script lock. */
function underDailyCap_() {
  var today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  var c = {}; try { c = JSON.parse(prop_('REQUESTS_TODAY') || '{}'); } catch (e) { c = {}; }
  var n = c.day === today ? Number(c.n) || 0 : 0;
  if (n >= MAX_NEW_REQUESTS_PER_DAY) return false;
  setProp_('REQUESTS_TODAY', JSON.stringify({day: today, n: n + 1}));
  return true;
}

function requestAccess_(email) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return; }
  try {
    if (accessStatus_(email) !== 'none') return;
    if (!underDailyCap_()) { console.warn('Access request from ' + email + ' not recorded: ' + MAX_NEW_REQUESTS_PER_DAY + ' new requests already today.'); return; }
    var sh = accessSheet_();
    addRow_(sh, accessCols_(sh), email, 'pending');
    notifyOwner_(email);
  } finally { lock.releaseLock(); }
}

/* ---------- email ---------- */

function owner_() { return prop_('OWNER_EMAIL') || Session.getEffectiveUser().getEmail(); }

function sign_(email) {
  var secret = prop_('APPROVE_SECRET');
  if (!secret) {   // made once, kept in Script Properties; never a value someone could guess
    secret = Utilities.getUuid() + Utilities.getUuid();
    setProp_('APPROVE_SECRET', secret);
  }
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(String(email).toLowerCase(), secret)).slice(0, 32);
}

function notifyOwner_(email) {
  var url = ScriptApp.getService().getUrl() + '?email=' + encodeURIComponent(email) + '&sig=' + encodeURIComponent(sign_(email));
  try {
    MailApp.sendEmail({
      to: owner_(),
      subject: 'LoCal: ' + email + ' wants access',
      htmlBody: '<p><b>' + html_(email) + '</b> signed in to LoCal and is waiting for you.</p>' +
        '<p><a href="' + html_(url) + '">Review this request</a></p>' +
        '<p style="color:#888;font-size:12px">Opening the link shows a confirmation step, so nothing is approved just by following it.</p>'
    });
  } catch (e) { console.error('Approval request email to the owner failed: ' + e.message + '. Run testEmail once from the editor.'); }  // logged, never fatal
}

function notifyApproved_(email) {
  try {
    MailApp.sendEmail({to: email, subject: 'LoCal is ready for you',
      htmlBody: '<p>You\'ve been approved. Open LoCal again and it will work.</p>'});
  } catch (e) { console.error('Approval email to ' + email + ' failed: ' + e.message); }
}

/**
 * Run this once from the editor (choose testEmail, press Run). It sends you a test email, and if
 * Apps Script hasn't been allowed to send email yet, the run asks for that permission first.
 * After approving, deploy a new version so the web app uses the new permission.
 */
function testEmail() {
  var to = owner_();
  MailApp.sendEmail({to: to, subject: 'LoCal: test email', htmlBody: '<p>Approval requests will reach you at this address.</p>'});
  Logger.log('Sent a test email to ' + to + '. Emails left today: ' + MailApp.getRemainingDailyQuota());
}

/* ---------- dispatch ---------- */

/**
 * Keeps every request to the size and shape the app sends. Approved accounts are trusted friends,
 * but a stolen sign-in or a curious friend shouldn't be able to use your key as a general-purpose
 * Gemini: text is clipped, photos must be photos, and nothing arrives that the app wouldn't send.
 */
function clip_(v, n) { return String(v == null ? '' : v).slice(0, n); }
function cleanHints_(h) {
  var d = h && Array.isArray(h.dishes) ? h.dishes : [];
  return {dishes: d.slice(0, 40).map(function (x) { return clip_(x, 160); })};
}

function run_(action, p) {
  if (!p || typeof p !== 'object') p = {};
  if (action === 'analyzePhoto') {
    if (typeof p.image !== 'string' || !p.image) throw new Error('No photo.');
    if (p.image.length > MAX_IMAGE_CHARS) throw new Error('That photo is too large. Try again with a smaller one.');
    if (!/^[A-Za-z0-9+\/=]+$/.test(p.image)) throw new Error('That photo couldn\'t be read.');
    var mime = IMAGE_MIMES.indexOf(String(p.mime || 'image/jpeg').toLowerCase()) >= 0 ? String(p.mime || 'image/jpeg').toLowerCase() : 'image/jpeg';
    p = {image: p.image, mime: mime, mode: p.mode, note: clip_(p.note, 500), hints: cleanHints_(p.hints)};
    // 'auto' (the current page) lets the model decide; 'label' and 'meal' keep older pages working.
    return p.mode === 'label' ? readLabel_(p) : p.mode === 'meal' ? estimateMeal_(p) : analyzeImage_(p);
  }
  if (action === 'analyzeText') {
    if (!String(p.text || '').trim()) throw new Error('NO_FOOD');
    return estimateMeal_({description: clip_(p.text, 1500), hints: cleanHints_(p.hints)});
  }
  if (action === 'analyzeItem') {
    return analyzeItem({name: clip_(p.name, 120), serving_unit: clip_(p.serving_unit, 30), grams_per_unit: Number(p.grams_per_unit) || 0,
      quantity: Number(p.quantity) || 1, category: clip_(p.category, 30), note: clip_(p.note, 500)});
  }
  if (action === 'adjustTargets') {
    if (!String(p.notes || '').trim()) throw new Error('NO_NOTES');
    // the profile and targets as numbers and known words only; the notes clipped
    var pr = p.profile || {}, bs = p.base || {}, n = function (v, lo, hi) { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null; };
    var words = function (v, ok) { return ok.indexOf(String(v)) >= 0 ? String(v) : ok[0]; };
    return adjustTargets({
      profile: {age: n(pr.age, 10, 110), sex: words(pr.sex, ['Male', 'Female']), height_cm: n(pr.height, 100, 250), weight: n(pr.weight, 25, 400),
        activity: words(pr.activity, ['Light', 'Desk job', 'Moderate', 'Very active']), goal: words(pr.goal, ['Lose', 'Keep', 'Gain']),
        target_weight_kg: n(pr.target_weight, 25, 400), pace_kg_per_week: n(pr.pace, 0, 1.5)},
      base: {kcal: n(bs.kcal, 800, 6000), maintenance: n(bs.maintenance, 800, 7000), protein_g: n(bs.protein_g, 0, 500), carbs_g: n(bs.carbs_g, 0, 900), fat_g: n(bs.fat_g, 0, 400),
        fiber_min_g: n(bs.fiber_min_g, 0, 100), sugar_max_g: n(bs.sugar_max_g, 0, 300), sodium_max_mg: n(bs.sodium_max_mg, 0, 9000)},
      notes: clip_(p.notes, 600)
    });
  }
  if (action === 'weeklySummary') {
    // The week's numbers, in the shape the app sends: numbers, dates, and up to 7 days. Nothing else.
    var num = function (v) { return typeof v === 'number' && isFinite(v) ? v : null; };
    var day = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null; };
    var n = {};
    Object.keys(p).slice(0, 40).forEach(function (k) {
      if (num(p[k]) !== null) n[clip_(k, 40)] = p[k];
      else if (day(p[k])) n[clip_(k, 40)] = p[k];
    });
    n.days = (Array.isArray(p.days) ? p.days : []).slice(0, 7).map(function (d) {
      d = d || {};
      return {date: day(d.date), weekday: clip_(d.weekday, 10), kcal: num(d.kcal), target: num(d.target), protein: num(d.protein), status: clip_(d.status, 10)};
    });
    return weeklySummary(n);
  }
  throw new Error('Unknown action.');
}

/* ---------- plumbing ---------- */

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }

function html_(s) { return String(s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function page_(title, body) {
  return HtmlService.createHtmlOutput(
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font:16px/1.5 -apple-system,system-ui,sans-serif;margin:0;padding:32px 24px;background:#17181D;color:#EFEAE5}' +
    'h1{font-size:22px;margin:0 0 12px}.b{display:inline-block;margin:8px 10px 0 0;padding:12px 20px;border-radius:14px;' +
    'background:#F08A0C;color:#2A1600;text-decoration:none;font-weight:600}.b.no{background:#3A3D46;color:#EFEAE5}</style>' +
    '<h1>' + title + '</h1>' + body).setTitle('LoCal');
}
