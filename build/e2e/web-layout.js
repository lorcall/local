// With real scrollbars showing (headless hides them by default): opening a tall screen adds a
// scrollbar, and the app and tab bar must not move sideways, nor the page scroll sideways.
const { chromium } = require('playwright');
let failures = 0;
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8795);
const TABS = {Settings: [['key','value'],['onboarded','yes']], Targets: [['effective_date','kcal'],['2026-01-01','1750']]};
(async () => {
  const browser = await chromium.launch({ignoreDefaultArgs: ['--hide-scrollbars']});
  for (const W of [1000, 445]) {
    const ctx = await browser.newContext({viewport: {width: W, height: 1100}});
    await ctx.addInitScript(() => {
      localStorage.setItem('local-web-token-v1', JSON.stringify({token: 'tok', exp: Date.now() + 3e6, hint: 'a@b.c'}));
      window.google = {accounts: {oauth2: {hasGrantedAllScopes: () => true, initTokenClient: c => ({requestAccessToken() { c.callback({access_token: 't', expires_in: 3600}); }})}}};
    });
    await ctx.route('https://accounts.google.com/**', r => r.fulfill({status: 200, contentType: 'text/javascript', body: ''}));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
    await ctx.route(/googleapis\.com/, route => {
      const u = decodeURIComponent(route.request().url()), j = o => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(o)});
      if (u.includes('/drive/v3/files?q=')) return j({files: [{id: 'e'}]});
      if (u.includes('/drive/v3/files/')) return j({id: 'x', trashed: false});
      if (u.includes('?fields=sheets.properties')) return j({sheets: ['Meals','Entries','Favorites','Targets','Weight','Settings'].map((t, i) => ({properties: {title: t, sheetId: i}}))});
      if (u.includes('values:batchGet')) { const rs = [...u.matchAll(/ranges=([^&]+)/g)].map(x => x[1]); return j({valueRanges: rs.map(r => ({values: /!1:1$/.test(r) ? [] : (TABS[r.split('!')[0]] || [])}))}); }
      return j({});
    });
    const page = await ctx.newPage();
    await page.goto('http://localhost:8795/web/index.html'); await page.waitForTimeout(2000);
    const m = () => page.evaluate(() => { const a = document.getElementById('app').getBoundingClientRect(), tb = document.querySelector('.tabbar'), t = tb ? tb.getBoundingClientRect() : null;
      return {scrollbar: document.documentElement.scrollHeight > document.documentElement.clientHeight, gutter: innerWidth - document.documentElement.clientWidth, appLeft: Math.round(a.left), appMid: Math.round(a.left + a.width / 2), tabMid: t ? Math.round(t.left + t.width / 2) : null, hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth}; });
    const short = await m();
    await page.click('[data-a=tab][data-v=targets]'); await page.waitForTimeout(500);
    await page.evaluate(() => { const f = document.createElement('div'); f.style.height = '1600px'; document.querySelector('.scr').appendChild(f); });  // make sure this screen scrolls
    await page.waitForTimeout(200);
    const tall = await m();
    console.log('window ' + W + 'px');
    console.log('  short screen: scrollbar ' + short.scrollbar + ', app left ' + short.appLeft + ', app middle ' + short.appMid + ', tab bar middle ' + short.tabMid);
    console.log('  tall screen:  scrollbar ' + tall.scrollbar + ' (' + tall.gutter + 'px), app left ' + tall.appLeft + ', app middle ' + tall.appMid + ', tab bar middle ' + tall.tabMid + ', sideways scroll ' + tall.hScroll);
    const ok = short.appLeft === tall.appLeft && !tall.hScroll && (W < 460 || tall.tabMid === tall.appMid);  // under 460px the app narrows to fit instead
    console.log((ok ? '  PASS  ' : '  FAIL  ') + 'nothing moved sideways' + (ok ? '' : ' (app moved ' + (tall.appLeft - short.appLeft) + 'px)'));
    if (!ok) failures++;
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
