// Smoke test: opens the demo preview at phone size, visits every screen, runs the main flows,
// records console errors and saves a screenshot of each screen.
const {chromium} = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.argv[2] || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, {recursive: true});
const WIDTH = +(process.argv[3] || 390);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: WIDTH, height: 900}, deviceScaleFactor: 1});
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'preview.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.tabbar', {timeout: 8000});
  const shot = async name => { await page.waitForTimeout(250); await page.screenshot({path: path.join(OUT, name + '.png'), fullPage: true}); };
  const go = async (name, p) => { await page.evaluate(([n, p]) => { S.stack = [{name: 'today', p: {}}]; S.menu = null; if (n !== 'today') go(n, p || {}); else render(); }, [name, p]); };
  const click = async sel => { await page.click(sel); await page.waitForTimeout(200); };

  for (const n of ['today', 'trends', 'history', 'targets', 'settings', 'goals', 'quick', 'dishes', 'weekly', 'topfoods', 'consistency', 'weight', 'welcome']) { await go(n); await shot(n); }
  const t = await page.evaluate(() => today());
  await go('day', {d: t}); await shot('day');

  // Log a meal: fake a photo, analyze (demo), review, edit an item, save
  await go('log'); await shot('log-empty');
  await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d');
    g.fillStyle = '#c9a158'; g.fillRect(0, 0, 400, 300); g.fillStyle = '#eee8da'; g.beginPath(); g.arc(200, 150, 110, 0, 7); g.fill();
    const d = c.toDataURL('image/jpeg', .8); const L = logState(); L.img = d; L.full = {data: d.split(',')[1], mime: 'image/jpeg'}; L.thumb = d; L.note = 'Sinigang na baboy, one bowl. Rice is one cup.'; L.meal_type = 'Dinner'; render();
  });
  await shot('log-photo');
  await click('[data-a="analyze"]');
  await page.waitForSelector('[data-a="saveDraft"]', {timeout: 6000});
  await shot('review');
  await click('[data-a="editItem"][data-v="0"]');
  await page.fill('#ei-name', 'Sinigang na manok');
  await page.fill('#ei-g', '300');
  await page.locator('#ei-g').press('Tab');
  await shot('edit');
  await click('[data-a="tglDefault"]');
  await click('[data-a="doneItem"]');
  await click('[data-a="itemQty"][data-i="1"][data-v="1"]');
  await click('[data-a="saveDraft"]');
  await page.waitForSelector('.tabbar');
  const dinner = await page.evaluate(() => mealsOn(today()).filter(m => m.meal_type === 'Dinner').length);
  await shot('today-after-save');

  // Label scan
  await page.evaluate(() => { const L = logState(); L.mode = 'label'; L.meal_type = 'Snack'; const d = S.log.thumb || ''; L.img = L.img || d; render(); });
  await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 300; const d = c.toDataURL('image/jpeg'); const L = logState(); L.img = d; L.full = {data: d.split(',')[1], mime: 'image/jpeg'}; L.thumb = d; S.stack = [{name: 'today', p: {}}]; go('log'); });
  await click('[data-a="analyze"]');
  await page.waitForSelector('[data-a="saveLabel"]', {timeout: 6000});
  await page.fill('#ls-sodium_mg', '180');
  await click('[data-a="labelServ"][data-v="1"]');
  await shot('label');
  await click('[data-a="saveLabel"]');
  await page.waitForSelector('.tabbar');

  // Quick add: add a favorite, open the menu, search
  await go('quick');
  await click('.add[data-a="addFood"]');
  await click('[data-a="foodMenu"]');
  await shot('quick-menu');
  await click('[data-a="menuClose"].mi');
  await page.fill('#qa-s', 'adobo');
  await shot('quick-search');

  // Swipe-row actions and delete
  await go('today');
  await page.evaluate(() => { const s = document.querySelector('.swipe'); S.ui.openSwipe = s.dataset.swipe; render(); });
  await shot('today-swiped');
  await click('.swipe.open [data-a="deleteMeal"]');
  await shot('confirm-delete');
  await click('.menu [data-a="menuPick"]');

  // Trends 30 days, weekly summary, consistency protein, weight save, targets save, goal calc
  await go('trends'); await click('[data-a="range"][data-v="30 days"]'); await shot('trends-30');
  await go('weekly'); await click('[data-a="writeSummary"]'); await page.waitForTimeout(1600); await shot('weekly-summary');
  await go('consistency'); await click('[data-a="cm"][data-v="Protein"]'); await shot('consistency-protein');
  await go('weight'); await page.fill('#wt-in', '72.4'); await click('[data-a="saveWeight"]'); await shot('weight-saved');
  await go('goals'); await page.fill('#gc-age', '34'); await shot('goals-typed'); await click('[data-a="useTargets"]'); await page.waitForTimeout(300); await shot('targets-after-calc');
  await go('targets'); await click('[data-a="tgKcal"][data-v="50"]'); await click('[data-a="saveTargets"]'); await page.waitForTimeout(400);
  await go('dishes'); await click('[data-a="newDish"]'); await page.fill('#ei-name', 'Pancit bihon'); await shot('dish-new');

  const target = await page.evaluate(() => currentTarget().kcal);
  console.log(JSON.stringify({errors, dinnerMeals: dinner, targetNow: target}, null, 1));
  await browser.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
