// Chip rows and tracks: the selection stretches to the new choice; rows that switch the view glide what's below.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8794);
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
  await page.goto('http://localhost:8794/web/index.html'); await page.waitForTimeout(2500);



  const sel = q => page.evaluate(q => {
    const g = document.querySelector(q), ind = g.querySelector(':scope > .selind'), on = g.querySelector(':scope > [aria-checked="true"], :scope > [aria-selected="true"]');
    const r = ind.getBoundingClientRect(), o = on.getBoundingClientRect(), gh = document.querySelector('.tabghost');
    const cx = o.left + o.width / 2, cy = o.top + o.height / 2, hit = document.elementFromPoint(cx, cy);
    return {off: Math.round(r.left - o.left), dw: Math.round(r.width - o.width), dh: Math.round(r.height - o.height), w: Math.round(r.width), ow: Math.round(o.width),
      ghost: !!gh, clip: gh ? gh.style.clipPath : '', anims: ind.getAnimations().length, label: hit ? (hit.className || hit.tagName) : '', scroll: Math.round(g.scrollLeft),
      onVisible: o.left >= g.getBoundingClientRect().left - 1 && o.right <= g.getBoundingClientRect().right + 1};
  }, q);
  const goTo = async n => { await page.evaluate(n => go(n, {}), n); await page.waitForTimeout(250); };
  const rest = (s, what) => check(s.off === 0 && s.dw === 0 && s.dh === 0 && !s.ghost, what + ' (' + JSON.stringify(s) + ')');

  // Trends: the 7 days / 30 days / Custom track
  await goTo('trends');
  rest(await sel('.track[aria-label="Range"]'), 'Trends: the tile sits exactly on the chosen range');
  check((await sel('.track[aria-label="Range"]')).label === 'cl', 'the chosen label is drawn above the tile');
  await page.click('.track[aria-label="Range"] [data-v="30 days"]'); await page.waitForTimeout(150);
  let s = await sel('.track[aria-label="Range"]');
  check(s.w > s.ow + 10 && s.anims === 1, 'the tile stretches toward 30 days (' + s.w + ' vs ' + s.ow + ')');
  check(s.ghost && /^inset\(\d+(\.\d+)?px 0px 0px( 0px)?\)$/.test(s.clip), 'the chart glides, the title and range row stay put (' + s.clip + ')');
  const top = await page.evaluate(() => [document.querySelector('#app h1').getBoundingClientRect().bottom, parseFloat(document.querySelector('.tabghost').style.clipPath.slice(6))]);
  check(top[1] >= top[0], 'the gliding part starts below the header');
  await page.waitForTimeout(600);
  rest(await sel('.track[aria-label="Range"]'), 'the tile settles on 30 days and the old chart is gone');
  await page.click('.track[aria-label="Range"] [data-v="7 days"]'); await page.waitForTimeout(650);
  rest(await sel('.track[aria-label="Range"]'), 'back to 7 days');

  // Where calories come from: a scrolling chip row
  await goTo('topfoods');
  const Q = '.chips[aria-label="Measure"]';
  rest(await sel(Q), 'Top foods: the well sits exactly on Calories');
  const last = await page.evaluate(q => { const b = [...document.querySelectorAll(q + ' > [data-v]')]; return b[b.length - 1].dataset.v; }, Q);
  await page.evaluate(([q, v]) => document.querySelector(q + ' [data-v="' + v + '"]').click(), [Q, last]);
  await page.waitForTimeout(150);
  s = await sel(Q);
  check(s.w > s.ow + 30 && s.ghost, 'the well stretches toward ' + last + ' and the cards glide (' + s.w + ')');
  await page.waitForTimeout(800);
  s = await sel(Q);
  rest(s, 'the well settles on ' + last);
  check(s.scroll > 0 && s.onVisible, 'the row scrolled ' + last + ' into view (' + s.scroll + ')');
  await page.evaluate(q => document.querySelector(q + ' [data-v="Protein"]').click(), Q); await page.waitForTimeout(900);
  rest(await sel(Q), 'and back to Protein');
  // a redraw that changes nothing keeps the row where it was scrolled and doesn't animate
  await page.evaluate(q => { document.querySelector(q).scrollLeft = 40; render(); }, Q);
  s = await sel(Q);
  check(s.scroll === 40 && s.anims === 0 && !s.ghost, 'an ordinary redraw leaves the row and the well alone');

  // Consistency
  await goTo('consistency');
  rest(await sel('.chips[aria-label="Target"]'), 'Consistency: the well sits on the chosen target');
  await page.evaluate(() => { const b = document.querySelectorAll('.chips[aria-label="Target"] > [data-v]'); b[1].click(); });
  await page.waitForTimeout(150); s = await sel('.chips[aria-label="Target"]');
  check(s.anims === 1 && s.ghost, 'Consistency: the well stretches and the view glides');
  await page.waitForTimeout(800); rest(await sel('.chips[aria-label="Target"]'), 'Consistency: settles');

  // a form row: only the tile moves
  await goTo('log');
  const M = '.chips[aria-label="Meal"]';
  rest(await sel(M), 'Log: the well sits on the meal type');
  const cur = await page.evaluate(m => document.querySelector(m + ' [aria-checked="true"]').dataset.v, M);
  const to = cur === 'Dinner' ? 'Breakfast' : 'Dinner';
  await page.click(M + ' [data-v="' + to + '"]'); await page.waitForTimeout(150); s = await sel(M);
  check(s.anims === 1 && !s.ghost, 'meal type: the well stretches, the form doesn\'t glide');
  await page.waitForTimeout(600); rest(await sel(M), 'meal type: settles on ' + to);

  // the window changes width: indicators follow
  await page.setViewportSize({width: 360, height: 844}); await page.waitForTimeout(300);
  rest(await sel(M), 'after a resize the well still fits the chosen chip');
  await page.setViewportSize({width: 390, height: 844}); await page.waitForTimeout(300);

  // reduced motion: instant
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.click(M + ' [data-v="Lunch"]'); await page.waitForTimeout(30);
  rest(await sel(M), 'with reduced motion the well moves instantly');

  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(failures ? '\n' + failures + ' failed' : '\nall passed');
  await browser.close(); server.close(); process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
