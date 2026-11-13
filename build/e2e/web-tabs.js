// Tab switching: the tile stretches from tab to tab and screens glide, with nothing left behind.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8792);
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
  await page.goto('http://localhost:8792/web/index.html'); await page.waitForTimeout(2500);


  const state = () => page.evaluate(() => {
    const bar = document.querySelector('#app .tabbar'), ind = bar && bar.querySelector('.tabind'), on = bar && bar.querySelector('.nb[aria-current]');
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    const r = ind && ind.getBoundingClientRect(), o = on && on.getBoundingClientRect();
    return {route: S.stack[S.stack.length - 1].name, scr: document.querySelectorAll('#app > .scr').length, ghosts: document.querySelectorAll('.tabghost').length,
      tileOff: r && o ? Math.round(r.left + r.width / 2 - (o.left + o.width / 2)) : null, tileW: r ? Math.round(r.width) : null,
      tileShown: ind ? getComputedStyle(ind).opacity : null, dup};
  });
  const tap = v => page.click('#app .tabbar .nb[data-v="' + v + '"]');

  let s = await state();
  check(s.route === 'today' && s.tileOff === 0 && s.tileShown === '1', 'the tile sits under Today on open (' + JSON.stringify(s) + ')');

  await tap('history');
  await page.waitForTimeout(140);
  s = await state();
  check(s.tileW > 80, 'the tile stretches on its way to History (width ' + s.tileW + ')');
  check(s.ghosts === 1, 'the old screen glides out on top while the new one comes in');
  check(!s.dup.length, 'no duplicate ids while both screens show (' + s.dup.join(',') + ')');
  const mid = await page.evaluate(() => getComputedStyle(document.querySelector('#app > .scr')).opacity);
  check(Number(mid) < 1, 'the new screen is still fading in (' + mid + ')');
  await page.waitForTimeout(600);
  s = await state();
  check(s.route === 'history' && s.tileOff === 0 && s.tileW === 48, 'the tile settles 48 px wide, centred under History');
  check(s.ghosts === 0 && s.scr === 1, 'the old screen is gone afterwards');

  // backwards, and every tab
  for (const v of ['targets', 'trends', 'today', 'targets']) {
    await tap(v); await page.waitForTimeout(650); s = await state();
    check(s.route === v && s.tileOff === 0 && s.tileW === 48 && !s.ghosts, 'to ' + v + ': tile centred, nothing left over');
  }

  // quick taps: each new switch starts from wherever the last one was
  await tap('today'); await page.waitForTimeout(90); await tap('history'); await page.waitForTimeout(60); await tap('trends');
  await page.waitForTimeout(140);
  s = await state();
  check(s.ghosts <= 1, 'quick taps never stack old screens (' + s.ghosts + ')');
  await page.waitForTimeout(600);
  s = await state();
  check(s.route === 'trends' && s.tileOff === 0 && s.tileW === 48 && !s.ghosts && s.scr === 1, 'quick taps end cleanly on Trends');

  // tapping the tab you're on does nothing visible
  await tap('trends'); await page.waitForTimeout(60); s = await state();
  check(!s.ghosts, 'tapping the current tab doesn\'t animate');

  // other screens have no tile; coming back puts it in place without a jump from nowhere
  await page.evaluate(() => go('settings', {})); await page.waitForTimeout(200);
  s = await state();
  check(s.tileShown === null || s.tileShown === '0', 'screens without the tab bar have no tile');
  await page.evaluate(() => back()); await page.waitForTimeout(200);
  s = await state();
  check(s.tileOff === 0 && s.tileShown === '1', 'back on a tab, the tile is in place');

  // a redraw that isn't a tab switch keeps the tile still
  await page.evaluate(() => render()); s = await state();
  check(s.tileOff === 0 && !s.ghosts, 'ordinary redraws leave the tile where it is');

  // the tab bar still works by keyboard and screen reader
  const aria = await page.evaluate(() => [...document.querySelectorAll('#app .tabbar .nb')].map(b => b.getAttribute('aria-label') + (b.getAttribute('aria-current') ? '*' : '')).join(' '));
  check(/Trends\*/.test(aria), 'the current tab is still announced (' + aria + ')');

  // reduced motion: an instant switch
  await page.emulateMedia({reducedMotion: 'reduce'});
  await tap('history'); await page.waitForTimeout(30); s = await state();
  check(!s.ghosts && s.tileOff === 0 && s.tileW === 48, 'with reduced motion the switch is instant');

  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(failures ? '\n' + failures + ' failed' : '\nall passed');
  await browser.close(); server.close(); process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
