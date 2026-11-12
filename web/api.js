/**
 * web/api.js — WebAPI(): the browser-side implementation of LoCal's server interface.
 *
 * The Apps Script build calls server functions with google.script.run. This build has no
 * server of its own: it talks to Google's APIs directly, as the signed-in user, and keeps
 * nothing. Each person's meals live in their own Sheet, in their own Drive.
 *
 *   data   -> Sheets API, on a spreadsheet this app created in the user's Drive
 *   photos -> Drive API, in the user's own LoCal App/LoCal photos folder
 *   AI     -> the Apps Script proxy, which holds the one Gemini key server-side
 *
 * Scope is drive.file only: this app can touch the files it created and nothing else in
 * the user's Drive. That is deliberate, and it is what keeps the consent screen honest.
 *
 * Fill in CONFIG below before deploying.
 */

const CONFIG = {
  // Google Cloud Console > Credentials > OAuth client ID (Web application).
  // Authorized JavaScript origin must include this page's origin exactly.
  CLIENT_ID: '554886238264-huc53raj9j242imk8k59fpdsjba9lu0q.apps.googleusercontent.com',
  // The Apps Script proxy deployment URL, ending in /exec. Holds the Gemini key.
  PROXY_URL: 'https://script.google.com/macros/s/AKfycbyUHWXJ3jWn8mweIOyHi2UY_UdBhCbw64QaAYZgzM08tjKKemlVmswbDgskYWl885MR/exec'
};

/** Shows progress on the boot screen. A stalled step should say which step it is. */
function status(msg) {
  try {
    // The boot markup is <div class="boot"><logo tile/><span>message</span></div>, and the
    // logo tile contains spans of its own, so only a direct child is the message.
    const el = document.querySelector('#app .boot > span');
    if (el) el.textContent = msg;
  } catch (e) { /* the app may have rendered already */ }
}

/** Rejects rather than hanging. Without this a request that never answers spins forever. */
function withTimeout(promise, ms, what) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(what + ' timed out after ' + Math.round(ms / 1000) + 's.')), ms); })
  ]);
}

const DRIVE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPES = 'openid email https://www.googleapis.com/auth/drive.file';
const APP_FOLDER = 'LoCal App';
const PHOTO_FOLDER = 'LoCal photos';
const SHEET_NAME = 'LoCal log';
const STORE_KEY = 'local-web-ids-v1';

/* The tabs and their columns. Must match sheets.gs so a Sheet works with either build.
   Named SHEET_TABS, not TABS: this file shares a global scope with the app bundle, which
   declares its own TABS, and two const declarations of one name is a SyntaxError that
   stops the whole bundle executing. */
const SHEET_TABS = {
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
const KEY_COL = {Meals: 'meal_id', Entries: 'entry_id', Favorites: 'food_id', Targets: 'effective_date', Weight: 'date', Settings: 'key'};

/* ---------- auth (module scope) ----------
   Google gives a browser-only app an access token (about an hour) and no refresh token, and
   getting a new one opens a popup, which Safari only allows straight from a tap. So:
   - the token is kept in localStorage until it expires, so a refresh or a reopen within the
     hour goes straight in instead of asking again;
   - sign-in never forces the consent screen (prompt '' asks only the first time), and passes
     the last account as a hint so Google can skip the account chooser;
   - when the token runs out mid-session, a "Continue" button appears, because a tap is the
     only thing Safari will open the renewal popup from. Calls wait for it rather than fail.
   The shell signs in before loading the app bundle for the same reason: boot() asks for data
   the moment it runs, which is too late to be "from a tap". */
const TOKEN_KEY = 'local-web-token-v1';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
let token = null, tokenExp = 0, tokenClient = null, hint = '', pending = null, asking = null;

(function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (!saved) return;
    hint = saved.hint || '';
    if (saved.token && saved.exp > Date.now()) { token = saved.token; tokenExp = saved.exp; }
  } catch (e) { /* storage blocked: sign in each visit */ }
})();
function persist() {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify({token: token, exp: tokenExp, hint: hint})); } catch (e) { /* private mode */ }
}
function forget() { token = null; tokenExp = 0; persist(); }
const haveToken = () => !!token && Date.now() < tokenExp;

