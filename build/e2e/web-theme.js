// Themes: Default, Light, Dark. Chosen in Settings, saved to the Sheet, applied on any device and before sign-in.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8821);
let failures = 0; const wrote = [];
const check = (ok, what) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + what); if (!ok) failures++; };

const X = 'Oats';
const CSSX = '';
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const E = (id, meal) => [id, meal, X, X, X, '150', X, '1', '400', '10', '20', '5', '1', '1', '100', X, 'FALSE', X];
const DATA = {
  Settings: [['key','value'],['onboarded','yes'],['week_start', X],['units', X],['weekly_summary:2026-11-09', JSON.stringify({text: X, suggestions: [X, X]})]],
  Targets: [['effective_date','kcal','protein_g','carbs_g','fat_g','fiber_min_g','sugar_max_g','sodium_max_mg'],['2026-01-01','1750','119','185','58','25','50','2300']],
  Meals: [['meal_id','date','time','meal_type','photo_url','note','confidence','confidence_reason','source','edited','thumb'],
    ['m1', '2026-11-12', X, X, 'https://drive.google.com/file/d/' + 'a'.repeat(30) + '/view', X, X, X, X, 'FALSE', CSSX],
    ['m2" onclick="window.__pwned=1', '2026-11-13', '08:00', 'Lunch', '', X, 'high', X, 'photo', 'FALSE', 'javascript:window.__pwned=1'],
    ['m3', '2026-11-11', '12:00', 'Dinner', '', '', 'high', '', 'photo', 'FALSE', PHOTO]],
  Entries: [['entry_id','meal_id','name','category','serving_unit','grams_per_unit','serving_label','quantity','kcal','protein_g','carbs_g','fat_g','sugar_g','fiber_g','sodium_mg','confidence','edited','reason'],
    E('e1', 'm1'), E('e2', 'm2" onclick="window.__pwned=1'), E('e3', 'm3')],
  Favorites: [['food_id','name','category','serving_unit','grams_per_unit','serving_label','kcal','protein_g','carbs_g','fat_g','sugar_g','fiber_g','sodium_mg','pinned','use_count','usual_hour','last_used','is_local_dish','dish_group','user_corrected'],
    ['f1', X, X, X, '100', X, '200', '1', '1', '1', '1', '1', '1', 'TRUE', '3', '12', '2026-11-12', 'FALSE', X, 'TRUE']],
  Weight: [['date','kg','note'], ['2026-11-10', '70', X], ['2026-11-12', '69.5', X]]
};

const ymdN = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dayN = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymdN(d); };
DATA.Settings = [['key', 'value'], ['onboarded', 'yes'], ['week_start', 'Monday'], ['units', 'kg and cm'],
  ['profile', JSON.stringify({age: '34', sex: 'Male', height: 170, weight: '72', activity: 'Light', goal: 'Lose', target_weight: 65, pace: 0.45, maintenance: 2220})]];
