// Food suggestions: opt-in switch, the Today card, own foods that fit, AI ideas, logging one.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8821);
let failures = 0, window_targets_writes = 0; const targetRows = [], proxySent = [], settingWrites = [];
const check = (ok, what) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + what); if (!ok) failures++; };

const X = 'Oats';
const CSSX = '';
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const E = (id, meal) => [id, meal, X, X, X, '150', X, '1', '400', '10', '20', '5', '1', '1', '100', X, 'FALSE', X];
const T0 = '2026-11-16';
const EN = (id, meal, name, kcal, p, c, f, fib) => [id, meal, name, 'other', 'serving', '', '', '1', String(kcal), String(p), String(c), String(f), '2', String(fib), '300', 'high', 'FALSE', ''];
const DATA = {
  Settings: [['key','value'],['onboarded','yes'],['suggest','off']],
  Targets: [['effective_date','kcal','protein_g','carbs_g','fat_g','fiber_min_g','sugar_max_g','sodium_max_mg','basis','notes','ai_summary'],
    ['2026-01-01','2000','120','220','65','25','50','2300','Calculator','Not too much protein <img src=x onerror=window.__pwned=1>','']],
  Meals: [['meal_id','date','time','meal_type','photo_url','note','confidence','confidence_reason','source','edited','thumb'],
    ['m1', T0, '08:00', 'Breakfast', '', '', 'high', '', 'photo', 'FALSE', ''],
    ['m2', T0, '12:30', 'Lunch', '', '', 'high', '', 'photo', 'FALSE', ''],
    ['m3', '2026-11-10', '19:00', 'Dinner', '', '', 'high', '', 'photo', 'FALSE', ''],
    ['m4', '2026-11-09', '19:00', 'Dinner', '', '', 'high', '', 'photo', 'FALSE', ''],
    ['m5', '2026-11-08', '19:00', 'Dinner', '', '', 'high', '', 'photo', 'FALSE', '']],
  Entries: [['entry_id','meal_id','name','category','serving_unit','grams_per_unit','serving_label','quantity','kcal','protein_g','carbs_g','fat_g','sugar_g','fiber_g','sodium_mg','confidence','edited','reason'],
    EN('e1', 'm1', 'Piyaya', 420, 6, 70, 12, 2), EN('e2', 'm2', 'Chicken inasal and rice', 760, 40, 90, 24, 3),
    EN('e3', 'm3', 'Microwaved omelet', 230, 19, 2, 16, 0), EN('e4', 'm4', 'Lechon kawali feast', 1900, 60, 120, 140, 1), EN('e5', 'm5', 'Tofu with chicken broth', 210, 18, 6, 12, 2)],
  Favorites: [['food_id','name','category','serving_unit','grams_per_unit','serving_label','kcal','protein_g','carbs_g','fat_g','sugar_g','fiber_g','sodium_mg','pinned','use_count','usual_hour','last_used','is_local_dish','dish_group','user_corrected'],
    ['f1', 'Greek yogurt', 'snacks and sweets', 'cup', '170', '', '150', '17', '8', '4', '6', '0', '60', 'TRUE', '2', '15', '2026-11-12', 'FALSE', '', 'FALSE'],
    ['f2', 'Banana', 'fruit', 'piece', '120', '', '105', '1', '27', '0', '14', '3', '1', 'FALSE', '4', '9', '2026-11-13', 'FALSE', '', 'FALSE']],
  Weight: [['date','kg','note']]
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
    if (u.includes('Targets') && (u.includes(':append') || route.request().method() === 'PUT')) { window_targets_writes++; targetRows.push(JSON.parse(route.request().postData()).values[0]); }
    if (u.includes('Settings') && (u.includes(':append') || route.request().method() === 'PUT')) settingWrites.push(route.request().postData());
    if (u.includes(':append')) return j({updates: {updatedRange: 'Entries!A10:R10'}});
    return j({});
  });
  let aiReply = null;
  await ctx.route(/script\.google\.com\/macros/, async route => {
    const sent = JSON.parse(route.request().postData() || '{}');
    const f = o => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(o)});
    if (sent.action === 'access') return f({result: {approved: true, email: 'a@b.c'}});
    proxySent.push(sent); await new Promise(r => setTimeout(r, 300));
    return f(aiReply);
  });

  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-11-16T18:30:00'));
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.goto('http://localhost:8821/web/index.html'); await page.waitForTimeout(2500);




  const txt = () => page.evaluate(() => document.getElementById('app').textContent);
  if (await page.$('.gate button')) { await page.click('.gate button'); await page.waitForTimeout(2500); }
  check(!/ideas/.test(await txt()), 'off by default: no card on Today');
  await page.evaluate(() => go('settings')); await page.waitForTimeout(300);
  await page.click('[data-a="setSuggest"][data-v="On"]'); await page.waitForTimeout(1200);
  check(settingWrites.some(b => /suggest/.test(b) && /"on"/.test(b)), 'turning it on is saved to the Sheet');
  await page.evaluate(() => back()); await page.waitForTimeout(400);
  let t = await txt();
  check(/Dinner ideas/.test(t) && /820 kcal left · protein 74 g short/.test(t), 'the card shows the meal and what is left (' + (t.match(/Dinner ideas[^S]*/) || [''])[0] + ')');

  const IDEAS = {ideas: [
    {name: 'Sinigang na hipon', why: 'Light, high protein.', items: [{name: 'Sinigang na hipon', category: 'meat and fish', serving_unit: 'bowl', quantity: 1, grams_per_unit: 0, kcal: 260, protein_g: 28, carbs_g: 14, fat_g: 8, sugar_g: 3, fiber_g: 4, sodium_mg: 900}]},
    {name: 'Huge <b>feast</b>', why: 'Too big', items: [{name: 'Feast', category: 'other', serving_unit: 'plate', quantity: 1, grams_per_unit: 0, kcal: 1500, protein_g: 20, carbs_g: 150, fat_g: 80, sugar_g: 10, fiber_g: 1, sodium_mg: 2000}]},
    {name: 'Chicken tinola with rice', why: 'Closes the protein gap.', items: [{name: 'Chicken tinola', category: 'meat and fish', serving_unit: 'bowl', quantity: 1, grams_per_unit: 0, kcal: 300, protein_g: 30, carbs_g: 8, fat_g: 14, sugar_g: 2, fiber_g: 2, sodium_mg: 700}, {name: 'Rice', category: 'staple', serving_unit: 'cup', quantity: 0.5, grams_per_unit: 0, kcal: 105, protein_g: 2, carbs_g: 23, fat_g: 0, sugar_g: 0, fiber_g: 0, sodium_mg: 0}]},
    {name: 'Banana cue', why: 'Sweet', items: [{name: 'Banana cue', category: 'snacks and sweets', serving_unit: 'stick', quantity: 1, grams_per_unit: 0, kcal: 220, protein_g: 1, carbs_g: 45, fat_g: 5, sugar_g: 25, fiber_g: 2, sodium_mg: 5}]}]};
  aiReply = {result: IDEAS};
  await page.click('[data-a="sugOpen"]'); await page.waitForTimeout(80);
  check(await page.isVisible('.sugsheet') && /Finding ideas/.test(await page.textContent('.sugsheet')), 'the sheet opens straight away and shows it is finding ideas');
  await page.waitForTimeout(700);
  const sent = proxySent.filter(x => x.action === 'suggestFoods');
  const sp = sent[0] && sent[0].payload;
  check(sp && sp.meal_type === 'Dinner' && sp.left.kcal === 820 && sp.left.protein_g === 74 && /Not too much protein/.test(sp.notes) && sp.eaten.length === 2 && sp.usual.includes('Greek yogurt'), 'sends what is left, the meal, the notes, what was eaten and usual foods');
  const local = await page.$$eval('.sugsheet [data-a="sugLog"][data-v^="l"]', b => b.map(x => x.getAttribute('aria-label')));
  check(local.some(x => /omelet/i.test(x)) && local.some(x => /Tofu/.test(x)) && local.some(x => /Greek yogurt/.test(x)) && !local.some(x => /Lechon/.test(x)) && !local.some(x => /inasal|Piyaya/i.test(x)),
    'own foods: past meals and saved foods that fit, not the oversized one or what was eaten today (' + local + ')');
  const ai = await page.$$eval('.sugsheet [data-a="sugLog"][data-v^="a"]', b => b.map(x => x.getAttribute('aria-label') + (x.classList.contains('cta') ? ' *' : '')));
  check(ai.length === 4 && /tinola.*\*|Sinigang.*\*/i.test(ai[0]) && /feast/i.test(ai[3]), 'AI ideas: best fit first and marked, the oversized one last (' + ai + ')');
  check(/1,175 kcal over|kcal over/.test(await page.textContent('.sugsheet')), 'an idea over what is left says so');
  check(await page.evaluate(() => !document.querySelector('.sugsheet b')), 'idea names are shown as text');

  const mh = await page.evaluate(() => { const b = document.querySelector('.sugsheet [data-a="sugMore"]'), sh = document.querySelector('.sugsheet'); return {b: b.getBoundingClientRect().height, scroll: sh.scrollHeight > sh.clientHeight}; });
  check(mh.b >= 49 && mh.scroll, 'a long sheet scrolls and More ideas keeps its full height (' + JSON.stringify(mh) + ')');
  await page.click('.sugsheet [data-a="sugClose"]'); await page.waitForTimeout(200);
  await page.click('[data-a="sugOpen"]'); await page.waitForTimeout(500);
  check(proxySent.filter(x => x.action === 'suggestFoods').length === 1, 'reopening keeps the same ideas without another AI call');
  await page.click('.sugsheet [data-a="sugMore"]'); await page.waitForTimeout(700);
  const s2 = proxySent.filter(x => x.action === 'suggestFoods');
  check(s2.length === 2 && s2[1].payload.exclude.includes('Sinigang na hipon'), 'More ideas asks again, leaving out what was shown');

  await page.click('.sugsheet [data-a="sugLog"][data-v="a0"]'); await page.waitForTimeout(400);
  const d = await page.evaluate(() => ({r: route().name, type: S.draft && S.draft.meal.meal_type, date: S.draft && S.draft.meal.date, n: S.draft && S.draft.items.length, sug: !!S.sug}));
  check(d.r === 'review' && d.type === 'Dinner' && d.date === '2026-11-16' && d.n >= 1 && !d.sug, 'Log opens the review for dinner today with the items filled in (' + JSON.stringify(d) + ')');
  await page.evaluate(() => back()); await page.waitForTimeout(300);

  aiReply = {error: 'QUOTA: used up'};
  await page.evaluate(() => { S.ui.sugCache = null; S.log = null; }); await page.evaluate(() => go('today')); await page.waitForTimeout(300);
  await page.click('[data-a="sugOpen"]'); await page.waitForTimeout(700);
  const st = await page.textContent('.sugsheet');
  check(/still work without the AI/.test(st) && /Try again/.test(st) && /omelet/i.test(st), 'an AI error keeps your own foods and offers to try again');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check(!(await page.$('.sugsheet')), 'Escape closes the sheet');

  check(!(await page.evaluate(() => window.__pwned)), 'nothing from the Sheet runs');
  check(!(await page.evaluate(() => window.__csp.length)), 'no CSP violations');
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(failures ? '\n' + failures + ' failed' : '\nall passed');
  await browser.close(); server.close(); process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
