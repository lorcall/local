// Save targets: greyed out until something would actually change.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8800);
let failures = 0, window_targets_writes = 0;
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
    if (u.includes(':append') && u.includes('Targets')) window_targets_writes++;
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
  await page.goto('http://localhost:8800/web/index.html'); await page.waitForTimeout(2500);




  const btn = () => page.evaluate(() => { const b = document.querySelector('[data-part="tg-save"]'); const cs = getComputedStyle(b);
    return {disabled: b.disabled, idle: b.classList.contains('idle'), bg: cs.backgroundColor}; });
  await page.evaluate(() => go('targets', {})); await page.waitForTimeout(400);
  let b = await btn();
  check(b.disabled && b.idle && !/245, 165, 36/.test(b.bg), 'opens greyed out (' + JSON.stringify(b) + ')');
  await page.evaluate(() => { const b = document.querySelector('[data-part="tg-save"]'); b.disabled = false; b.click(); b.disabled = true; }); await page.waitForTimeout(300);
  check(window_targets_writes === 0, 'tapping it greyed out saves nothing');

  await page.evaluate(() => document.querySelector('[data-a="tgKcal"][data-v="50"]').click()); await page.waitForTimeout(150); b = await btn();
  check(!b.disabled && !b.idle && /245, 165, 36/.test(b.bg), 'lights up after + 50 kcal');
  await page.evaluate(() => document.querySelector('[data-a="tgKcal"][data-v="-50"]').click()); await page.waitForTimeout(150); b = await btn();
  check(b.disabled && b.idle, 'greys out again when set back');

  const orig = await page.inputValue('#tg-protein_g');
  await page.fill('#tg-protein_g', String(Number(orig) + 5)); await page.waitForTimeout(100); b = await btn();
  check(!b.disabled, 'lights up while typing a new protein figure, before leaving the field');
  check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'tg-protein_g'), 'typing keeps the field focused');
  await page.fill('#tg-protein_g', orig); await page.waitForTimeout(100); b = await btn();
  check(b.disabled, 'greys out when the original figure is typed back');

  await page.evaluate(() => document.querySelector('[data-a="tgToggle"]').click()); await page.waitForTimeout(150); b = await btn();
  check(!b.disabled, 'lights up when a limit is switched off');
  await page.evaluate(() => document.querySelector('[data-a="tgToggle"]').click()); await page.waitForTimeout(150); b = await btn();
  check(b.disabled, 'greys out when it is switched back on');

  await page.click('.track [data-v="Percent"]'); await page.waitForTimeout(600); b = await btn();
  check(b.disabled, 'switching to Percent alone is not a change');
  await page.click('.track [data-v="Grams"]'); await page.waitForTimeout(600);

  await page.evaluate(() => document.querySelector('[data-a="tgKcal"][data-v="50"]').click()); await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('[data-part="tg-save"]').click()); await page.waitForTimeout(800);
  check(window_targets_writes === 1, 'a real change saves once (' + window_targets_writes + ')');
  await page.evaluate(() => go('targets', {})); await page.waitForTimeout(400); b = await btn();
  check(b.disabled, 'after saving, the new targets are the baseline and the button is grey');

  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(failures ? '\n' + failures + ' failed' : '\nall passed');
  await browser.close(); server.close(); process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
