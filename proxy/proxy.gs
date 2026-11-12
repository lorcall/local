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
 * This file calls estimateMeal_, readLabel_, analyzeItem and weeklySummary, so copy gemini.gs
 * into the same project alongside it.
 */

var TOKENINFO = 'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=';
var ACCESS_TAB = '';            // blank: use the spreadsheet's first tab, whatever it is called
var ACCESS_COLS = ['email', 'status'];
var CACHE_SECONDS = 300;

/* ---------- entry point ---------- */

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var who = verify_(req.token); // throws on anything it cannot vouch for

    var status = accessStatus_(who.email);
    if (status !== 'approved') {
      if (status === 'none') requestAccess_(who.email);
      return reply_({pending: true, error: status === 'denied'
        ? 'This account doesn\'t have access to LoCal.'
        : 'Your request is with the owner. You\'ll get an email once it\'s approved.'});
    }

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
    return page_('Approved', p.email + ' can now use LoCal.');
  }
  if (p.confirm === 'no') {
    setStatus_(p.email, 'denied');
    return page_('Declined', p.email + ' has been denied.');
  }
  var base = ScriptApp.getService().getUrl() + '?email=' + encodeURIComponent(p.email) + '&sig=' + encodeURIComponent(p.sig);
  return page_('Approve ' + p.email + '?',
    '<p>They asked to use LoCal. Approving lets them analyse meals with your Gemini key.</p>' +
    '<p><a class="b" href="' + base + '&confirm=1">Approve</a> <a class="b no" href="' + base + '&confirm=no">Decline</a></p>');
}

/* ---------- identity ---------- */

/**
 * Checks the access token with Google and returns {email}.
 * The audience check is the one that matters: without it any valid Google token from any
 * app in the world would open this door. Everything else here is secondary.
 */
function verify_(token) {
  if (!token) throw new Error('Not signed in.');
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
        status = String(rows[i][c.status - 1] || 'pending').trim().toLowerCase() || 'pending';
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

function requestAccess_(email) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return; }
  try {
    if (accessStatus_(email) !== 'none') return;
    var sh = accessSheet_();
    addRow_(sh, accessCols_(sh), email, 'pending');
    notifyOwner_(email);
  } finally { lock.releaseLock(); }
}

/* ---------- email ---------- */

function owner_() { return prop_('OWNER_EMAIL') || Session.getEffectiveUser().getEmail(); }

function sign_(email) {
  var secret = prop_('APPROVE_SECRET') || ScriptApp.getScriptId();
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(String(email).toLowerCase(), secret)).slice(0, 32);
}

function notifyOwner_(email) {
  var url = ScriptApp.getService().getUrl() + '?email=' + encodeURIComponent(email) + '&sig=' + encodeURIComponent(sign_(email));
  try {
    MailApp.sendEmail({
      to: owner_(),
      subject: 'LoCal: ' + email + ' wants access',
      htmlBody: '<p><b>' + email + '</b> signed in to LoCal and is waiting for you.</p>' +
        '<p><a href="' + url + '">Review this request</a></p>' +
        '<p style="color:#888;font-size:12px">Opening the link shows a confirmation step, so nothing is approved just by following it.</p>'
    });
  } catch (e) { /* a failed email must not fail the request */ }
}

function notifyApproved_(email) {
  try {
    MailApp.sendEmail({to: email, subject: 'LoCal is ready for you',
      htmlBody: '<p>You\'ve been approved. Open LoCal again and it will work.</p>'});
  } catch (e) { /* they will find out when it works */ }
}

/* ---------- dispatch ---------- */

function run_(action, p) {
  if (action === 'analyzePhoto') {
    if (!p.image) throw new Error('No photo.');
    return p.mode === 'label' ? readLabel_(p) : estimateMeal_(p);
  }
  if (action === 'analyzeText') {
    if (!String(p.text || '').trim()) throw new Error('NO_FOOD');
    return estimateMeal_({description: String(p.text).slice(0, 1500), hints: p.hints});
  }
  if (action === 'analyzeItem') return analyzeItem(p);
  if (action === 'weeklySummary') return weeklySummary(p);
  throw new Error('Unknown action.');
}

/* ---------- plumbing ---------- */

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

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
