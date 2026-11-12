// The trends target line follows the target history: a cut from 1,750 to 1,500 three days ago.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), SHOTS = process.env.SHOTS;
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8793);
let failures = 0;
const check = (ok, what) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + what); if (!ok) failures++; };
const pad = n => String(n).padStart(2, '0'), key = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = off => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + off); return key(d); };
const meals = [['meal_id','date','time','meal_type','photo_url','note','confidence','confidence_reason','source','edited']];
const entries = [['entry_id','meal_id','name','category','serving_unit','grams_per_unit','serving_label','quantity','kcal','protein_g','carbs_g','fat_g','sugar_g','fiber_g','sodium_mg','confidence','edited','reason']];
for (let o = -10; o < 0; o++) { const k = day(o); meals.push(['m' + k, k, '12:00', 'Lunch', '', '', 'high', '', 'photo', 'FALSE']); entries.push(['e' + k, 'm' + k, 'Plate', 'other', 'plate', 400, '', 1, 1600, 60, 200, 50, 10, 5, 800, 'high', 'FALSE', '']); }
const DATA = {Settings: [['key','value'],['onboarded','yes']], Meals: meals, Entries: entries,
  Targets: [['effective_date','kcal','protein_g','carbs_g','fat_g'],['2020-01-01','1750','119','185','58'],[day(-3),'1500','119','150','50']]};
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
  await ctx.addInitScript(() => {
    localStorage.setItem('local-web-token-v1', JSON.stringify({token: 'tok', exp: Date.now() + 3e6, hint: 'a@b.c'}));
    window.google = {accounts: {oauth2: {hasGrantedAllScopes: () => true, initTokenClient: c => ({requestAccessToken() { c.callback({access_token: 't', expires_in: 3600}); }})}}};
  });
  await ctx.route('https://accounts.google.com/**', r => r.fulfill({status: 200, contentType: 'text/javascript', body: ''}));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  await ctx.route(/script\.google\.com\/macros/, r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({result: {approved: true, email: 'a@b.c'}})}));  // approval check
  await ctx.route(/googleapis\.com/, route => {
    const u = decodeURIComponent(route.request().url()), j = o => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(o)});
    if (u.includes('/drive/v3/files?q=')) return j({files: [{id: 'e'}]});
    if (u.includes('/drive/v3/files/')) return j({id: 'x', trashed: false});
    if (u.includes('?fields=sheets.properties')) return j({sheets: ['Meals','Entries','Favorites','Targets','Weight','Settings'].map((t, i) => ({properties: {title: t, sheetId: i}}))});
    if (u.includes('values:batchGet')) { const rs = [...u.matchAll(/ranges=([^&]+)/g)].map(x => x[1]); return j({valueRanges: rs.map(r => ({values: /!1:1$/.test(r) ? [] : (DATA[r.split('!')[0]] || [])}))}); }
    return j({});
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8793/web/index.html'); await page.waitForTimeout(2500);
  await page.click('[data-a=tab][data-v=trends]'); await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const line = document.querySelector('[role=img] > div[aria-hidden]');
    const cells = [...line.children];
    return {
      bottoms: cells.map(c => c.querySelector('i') ? c.querySelector('i').style.bottom : null),
      ends: cells.map(c => c.querySelector('i') ? [c.querySelector('i').style.left, c.querySelector('i').style.right] : null),
      diagonals: cells.map(c => !!c.querySelector('svg line')),
      diag: (() => { const c = cells.find(x => x.querySelector('svg')); if (!c) return null; const sv = c.querySelector('svg'), ln = sv.querySelector('line');
        const cb = c.getBoundingClientRect(), pb = c.previousElementSibling.getBoundingClientRect(), r = sv.getBoundingClientRect();
        return {fromMid: Math.abs(r.left - (pb.left + pb.width / 2)), toMid: Math.abs(r.right - (cb.left + cb.width / 2)), down: ln.getAttribute('y1') === '0'}; })(),
      labels: [...line.querySelectorAll('span')].map(s => s.textContent),
      aria: document.querySelector('[role=img]').getAttribute('aria-label'),
      bars: [...document.querySelectorAll('[role=img] .trk > div')].map(b => /--ov/.test(b.getAttribute('style')) ? 'over' : /repeating/.test(b.getAttribute('style')) ? 'today' : 'on')
    };
  });
  const b = info.bottoms;
  check(b.length === 7, 'one target segment per day (7)');
  check(b[0] === b[2] && b[3] === b[6] && b[0] !== b[3], 'segments step down on the day the target changed (' + b.join(' ') + ')');
  check(info.diagonals.indexOf(true) === 3 && info.diagonals.filter(Boolean).length === 1, 'one diagonal, into the change day');
  check(info.diag && info.diag.fromMid < 1 && info.diag.toMid < 1 && info.diag.down, 'it runs from the middle of the last old-target bar down to the middle of the first new one (off by ' + (info.diag ? info.diag.fromMid.toFixed(1) + ' and ' + info.diag.toMid.toFixed(1) + ' px' : 'missing') + ')');
  check(info.ends[2][1] === '50%' && info.ends[3][0] === '50%', 'the flat segments stop at those middles');
  check(info.labels.join('|') === '1,750|Target 1,500', 'labels: earlier target, then the current one (' + info.labels.join(', ') + ')');
  check(/1,750 kcal from .*then 1,500 kcal from/.test(info.aria), 'the chart\'s description names both targets');
  check(info.bars.slice(0, 3).every(x => x === 'on') && info.bars.slice(3, 6).every(x => x === 'over'), '1,600 kcal reads on target before the cut and over after it (' + info.bars.join(' ') + ')');
  if (SHOTS) await page.locator('section[data-hswipe=trendStep]').screenshot({path: SHOTS + '/target-step.png'});
  await page.click('[data-a=range][data-v="30 days"]'); await page.waitForTimeout(300);
  const thin = await page.evaluate(() => [...document.querySelector('[role=img] > div[aria-hidden]').querySelectorAll('span')].map(s => s.textContent));
  check(thin.length >= 1 && thin[thin.length - 1] === 'Target 1,500', '30 days: still labels the current target (' + thin.join(', ') + ')');
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
