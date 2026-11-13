/* ---------- API: Apps Script server, or a local demo store ---------- */
const IN_GAS = typeof google !== 'undefined' && google.script && google.script.run;

function gasCall(fn, ...args) {
  return new Promise((resolve, reject) => {
    google.script.run.withSuccessHandler(resolve).withFailureHandler(err => reject(err && err.message ? err : new Error(String(err))))[fn](...args);
  });
}

const API = IN_GAS ? {
  bootstrap: () => gasCall('bootstrap'),
  setup: () => gasCall('setup', seedFavorites()),
  saveMeal: p => gasCall('saveMeal', p),
  deleteMeal: id => gasCall('deleteMeal', id),
  analyzePhoto: p => gasCall('analyzePhoto', p),
  savePhoto: p => gasCall('savePhoto', p),
  analyzeText: p => gasCall('analyzeText', p),
  getThumbs: ids => gasCall('getThumbs', ids),
  getPhoto: p => gasCall('getPhoto', p),
  analyzeItem: p => gasCall('analyzeItem', p),
  saveFavorite: f => gasCall('saveFavorite', f),
  saveTargets: t => gasCall('saveTargets', t),
  addWeight: w => gasCall('addWeight', w),
  saveSettings: s => gasCall('saveSettings', s),
  weeklySummary: n => gasCall('weeklySummary', n),
  adjustTargets: p => gasCall('adjustTargets', p)
} : (typeof WebAPI === 'function' ? WebAPI() : DemoAPI());
/* Three implementations behind one interface: Apps Script (google.script.run),
   the static web build (WebAPI, defined in web/api.js and loaded before this
   bundle), and the offline demo used by preview.html. */

/* Applies a server write to local state too, so the UI never waits for a re-read. */
function applyMeal(meal, entries) {
  const d = S.data;
  const i = d.meals.findIndex(m => m.meal_id === meal.meal_id);
  if (i >= 0) d.meals[i] = meal; else d.meals.push(meal);
  d.entries = d.entries.filter(e => e.meal_id !== meal.meal_id).concat(entries);
  S.dirty = true;
}
function applyFavorite(f) {
  const i = S.data.favorites.findIndex(x => x.food_id === f.food_id);
  if (i >= 0) S.data.favorites[i] = f; else S.data.favorites.push(f);
}

/* ---------- demo store (preview outside Apps Script) ---------- */
function DemoAPI() {
  const KEY = 'local-demo-v1';
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let db = null;
  const load = () => {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
    if (!db || db.seedDay !== today()) db = demoSeed();
    return db;
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage may be blocked */ } };
  const snapshot = () => JSON.parse(JSON.stringify({meals: db.meals.map(m => { const o = Object.assign({}, m, {has_thumb: !!m.thumb}); delete o.thumb; return o; }), entries: db.entries, favorites: db.favorites, targets: db.targets, weight: db.weight, settings: db.settings}));
  const meta = () => ({demo: true, sheetUrl: '', folderUrl: '', hasKey: false, model: 'Demo, no AI calls', analysesToday: num(db.settings['analyses:' + today()])});
  return {
    async bootstrap() { load(); return {data: snapshot(), meta: meta()}; },
    async setup() { load(); db.settings.onboarded = 'yes'; save(); return {data: snapshot(), meta: meta()}; },
    async saveMeal({meal, entries}) {
      load(); await wait(250);
      db.meals = db.meals.filter(m => m.meal_id !== meal.meal_id).concat([meal]);
      db.entries = db.entries.filter(e => e.meal_id !== meal.meal_id).concat(entries);
      save(); return {meal, entries};
    },
    async deleteMeal(id) { load(); db.meals = db.meals.filter(m => m.meal_id !== id); db.entries = db.entries.filter(e => e.meal_id !== id); save(); return true; },
    async analyzePhoto(p) {
      load(); await wait(1400);
      const k = 'analyses:' + today(); db.settings[k] = num(db.settings[k]) + 1; save();
      return {analysesToday: db.settings[k], result: p.mode === 'label' ? demoLabel() : demoMeal(p.note)};
    },
    async savePhoto() { return ''; },
    async analyzeText(p) {
      load(); await wait(1100);
      const k = 'analyses:' + today(); db.settings[k] = num(db.settings[k]) + 1; save();
      return {analysesToday: db.settings[k], result: demoText(p.text)};
    },
    async getThumbs(ids) { load(); await wait(300); const out = {}; db.meals.forEach(m => { if (ids.includes(m.meal_id) && m.thumb) out[m.meal_id] = m.thumb; }); return out; },
    async getPhoto() { await wait(300); return null; },
    async analyzeItem(p) {
      await wait(900);
      const f = db.favorites.find(x => x.name.toLowerCase() === String(p.name).toLowerCase());
      const g = num(p.grams_per_unit) || 100, q = num(p.quantity) || 1;
      if (f && num(f.kcal)) { const base = Object.assign({}, f, {quantity: 1}); return Object.assign(rescale(base, g, q), {name: p.name, confidence: 'medium', reason: 'Matched your saved dish'}); }
      const per100 = {kcal: 160, protein_g: 12, carbs_g: 8, fat_g: 9, sugar_g: 2, fiber_g: 1, sodium_mg: 380};
      const out = {name: p.name, category: p.category || 'other', confidence: 'medium', reason: 'Demo estimate from typical values'};
      VALUES.forEach(v => out[v] = r1(per100[v] * g * q / 100));
      return out;
    },
    async saveFavorite(f) { load(); db.favorites = db.favorites.filter(x => x.food_id !== f.food_id).concat([f]); save(); return f; },
    async saveTargets(t) { load(); db.targets = db.targets.filter(x => x.effective_date !== t.effective_date).concat([t]); save(); return t; },
    async addWeight(w) { load(); db.weight = db.weight.filter(x => x.date !== w.date).concat([w]); save(); return w; },
    async saveSettings(s) { load(); Object.assign(db.settings, s); save(); return db.settings; },
    async weeklySummary(n) { await wait(1200); return demoSummary(n); },
    async adjustTargets(p) {
      await wait(1100);
      const b = p.base, t = Object.assign({}, b), n = String(p.notes).toLowerCase(), changes = [];
      if (/fib(re|er)/.test(n)) { t.fiber_min_g = Math.max(b.fiber_min_g, 35); changes.push({field: 'fiber_min_g', reason: 'You asked to eat more fibre'}); }
      if (/protein/.test(n)) { t.protein_g = Math.round(b.protein_g * 0.7); changes.push({field: 'protein_g', reason: 'Lower protein for the condition you mentioned'}); }
      t.carbs_g = Math.max(50, Math.round((t.kcal - t.protein_g * 4 - t.fat_g * 9) / 4));
      if (t.carbs_g !== b.carbs_g) changes.push({field: 'carbs_g', reason: 'Carbs fill the calories protein no longer covers'});
      return {result: Object.assign(t, {changes, summary: changes.length ? 'Demo check: adjusted for your notes.' : 'Demo check: your notes need no changes.',
        caution: 'This is the offline preview. A doctor or dietitian should confirm targets for a health condition.'})};
    }
  };
}

