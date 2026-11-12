// Runs the Apps Script server code in Node against in-memory fakes of SpreadsheetApp,
// DriveApp, UrlFetchApp and friends, to check the Sheet logic and the Gemini plumbing.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const dir = path.join(__dirname, '..', 'apps-script');

function makeSheet(name) {
  const rows = []; // array of arrays
  let maxCols = 26, maxRows = 1000;
  const sh = {
    name, rows,
    getName: () => name,
    getLastRow: () => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i] && rows[i].some(v => v !== '' && v != null)) return i + 1; return 0; },
    getLastColumn: () => rows.reduce((m, r) => { let l = 0; (r || []).forEach((v, i) => { if (v !== '' && v != null) l = i + 1; }); return Math.max(m, l); }, 0),
    getMaxColumns: () => maxCols, getMaxRows: () => maxRows,
    insertColumnsAfter: (a, n) => { maxCols += n; },
    setFrozenRows: () => {},
    deleteRows: (start, n) => { rows.splice(start - 1, n); },
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({length: nr}, (_, i) => Array.from({length: nc}, (_, j) => { const row = rows[r - 1 + i] || []; const v = row[c - 1 + j]; return v == null ? '' : v; })),
      getDisplayValues() { return this.getValues().map(rw => rw.map(String)); },
      setValues: vals => { vals.forEach((rw, i) => { const idx = r - 1 + i; rows[idx] = rows[idx] || []; rw.forEach((v, j) => { rows[idx][c - 1 + j] = v; }); }); return sh.getRange(r, c, nr, nc); },
      setFontWeight() { return this; }, setNumberFormat() { return this; }
    })
  };
  return sh;
}
function makeSS(title) {
  const sheets = [makeSheet('Sheet1')];
  return {
    sheets,
    getId: () => 'SS1', getUrl: () => 'https://docs.google.com/spreadsheets/d/SS1',
    getSheetByName: n => sheets.find(s => s.name === n) || null,
    insertSheet: n => { const s = makeSheet(n); sheets.push(s); return s; },
    getSheets: () => sheets.slice(),
    deleteSheet: s => { sheets.splice(sheets.indexOf(s), 1); }
  };
}

let SS = null; const props = {}; const fetches = [];
let fetchPlan = []; // queue of {code, body}
const ctx = {
  console,
  PropertiesService: {getScriptProperties: () => ({getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; }, getKeys: () => Object.keys(props)})},
  LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() {}})},
  Session: {getScriptTimeZone: () => 'Asia/Manila'},
  SpreadsheetApp: {openById: id => { if (SS && id === SS.getId()) return SS; throw new Error('nope'); }, getActiveSpreadsheet: () => null, create: t => (SS = makeSS(t))},
  DriveApp: {
    getFolderById: id => ({getUrl: () => 'https://drive.google.com/drive/folders/' + id, createFile: b => ({getUrl: () => 'https://drive.google.com/file/d/PHOTO1/view'})}),
    getFoldersByName: () => ({hasNext: () => false}),
    createFolder: n => ({getId: () => 'FOLDER1', getUrl: () => 'u', createFile: () => ({getUrl: () => 'https://drive.google.com/file/d/PHOTO1/view'})})
  },
  Utilities: {
    formatDate: (d, tz, f) => f === 'HH:mm' ? '12:00' : f.includes('HHmmss') ? '2026-10-29-120000' : '2026-10-29',
    base64Decode: s => Buffer.from(s, 'base64'), newBlob: (b, m, n) => ({b, m, n})
  },
  UrlFetchApp: {fetch: (url, opt) => { fetches.push({url, body: JSON.parse(opt.payload), headers: opt.headers}); const r = fetchPlan.shift() || {code: 500, body: '{}'}; return {getResponseCode: () => r.code, getContentText: () => r.body}; }},
  HtmlService: {}
};
vm.createContext(ctx);
['Code.gs', 'sheets.gs', 'gemini.gs'].forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, {filename: f}));
const run = (fn, ...a) => ctx[fn](...a);
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

// 1. bootstrap before setup: nothing created
let b = run('bootstrap');
assert.strictEqual(SS, null); eq(b.data.meals, []);

