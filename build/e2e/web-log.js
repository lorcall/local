// Logging flows of the web build, with Google and the AI proxy stubbed and a little history.
//   photo: no meal/label switch; a label photo opens the label screen, a meal photo the review
//   search: past meals and foods are findable and add in one tap; no match offers a new food
//   layout: the app is centred on the window width
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const PHOTO = process.argv[2], SHOTS = process.env.SHOTS;  // set SHOTS to a folder to save screenshots
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8790);
let failures = 0;
const check = (ok, what) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + what); if (!ok) failures++; };
const E = (id, meal, name, unit, g, q, kcal) => [id, meal, name, 'other', unit, g, '', q, kcal, 10, 20, 5, 1, 1, 100, 'high', 'FALSE', ''];
const DATA = {
  Settings: [['key','value'],['onboarded','yes']],
  Targets: [['effective_date','kcal','protein_g','carbs_g','fat_g','fiber_min_g','sugar_max_g','sodium_max_mg'],['2026-01-01','1750','119','185','58','25','50','2300']],
  Meals: [['meal_id','date','time','meal_type','photo_url','note','confidence','confidence_reason','source','edited'],
    ['m1','2026-11-10','12:30','Lunch','','','high','','photo','FALSE'],
    ['m2','2026-11-11','08:00','Breakfast','','','high','','photo','FALSE'],
    ['m3','2026-11-12','12:00','Lunch','','','high','','photo','FALSE']],
  Entries: [['entry_id','meal_id','name','category','serving_unit','grams_per_unit','serving_label','quantity','kcal','protein_g','carbs_g','fat_g','sugar_g','fiber_g','sodium_mg','confidence','edited','reason'],
    E('e1','m1','Chicken adobo','serving',150,1,435), E('e2','m1','Plain rice','cup',160,1,205),
    E('e3','m2','Oatmeal','bowl',250,1,150), E('e4','m2','Banana','piece',120,1,105),
    E('e5','m3','Chicken adobo','serving',150,1,435), E('e6','m3','Plain rice','cup',160,1,205)]
};
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(() => {
    localStorage.setItem('local-web-token-v1', JSON.stringify({token: 'tok', exp: Date.now() + 3e6, hint: 'a@b.c'}));
    window.google = {accounts: {oauth2: {hasGrantedAllScopes: () => true, initTokenClient: c => ({requestAccessToken() { c.callback({access_token: 't', expires_in: 3600}); }})}}};
  });
  await ctx.route('https://accounts.google.com/**', r => r.fulfill({status: 200, contentType: 'text/javascript', body: ''}));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  const writes = [];
  await ctx.route(/googleapis\.com/, async route => {
    const u = decodeURIComponent(route.request().url()), m = route.request().method();
    const j = o => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(o)});
    if (/upload\/drive/.test(u)) return j({id: 'photo1', webViewLink: 'https://drive.google.com/file/d/photo1/view'});
    if (u.includes('/drive/v3/files?q=')) return j({files: [{id: 'existing'}]});
    if (u.includes('/drive/v3/files/')) return j({id: 'x', trashed: false});
    if (u.includes('?fields=sheets.properties')) return j({sheets: Object.keys(DATA).concat(['Favorites','Weight']).map((t, i) => ({properties: {title: t, sheetId: i}}))});
    if (u.includes('values:batchGet')) {
      const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map(x => x[1]);
      return j({valueRanges: ranges.map(r => { const tab = r.split('!')[0]; return {values: /!1:1$/.test(r) ? [] : (DATA[tab] || [])}; })});
    }
    if (m !== 'GET') writes.push(m + ' ' + u.replace(/https:\/\/[^/]+/, '').slice(0, 80));
    if (u.includes(':append')) return j({updates: {updatedRange: 'Entries!A10:R10'}});
    return j({});
  });
  let aiReply = null, aiSent = null;
  await ctx.route(/script\.google\.com\/macros/, async route => {
    aiSent = JSON.parse(route.request().postData() || '{}');
    if (aiSent.action === 'access') return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({result: {approved: true, email: 'a@b.c'}})});
    route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({result: aiReply})});
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  await page.goto('http://localhost:8790/web/index.html'); await page.waitForTimeout(2500);

  console.log('Photo');
  await page.click('[data-a=go][data-v=log]'); await page.waitForTimeout(400);
  check(!(await page.$('[role=radiogroup][aria-label*=photographing]')) && !(await page.$('[data-a=logMode]')), 'no meal/label switch');
  check(!!(await page.$('.sheet [data-a=go][data-v=search][aria-label="Search past meals"]')), 'search button beside the shutter');
  if (SHOTS) await page.screenshot({path: SHOTS + '/log.png', fullPage: true});
  const ph = await page.getAttribute('#lm-note', 'placeholder');
  check(/^Guide the AI/.test(ph) && !/sinigang|rice is/i.test(ph), 'note placeholder is generic: "' + ph + '"');
  await page.setInputFiles('#galIn', PHOTO); await page.waitForTimeout(800);
  aiReply = {kind: 'label', product: 'Oat biscuits', serving_g: 30, servings_per_pack: 8, per_serving: {kcal: 140, protein_g: 2, carbs_g: 20, fat_g: 6, sugar_g: 7, fiber_g: 2, sodium_mg: 90}, unread_fields: [], confidence: 'high'};
  await page.click('[data-a=analyze]'); await page.waitForTimeout(1200);
  check(aiSent && aiSent.payload && aiSent.payload.mode === 'auto', 'photo sent with mode auto');
  check(/From the label/.test(await text()) && /Oat biscuits/.test(await page.inputValue('#ls-name')), 'a label photo opens the label screen');
  await page.click('[data-a=back]'); await page.waitForTimeout(400);
  aiReply = {kind: 'meal', items: [{name: 'Pasta', category: 'staple', serving_unit: 'plate', quantity: 1, grams_per_unit: 300, kcal: 520, protein_g: 18, carbs_g: 80, fat_g: 14, sugar_g: 6, fiber_g: 4, sodium_mg: 600, confidence: 'medium', reason: ''}], confidence: 'medium', reason: 'clear photo'};
  await page.click('[data-a=analyze]'); await page.waitForTimeout(1200);
  check(/Review/.test(await text()) && /Pasta/.test(await text()), 'a meal photo opens the review');
  await page.click('[data-a=back]'); await page.waitForTimeout(300);

  console.log('Search');
  await page.click('.sheet [data-a=go][data-v=search]'); await page.waitForTimeout(400);
  let t = await text();
  check(/Recent meals/.test(t) && /Foods you have most/.test(t), 'opens on recent meals and most-had foods');
  check((t.match(/Chicken adobo, 1 cup rice/g) || []).length === 1, 'repeat meals listed once');
  await page.fill('#sq-s', 'adobo'); await page.waitForTimeout(300);
  t = await text();
  check(/Chicken adobo, 1 cup rice/.test(t) && /had 2 times/.test(t) && !/Oatmeal/.test(t), 'typing filters to matching meals and foods');
  if (SHOTS) await page.screenshot({path: SHOTS + '/search.png', fullPage: true});
  check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'sq-s'), 'the search box keeps focus while typing');
  const before = writes.length;
  await page.click('[data-a=addPastItem]'); await page.waitForTimeout(800);
  check(writes.length > before && /Added to/.test(await text()), 'one tap adds a past food (' + (writes.length - before) + ' writes)');
  await page.fill('#sq-s', 'lunch'); await page.waitForTimeout(300);
  check(/Chicken adobo, 1 cup rice/.test(await text()), 'searching a meal type finds those meals');
  check(/Not in the list\?/.test(await text()) && await page.isVisible('[data-part="sq-list"] [data-a="describeQ"]') && !(await page.$('[data-part="sq-ai"] [data-a="go"][data-v="describe"]')),
    'with results, a "not in the list" describe button follows them, and only one shows');
  await page.fill('#sq-s', 'zzzfood'); await page.waitForTimeout(300);
  check(await page.evaluate(() => (document.querySelector('[data-part="sq-list"] [data-a="describeQ"]') || {}).className) === 'cta btn', 'with no match, describing it for the AI is the main button');
  await page.click('[data-a="describeQ"]'); await page.waitForTimeout(300);
  check(await page.evaluate(() => route().name) === 'describe' && (await page.inputValue('#ds-text')) === 'zzzfood', 'describing starts with the search words');
  await page.evaluate(() => { back(); }); await page.waitForTimeout(300);
  await page.fill('#sq-s', ''); await page.waitForTimeout(200);
  check(await page.isVisible('[data-part="sq-ai"] [data-a="go"][data-v="describe"]'), 'with no search, the describe button sits at the bottom');
  await page.evaluate(() => { logState().text = ''; });
  await page.fill('#sq-s', 'zzzfood'); await page.waitForTimeout(300);
  check(/Nothing you've logged matches/.test(await text()), 'no match says so');
  await page.click('[data-a=newFood]'); await page.waitForTimeout(400);
  check(/Add an item/.test(await text()) && (await page.inputValue('#ei-name')) === 'zzzfood', 'offers to add it as a new food, name filled in');
  check(!/Filipino|Dish group/.test(await text()), 'no dish group on the item editor');

  console.log('Layout');
  check(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter !== 'stable' && Math.round(document.getElementById('app').getBoundingClientRect().left) === Math.max(0, Math.round(innerWidth / 2 - 215))), 'app centred on the window width, no reserved scrollbar strip (see web-layout.js)');
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