function demoMeal(note) {
  return {
    confidence: 'medium',
    reason: 'Broth fat and the patis amount are hard to see. Your note set the meat and the rice.',
    items: [
      {name: 'Sinigang na baboy', category: 'meat and fish', serving_unit: 'bowl', grams: 400, kcal: 360, protein_g: 24, carbs_g: 12, fat_g: 24, sugar_g: 5, fiber_g: 3, sodium_mg: 1100, confidence: 'medium', reason: 'Broth fat is hard to see'},
      {name: 'Plain rice', category: 'staple', serving_unit: 'cup', grams: 160, kcal: 205, protein_g: 4.3, carbs_g: 44.5, fat_g: 0.4, sugar_g: 0.1, fiber_g: 0.6, sodium_mg: 2, confidence: 'high', reason: 'Your note said one cup'},
      {name: 'Patis (fish sauce)', category: 'other', serving_unit: 'tbsp', grams: 5, kcal: 2, protein_g: 0.3, carbs_g: 0.2, fat_g: 0, sugar_g: 0.2, fiber_g: 0, sodium_mg: 470, confidence: 'low', reason: 'amount not visible'}
    ]
  };
}
/* Preview only: picks known dishes out of the description so the flow can be tried without Gemini. */
function demoText(text) {
  const t = String(text).toLowerCase(), favs = seedFavorites().filter(f => has(f.kcal));
  const items = [];
  favs.forEach(f => { if (t.includes(f.name.toLowerCase()) || (f.name === 'Plain rice' && /\brice\b/.test(t) && !/sinangag|fried rice/.test(t))) {
    const m = t.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:cups?|pcs?|pieces?|bowls?|servings?|sticks?)?\\s*(?:of\\s+)?' + (f.name === 'Plain rice' ? '(?:plain\\s+)?rice' : f.name.toLowerCase())));
    const q = m ? num(m[1]) : 1, it = {name: f.name, category: f.category, serving_unit: f.serving_unit, quantity: q, grams_per_unit: num(f.grams_per_unit) || 100, confidence: 'medium', reason: 'Typical portion'};
    VALUES.forEach(v => it[v] = r1(num(f[v]) * q)); items.push(it);
  } });
  if (!items.length) items.push({name: cap1(t.split(/[,.\n]/)[0].trim().slice(0, 40)) || 'Meal', category: 'other', serving_unit: 'serving', quantity: 1, grams_per_unit: 250, kcal: 400, protein_g: 18, carbs_g: 45, fat_g: 16, sugar_g: 6, fiber_g: 3, sodium_mg: 700, confidence: 'low', reason: 'No amount given'});
  return {confidence: items.some(i => i.confidence === 'low') ? 'low' : 'medium', reason: 'Estimated from your description. Amounts you named were used.', items};
}
function demoLabel() {
  return {product: 'Wheat crackers', serving_g: 25, servings_per_pack: 4, confidence: 'high', reason: 'Read from the printed label',
    per_serving: {kcal: 120, protein_g: 3, carbs_g: 17, fat_g: 4.5, sugar_g: 2, fiber_g: 1, sodium_mg: null}, unread_fields: ['sodium_mg']};
}
function demoSummary(n) {
  const over = n.days.filter(d => d.status === 'over');
  const wk = over.filter(d => d.weekday === 'Saturday' || d.weekday === 'Sunday');
  const t = [], wdOver = over.length - wk.length;
  t.push(wdOver === 0 ? 'Weekdays stayed close to your target.' : over.length <= 2 ? 'Most days stayed close to your target.' : 'Several days ran over your target, ' + wdOver + ' of them on weekdays.');
  if (wk.length) t.push(wk.map(d => d.weekday).join(' and ') + ' added about ' + fmt(Math.round(sum(wk, d => d.kcal - d.target) / 10) * 10) + ' kcal over target' + (wk.length > 1 ? ' between them.' : '.'));
  t.push('Protein averaged ' + fmt(n.protein_avg) + ' g' + (n.protein_avg < n.protein_goal * 0.9 ? ', well under your ' + fmt(n.protein_goal) + ' g goal.' : ', close to your goal.'));
  return {text: t.join(' '), suggestions: ['Add an egg or a piece of fish at breakfast to lift protein by about 10 g.', 'On weekends, try half a cup of rice with your heaviest meal.'], demo: true};
}