// 2. setup creates the tabs and seeds favorites once
const seed = [{food_id: 'food_1', name: 'Plain rice', category: 'staple', serving_unit: 'cup', grams_per_unit: 160, kcal: 205, protein_g: 4.3, carbs_g: 44.5, fat_g: 0.4, pinned: true, is_local_dish: true},
  {food_id: 'food_2', name: 'Kare-kare', kcal: '', is_local_dish: true}];
b = run('setup', seed); run('setup', seed);
eq(SS.sheets.map(s => s.name), ['Meals', 'Entries', 'Favorites', 'Targets', 'Weight', 'Settings']);
assert.strictEqual(b.data.favorites.length, 2, 'seeded once');
assert.strictEqual(run('bootstrap').data.favorites.length, 2, 'not seeded twice');
assert.strictEqual(b.data.settings.week_start, 'Monday');

// 3. save, update, delete a meal
const meal = {meal_id: 'm1', date: '2026-10-29', time: '19:12', meal_type: 'Dinner', note: 'one bowl', edited: false, thumb: 'data:x'};
const ents = [{entry_id: 'e1', name: 'Tinola', kcal: 293, quantity: 1}, {entry_id: 'e2', name: 'Plain rice', kcal: 205, quantity: 1}];
run('saveMeal', {meal, entries: ents});
run('saveMeal', {meal: {meal_id: 'm2', date: '2026-10-29', time: '07:00', meal_type: 'Breakfast'}, entries: [{entry_id: 'e3', name: 'Tapsilog', kcal: 610}]});
run('saveMeal', {meal: Object.assign({}, meal, {edited: true}), entries: [ents[0]]});
b = run('bootstrap');
assert.strictEqual(b.data.meals.length, 2); assert.strictEqual(b.data.meals.find(m => m.meal_id === 'm1').edited, true);
assert.strictEqual(b.data.entries.length, 2, 'entries replaced, not duplicated');
run('deleteMeal', 'm1');
b = run('bootstrap');
eq(b.data.meals.map(m => m.meal_id), ['m2']); assert.deepStrictEqual(b.data.entries.map(e => e.entry_id), ['e3']);

// 4. targets are versioned by date, weight upserts by date, settings by key, favorites by id
run('saveTargets', {effective_date: '2026-09-01', kcal: 2000}); run('saveTargets', {effective_date: '2026-10-29', kcal: 1900}); run('saveTargets', {effective_date: '2026-10-29', kcal: 1850});
run('addWeight', {date: '2026-10-29', kg: 72.6}); run('addWeight', {date: '2026-10-29', kg: 72.4, note: 'am'});
run('saveSettings', {week_start: 'Sunday', profile: '{"age":30}'});
run('saveFavorite', {food_id: 'food_2', name: 'Kare-kare', kcal: 520, user_corrected: true});
b = run('bootstrap');
eq(b.data.targets.map(t => t.kcal), [2000, 1850]);
eq(b.data.weight, [{date: '2026-10-29', kg: 72.4, note: 'am'}]);
assert.strictEqual(b.data.settings.week_start, 'Sunday');
const kk = b.data.favorites.find(f => f.food_id === 'food_2'); assert.strictEqual(kk.kcal, 520); assert.strictEqual(kk.is_local_dish, true, 'upsert keeps other columns');