const gisReady = () => new Promise((resolve, reject) => {
  if (window.google && google.accounts && google.accounts.oauth2) return resolve();
  let waited = 0;
  const t = setInterval(() => {
    if (window.google && google.accounts && google.accounts.oauth2) { clearInterval(t); resolve(); }
    else if ((waited += 100) > 10000) { clearInterval(t); reject(new Error('Google sign-in didn\'t load. Check your connection and reload.')); }
  }, 100);
});

/** Remembers which account signed in, so the next sign-in can skip the account chooser. */
async function learnHint() {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {headers: {Authorization: 'Bearer ' + token}});
    if (r.ok) { const j = await r.json(); if (j.email) { hint = j.email; persist(); } }
  } catch (e) { /* only a convenience */ }
}

/** Opens Google's sign-in. Call it from a tap: Safari blocks the popup otherwise. */
async function signIn() {
  if (!CONFIG.CLIENT_ID) throw new Error('This copy of LoCal has no Google client ID set. See web/api.js.');
  await gisReady();
  if (!tokenClient) {
    // One client for the page; each request's outcome is routed to whichever sign-in is waiting.
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID, scope: SCOPES, prompt: '', hint: hint, login_hint: hint,
      callback: r => { if (pending) pending.ok(r); },
      error_callback: e => { if (pending) pending.fail(e); }
    });
  }
  return withTimeout(new Promise((resolve, reject) => {
    pending = {
      ok: r => {
        pending = null;
        if (r.error) return reject(new Error(r.error === 'access_denied' ? 'LoCal needs permission to keep your log in your own Drive.' : String(r.error)));
        const o = google.accounts.oauth2;
        if (o.hasGrantedAllScopes && !o.hasGrantedAllScopes(r, DRIVE_SCOPE)) {
          return reject(new Error('LoCal needs the Google Drive permission ticked to keep your log. Try again and leave it ticked.'));
        }
        token = r.access_token;
        tokenExp = Date.now() + (Number(r.expires_in || 3600) - 120) * 1000; // renew a little early
        persist();
        learnHint();
        resolve(token);
      },
      fail: e => {
        pending = null;
        const type = e && e.type;
        reject(new Error(type === 'popup_failed_to_open' ? 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'
          : type === 'popup_closed' ? 'The sign-in window was closed before it finished.'
          : 'Google sign-in didn\'t finish. Try again.'));
      }
    };
    try { tokenClient.requestAccessToken({prompt: ''}); } catch (e) { pending = null; reject(e); }
  }), 120000, 'Google sign-in');
}

/**
 * A token for the next request. When the current one has run out, every waiting call shares
 * one "Continue" prompt and carries on after the tap, instead of failing mid-save.
 */
async function auth() {
  if (haveToken()) return token;
  if (asking) return asking;
  asking = new Promise(resolve => {
    const box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'reauth-title');
    box.style.cssText = 'position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:24px;' +
      'background:rgba(23,24,29,.86);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)';
    box.innerHTML = '<div style="max-width:340px;width:100%;text-align:center;color:#ECEDF2">' +
      '<p id="reauth-title" style="margin:0 0 6px;font-size:18px;font-weight:500">Still there?</p>' +
      '<p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#A2A7B6">Google signs browser apps out after about an hour. ' +
      'Tap to carry on where you left off.</p>' +
      '<button type="button" style="width:100%;min-height:52px;border:0;border-radius:16px;font-family:inherit;font-size:16px;font-weight:600;color:#2A1600;' +
      'background:radial-gradient(120% 160% at 35% 20%,#FFC46E,#F08A0C 70%)">Continue</button>' +
      '<p role="alert" style="margin:10px 0 0;min-height:18px;font-size:13px;color:#FF8E8E"></p></div>';
    document.body.appendChild(box);
    const btn = box.querySelector('button'), err = box.querySelector('[role=alert]');
    btn.focus();
    btn.onclick = async () => {
      btn.disabled = true;
      err.textContent = '';
      try { await signIn(); box.remove(); asking = null; resolve(token); }
      catch (e) { btn.disabled = false; err.textContent = (e && e.message) || 'Sign-in failed. Try again.'; }
    };
  });
  return asking;
}