/* Seed: about six weeks of believable Filipino meals so every screen has data. */
function demoSeed() {
  const t = today();
  const favs = seedFavorites();
  const F = n => favs.find(f => f.name === n);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const meals = [], entries = [];
  const add = (day, type, time, parts, extra) => {
    const id = 'meal_' + day.replace(/-/g, '') + '_' + type[0];
    meals.push(Object.assign({meal_id: id, date: day, time, meal_type: type, photo_url: '', note: '', confidence: 'high', confidence_reason: '', source: 'photo', edited: false, thumb: ''}, extra || {}));
    parts.forEach(([name, q], i) => {
      const f = F(name);
      const e = {entry_id: id + '_' + i, meal_id: id, name: f.name, category: f.category, serving_unit: f.serving_unit, grams_per_unit: f.grams_per_unit, serving_label: f.serving_label, quantity: q || 1, confidence: 'high', edited: false, reason: ''};
      VALUES.forEach(v => e[v] = r1(num(f[v]) * (q || 1)));
      entries.push(e);
    });
  };
  const B = [[['Tapsilog']], [['Pandesal', 3], ['Kape 3-in-1']], [['Boiled egg', 2], ['Plain rice'], ['Kape 3-in-1']]];
  const L = [[['Chicken adobo'], ['Plain rice']], [['Pork adobo'], ['Plain rice']], [['Sinigang na baboy'], ['Plain rice']], [['Tinola'], ['Plain rice']]];
  const N = [[['Banana cue']], [['Kape 3-in-1']], [['Kape 3-in-1']], [['Pandesal', 2]]];
  const D = [[['Tinola'], ['Plain rice']], [['Sinigang na manok'], ['Plain rice']], [['Sinigang na manok'], ['Plain rice', 1.5]], [['Tinola'], ['Plain rice', 1.5]], [['Chicken adobo'], ['Plain rice']]];
  for (let i = 42; i >= 1; i--) {
    const day = addDays(t, -i);
    if (i === 17 || i === 33) continue; // a couple of days with nothing logged
    const wkend = [0, 6].includes(parseDay(day).getDay());
    add(day, 'Breakfast', '07:' + pad(10 + Math.floor(rnd() * 40)), pick(B));
    add(day, 'Lunch', '12:' + pad(5 + Math.floor(rnd() * 45)), wkend ? [['Lechon kawali'], ['Plain rice']] : pick(L));
    if (rnd() > 0.35 || wkend) add(day, 'Snack', '15:' + pad(Math.floor(rnd() * 50)), wkend ? [['Turon']] : pick(N));
    add(day, 'Dinner', '19:' + pad(Math.floor(rnd() * 50)), wkend ? (rnd() > 0.5 ? [['Pork adobo'], ['Plain rice', 1.5]] : [['Tinola'], ['Plain rice']]) : pick(D));
  }
  add(t, 'Breakfast', '07:40', [['Tapsilog']]);
  add(t, 'Lunch', '12:15', [['Chicken adobo'], ['Plain rice']], {edited: true});
  add(t, 'Snack', '15:30', [['Banana cue']]);
  const weight = [];
  for (let i = 30; i >= 1; i -= 2) {
    const base = 73.4 - (30 - i) / 30 * 0.8;
    weight.push({date: addDays(t, -i), kg: r1(base + (rnd() - 0.45) * 0.6), note: i === 4 ? 'after a salty dinner' : ''});
  }
  favs.forEach(f => { f.use_count = 0; });
  F('Sinigang na manok').user_corrected = true;
  entries.forEach(e => { const f = F(e.name); if (f) f.use_count++; });
  return {
    seedDay: t, meals, entries, favorites: favs, weight,
    targets: [Object.assign({}, DEFAULT_TARGET, {effective_date: addDays(t, -60)})],
    settings: {onboarded: 'yes', week_start: 'Monday', rice_serving: '1 cup, 160 g', units: 'kg and cm',
      profile: JSON.stringify({age: 30, sex: 'Male', height: 170, weight: 72.6, activity: 'Light', goal: 'Lose', target_weight: 68, pace: 0.35, maintenance: 2260})}
  };
}

