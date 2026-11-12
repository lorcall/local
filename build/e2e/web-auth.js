// Sign-in behaviour of the web build, in Chromium with Google stubbed.
//   A. first visit: one sign-in screen, then the app
//   B. refresh: straight in, no sign-in screen, no new token request
//   C. return after the token expired: "Welcome back", one tap, no consent screen forced
//   D. token rejected mid-load: a Continue prompt appears, and loading resumes after the tap
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const type = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/json'}[path.extname(p)] || 'application/octet-stream';
  res.writeHead(200, {'Content-Type': type}); fs.createReadStream(p).pipe(res);
}).listen(8770);
const URL = 'http://localhost:8770/web/index.html';
let failures = 0;
const check = (ok, what) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + what); if (!ok) failures++; };

async function setup(context, opts = {}) {
  await context.addInitScript(() => {
    window.__gis = {requests: [], inits: []};
    window.google = { accounts: { oauth2: {
      hasGrantedAllScopes: () => true,
      initTokenClient: cfg => { window.__gis.inits.push({prompt: cfg.prompt, hint: cfg.hint}); return {
        requestAccessToken(o) { window.__gis.requests.push(o || {}); setTimeout(() => cfg.callback({access_token: 'tok-' + Date.now(), expires_in: 3600}), 30); }
      }; }
    } } };
  });
  let rejectOnce = !!opts.rejectOnce;
  await context.route('https://accounts.google.com/**', r => r.fulfill({status: 200, contentType: 'text/javascript', body: ''}));
  await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  await context.route(/googleapis\.com/, async route => {
    const u = route.request().url(), m = route.request().method();
    const j = (o, s = 200) => route.fulfill({status: s, contentType: 'application/json', body: JSON.stringify(o)});
    if (u.includes('/oauth2/v3/userinfo')) return j({email: 'person@example.com'});
    if (rejectOnce && u.includes('values:batchGet')) { rejectOnce = false; return j({error: {message: 'expired'}}, 401); }
    if (u.includes('/drive/v3/files?q=')) return j({files: []});
    if (u.includes('/drive/v3/files?fields=id') && m === 'POST') return j({id: 'f' + Math.random().toString(36).slice(2, 7)});
    if (u.includes('/drive/v3/files/')) return j({id: 'x', trashed: false});
    if (/spreadsheets$/.test(u.split('?')[0]) && m === 'POST') return j({spreadsheetId: 'sheet-1'});
    if (u.includes('?fields=sheets.properties')) return j({sheets: [{properties: {title: 'Sheet1', sheetId: 0}}]});
    if (u.includes(':batchUpdate') && !u.includes('/values')) return j({replies: []});
    if (u.includes('values:batchGet')) { const n = (u.match(/ranges=/g) || []).length; return j({valueRanges: Array.from({length: n}, () => ({values: []}))}); }
    if (u.includes(':append')) return j({updates: {updatedRange: 'X!A2:Z2'}});
    return j({});
  });
}
const screen = page => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
const inApp = async page => /Snap a meal|Connect Google account|Today/.test(await screen(page));

(async () => {
  const browser = await chromium.launch();

  console.log('A. first visit');
  const ctx = await browser.newContext();
  await setup(ctx);
  let page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL); await page.waitForTimeout(800);
  check(/Continue with Google/.test(await screen(page)), 'shows one sign-in screen');
  check((await page.evaluate(() => window.__gis.requests.length)) === 0, 'opens no popup before the tap');
  await page.click('#go'); await page.waitForTimeout(2500);
  check(await inApp(page), 'opens the app after the tap');
  const req = await page.evaluate(() => window.__gis.requests[0] || {});
  check(req.prompt === '', 'does not force the consent screen (prompt "")');
  check(await page.evaluate(() => !!JSON.parse(localStorage.getItem('local-web-token-v1') || '{}').token), 'keeps the token');

  console.log('B. refresh within the hour');
  await page.reload(); await page.waitForTimeout(2500);
  check(!/Continue with Google|Welcome back/.test(await screen(page)), 'no sign-in screen');
  check((await page.evaluate(() => window.__gis.requests.length)) === 0, 'no new token request');
  check(await inApp(page), 'straight into the app');

  console.log('C. return after the token expired');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('local-web-token-v1')); s.exp = Date.now() - 1000; localStorage.setItem('local-web-token-v1', JSON.stringify(s)); });
  await page.reload(); await page.waitForTimeout(800);
  check(/Welcome back/.test(await screen(page)), 'says welcome back');
  await page.click('#go'); await page.waitForTimeout(2500);
  check(await inApp(page), 'one tap and in');
  check((await page.evaluate(() => window.__gis.inits[0] || {})).hint === 'person@example.com', 'passes the last account as a hint');
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close();

  console.log('D. token rejected while loading');
  const ctx2 = await browser.newContext();
  await setup(ctx2, {rejectOnce: true});
  page = await ctx2.newPage();
  await page.goto(URL); await page.waitForTimeout(600);
  await page.click('#go'); await page.waitForTimeout(2000);
  check(/Still there\?/.test(await screen(page)), 'shows the Continue prompt instead of failing');
  await page.click('[role=dialog] button'); await page.waitForTimeout(2500);
  check(await inApp(page), 'loading resumes after the tap');
  check((await page.$('[role=dialog]')) === null, 'the prompt goes away');
  await ctx2.close();

  await browser.close(); server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
