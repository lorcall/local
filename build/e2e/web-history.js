// History stays on one page: dates select, a week of days ends at the selection, one day opens in place.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8802);
let failures = 0;
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
  await page.clock.setFixedTime(new Date('2026-11-13T12:00:00'));  // the data is written around this day
  await page.goto('http://localhost:8802/web/index.html'); await page.waitForTimeout(2500);




  const st = () => page.evaluate(() => ({route: route().name, rows: [...document.querySelectorAll('[data-a="hPick"]')].map(b => b.dataset.d),
    open: [...document.querySelectorAll('.hrow.open [data-a="hPick"]')].map(b => b.dataset.d), sel: [...document.querySelectorAll('.day.sel')].map(b => b.dataset.d),
    meals: document.querySelectorAll('.hpanel [data-a="editMeal"]').length}));
  await page.evaluate(() => document.querySelector('#app .tabbar .nb[data-v="history"]').click()); await page.waitForTimeout(700);
  let s = await st();
  check(s.route === 'history' && s.sel[0] === '2026-11-13' && s.open[0] === '2026-11-13' && s.rows[0] === '2026-11-13', 'opens on today, selected and open (' + JSON.stringify(s) + ')');
  check(s.rows.length <= 7 && s.rows.every(d => d >= '2026-11-11'), 'at most a week of rows, none before the first logged day');
  check(s.meals === 1, 'the open day lists its meals');

  await page.click('.day[data-d="2026-11-12"]'); await page.waitForTimeout(400); s = await st();
  check(s.route === 'history', 'tapping a date stays on History');
  check(s.sel[0] === '2026-11-12' && s.open[0] === '2026-11-12' && s.rows[0] === '2026-11-12', 'the week now ends at the tapped date, which is selected and open');

  await page.click('[data-a="hPick"][data-d="2026-11-11"]'); await page.waitForTimeout(400); s = await st();
  check(s.route === 'history' && s.open.join() === '2026-11-11' && s.sel[0] === '2026-11-11', 'tapping a row opens that day and selects it on the calendar');
  check(s.rows[0] === '2026-11-12', 'the rows don\'t move when a row is tapped');

  await page.click('[data-a="hPick"][data-d="2026-11-11"]'); await page.waitForTimeout(300); s = await st();
  check(!s.open.length, 'tapping the open row closes it');

  // a day with nothing logged, from the calendar
  await page.click('.day[data-d="2026-11-05"]').catch(() => {}); await page.waitForTimeout(300); s = await st();
  check(s.route === 'history', 'a date with nothing logged also stays on History');

  // meals still open for editing
  await page.click('.day[data-d="2026-11-13"]'); await page.waitForTimeout(300);
  await page.click('.hpanel [data-a="editMeal"]'); await page.waitForTimeout(400);
  check(await page.evaluate(() => route().name) === 'review', 'a meal in the open day opens for editing');
  await page.evaluate(() => back()); await page.waitForTimeout(300); s = await st();
  check(s.route === 'history' && s.open[0] === '2026-11-13', 'coming back, History is as it was');

  // add a meal to the selected day; saving comes back to History
  await page.click('.day[data-d="2026-11-12"]'); await page.waitForTimeout(300);
  const addBtn = await page.$('.hpanel [data-a="go"][data-v="log"][data-day="2026-11-12"]');
  check(addBtn && /Add a meal to Nov 12/.test(await addBtn.textContent()), 'the open day offers to add a meal to it');
  await addBtn.click(); await page.waitForTimeout(300);
  check(await page.evaluate(() => route().name === 'log' && logState().date === '2026-11-12' && logState().time === TYPE_TIME[logState().meal_type]), 'logging starts on that date');
  await page.evaluate(() => { const L = logState(); addToMealToday(L.meal_type, [{entry_id: uid('ent'), name: 'Test food', category: 'other', kcal: 100, protein_g: 0, carbs_g: 0, fat_g: 0, quantity: 1, serving_unit: 'serving'}], 'manual'); home('Added'); });
  await page.waitForTimeout(400); s = await st();
  check(s.route === 'history' && s.open[0] === '2026-11-12', 'after saving, History is back with that day open');
  check(await page.evaluate(() => mealsOn('2026-11-12').some(m => itemsOf(m.meal_id).some(e => e.name === 'Test food'))), 'the meal is on that date');
  await page.click('.day[data-d="2026-11-13"]'); await page.waitForTimeout(300);
  check(/Add a meal today/.test(await page.textContent('.hpanel')), 'on today it says today');
  await page.evaluate(() => { document.querySelector('[data-a="tab"][data-v="today"]').click(); }); await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector('[data-a="go"][data-v="log"]').click(); }); await page.waitForTimeout(300);
  await page.evaluate(() => home()); await page.waitForTimeout(300);
  check(await page.evaluate(() => route().name) === 'today', 'logging from Today still returns to Today');
  await page.evaluate(() => { document.querySelector('[data-a="tab"][data-v="history"]').click(); }); await page.waitForTimeout(300);

  // another month: the week follows it
  await page.click('[data-a="monthStep"][data-v="-1"]').catch(() => {}); await page.waitForTimeout(500); s = await st();
  check(s.route === 'history', 'changing month stays on History (' + JSON.stringify(s) + ')');

  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(failures ? '\n' + failures + ' failed' : '\nall passed');
  await browser.close(); server.close(); process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
