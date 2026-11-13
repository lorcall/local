// Nothing is stored until Save; saving, editing and deleting are instant, with the Google work in the background.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8807);
let failures = 0; const NET = {delay: 0, failAppend: 0, uploads: 0, appends: 0, deletes: 0};
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
    if (NET.delay && route.request().method() !== 'GET') await new Promise(r => setTimeout(r, NET.delay));
    if (/upload\/drive/.test(u)) NET.uploads++;
    if (u.includes(':append') && u.includes('Meals')) { if (NET.failAppend > 0) { NET.failAppend--; return route.fulfill({status: 500, contentType: 'application/json', body: '{"error":{"message":"backend error"}}'}); } NET.appends++; }
    if (u.includes(':batchUpdate')) NET.deletes++;
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
  await page.goto('http://localhost:8807/web/index.html'); await page.waitForTimeout(2500);




  const item = {name: 'Oats', category: 'staple', serving_unit: 'g', quantity: 1, grams_per_unit: 80, kcal: 300, protein_g: 10, carbs_g: 50, fat_g: 6, sugar_g: 1, fiber_g: 8, sodium_mg: 5, confidence: 'high', reason: ''};
  aiReply = {result: {kind: 'meal', items: [item], confidence: 'high', reason: 'clear'}};
  const photograph = async () => {
    await page.evaluate(() => { S.log = null; S.label = null; S.draft = null; S.stack = [{name: 'today', p: {}}]; render(); go('log', {}); });
    await page.waitForTimeout(300);
    await page.setInputFiles('#galIn', path.join(ROOT, 'icons', 'icon-192.png')); await page.waitForTimeout(700);
    await page.click('[data-a=analyze]'); await page.waitForTimeout(1000);
  };
  // what's on screen, not just the flag: a styled element can ignore 'hidden'
  const pill = () => page.evaluate(() => { const p = document.getElementById('syncpill'); return p && getComputedStyle(p).display !== 'none' ? p.dataset.state + ': ' + p.textContent : 'hidden'; });
  const mealsToday = () => page.evaluate(() => mealsOn(today()).length);
  await page.waitForTimeout(800);
  const start = await mealsToday();

  // 1. analysed but not saved: nothing stored
  await photograph();
  check(await page.evaluate(() => route().name) === 'review', 'the estimate opens for review');
  check(NET.uploads === 0 && NET.appends === 0, 'analysing uploads nothing and writes nothing (' + NET.uploads + ' uploads, ' + NET.appends + ' rows)');
  check(!!(await page.$('[data-a="discardDraft"]')), 'the review screen offers Cancel');
  await page.click('[data-a="discardDraft"]'); await page.waitForTimeout(400);
  check(await page.evaluate(() => route().name) === 'today' && await page.evaluate(() => !S.draft && !S.log), 'Cancel goes back and drops the photo and estimate');
  check(NET.uploads === 0 && NET.appends === 0 && await mealsToday() === start, 'after Cancel, still nothing stored');

  // 2. save is instant, with the work in the background
  NET.delay = 1200;
  await photograph();
  const t0 = Date.now();
  await page.click('[data-a="saveDraft"]');
  await page.waitForFunction(() => route().name === 'today', null, {timeout: 3000});
  const took = Date.now() - t0;
  check(took < 600, 'Save returns to Today straight away (' + took + ' ms, with Google taking 1.2 s a call)');
  check(await mealsToday() === start + 1, 'the new meal shows at once');
  check(/^busy: Saving/.test(await pill()), 'a small pill says it\'s saving (' + await pill() + ')');
  await page.waitForFunction(() => { const p = document.getElementById('syncpill'); return p && p.dataset.state === 'done'; }, null, {timeout: 15000});
  check(/^done: Saved/.test(await pill()), 'then says saved (' + await pill() + ')');
  check(NET.uploads === 1 && NET.appends === 1, 'the photo went up once and the meal was written once (' + NET.uploads + ', ' + NET.appends + ')');
  await page.waitForTimeout(1000);
  check(/^done: Saved/.test(await pill()), 'it stays a moment so it can be read');
  await page.waitForTimeout(1300);
  check(await pill() === 'hidden', 'then actually disappears from the screen');

  // 3. delete is instant too
  const id = await page.evaluate(() => mealsOn(today()).slice(-1)[0].meal_id);
  await page.evaluate(() => { const d = API.deleteMeal; window.__deleted = []; API.deleteMeal = async id => { window.__deleted.push(id); await new Promise(r => setTimeout(r, 1200)); return d(id); }; });
  await page.evaluate(id => A.deleteMeal({dataset: {v: id}}), id); await page.waitForTimeout(200);
  const t1 = Date.now();
  await page.evaluate(() => { const b = document.querySelector('.menu button.danger, .menu [data-i="0"], .menu .mi'); b.click(); });
  await page.waitForTimeout(80);
  check(await mealsToday() === start && Date.now() - t1 < 500, 'Delete removes the meal at once');
  check(/Deleting/.test(await pill()), 'and the pill says deleting (' + await pill() + ')');
  await page.waitForFunction(() => { const p = document.getElementById('syncpill'); return p && p.dataset.state === 'done'; }, null, {timeout: 15000});
  check((await page.evaluate(() => window.__deleted)).length === 1, 'the delete ran in the background');

  // 4. a failure keeps the meal, says so, and Retry finishes it without a second upload
  NET.delay = 200; NET.failAppend = 1; const up0 = NET.uploads, ap0 = NET.appends;
  await photograph(); await page.click('[data-a="saveDraft"]');
  await page.waitForFunction(() => { const p = document.getElementById('syncpill'); return p && p.dataset.state === 'error'; }, null, {timeout: 15000});
  check(/Couldn't save/.test(await pill()) && await mealsToday() === start + 1, 'a failed save says so and the meal stays on screen (' + await pill() + ')');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('local-pending-v1') || '[]').length) === 1, 'the unsaved meal is kept on the device');
  await page.click('#syncpill [data-a="syncRetry"]');
  await page.waitForFunction(() => { const p = document.getElementById('syncpill'); return p && p.dataset.state === 'done'; }, null, {timeout: 15000});
  check(NET.uploads === up0 + 1 && NET.appends === ap0 + 1, 'Retry saves it, and the photo isn\'t uploaded twice (' + (NET.uploads - up0) + ' upload)');
  check(await page.evaluate(() => (localStorage.getItem('local-pending-v1') || '[]') === '[]'), 'nothing is left waiting');

  // 5. closed mid-save: finished on the next open
  NET.failAppend = 99; await photograph(); await page.click('[data-a="saveDraft"]');
  await page.waitForFunction(() => { const p = document.getElementById('syncpill'); return p && p.dataset.state === 'error'; }, null, {timeout: 15000});
  NET.failAppend = 0; const ap1 = NET.appends;
  page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
  await page.reload(); await page.waitForTimeout(2500);
  check(NET.appends === ap1 + 1, 'reopening the app finishes the save it was in the middle of');
  check(await page.evaluate(() => (localStorage.getItem('local-pending-v1') || '[]') === '[]'), 'and clears it from the device');

  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(failures ? '\n' + failures + ' failed' : '\nall passed');
  await browser.close(); server.close(); process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
