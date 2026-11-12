// Version 2 flows: day navigation, warnings, micro tiles, dates on meals, copy to a date, describe, photos.
const {chromium} = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs'), assert = require('assert');
const OUT = process.argv[2]; fs.mkdirSync(OUT, {recursive: true});
(async () => {
  const b = await chromium.launch(), page = await b.newPage({viewport: {width: 390, height: 900}});
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_|Failed to load/.test(m.text())) errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'preview.html'));
  const bootStatic = await page.evaluate(() => !!document.querySelector('#app .logospin'));
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('.tabbar');
  const shot = async n => { await page.waitForTimeout(250); await page.screenshot({path: path.join(OUT, n + '.png'), fullPage: true}); };
  const ev = (f, a) => page.evaluate(f, a);
  await shot('v2-today');
  // arrows
  await page.click('[data-a="day"][data-v="-1"]'); const y = await ev(() => viewDay()); assert.strictEqual(y, await ev(() => addDays(today(), -1)));
  await shot('v2-yesterday');
  // swipe the dial right → the day before
  const box = await page.locator('.dialmove').boundingBox();
  await page.mouse.move(box.x + 60, box.y + 100); await page.mouse.down(); await page.mouse.move(box.x + 200, box.y + 105, {steps: 8}); await page.mouse.up();
  await page.waitForTimeout(300); assert.strictEqual(await ev(() => viewDay()), await ev(() => addDays(today(), -2)));
  await page.click('[data-a="day"][data-v="today"]'); assert.strictEqual(await ev(() => S.ui.day), null);
  // log for another day from Today: logs on the date on screen
  await page.click('[data-a="day"][data-v="-1"]');
  await page.click('.fab'); const ld = await ev(() => S.log.date); assert.strictEqual(ld, await ev(() => addDays(today(), -1)));
  await shot('v2-log-yesterday');
  // describe a meal
  await page.click('[data-a="go"][data-v="describe"]');
  await page.fill('#ds-text', '1 bowl tinola, 2 cups rice'); await page.waitForTimeout(100);
  await shot('v2-describe');
  await page.click('[data-a="describe"]'); await page.waitForSelector('[data-a="saveDraft"]', {timeout: 6000});
  const items = await ev(() => S.draft.items.map(i => i.name + ' ' + i.quantity)); console.log('describe →', items.join(', '));
  assert.ok(items.some(i => /Tinola/.test(i)) && items.some(i => /rice 2/.test(i)));
  // change time and type in review
  await page.click('[data-a="draftType"][data-v="Dinner"]');
  await page.fill('#draft-time', '20:15'); await page.locator('#draft-time').dispatchEvent('change');
  await shot('v2-review-when');
  await page.click('[data-a="saveDraft"]'); await page.waitForSelector('.tabbar');
  const saved = await ev(() => { const d = addDays(today(), -1); return mealsOn(d).filter(m => m.source === 'text').map(m => m.meal_type + ' ' + m.time); });
  assert.deepStrictEqual(saved, ['Dinner 20:15']);
  // edit a saved meal: move it to another date
  await page.click('[data-a="day"][data-v="today"]');
  const lunchId = await ev(() => mealsOn(today()).find(m => m.meal_type === 'Lunch').meal_id);
  await ev(id => { document.querySelector('.front[data-v="' + id + '"]').click(); }, lunchId);
  await page.waitForSelector('#draft-date');
  const two = await ev(() => addDays(today(), -3));
  await page.fill('#draft-date', two); await page.locator('#draft-date').dispatchEvent('change');
  await page.click('[data-a="saveDraft"]'); await page.waitForSelector('.tabbar');
  assert.strictEqual(await ev(id => S.data.meals.find(m => m.meal_id === id).date, lunchId), two);
  assert.strictEqual(await ev(() => viewDay()), two, 'Today shows the day the meal moved to');
  // copy to another date via the swipe menu
  await page.click('[data-a="day"][data-v="today"]');
  await ev(() => { const s = document.querySelector('.swipe'); S.ui.openSwipe = s.dataset.swipe; render(); });
  await page.click('.swipe.open [data-a="copyMeal"]'); await shot('v2-copy-menu');
  await page.click('.menu [data-a="menuPick"][data-v="1"]'); await page.waitForSelector('#draft-date');
  const tm = await ev(() => addDays(today(), 1));
  await page.fill('#draft-date', tm); await page.locator('#draft-date').dispatchEvent('change');
  await page.click('[data-a="saveDraft"]'); await page.waitForSelector('.tabbar');
  assert.ok(await ev(d => mealsOn(d).length, tm) >= 1); assert.strictEqual(await ev(() => viewDay()), tm);
  // quick add to a chosen date
  await page.click('[data-a="day"][data-v="today"]');
  await ev(() => { go('quick'); });
  const twoAgo = await ev(() => addDays(today(), -5));
  await page.fill('#log-date', twoAgo); await page.locator('#log-date').dispatchEvent('change');
  const before = await ev(d => sum(mealsOn(d), m => mealKcal(m)), twoAgo);
  await page.click('.add[data-a="addFood"]'); await page.waitForTimeout(500);
  assert.ok(await ev(d => sum(mealsOn(d), m => mealKcal(m)), twoAgo) > before);
  // photo meal: save with a thumbnail, reopen, see it, open the viewer
  await ev(() => { S.stack = [{name: 'today', p: {}}]; S.ui.day = null; S.log = null; go('log');
    const c = document.createElement('canvas'); c.width = 300; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#c9a158'; g.fillRect(0, 0, 300, 300); g.fillStyle = '#7a3'; g.fillRect(80, 80, 140, 140);
    const d = c.toDataURL('image/jpeg', .8); const L = logState(); L.img = d; L.full = {data: d.split(',')[1], mime: 'image/jpeg'}; L.thumb = c.toDataURL('image/jpeg', .6); L.meal_type = 'Dinner'; render(); });
  await page.click('[data-a="analyze"]'); await page.waitForSelector('[data-a="saveDraft"]', {timeout: 6000});
  await shot('v2-review-photo');
  await page.click('[data-a="saveDraft"]'); await page.waitForSelector('.tabbar');
  const pid = await ev(() => mealsOn(today()).find(m => m.source === 'photo' && m.meal_type === 'Dinner').meal_id);
  // simulate a fresh load: thumbnails are not in memory and come from getThumbs
  await ev(() => { S.photos = {}; });
  await ev(id => { S.draft = {mode: 'edit', source: 'photo', meal: Object.assign({}, S.data.meals.find(m => m.meal_id === id)), items: JSON.parse(JSON.stringify(itemsOf(id))), ai: null}; go('review'); }, pid);
  await page.waitForTimeout(700);
  const thumbLoaded = await ev(id => /url\(/.test(document.querySelector('[data-thumb="' + id + '"]').style.backgroundImage), pid);
  await page.click('[data-a="viewPhoto"]'); await page.waitForTimeout(600); await shot('v2-viewer');
  await page.click('.menu, .scrim button[data-a="closeViewer"]');
  // day summary thumbnails
  await ev(() => { S.photos = {}; S.stack = [{name: 'today', p: {}}]; go('day', {d: today()}); }); await page.waitForTimeout(600); await shot('v2-day');
  // over-target warning appears when over
  await ev(() => { S.stack = [{name: 'today', p: {}}]; S.ui.day = null; render(); });
  await shot('v2-today-after');
  const warn = await ev(() => !!document.querySelector('.warn'));
  console.log(JSON.stringify({errors, bootStatic, thumbLoaded, warn}));
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
