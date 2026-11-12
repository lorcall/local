// Approval happens once, at sign-in, against the proxy's LoCal Users sheet.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8796);
let failures = 0;
const check = (ok, what) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + what); if (!ok) failures++; };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(() => { window.google = {accounts: {oauth2: {hasGrantedAllScopes: () => true, initTokenClient: c => ({requestAccessToken() { setTimeout(() => c.callback({access_token: 't', expires_in: 3600}), 20); }})}}}; });
  await ctx.route('https://accounts.google.com/**', r => r.fulfill({status: 200, contentType: 'text/javascript', body: ''}));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  let sheet = 'none', accessCalls = 0, driveCalls = 0;
  await ctx.route(/script\.google\.com\/macros/, r => {
    accessCalls++;
    const body = sheet === 'approved' ? {result: {approved: true, email: 'friend@example.com'}} : {pending: true, denied: sheet === 'denied', error: 'x'};
    if (sheet === 'none') sheet = 'pending';
    r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
  });
  await ctx.route(/googleapis\.com/, route => {
    const u = decodeURIComponent(route.request().url()), j = o => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(o)});
    if (/fonts\.googleapis/.test(u)) return route.fulfill({status: 200, contentType: 'text/css', body: ''});
    if (/oauth2\/v3\/userinfo/.test(u)) return j({email: 'friend@example.com'});
    driveCalls++;
    if (u.includes('/drive/v3/files?q=')) return j({files: [{id: 'e'}]});
    if (u.includes('/drive/v3/files/')) return j({id: 'x', trashed: false});
    if (u.includes('?fields=sheets.properties')) return j({sheets: ['Meals','Entries','Favorites','Targets','Weight','Settings'].map((t, i) => ({properties: {title: t, sheetId: i}}))});
    if (u.includes('values:batchGet')) { const rs = [...u.matchAll(/ranges=([^&]+)/g)].map(x => x[1]); return j({valueRanges: rs.map(() => ({values: []}))}); }
    return j({});
  });
  const page = await ctx.newPage();
  const txt = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  await page.goto('http://localhost:8796/web/index.html'); await page.waitForTimeout(800);
  await page.click('#go'); await page.waitForTimeout(1500);
  check(/sent to the owner/.test(await txt()) && /Check again/.test(await txt()), 'new account: waits for approval after signing in');
  check(driveCalls === 0, 'nothing is opened or created in their Drive before approval');
  await page.click('#go'); await page.waitForTimeout(1200);
  check(/sent to the owner/.test(await txt()), 'still pending: Check again keeps waiting');
  sheet = 'approved';
  await page.click('#go'); await page.waitForTimeout(2500);
  check(/Snap a meal|Connect Google account|Today/.test(await txt()), 'approved: Check again opens the app');
  const before = accessCalls;
  await page.reload(); await page.waitForTimeout(2500);
  check(/Snap a meal|Connect Google account|Today/.test(await txt()) && !/Checking your access|sent to the owner/.test(await txt()), 'next launch opens straight away');
  check(accessCalls === before + 1, 'and re-checks the sheet in the background');
  sheet = 'denied';
  await page.reload(); await page.waitForTimeout(2500);
  check(/Snap a meal|Connect Google account|Today/.test(await txt()), 'removed: this launch still opens (the background check notes it)');
  await page.reload(); await page.waitForTimeout(1800);
  check(/doesn't have access/.test(await txt()), 'removed: the next launch is stopped');
  await browser.close(); server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
