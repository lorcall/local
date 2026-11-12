// Loads the real web build in Chromium with Google's services stubbed, and reports
// every console line, page error and unhandled rejection, plus what the screen shows.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = require('path').join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const type = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/json'}[path.extname(p)] || 'application/octet-stream';
  res.writeHead(200, {'Content-Type': type}); fs.createReadStream(p).pipe(res);
}).listen(8765);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const log = [];
  page.on('console', m => log.push('[console.' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => log.push('[pageerror] ' + e.message));
  page.on('requestfailed', r => log.push('[requestfailed] ' + r.url().slice(0, 90)));

  // Stub Google Identity Services: hand back a token straight away, as a signed-in user would get.
  await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', e => console.error('UNHANDLED REJECTION: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
    window.google = { accounts: { oauth2: { initTokenClient: (cfg) => ({
      callback: cfg.callback,
      requestAccessToken() { setTimeout(() => this.callback({ access_token: 'fake-token', expires_in: 3600 }), 50); }
    }) } } };
  });
  await page.route('https://accounts.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', r => r.fulfill({ status: 404, body: '' }));

  // Stub Drive + Sheets with a brand-new user: nothing exists yet.
  const calls = [];
  await page.route(/script\.google\.com\/macros/, r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({result: {approved: true, email: 'a@b.c'}})}));  // approval check
  await page.route(/googleapis\.com/, async route => {
    const req = route.request(), u = req.url(), m = req.method();
    calls.push(m + ' ' + u.replace(/https:\/\/[^/]+/, '').slice(0, 110));
    const j = (o, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.includes('/drive/v3/files?q=')) return j({ files: [] });
    if (u.includes('/drive/v3/files?fields=id') && m === 'POST') return j({ id: 'folder-' + calls.length });
    if (u.includes('/drive/v3/files/') && m === 'PATCH') return j({ id: 'x' });
    if (u.includes('/drive/v3/files/')) return j({ id: 'x', trashed: false });
    if (/spreadsheets$/.test(u.split('?')[0]) && m === 'POST') return j({ spreadsheetId: 'sheet-1' });
    if (u.includes('?fields=sheets.properties')) return j({ sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] });
    if (u.includes(':batchUpdate') && !u.includes('/values')) return j({ replies: [] });
    if (u.includes('values:batchGet')) {
      const n = (u.match(/ranges=/g) || []).length;
      return j({ valueRanges: Array.from({ length: n }, () => ({ values: [] })) });
    }
    if (u.includes('/values:batchUpdate')) return j({});
    if (u.includes(':append')) return j({ updates: { updatedRange: 'X!A2:Z2' } });
    if (u.includes('/values/')) return j({ values: [] });
    return j({});
  });

  await page.goto('http://localhost:8765/web/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  if (await page.$('#go')) await page.click('#go');
  await page.waitForTimeout(6000);
  const shown = await page.evaluate(() => document.getElementById('app').innerText.replace(/\s+/g, ' ').trim().slice(0, 300));
  await page.screenshot({ path: 'shot.png' });

  console.log('=== SCREEN ===\n' + shown);
  console.log('\n=== ERRORS / CONSOLE ===\n' + (log.join('\n') || '(none)'));
  console.log('\n=== GOOGLE API CALLS (' + calls.length + ') ===\n' + calls.join('\n'));
  await browser.close(); server.close();
})();