/* Filipino dishes and everyday foods. Typical portions; the user's corrections replace them.
   kcal is left blank where the design shows [KCAL] — the user fills those in. */
function seedFavorites() {
  const rows = [
    // name, group, category, unit, grams, label, kcal, P, C, F, sugar, fiber, sodium, pinned, hour, local
    ['Plain rice', 'Rice', 'staple', 'cup', 160, '', 205, 4.3, 44.5, 0.4, 0.1, 0.6, 2, true, 19, true],
    ['Sinigang na manok', 'Soup', 'meat and fish', 'bowl', 300, '', 195, 21, 9, 8, 3, 2, 830, false, 19, true],
    ['Sinigang na baboy', 'Soup', 'meat and fish', 'bowl', 400, '', 360, 24, 12, 24, 5, 3, 1100, false, 19, true],
    ['Tinola', 'Soup', 'meat and fish', 'bowl', 350, '', 293, 28, 10, 16, 3, 2, 900, true, 19, true],
    ['Chicken adobo', 'Ulam', 'meat and fish', 'serving', 150, '', 435, 34, 5, 31, 3, 0.3, 900, false, 12, true],
    ['Pork adobo', 'Ulam', 'meat and fish', 'serving', 150, '', 435, 26, 5, 35, 3, 0.3, 950, false, 12, true],
    ['Tapsilog', 'Ulam', 'meat and fish', 'plate', '', '1 plate, with egg and sinangag', 610, 30, 62, 26, 4, 1, 1100, false, 7, true],
    ['Lechon kawali', 'Ulam', 'meat and fish', 'serving', 120, '', 555, 22, 2, 51, 0.5, 0, 700, false, 12, true],
    ['Kare-kare', 'Ulam', 'meat and fish', 'bowl', '', '1 bowl, with bagoong', '', '', '', '', '', '', '', false, 12, true],
    ['Lumpiang shanghai', 'Ulam', 'meat and fish', 'serving', '', '5 pieces', '', '', '', '', '', '', '', false, 12, true],
    ['Banana cue', 'Street food', 'snacks and sweets', 'stick', '', '1 stick', 180, 1, 38, 3, 22, 2, 3, false, 15, true],
    ['Turon', 'Street food', 'snacks and sweets', 'piece', '', '1 piece', 251, 2, 42, 9, 20, 2, 40, false, 15, true],
    ['Pancit canton', 'Merienda', 'staple', 'cup', '', '1 cup', '', '', '', '', '', '', '', false, 15, true],
    ['Pandesal', 'Merienda', 'staple', 'piece', 30, '', 87, 2.6, 15, 1.8, 2, 0.6, 120, false, 7, true],
    ['Kape 3-in-1', '', 'drinks', 'sachet', '', '1 sachet', 110, 1, 20, 3, 16, 0, 40, false, 19, false],
    ['Boiled egg', '', 'meat and fish', 'piece', 50, '1 large', 78, 6.3, 0.6, 5.3, 0.6, 0, 62, false, 19, false]
  ];
  return rows.map((r, i) => ({
    food_id: 'food_' + (i + 1), name: r[0], dish_group: r[1], category: r[2], serving_unit: r[3], grams_per_unit: r[4], serving_label: r[5],
    kcal: r[6], protein_g: r[7], carbs_g: r[8], fat_g: r[9], sugar_g: r[10], fiber_g: r[11], sodium_mg: r[12],
    pinned: r[13], use_count: 0, usual_hour: r[14], last_used: '', is_local_dish: r[15], user_corrected: false
  }));
}