/** The shell uses these to decide whether to show the sign-in screen at all. */
window.LoCalAuth = {
  signIn: signIn,
  signedIn: haveToken,
  returning: () => !!hint,
  configured: () => !!CONFIG.CLIENT_ID
};

function WebAPI() {
  /** One fetch wrapper for every Google call: adds the token, retries once past a 401. */
  async function call(url, opt = {}, retry = true) {
    const t = await auth();
    const headers = Object.assign({Authorization: 'Bearer ' + t}, opt.headers || {});
    const res = await withTimeout(fetch(url, Object.assign({}, opt, {headers})), 25000, 'Google ' + (url.indexOf('sheets') > -1 ? 'Sheets' : 'Drive'));
    if (res.status === 401 && retry) { forget(); return call(url, opt, false); } // auth() asks for a tap
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = (j.error && (j.error.message || j.error.status)) || ''; } catch (e) { /* non-JSON error */ }
      if (res.status === 403 && /quota|rate/i.test(detail)) throw new Error('Google is rate-limiting this account. Wait a minute and try again.');
      throw new Error('Google API ' + res.status + (detail ? ': ' + detail : ''));
    }
    return res.status === 204 ? null : res.json();
  }

  const json = (url, body, method = 'POST') =>
    call(url, {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});

  /* ---------- the user's own files ---------- */
  let ids = {sheet: '', photos: '', app: ''}, gids = {}, headers = {}, index = {};

  const loadIds = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {}; } catch (e) { return {}; } };
  const saveIds = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(ids)); } catch (e) { /* private mode */ } };

  const alive = async id => {
    if (!id) return false;
    try { const f = await call(DRIVE + '/files/' + id + '?fields=id,trashed'); return !!f && !f.trashed; } catch (e) { return false; }
  };

  /** drive.file only ever lists files this app made, so a name search here is safe and narrow. */
  async function findByName(name, mime, parent) {
    const q = ["name='" + name.replace(/'/g, "\\'") + "'", 'trashed=false', "mimeType='" + mime + "'"];
    if (parent) q.push("'" + parent + "' in parents");
    const r = await call(DRIVE + '/files?q=' + encodeURIComponent(q.join(' and ')) + '&fields=files(id,name)&pageSize=10');
    return (r.files && r.files[0] && r.files[0].id) || '';
  }

  const createFolder = (name, parent) => json(DRIVE + '/files?fields=id', {
    name, mimeType: 'application/vnd.google-apps.folder', parents: parent ? [parent] : undefined
  });

  /**
   * Finds or builds LoCal App/ with the Sheet and the photos folder inside it.
   * Everything this app makes lives in that one folder, so a user's Drive stays tidy.
   */
  async function ensureFiles() {
    const saved = loadIds();
    ids = {sheet: saved.sheet || '', photos: saved.photos || '', app: saved.app || ''};

    status('Looking for your LoCal App folder');
    if (!(await alive(ids.app))) ids.app = await findByName(APP_FOLDER, 'application/vnd.google-apps.folder');
    if (!ids.app) ids.app = (await createFolder(APP_FOLDER)).id;

    status('Looking for your log');
    if (!(await alive(ids.sheet))) ids.sheet = await findByName(SHEET_NAME, 'application/vnd.google-apps.spreadsheet');
    if (!ids.sheet) {
      const ss = await json(SHEETS, {properties: {title: SHEET_NAME}});
      ids.sheet = ss.spreadsheetId;
      // Sheets API creates in Drive root; move it into the app folder.
      await call(DRIVE + '/files/' + ids.sheet + '?addParents=' + ids.app + '&removeParents=root&fields=id', {method: 'PATCH'});
    }

    if (!(await alive(ids.photos))) ids.photos = await findByName(PHOTO_FOLDER, 'application/vnd.google-apps.folder', ids.app)
      || await findByName(PHOTO_FOLDER, 'application/vnd.google-apps.folder');
    if (!ids.photos) ids.photos = (await createFolder(PHOTO_FOLDER, ids.app)).id;

    saveIds();
    status('Setting up the tabs');
    await ensureTabs();
  }

  /** Creates missing tabs and writes any missing header columns. Safe to run every load. */
  async function ensureTabs() {
    const meta = await call(SHEETS + '/' + ids.sheet + '?fields=sheets.properties(sheetId,title)');
    const have = {};
    (meta.sheets || []).forEach(s => { have[s.properties.title] = s.properties.sheetId; });
    gids = have;

    const adds = Object.keys(SHEET_TABS).filter(t => !(t in have)).map(title => ({addSheet: {properties: {title}}}));
    if (adds.length) {
      const r = await json(SHEETS + '/' + ids.sheet + ':batchUpdate', {requests: adds});
      (r.replies || []).forEach(rep => { if (rep.addSheet) gids[rep.addSheet.properties.title] = rep.addSheet.properties.sheetId; });
    }

    // Header rows: read what is there, write only the tabs that are missing columns.
    const ranges = Object.keys(SHEET_TABS).map(t => encodeURIComponent(t + '!1:1')).join('&ranges=');
    const got = await call(SHEETS + '/' + ids.sheet + '/values:batchGet?ranges=' + ranges);
    const writes = [];
    Object.keys(SHEET_TABS).forEach((tab, i) => {
      const row = ((got.valueRanges[i] || {}).values || [])[0] || [];
      headers[tab] = row.map(String).filter(Boolean);
      const missing = SHEET_TABS[tab].filter(c => headers[tab].indexOf(c) < 0);
      if (!missing.length) return;
      headers[tab] = headers[tab].concat(missing);
      writes.push({range: tab + '!A1', values: [headers[tab]]});
    });
    if (writes.length) await json(SHEETS + '/' + ids.sheet + '/values:batchUpdate', {valueInputOption: 'RAW', data: writes}, 'POST');

    // Drop the default Sheet1 a brand new spreadsheet comes with.
    if ('Sheet1' in gids && Object.keys(gids).length > 1) {
      try { await json(SHEETS + '/' + ids.sheet + ':batchUpdate', {requests: [{deleteSheet: {sheetId: gids.Sheet1}}]}); delete gids.Sheet1; } catch (e) { /* fine */ }
    }
  }

  /* ---------- reading ---------- */
  const colLetter = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; };

  /** Rows as objects, keyed by header name, with the sheet row number kept for updates. */
  function toObjects(tab, values) {
    const head = headers[tab], out = [];
    index[tab] = {};
    (values || []).slice(1).forEach((row, i) => {
      if (!row.some(v => v !== '' && v != null)) return;
      const o = {};
      head.forEach((h, c) => { if (h) o[h] = row[c] == null ? '' : row[c]; });
      const k = o[KEY_COL[tab]];
      if (k !== '' && k != null) index[tab][String(k)] = i + 2; // 1-based, past the header
      out.push(o);
    });
    return out;
  }

  /**
   * Reads every tab. Meal thumbnails are skipped here: they are data URLs up to 45 KB each,
   * so pulling them for a year of meals would make opening the app a multi-megabyte download.
   * getThumbs fetches only the ones actually on screen.
   */
  async function readAll() {
    const thumbAt = headers.Meals.indexOf('thumb');
    const mealRanges = [];
    if (thumbAt < 0) mealRanges.push('Meals!A:' + colLetter(headers.Meals.length - 1));
    else {
      if (thumbAt > 0) mealRanges.push('Meals!A:' + colLetter(thumbAt - 1));
      if (thumbAt < headers.Meals.length - 1) mealRanges.push('Meals!' + colLetter(thumbAt + 1) + ':' + colLetter(headers.Meals.length - 1));
    }
    const others = Object.keys(SHEET_TABS).filter(t => t !== 'Meals');
    const ranges = mealRanges.concat(others.map(t => t + '!A:' + colLetter(headers[t].length - 1)));
    const got = await call(SHEETS + '/' + ids.sheet + '/values:batchGet?majorDimension=ROWS&ranges=' + ranges.map(encodeURIComponent).join('&ranges='));

    // Stitch the two meal slices back into whole rows, leaving the thumb column blank.
    const mealVals = [];
    const parts = got.valueRanges.slice(0, mealRanges.length).map(v => v.values || []);
    const rowCount = Math.max(...parts.map(p => p.length), 0);
    for (let r = 0; r < rowCount; r++) {
      let row = [];
      parts.forEach((p, pi) => {
        const seg = p[r] || [];
        if (thumbAt >= 0 && pi === 1) row = row.concat(['']); // the skipped thumb cell
        row = row.concat(seg);
      });
      if (thumbAt >= 0 && parts.length === 1 && thumbAt === headers.Meals.length - 1) row = row.concat(['']);
      mealVals.push(row);
    }

    const data = {meals: toObjects('Meals', mealVals)};
    others.forEach((t, i) => {
      const vals = (got.valueRanges[mealRanges.length + i] || {}).values || [];
      const rows = toObjects(t, vals);
      if (t === 'Settings') { data.settings = {}; rows.forEach(r => { if (r.key) data.settings[r.key] = r.value; }); }
      else data[t.toLowerCase()] = rows;
    });
    data.meals.forEach(m => { m.has_thumb = String(m.photo_url || '') !== '' || m.has_thumb === true; });
    return data;
  }

  /* ---------- writing ---------- */
  const cellsFor = (tab, obj, existing) => headers[tab].map((h, i) =>
    obj.hasOwnProperty(h) ? (obj[h] == null ? '' : obj[h]) : (existing ? (existing[i] == null ? '' : existing[i]) : ''));

  async function upsert(tab, obj) {
    const key = String(obj[KEY_COL[tab]]);
    const row = index[tab] && index[tab][key];
    const last = colLetter(headers[tab].length - 1);
    if (row) {
      const cur = await call(SHEETS + '/' + ids.sheet + '/values/' + encodeURIComponent(tab + '!A' + row + ':' + last + row));
      const existing = (cur.values || [[]])[0];
      await json(SHEETS + '/' + ids.sheet + '/values/' + encodeURIComponent(tab + '!A' + row + ':' + last + row) + '?valueInputOption=RAW',
        {values: [cellsFor(tab, obj, existing)]}, 'PUT');
    } else {
      const r = await json(SHEETS + '/' + ids.sheet + '/values/' + encodeURIComponent(tab + '!A1') +
        ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&includeValuesInResponse=false', {values: [cellsFor(tab, obj)]});
      const updated = r.updates && r.updates.updatedRange || '';
      const m = updated.match(/!A?(\d+)/);
      if (m) index[tab][key] = Number(m[1]);
    }
    return obj;
  }

  async function appendMany(tab, objs) {
    if (!objs || !objs.length) return;
    const r = await json(SHEETS + '/' + ids.sheet + '/values/' + encodeURIComponent(tab + '!A1') +
      ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {values: objs.map(o => cellsFor(tab, o))});
    const m = (r.updates && r.updates.updatedRange || '').match(/!A?(\d+)/);
    if (m) objs.forEach((o, i) => { index[tab][String(o[KEY_COL[tab]])] = Number(m[1]) + i; });
  }

  /** Deletes whole rows, bottom-up so earlier row numbers stay valid. */
  async function deleteWhere(tab, col, value) {
    const last = colLetter(headers[tab].length - 1);
    const got = await call(SHEETS + '/' + ids.sheet + '/values/' + encodeURIComponent(tab + '!A:' + last));
    const vals = got.values || [];
    const at = headers[tab].indexOf(col);
    const rows = [];
    vals.slice(1).forEach((r, i) => { if (String(r[at] == null ? '' : r[at]) === String(value)) rows.push(i + 2); });
    if (!rows.length) return;
    const requests = rows.sort((a, b) => b - a).map(r => ({
      deleteDimension: {range: {sheetId: gids[tab], dimension: 'ROWS', startIndex: r - 1, endIndex: r}}
    }));
    await json(SHEETS + '/' + ids.sheet + ':batchUpdate', {requests});
    // Row numbers shifted; the next read rebuilds the index, so drop it now rather than guess.
    index[tab] = {};
    const fresh = await call(SHEETS + '/' + ids.sheet + '/values/' + encodeURIComponent(tab + '!A:' + last));
    toObjects(tab, fresh.values || []);
  }

  /* ---------- photos ---------- */
  async function uploadPhoto(b64, mime, name) {
    const boundary = 'local' + Math.random().toString(36).slice(2);
    const meta = {name, parents: [ids.photos], mimeType: mime};
    const body =
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
      '\r\n--' + boundary + '\r\nContent-Transfer-Encoding: base64\r\nContent-Type: ' + mime + '\r\n\r\n' + b64 +
      '\r\n--' + boundary + '--';
    const r = await call(DRIVE_UPLOAD + '/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + boundary}, body
    });
    return r.webViewLink || ('https://drive.google.com/file/d/' + r.id + '/view');
  }

  /* ---------- the AI proxy ---------- */
  // The Gemini key never reaches the browser. The proxy checks this access token, confirms
  // the account is on its allowlist, and calls Gemini itself.
  async function proxy(action, payload) {
    if (!CONFIG.PROXY_URL) throw new Error('NO_KEY');
    const t = await auth();
    // text/plain avoids a CORS preflight, which Apps Script does not answer.
    const res = await withTimeout(fetch(CONFIG.PROXY_URL, {
      method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({action, token: t, payload})
    }), 90000, 'The AI service');
    if (!res.ok) throw new Error('The AI service didn\'t answer (' + res.status + '). Try again in a moment.');
    const j = await res.json();
    if (j.error) throw new Error(j.error);
    if (j.pending) throw new Error('PENDING_APPROVAL');
    return j;
  }

  /* ---------- the interface the app uses ---------- */
  let metaCache = {demo: false, sheetUrl: '', folderUrl: '', hasKey: !!CONFIG.PROXY_URL, model: 'Gemini, free tier', analysesToday: 0};
  const countKey = () => 'local-analyses-' + new Date().toISOString().slice(0, 10);
  const bumpLocal = () => {
    try {
      const n = Number(localStorage.getItem(countKey()) || 0) + 1;
      localStorage.setItem(countKey(), String(n));
      return n;
    } catch (e) { return metaCache.analysesToday + 1; }
  };

  const meta = () => Object.assign({}, metaCache, {
    sheetUrl: ids.sheet ? 'https://docs.google.com/spreadsheets/d/' + ids.sheet + '/edit' : '',
    folderUrl: ids.photos ? 'https://drive.google.com/drive/folders/' + ids.photos : '',
    analysesToday: Number((() => { try { return localStorage.getItem(countKey()) || 0; } catch (e) { return 0; } })())
  });

  return {
    /** Called once at start. Signs in, finds or makes the files, reads everything. */
    async bootstrap() {
      status('Checking your sign-in');
      await auth();
      status('Finding your LoCal files');
      await ensureFiles();
      status('Reading your log');
      const data = await readAll();
      return {data, meta: meta()};
    },
    async setup(seed) {
      await ensureFiles();
      const data = await readAll();
      if (!data.favorites.length && seed && seed.length) {
        await appendMany('Favorites', seed.map(f => Object.assign({}, f, {
          is_local_dish: !!f.is_local_dish, pinned: !!f.pinned, user_corrected: false
        })));
      }
      const defaults = {week_start: 'Monday', units: 'kg and cm'};
      for (const k of Object.keys(defaults)) {
        if (data.settings[k] == null || data.settings[k] === '') await upsert('Settings', {key: k, value: defaults[k]});
      }
      return {data: await readAll(), meta: meta()};
    },
    async saveMeal(p) {
      const meal = Object.assign({}, p.meal);
      if (meal.thumb && String(meal.thumb).length > 45000) meal.thumb = '';
      await upsert('Meals', meal);
      await deleteWhere('Entries', 'meal_id', meal.meal_id);
      const entries = (p.entries || []).map(e => Object.assign({}, e, {meal_id: meal.meal_id}));
      await appendMany('Entries', entries);
      return {meal, entries};
    },
    async deleteMeal(id) {
      await deleteWhere('Meals', 'meal_id', id);
      await deleteWhere('Entries', 'meal_id', id);
      return true;
    },
    async getThumbs(idList) {
      const at = headers.Meals.indexOf('thumb');
      if (at < 0 || !idList || !idList.length) return {};
      const wanted = idList.filter(id => index.Meals && index.Meals[String(id)]).slice(0, 40);
      if (!wanted.length) return {};
      const col = colLetter(at);
      const ranges = wanted.map(id => encodeURIComponent('Meals!' + col + index.Meals[String(id)])).join('&ranges=');
      const got = await call(SHEETS + '/' + ids.sheet + '/values:batchGet?ranges=' + ranges);
      const out = {};
      wanted.forEach((id, i) => {
        const v = (((got.valueRanges[i] || {}).values || [])[0] || [])[0];
        if (v) out[id] = v;
      });
      return out;
    },
    async getPhoto(p) {
      const m = String(p && p.url || '').match(/[-\w]{25,}/);
      if (!m) return null;
      try {
        const t = await auth();
        const res = await fetch(DRIVE + '/files/' + m[0] + '?alt=media', {headers: {Authorization: 'Bearer ' + t}});
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return {data: btoa(bin), mime: res.headers.get('Content-Type') || 'image/jpeg'};
      } catch (e) { return null; }
    },
    async savePhoto(p) {
      const name = (p.mode === 'label' ? 'label' : String(p.meal_type || 'meal').toLowerCase()) + '-' +
        new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19) + '.jpg';
      return uploadPhoto(p.image, p.mime || 'image/jpeg', name);
    },
    async analyzePhoto(p) {
      try {
        const r = await proxy('analyzePhoto', p);
        return {result: r.result, analysesToday: bumpLocal()};
      } catch (e) { return {error: String(e && e.message || e)}; }
    },
    async analyzeText(p) {
      try {
        const r = await proxy('analyzeText', p);
        return {result: r.result, analysesToday: bumpLocal()};
      } catch (e) { return {error: String(e && e.message || e)}; }
    },
    async analyzeItem(p) { const r = await proxy('analyzeItem', p); return r.result; },
    async weeklySummary(n) { const r = await proxy('weeklySummary', n); return r.result; },
    saveFavorite: f => upsert('Favorites', f),
    saveTargets: t => upsert('Targets', t),
    addWeight: w => upsert('Weight', w),
    async saveSettings(obj) {
      for (const k of Object.keys(obj || {})) await upsert('Settings', {key: k, value: obj[k] == null ? '' : String(obj[k])});
      const fresh = await readAll();
      return fresh.settings;
    },
    /** Exposed so the shell can show a sign-in button before bootstrap runs. */
    _signIn: () => signIn(true),
    _signedIn: () => haveToken()
  };
}
