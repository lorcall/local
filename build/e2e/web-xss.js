// Hostile text everywhere the app reads text from: the user's Sheet, Gemini's answers and error
// messages. A food label photo can carry any text, and Gemini copies label text faithfully, so
// none of it may ever become markup. Pass: nothing runs and no injected element or attribute exists.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8791);
let failures = 0;
const check = (ok, what) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + what); if (!ok) failures++; };

const X = '"\'><img data-pwn src=x onerror="window.__pwned=(window.__pwned||[]).concat(location.hash||1)"><svg data-pwn onload="window.__pwned=1">';
const CSSX = 'x\');background:red" data-pwn="1" onmouseover="window.__pwned=1';
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
  await page.goto('http://localhost:8791/web/index.html'); await page.waitForTimeout(2500);

  const seen = [];
  const sweep = async where => {
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({
      ran: window.__pwned || null,
      els: document.querySelectorAll('[data-pwn]').length,
      on: [...document.querySelectorAll('#app *')].filter(el => [...el.attributes].some(a => /^on/i.test(a.name))).map(el => el.tagName + ' ' + [...el.attributes].map(a => a.name).join(',')).slice(0, 3),
      js: [...document.querySelectorAll('#app [src],#app [href]')].filter(el => /^\s*javascript:/i.test(el.getAttribute('src') || el.getAttribute('href'))).length,
      where: [...document.querySelectorAll('[data-pwn]')].map(el => (el.parentElement ? el.parentElement.outerHTML : el.outerHTML).slice(0, 260)).slice(0, 3)
    }));
    await page.evaluate(() => { window.__pwned = null; document.querySelectorAll('[data-pwn]').forEach(el => el.remove()); });
    seen.push(where);
    check(!r.ran && !r.els && !r.on.length && !r.js, where + (r.ran || r.els || r.on.length || r.js ? ': ' + JSON.stringify(r) : ''));
  };
  const go = async (name, p) => { await page.evaluate(([n, q]) => go(n, q || {}), [name, p]); await sweep('screen ' + name + (p ? ' ' + JSON.stringify(p) : '')); };

  await sweep('today with hostile sheet data');
  for (const s of ['history', 'trends', 'targets', 'goals', 'settings', 'weekly', 'topfoods', 'consistency', 'weight', 'search', 'describe', 'log'])
    await go(s);
  await go('day', {d: '2026-11-12'});
  await go('day', {d: '2026-11-13'});
  // search for the hostile favourite so its result row renders
  await page.evaluate(() => go('search', {}));
  const sq = await page.$('input[type=search], #sq, .scr input');
  if (sq) { await sq.fill('img'); await sweep('search results with hostile names'); }

  // open a hostile meal for editing, then one of its items
  await page.evaluate(() => go('day', {d: '2026-11-12'}));
  await page.waitForTimeout(300);
  const ed = await page.$('button[data-a=editMeal]:not(.ib)');
  if (ed) { await ed.click(); await sweep('editing a hostile meal');
    const it = await page.$('[data-a=editItem]'); if (it) { await it.click(); await sweep('editing a hostile item'); }
  } else check(false, 'found a meal to edit');

  // the full photo viewer: hostile Content-Type from Drive
  await page.evaluate(() => go('day', {d: '2026-11-12'}));
  await page.waitForTimeout(300);
  const th = await page.$('[data-a=viewPhoto], [data-a=openPhoto], .th[data-thumb]');
  if (th) { await th.click().catch(() => {}); await page.waitForTimeout(800); await sweep('photo viewer with a hostile file type'); }

  // Gemini answers: a meal and a label, every text field hostile; then a hostile error
  const item = {name: X, category: X, serving_unit: X, quantity: 1, grams_per_unit: 100, kcal: 100, protein_g: 1, carbs_g: 1, fat_g: 1, sugar_g: 1, fiber_g: 1, sodium_mg: 1, confidence: X, reason: X};
  const shoot = async (reply, where) => {
    aiReply = reply;
    await page.evaluate(() => { S.log = null; S.label = null; S.draft = null; S.stack = [{name: 'today', p: {}}]; render(); go('log', {}); });
    await page.waitForTimeout(300);
    await page.setInputFiles('#galIn', path.join(ROOT, 'icons', 'icon-192.png')); await page.waitForTimeout(700);
    await page.fill('#lm-note', X).catch(() => {});
    await page.click('[data-a=analyze]'); await page.waitForTimeout(1200);
    await sweep(where);
  };
  await shoot({result: {kind: 'meal', items: [item, item], confidence: X, reason: X}}, 'review screen from a hostile meal answer');
  const it2 = await page.$('[data-a=editItem]'); if (it2) { await it2.click(); await sweep('editing a hostile AI item'); }
  await shoot({result: {kind: 'label', product: X, serving_g: 30, servings_per_pack: 2, per_serving: {kcal: 100, protein_g: 1, carbs_g: 1, fat_g: 1, sugar_g: 1, fiber_g: 1, sodium_mg: 1}, unread_fields: [X], confidence: X}}, 'label screen from a hostile label answer');
  await shoot({error: X}, 'a hostile error message');
  aiReply = {result: {text: X, suggestions: [X, X]}};
  await page.evaluate(() => go('weekly', {}));
  const wb = await page.$('[data-a=weekly], [data-a=makeSummary], [data-a=summary]');
  if (wb) { await wb.click(); await page.waitForTimeout(800); }
  await sweep('weekly summary with hostile AI text');

  const v = await page.evaluate(() => window.__csp);
  check(!v.length, 'the app itself breaks no security policy rule' + (v.length ? ': ' + v.slice(0, 4).join(' | ') : ''));
  // The backstop: markup that slips through anyway still cannot run.
  const blocked = await page.evaluate(() => new Promise(res => {
    const d = document.createElement('div'); d.innerHTML = '<img src="data:," onerror="window.__ran=1">';
    document.body.appendChild(d); setTimeout(() => res(!window.__ran && window.__csp.length > 0), 400);
  }));
  check(blocked, 'an injected inline handler is blocked by the security policy');
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(failures ? '\n' + failures + ' failed' : '\nall passed');
  await browser.close(); server.close(); process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