DATA.Targets = [DATA.Targets[0], [dayN(-14), '1750', '119', '185', '58', '25', '50', '2300']];
DATA.Weight = [['date', 'kg', 'note']];
DATA.Meals = [DATA.Meals[0]]; DATA.Entries = [DATA.Entries[0]];
for (let n = -14; n <= -1; n++) {
  if (n === -9) continue;                                   // one day not logged
  const id = 'w' + (n + 20);
  DATA.Meals.push([id, dayN(n), '12:00', 'Lunch', '', '', 'high', '', 'text', 'FALSE', '']);
  DATA.Entries.push(['e' + id, id, 'Food', 'other', 'serving', '100', '', '1', '1500', '100', n === -1 ? '400' : '150', '50', '10', '20', n === -1 ? '3500' : '2000', 'high', 'FALSE', '']);
}
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || 'inline')));
    localStorage.setItem('local-web-token-v1', JSON.stringify({token: 'tok', exp: Date.now() + 3e6, hint: 'a@b.c'}));
    window.google = {accounts: {oauth2: {hasGrantedAllScopes: () => true, initTokenClient: c => ({requestAccessToken() { c.callback({access_token: 't', expires_in: 3600}); }})}}};
  });
  await ctx.route('https://accounts.google.com/**', r => r.fulfill({status: 200, contentType: 'text/javascript', body: ''}));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  await ctx.route(/googleapis\.com/, async route => {
    const u = decodeURIComponent(route.request().url());
    const j = o => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(o)});
    if (/upload\/drive/.test(u)) return j({id: 'photo1', webViewLink: 'https://drive.google.com/file/d/photo1/view'});
    if (/alt=media/.test(u)) return route.fulfill({status: 200, headers: {'Content-Type': 'image/png" onerror="window.__pwned=1'}, body: Buffer.from('x')});
    if (u.includes('/drive/v3/files?q=')) return j({files: [{id: 'existing'}]});
    if (u.includes('/drive/v3/files/')) return j({id: 'x', trashed: false});
    if (u.includes('?fields=sheets.properties')) return j({sheets: Object.keys(DATA).map((t, i) => ({properties: {title: t, sheetId: i}}))});
    if (u.includes('values:batchGet')) {
      const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map(x => x[1]);
      return j({valueRanges: ranges.map(r => {
        const tab = r.split('!')[0], rows = DATA[tab] || [];
        if (/!1:1$/.test(r)) return {values: [rows[0] || []]};
        if (tab === 'Meals' && /!K\d+$/.test(r)) return {values: [[CSSX]]};          // a thumbnail cell
        if (tab === 'Meals' && /!A:J$/.test(r)) return {values: rows.map(x => x.slice(0, 10))};
        return {values: rows};
      })});
    }
    if (u.includes(':append')) wrote.push(u.split('/values/')[1].split('!')[0] + ' ' + (route.request().postData() || ''));
    if (u.includes(':append')) return j({updates: {updatedRange: 'Entries!A10:R10'}});
    return j({});
  });
  let aiReply = null;
  await ctx.route(/script\.google\.com\/macros/, async route => {
    const sent = JSON.parse(route.request().postData() || '{}');
    const f = o => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(o)});
    if (sent.action === 'access') return f({result: {approved: true, email: 'a@b.c'}});
    return f(aiReply);
  });

  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.goto('http://localhost:8821/web/index.html'); await page.waitForTimeout(2500);





  await page.waitForTimeout(2500);
  const look = () => page.evaluate(() => ({attr: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.documentElement).getPropertyValue('--g').trim(),
    track: COLOR.track, link: getComputedStyle(document.documentElement).getPropertyValue('--link').trim(), cached: localStorage.getItem('local-theme-v1'),
    wmDark: (() => { const i = document.querySelector('#app img.wordmark.on-dark'); return i ? getComputedStyle(i).display : 'n/a'; })(),
    wmLight: (() => { const i = document.querySelector('#app img.wordmark.on-light'); return i ? getComputedStyle(i).display : 'n/a'; })()}));
  let L = await look();
  check(!L.attr && L.bg === '#23252D' && L.wmDark !== 'none' && L.wmLight === 'none', 'Default is what the app was (' + JSON.stringify(L) + ')');

  await page.evaluate(() => go('settings', {})); await page.waitForTimeout(400);
  check(!!(await page.$('.track[aria-label="Theme"] [data-v="Light"]')), 'Settings offers Default, Light and Dark');
  await page.click('.track[aria-label="Theme"] [data-v="Light"]'); await page.waitForTimeout(600);
  L = await look();
  check(L.attr === 'light' && L.bg === '#E4E7ED' && L.track === '#D0D6DF', 'Light applies at once, dials included (' + L.bg + ', track ' + L.track + ')');
  check(L.link === '#22262F', 'secondary links lose the mango in Light');
  check(L.cached === 'Light', 'remembered on the device');
  await page.waitForFunction(() => !SYNC.jobs.length, null, {timeout: 10000});
  check(wrote.some(w => /^Settings /.test(w) && /theme/.test(w) && /Light/.test(w)) || await page.evaluate(() => S.data.settings.theme === 'Light'), 'and saved to the Sheet');
  await page.evaluate(() => go('today', {})); await page.waitForTimeout(300);
  L = await look();
  check(L.wmDark === 'none' && L.wmLight !== 'none', 'the dark-text wordmark shows on Light');

  await page.evaluate(() => go('settings', {})); await page.waitForTimeout(300);
  await page.click('.track[aria-label="Theme"] [data-v="Dark"]'); await page.waitForTimeout(600);
  L = await look();
  check(L.attr === 'dark' && L.bg === '#141519' && L.wmDark !== 'none', 'Dark applies (' + L.bg + ')');
  await page.click('.track[aria-label="Theme"] [data-v="Default"]'); await page.waitForTimeout(600);
  L = await look();
  check(!L.attr && L.bg === '#23252D' && L.track === '#15161B' && L.cached === 'Default', 'Default goes back to exactly the original');

  // another device: nothing cached, the Sheet says Light
  DATA.Settings.push(['theme', 'Light']);
  await page.evaluate(() => localStorage.removeItem('local-theme-v1'));
  await page.reload(); await page.waitForTimeout(2500);
  L = await look();
  check(L.attr === 'light' && L.cached === 'Light', 'on a fresh device the Sheet\'s theme is applied and cached');
  // the next open starts in it before anything loads (the sign-in and loading screens)
  const early = await ctx.newPage();
  await early.route('**/api.js*', r => r.fulfill({contentType: 'text/javascript', body: 'window.LoCalAuth={configured:()=>true,signedIn:()=>false,returning:()=>false,signIn:()=>new Promise(()=>{})};'}));
  await early.goto('http://localhost:8821/web/index.html'); await early.waitForTimeout(500);
  const g = await early.evaluate(() => ({attr: document.documentElement.getAttribute('data-theme'), light: getComputedStyle(document.querySelector('.gate .wm.light')).display, dark: getComputedStyle(document.querySelector('.gate .wm.dark')).display}));
  check(g.attr === 'light' && g.light !== 'none' && g.dark === 'none', 'the sign-in screen opens in the saved theme with the right wordmark (' + JSON.stringify(g) + ')');
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(failures ? '\n' + failures + ' failed' : '\nall passed');
  await browser.close(); server.close(); process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