// 5. Gemini: no key
let r = run('analyzePhoto', {image: 'AAAA', mime: 'image/jpeg', mode: 'meal', note: ''});
assert.ok(/NO_KEY/.test(r.error));
// photo saving is its own call now
assert.ok(run('savePhoto', {image: 'AAAA', mode: 'meal', meal_type: 'Dinner'}).includes('PHOTO1'));
props.GEMINI_API_KEY = 'k';
const mealJson = {items: [{name: 'Tinola', category: 'meat and fish', serving_unit: 'bowl', quantity: 1, grams_per_unit: 350, kcal: 290, protein_g: 28, carbs_g: 10, fat_g: 16, sugar_g: 3, fiber_g: 2, sodium_mg: 900, confidence: 'high', reason: 'clear'}], confidence: 'high', reason: 'Clear photo.'};
const ok = j => ({code: 200, body: JSON.stringify({steps: [{type: 'model_output', content: [{type: 'text', text: JSON.stringify(j)}]}]})});
// first route: Flash-Lite, Interactions API, minimal thinking; hints come from the page, no Sheet read
fetchPlan = [ok(mealJson)];
r = run('analyzePhoto', {image: 'AAAA', mime: 'image/jpeg', mode: 'meal', note: 'chicken', hints: {rice: '1 cup, 160 g', dishes: ['Tinola (1 bowl, 350 g): 293 kcal, P28 C10 F16 *']}});
assert.strictEqual(r.result.items[0].name, 'Tinola'); assert.strictEqual(r.analysesToday, 1);
let sent = fetches[fetches.length - 1];
assert.ok(sent.url.endsWith('/interactions')); assert.strictEqual(sent.body.model, 'gemini-3.5-flash-lite');
assert.strictEqual(sent.body.generation_config.thinking_level, 'minimal'); assert.strictEqual(sent.headers['x-goog-api-key'], 'k');
assert.strictEqual(sent.body.input[0].type, 'image'); assert.ok(sent.body.input[1].text.includes('chicken')); assert.ok(sent.body.input[1].text.includes('Tinola (1 bowl'));
// old page without hints still works (reads the Sheet)
fetchPlan = [ok(mealJson)];
r = run('analyzePhoto', {image: 'AAAA', mode: 'meal'}); assert.ok(fetches[fetches.length - 1].body.input[1].text.includes('Plain rice'));
// route falls back: interactions 400 → generateContent with thinkingLevel works, and is remembered
props.GEMINI_ROUTE = undefined; delete props.GEMINI_ROUTE;
fetchPlan = [{code: 400, body: '{"error":{"message":"Unknown field generation_config"}}'}, {code: 200, body: JSON.stringify({candidates: [{content: {parts: [{text: '```json\n' + JSON.stringify(mealJson) + '\n```'}]}}]})}];
r = run('analyzePhoto', {image: 'AAAA', mode: 'meal', hints: {dishes: []}});
assert.strictEqual(r.result.items.length, 1);
sent = fetches[fetches.length - 1];
assert.ok(sent.url.includes('gemini-3.5-flash-lite:generateContent')); assert.strictEqual(sent.body.generationConfig.thinkingConfig.thinkingLevel, 'minimal');
eq(JSON.parse(props.GEMINI_ROUTE), {model: 'gemini-3.5-flash-lite', api: 'generateContent', think: true});
// next call goes straight to the remembered route: one request
let before = fetches.length; fetchPlan = [{code: 200, body: JSON.stringify({candidates: [{content: {parts: [{text: JSON.stringify(mealJson)}]}}]})}];
run('analyzePhoto', {image: 'AAAA', mode: 'meal', hints: {}}); assert.strictEqual(fetches.length - before, 1); assert.ok(fetches[fetches.length - 1].url.includes(':generateContent'));
// quota on Flash-Lite skips its other routes and moves to Gemini 3.8 Flash with low thinking
before = fetches.length; fetchPlan = [{code: 429, body: '{}'}, ok(mealJson)];
r = run('analyzePhoto', {image: 'AAAA', mode: 'meal', hints: {}});
assert.strictEqual(fetches.length - before, 2); sent = fetches[fetches.length - 1];
assert.strictEqual(sent.body.model, 'gemini-3.8-flash'); assert.strictEqual(sent.body.generation_config.thinking_level, 'low');
// quota everywhere
fetchPlan = Array(9).fill({code: 429, body: '{}'});
r = run('analyzePhoto', {image: 'AAAA', mode: 'meal', hints: {}}); assert.ok(/QUOTA/.test(r.error));
// no food
fetchPlan = [{code: 200, body: JSON.stringify({output_text: JSON.stringify({items: [], confidence: 'low', reason: 'x', no_food: true})})}];
r = run('analyzePhoto', {image: 'AAAA', mode: 'meal', hints: {}}); assert.ok(/NO_FOOD/.test(r.error));
// label with an unread field
fetchPlan = [{code: 200, body: JSON.stringify({output_text: JSON.stringify({product: 'Crackers', serving_g: 25, servings_per_pack: 4, per_serving: {kcal: 120, protein_g: 3, carbs_g: 17, fat_g: 4.5, sugar_g: 2, fiber_g: 1, sodium_mg: 0}, unread_fields: ['sodium_mg'], confidence: 'high'})})}];
r = run('analyzePhoto', {image: 'AAAA', mode: 'label'}); assert.strictEqual(r.result.per_serving.sodium_mg, null);
// weekly summary
fetchPlan = [{code: 200, body: JSON.stringify({output_text: JSON.stringify({text: 'Fine week.', suggestions: ['a', 'b', 'c']})})}];
const s = run('weeklySummary', {avg_kcal: 1900}); eq(s.suggestions, ['a', 'b']);
// bad key
fetchPlan = [{code: 403, body: '{"error":{"message":"API key not valid"}}'}];
assert.throws(() => run('analyzeItem', {name: 'Pancit', quantity: 1}), /refused the API key/);
// counts live in Script Properties
assert.strictEqual(run('bootstrap').meta.analysesToday, 6);
// permission error from UrlFetchApp is reported as PERMISSION, not a network problem
const realFetch = ctx.UrlFetchApp.fetch;
ctx.UrlFetchApp.fetch = () => { throw new Error('You do not have permission to call UrlFetchApp.fetch. Required permissions: https://www.googleapis.com/auth/script.external_request'); };
r = run('analyzePhoto', {image: 'AAAA', mode: 'meal', hints: {}});
assert.ok(/^PERMISSION/.test(r.error), r.error);
ctx.UrlFetchApp.fetch = realFetch;
// testGemini clears the route, finds one, and times a second call
const logs = []; ctx.Logger = {log: x => logs.push(x)};
fetchPlan = [{code: 404, body: '{}'}, ok({ok: true}), ok({ok: true})];
run('testGemini');
assert.ok(logs.some(l => /Working route: gemini-3.5-flash-lite via generateContent/.test(l)), logs.join('\n'));
assert.ok(logs.some(l => /Second call/.test(l)));
console.log('server tests passed:', fetches.length, 'mock Gemini calls');
// v2: thumbnails stay out of bootstrap and load on demand; text analysis; full photo
run('saveMeal', {meal: {meal_id: 'mt', date: '2026-10-30', time: '12:00', meal_type: 'Lunch', thumb: 'data:image/jpeg;base64,THUMB', photo_url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view'}, entries: [{entry_id: 'et', name: 'Adobo', kcal: 435}]});
const bm = run('bootstrap').data.meals.find(m => m.meal_id === 'mt');
assert.strictEqual(bm.thumb, undefined); assert.strictEqual(bm.has_thumb, true);
eq(run('getThumbs', ['mt', 'm2']), {mt: 'data:image/jpeg;base64,THUMB'});
// editing without a thumb keeps the stored one
run('saveMeal', {meal: {meal_id: 'mt', date: '2026-10-31', time: '13:00', meal_type: 'Dinner', has_thumb: true}, entries: [{entry_id: 'et', name: 'Adobo', kcal: 435}]});
eq(run('getThumbs', ['mt']), {mt: 'data:image/jpeg;base64,THUMB'});
const moved = run('bootstrap').data.meals.find(m => m.meal_id === 'mt'); assert.strictEqual(moved.date, '2026-10-31'); assert.strictEqual(moved.meal_type, 'Dinner');
ctx.DriveApp.getFileById = id => { assert.strictEqual(id, '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'); return {getBlob: () => ({getBytes: () => [1, 2, 3], getContentType: () => 'image/jpeg'})}; };
ctx.Utilities.base64Encode = b => 'AQID';
eq(run('getPhoto', {url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view'}), {data: 'AQID', mime: 'image/jpeg'});
assert.strictEqual(run('getPhoto', {url: ''}), null);
before = fetches.length; fetchPlan = [ok(mealJson)];
r = run('analyzeText', {text: '1 bowl tinola, 1 cup rice', meal_type: 'Dinner', hints: {}});
assert.strictEqual(r.result.items[0].name, 'Tinola');
sent = fetches[fetches.length - 1];
const inp = sent.body.input || sent.body.contents[0].parts;
assert.strictEqual(inp.length, 1, 'text only, no image'); assert.ok(JSON.stringify(inp).includes('1 bowl tinola'));
assert.ok(/NO_FOOD/.test(run('analyzeText', {text: '  '}).error));
console.log('v2 server checks passed');
