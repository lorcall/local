// Weight: the calculator's weight starts an energy-balance estimate; weigh-ins can be added, changed and deleted.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8810);
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
  await page.goto('http://localhost:8810/web/index.html'); await page.waitForTimeout(2500);




  await page.waitForTimeout(2500);
  // 1. the calculator's weight becomes the first weigh-in, on the day the first target was set
  const seeded = await page.evaluate(() => S.data.weight.slice());
  check(seeded.length === 1 && seeded[0].date === dayN(-14) && seeded[0].kg === 72 && /calculator/.test(seeded[0].note), 'the calculator weight is added as a weigh-in on its date (' + JSON.stringify(seeded) + ')');
  check(wrote.some(w => /^Weight /.test(w) && /72/.test(w)), 'and written to the Weight sheet');
  check(wrote.some(w => /^Settings /.test(w) && /weight_seeded/.test(w)) || await page.evaluate(() => S.data.settings.weight_seeded === 'yes'), 'only once (remembered in Settings)');

  // 2. the estimate: energy balance, worked by hand
  const M = await page.evaluate(() => { const m = weightModel(); return {now: m.now, assumed: m.assumed, counted: m.counted, water: m.water, k: m.k, cal: m.calibrated, wk: m.weekRate}; });
  let est = 72; const bmr = kg => 10 * kg + 6.25 * 170 - 5 * 34 + 5;
  for (let n = -14; n <= -1; n++) { const eat = n === -9 ? 1750 : 1500; est += (eat - bmr(est) * 1.375) / 7700; }
  check(Math.abs(M.now - est) < 0.01, 'the estimate matches the arithmetic: ' + M.now.toFixed(2) + ' kg vs ' + est.toFixed(2) + ' kg by hand');
  check(M.assumed === 1 && M.counted === 13, 'the unlogged day is counted at the target (' + M.assumed + ' assumed, ' + M.counted + ' logged)');
  check(M.water > 0.4 && M.water <= 1.2, 'yesterday\'s extra carbs and salt show as water on the scale (+' + M.water.toFixed(2) + ' kg)');
  check(!M.cal && M.k === 1, 'no calibration from a single weigh-in');

  // 3. the screen
  await page.evaluate(() => go('weight', {})); await page.waitForTimeout(400);
  const txt = await page.evaluate(() => document.querySelector('#app .scr').innerText);
  check(/kg, estimated/.test(txt) && new RegExp(est.toFixed(1).replace('.', '\\.')).test(txt), 'the headline shows the estimate (' + est.toFixed(1) + ')');
  check(/kg to go/.test(txt) && /Goal 65/.test(txt) && !/No goal/.test(txt), 'the goal reads sensibly');
  check(/On the scale this morning/.test(txt) && /about .* kg a week/.test(txt) && /counted at your calorie target/.test(txt), 'the notes explain water, pace and the assumed day');
  check(await page.$('.scr svg[aria-label^="Estimated weight"]') != null, 'the chart draws the estimate');

  // 4. add a weigh-in for an earlier day, change it, delete it
  const d7 = dayN(-7);
  await page.fill('#wt-date', d7); await page.fill('#wt-in', '71.4'); await page.fill('[data-in="wNote"]', 'gym scale');
  await page.click('[data-a="saveWeight"]'); await page.waitForTimeout(300);
  let W = await page.evaluate(() => S.data.weight.map(w => w.date + ' ' + w.kg + ' ' + w.note).sort());
  check(W.includes(d7 + ' 71.4 gym scale'), 'a weigh-in can be added for any past day (' + W + ')');
  await page.click('[data-a="wEdit"][data-v="' + d7 + '"]'); await page.waitForTimeout(300);
  check(/Change weigh-in/.test(await page.evaluate(() => document.querySelector('#wt-form').textContent)), 'tapping a weigh-in opens it for changes');
  await page.fill('#wt-in', '71.1'); await page.fill('#wt-date', dayN(-6));
  await page.click('[data-a="saveWeight"]'); await page.waitForTimeout(300);
  W = await page.evaluate(() => S.data.weight.map(w => w.date + ' ' + w.kg).sort());
  check(W.includes(dayN(-6) + ' 71.1') && !W.some(w => w.startsWith(d7)), 'its weight and date can be changed (' + W + ')');
  await page.click('[data-a="wEdit"][data-v="' + dayN(-6) + '"]'); await page.waitForTimeout(200);
  await page.click('[data-a="wDelete"]'); await page.waitForTimeout(300);
  W = await page.evaluate(() => S.data.weight.map(w => w.date));
  check(W.length === 1, 'and it can be deleted (' + W + ')');
  await page.waitForFunction(() => !SYNC.jobs.length, null, {timeout: 10000});
  check(true, 'the changes finished saving in the background');

  // 5. weigh-ins over two weeks fit the burn to the person
  const fit = await page.evaluate(() => {
    S.data.weight = [{date: addDays(today(), -14), kg: 72, note: ''}, {date: addDays(today(), -7), kg: 71.9, note: ''}, {date: addDays(today(), -1), kg: 71.8, note: ''}];
    const m = weightModel(); return {k: m.k, cal: m.calibrated, now: m.now};
  });
  check(fit.cal && fit.k < 0.85, 'weigh-ins that drop slower than predicted lower the fitted burn (k ' + fit.k.toFixed(2) + ')');
  check(fit.now > est + 0.5, 'and pull the estimate toward the scale (' + fit.now.toFixed(2) + ' kg)');

  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(failures ? '\n' + failures + ' failed' : '\nall passed');
  await browser.close(); server.close(); process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
