// Goal calculator notes for the AI: check, compare, use, and the notes kept in the Targets row.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
}).listen(8817);
let failures = 0, window_targets_writes = 0; const targetRows = [], proxySent = [];
const check = (ok, what) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + what); if (!ok) failures++; };

const X = 'Oats';
const CSSX = '';
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const E = (id, meal) => [id, meal, X, X, X, '150', X, '1', '400', '10', '20', '5', '1', '1', '100', X, 'FALSE', X];
const DATA = {
  Settings: [['key','value'],['onboarded','yes'],['week_start', X],['units', X],['weekly_summary:2026-11-09', JSON.stringify({text: X, suggestions: [X, X]})]],
  Targets: [['effective_date','kcal','protein_g','carbs_g','fat_g','fiber_min_g','sugar_max_g','sodium_max_mg','basis','notes','ai_summary'],
    ['2026-01-01','1750','119','185','58','25','50','2300','Calculator','Old notes <b>bold</b>',''],
    ['2026-02-01','1800','119','185','58','25','50','2300','Manual','','']],
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
    if (u.includes('Targets') && (u.includes(':append') || route.request().method() === 'PUT')) { window_targets_writes++; targetRows.push(JSON.parse(route.request().postData()).values[0]); }
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
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.goto('http://localhost:8817/web/index.html'); await page.waitForTimeout(2500);




  const ADJ = {kcal: 1800, protein_g: 80, carbs_g: 248, fat_g: 60, fiber_min_g: 35, sugar_max_g: 50, sodium_max_mg: 2300,
    summary: 'Less protein for your condition, more fibre as asked.', caution: 'A doctor should confirm.', changes: [{field: 'protein_g', reason: 'Easier on the kidneys'}, {field: 'fiber_min_g', reason: 'You asked for more fibre'}]};
  const state = () => page.evaluate(() => ({
    notes: (document.getElementById('gc-notes') || {}).value, from: (document.querySelector('[data-part="gc-nfrom"]') || {}).textContent,
    cta: [...document.querySelectorAll('[data-part="gc-ai"] button')].map(b => b.textContent.trim() + (b.disabled ? ' (off)' : '')),
    card: (document.querySelector('.gc-cmp') || {}).textContent || '', stale: /Out of date/.test(document.querySelector('[data-part="gc-ai"]').textContent),
    clear: !!document.querySelector('[data-a="gcClear"]')}));
  await page.evaluate(() => go('goals')); await page.waitForTimeout(400);
  let s = await state();
  check(s.notes === 'Old notes <b>bold</b>' && /Your notes from January 1/.test(s.from) && s.clear, 'the last calculator notes are filled in, with their date (' + JSON.stringify(s.notes) + ')');
  check(s.cta[0] === 'Check with AI' && s.cta[1] === 'Use calculated targets', 'with notes, the main button checks with AI (' + s.cta + ')');

  await page.fill('#gc-notes', 'I want more fibre. My doctor says not too much protein.'); await page.waitForTimeout(100);
  check(/Optional/.test((await state()).from), 'changed notes drop the "from" line');
  aiReply = {result: ADJ};
  await page.click('[data-a="gcAsk"]'); await page.waitForTimeout(80);
  s = await state();
  check(/Checking with AI \(off\)/.test(s.cta.join()), 'shows it is checking (' + s.cta + ')');
  await page.waitForTimeout(600); s = await state();
  const sent = proxySent.find(x => x.action === 'adjustTargets');
  check(sent && sent.payload.notes === 'I want more fibre. My doctor says not too much protein.' && Object.keys(sent.payload.profile).sort().join() === 'activity,age,goal,height,pace,sex,target_weight,weight'
    && sent.payload.base.fiber_min_g === 25 && sent.payload.base.kcal > 0, 'sends the notes, the profile and the calculated targets, nothing more');
  check(/Protein/.test(s.card) && /80 g/.test(s.card) && /35 g/.test(s.card) && /Easier on the kidneys/.test(s.card) && !s.stale, 'shows calculated against adjusted, with reasons');
  check(s.cta[0] === 'Use adjusted targets' && s.cta[1] === 'Use calculated targets', 'offers both (' + s.cta + ')');
  const mango = await page.evaluate(() => [...document.querySelectorAll('.gc-cmp span')].filter(x => /color:\s*var\(--ai\)/.test(x.getAttribute('style') || '')).map(x => x.textContent));
  check(mango.includes('80 g') && mango.includes('35 g') && !mango.includes('50 g') && !mango.includes('2,300 mg'), 'changed values stand out (' + mango + ')');

  await page.type('#gc-notes', ' Low sodium too.'); await page.waitForTimeout(150); s = await state();
  check(s.stale && s.cta[0] === 'Check again with AI', 'editing the notes marks the check out of date (' + s.cta + ')');
  await page.fill('#gc-age', '41'); await page.waitForTimeout(100);
  await page.click('[data-a="gcAsk"]'); await page.waitForTimeout(800); s = await state();
  check(!s.stale && s.cta[0] === 'Use adjusted targets', 'checking again brings it up to date');

  await page.click('[data-a="useTargets"][data-v="ai"]'); await page.waitForTimeout(1200);
  let row = targetRows[targetRows.length - 1] || [];
  check(row[1] === 1800 && row[2] === 80 && row[5] === 35 && row[8] === 'Calculator + AI' && /Low sodium too/.test(row[9]) && /Less protein/.test(row[10]), 'saves the adjusted targets with basis, notes and summary (' + JSON.stringify(row) + ')');
  const tg = await page.evaluate(() => document.getElementById('app').textContent);
  check(/adjusted by AI for your notes/.test(tg) && /Less protein for your condition/.test(tg), 'the Targets screen says how they were set');

  await page.evaluate(() => go('goals')); await page.waitForTimeout(400); s = await state();
  check(/Low sodium too/.test(s.notes) && /Your notes from/.test(s.from) && !s.card, 'recalculating fills in the same notes again');
  await page.click('[data-a="gcClear"]'); await page.waitForTimeout(150); s = await state();
  check(s.notes === '' && s.cta.join() === 'Use these targets' && !s.clear, 'clearing empties the notes and goes back to one button');
  check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'gc-notes'), 'clearing leaves the cursor in the notes for new ones');
  await page.click('[data-a="useTargets"]'); await page.waitForTimeout(1200);
  row = targetRows[targetRows.length - 1] || [];
  check(row[8] === 'Calculator' && row[9] === '' && row[10] === '', 'calculated targets save with the notes cleared (' + JSON.stringify(row.slice(8)) + ')');
  await page.evaluate(() => go('goals')); await page.waitForTimeout(400); s = await state();
  check(s.notes === '', 'cleared notes stay cleared next time');

  await page.evaluate(() => go('targets', {})); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('[data-a="tgKcal"][data-v="50"]').click()); await page.waitForTimeout(100);
  await page.evaluate(() => document.querySelector('[data-part="tg-save"]').click()); await page.waitForTimeout(1000);
  row = targetRows[targetRows.length - 1] || [];
  check(row[8] === 'Manual', 'a change on the Targets screen is marked Manual');

  await page.evaluate(() => go('goals')); await page.waitForTimeout(300);
  await page.fill('#gc-notes', 'something'); aiReply = {error: 'Gemini is busy. Try again in a minute.'};
  await page.click('[data-a="gcAsk"]'); await page.waitForTimeout(800);
  const warn = await page.evaluate(() => (document.querySelector('[data-part="gc-ai"] .warn') || {}).textContent || '');
  check(/busy/.test(warn) && /notes are kept/.test(warn) && (await state()).notes === 'something', 'an AI error is shown and the notes are kept');

  check(!(await page.evaluate(() => window.__pwned)), 'notes from the Sheet are shown as text');
  check(!(await page.evaluate(() => window.__csp.length)), 'no CSP violations');
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(failures ? '\n' + failures + ' failed' : '\nall passed');
  await browser.close(); server.close(); process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
