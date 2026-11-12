// Swiping and paging the calendar, the trends chart and the Today dial, with sample history from Oct 20.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), SHOTS = process.env.SHOTS;  // set SHOTS to a folder to save screenshots
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8792);
let failures = 0;
const check = (ok, what) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + what); if (!ok) failures++; };
const ymd = d => d.toISOString().slice(0, 10);
const meals = [['meal_id','date','time','meal_type','photo_url','note','confidence','confidence_reason','source','edited']];
const entries = [['entry_id','meal_id','name','category','serving_unit','grams_per_unit','serving_label','quantity','kcal','protein_g','carbs_g','fat_g','sugar_g','fiber_g','sodium_mg','confidence','edited','reason']];
const now = new Date(); now.setHours(12);
for (let d = new Date(now.getFullYear(), now.getMonth() - 1, 20, 12); d < now; d.setDate(d.getDate() + 1)) {
  const k = ymd(d), id = 'm' + k; meals.push([id, k, '12:00', 'Lunch', '', '', 'high', '', 'photo', 'FALSE']);
  entries.push(['e' + k, id, 'Rice bowl', 'staple', 'bowl', 300, '', 1, 600, 20, 90, 12, 4, 3, 500, 'high', 'FALSE', '']);
}
const DATA = {Settings: [['key','value'],['onboarded','yes']], Targets: [['effective_date','kcal','protein_g','carbs_g','fat_g'],['2020-01-01','1750','119','185','58']], Meals: meals, Entries: entries};
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
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
    if (u.includes('values:batchGet')) { const rs = [...u.matchAll(/ranges=([^&]+)/g)].map(x => x[1]); return j({valueRanges: rs.map(r => ({values: /!1:1$/.test(r) ? [] : (DATA[r.split('!')[0]] || [])}))}); }
    return j({});
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8792/web/index.html'); await page.waitForTimeout(2500);
  const drag = async (sel, dx) => {
    const b = await page.locator(sel).first().boundingBox(), y = b.y + b.height / 2, x = b.x + b.width / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x + dx * i / 8, y + 2);
    await page.mouse.up(); await page.waitForTimeout(350);
  };
  const monthLabel = () => page.locator('header [aria-live]').first().innerText();
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const thisM = MONTHS[now.getMonth()], lastM = MONTHS[(now.getMonth() + 11) % 12];

  console.log('Calendar');
  await page.click('[data-a=tab][data-v=history]'); await page.waitForTimeout(400);
  check((await monthLabel()) === thisM, 'opens on ' + thisM);
  await drag('[data-hswipe=monthStep]', -200);
  check((await monthLabel()) === thisM, 'swiping left past this month does nothing');
  await drag('[data-hswipe=monthStep] .day', 200);
  check((await monthLabel()).startsWith(lastM), 'swiping right, even starting on a day, shows ' + lastM);
  check(await page.evaluate(() => !!document.querySelector('[data-hswipe=monthStep]')), 'the swipe did not open that day');
  check(await page.locator('[data-a=monthStep][data-v="-1"]').isDisabled(), 'back stops at the first month with meals');
  await drag('[data-hswipe=monthStep]', 200);
  check((await monthLabel()).startsWith(lastM), 'swiping right past the first month does nothing');
  await drag('[data-hswipe=monthStep]', -200);
  check((await monthLabel()) === thisM, 'swiping left comes back');
  await page.locator('[data-hswipe=monthStep] button.day').first().click(); await page.waitForTimeout(300);
  check(!(await page.$('[data-hswipe=monthStep]')), 'a plain tap on a day still opens it');

  await page.click('[data-a=back]'); await page.waitForTimeout(300);
  console.log('Bar graph');
  await page.click('[data-a=tab][data-v=trends]'); await page.waitForTimeout(400);
  const period = () => page.locator('[data-a=trendStep][data-v="-1"] + span').innerText();
  const p0 = await period();
  check(await page.locator('[data-a=trendStep][data-v="1"]').isDisabled(), 'starts on the latest period (' + p0 + '), later disabled');
  if (SHOTS) await page.screenshot({path: SHOTS + '/trends.png'});
  await drag('[data-hswipe=trendStep]', 200);
  const p1 = await period();
  check(p1 !== p0, 'swiping right shows the week before (' + p1 + ')');
  await page.click('[data-a=trendStep][data-v="1"]'); await page.waitForTimeout(300);
  check((await period()) === p0, 'the later arrow comes back');
  await page.locator('[data-hswipe=trendStep]').hover();
  await page.mouse.wheel(-120, 0); await page.waitForTimeout(300);
  check((await period()) === p1, 'a sideways trackpad scroll steps back');
  for (let i = 0; i < 6; i++) { await drag('[data-hswipe=trendStep]', 200); }
  check(await page.locator('[data-a=trendStep][data-v="-1"]').isDisabled(), 'back stops at the first logged week (' + (await period()) + ')');
  await page.click('[data-a=range][data-v="30 days"]'); await page.waitForTimeout(300);
  check(await page.locator('[data-a=trendStep][data-v="1"]').isDisabled(), 'changing range returns to the latest period');

  console.log('Today dial');
  await page.click('[data-a=tab][data-v=today]'); await page.waitForTimeout(400);
  await drag('[data-hswipe=day]', -200);
  check(/Tomorrow/.test(await page.locator('header').first().innerText()), 'swiping the dial left still goes to tomorrow');
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
