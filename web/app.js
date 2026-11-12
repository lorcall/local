/* LoCal front end — core: utilities, constants, state, calculations. */
'use strict';

/* ---------- utilities ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const has = v => v !== '' && v != null && isFinite(parseFloat(v));
const r0 = v => Math.round(num(v));
const r1 = v => Math.round(num(v) * 10) / 10;
const fmt = (v, d = 0) => { const n = num(v); return n.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: d}); };
const fmtSigned = (v, d = 0) => (num(v) > 0 ? '+' : num(v) < 0 ? '−' : '') + fmt(Math.abs(num(v)), d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const cap1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const lc1 = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const sum = (arr, f) => arr.reduce((a, x) => a + num(f ? f(x) : x), 0);
const avg = (arr, f) => arr.length ? sum(arr, f) / arr.length : 0;
const plural = (n, one, many) => fmt(n, 1) + ' ' + (num(n) === 1 ? one : (many || one + 's'));

/* dates: day keys are local 'YYYY-MM-DD' strings */
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseDay = k => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON3 = MONTHS.map(m => m.slice(0, 3));
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WD3 = WEEKDAYS.map(w => w.slice(0, 3));
const dayName = k => WEEKDAYS[parseDay(k).getDay()];
const monthDay = k => { const d = parseDay(k); return MONTHS[d.getMonth()] + ' ' + d.getDate(); };
const shortDay = k => { const d = parseDay(k); return WD3[d.getDay()] + ', ' + MON3[d.getMonth()] + ' ' + d.getDate(); };
const longDay = k => { const d = parseDay(k); return WEEKDAYS[d.getDay()] + ', ' + MON3[d.getMonth()] + ' ' + d.getDate(); };
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);
const time12 = hm => { if (!hm) return ''; let [h, m] = String(hm).split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + pad(m || 0) + ' ' + ap; };
const hourLabel = h => { const ap = h >= 12 ? 'PM' : 'AM'; return (h % 12 || 12) + ' ' + ap; };
const relDay = k => { const t = today(); if (k === t) return 'Today'; if (k === addDays(t, -1)) return 'Yesterday'; if (daysBetween(k, t) < 7) return dayName(k); return shortDay(k); };

/* ---------- constants ---------- */
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
const mealOrder = t => { const i = MEAL_TYPES.indexOf(t); return i < 0 ? 9 : i; };
const TYPE_TIME = {Breakfast: '07:30', Lunch: '12:30', Snack: '15:30', Dinner: '19:00'};
const viewDay = () => S.ui.day || today();
const dayLabel = k => k === today() ? 'Today' : k === addDays(today(), -1) ? 'Yesterday' : k === addDays(today(), 1) ? 'Tomorrow' : shortDay(k);
const mealForNow = () => { const h = new Date().getHours(); return h < 10 ? 'Breakfast' : h < 14 ? 'Lunch' : h < 17 ? 'Snack' : 'Dinner'; };
const VALUES = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'sugar_g', 'fiber_g', 'sodium_mg'];
const VALUE_LABEL = {kcal: 'Calories', protein_g: 'Protein', carbs_g: 'Carbs', fat_g: 'Fat', sugar_g: 'Sugar', fiber_g: 'Fiber', sodium_mg: 'Sodium'};
const VALUE_UNIT = {kcal: 'kcal', protein_g: 'g', carbs_g: 'g', fat_g: 'g', sugar_g: 'g', fiber_g: 'g', sodium_mg: 'mg'};
const CATEGORIES = ['staple', 'meat and fish', 'vegetables', 'fruit', 'drinks', 'snacks and sweets', 'other'];
const CATEGORY_LABEL = {'staple': 'Rice, bread and noodles', 'meat and fish': 'Meat and fish', 'vegetables': 'Vegetables', 'fruit': 'Fruit', 'drinks': 'Drinks', 'snacks and sweets': 'Snacks and sweets', 'other': 'Other'};
const UNITS = ['g', 'cup', 'bowl', 'piece'];
const UNIT_LABEL = {g: 'Grams', cup: 'Cup', bowl: 'Bowl', piece: 'Piece'};
const ACTIVITY = [['Desk job', 1.2], ['Light', 1.375], ['Moderate', 1.55], ['Very active', 1.725]];
const COLOR = {p: '#7BE5C4', c: '#F5A524', f: '#A495FF', ov: '#FF7A6B', a: '#F5A524', mu: '#A2A7B6', lo: '#15161B', hi: '#2F323C'};
const DEFAULT_TARGET = {effective_date: '2000-01-01', kcal: 1900, protein_g: 120, carbs_g: 210, fat_g: 63, fiber_min_g: 25, sugar_max_g: 50, sodium_max_mg: 2300};
const KCAL_PER_KG = 7700;

/* ---------- state ---------- */
const S = {
  data: {meals: [], entries: [], favorites: [], targets: [], weight: [], settings: {}},
  meta: {demo: false, sheetUrl: '', folderUrl: '', hasKey: false, model: '', analysesToday: 0},
  stack: [{name: 'today', p: {}}],
  log: null, draft: null, edit: null, label: null,
  ui: {}, toast: null, menu: null, viewer: null, photos: {}, full: {}, dirty: true, firstToday: true
};
const route = () => S.stack[S.stack.length - 1];
const setting = (k, d) => (S.data.settings[k] != null && S.data.settings[k] !== '') ? S.data.settings[k] : d;
const profile = () => { try { return JSON.parse(setting('profile', '{}')) || {}; } catch (e) { return {}; } };
const weekStart = () => setting('week_start', 'Monday') === 'Sunday' ? 0 : 1;

/* ---------- serving labels ---------- */
function unitWord(u, q) {
  u = u || 'serving';
  if (u === 'g') return 'g';
  return q === 1 || q === '1' ? u : (u.endsWith('s') ? u : u + 's');
}
function servingLabel(x) {
  // "1 bowl, 400 g" per one unit; favorites may carry a free-text label
  if (x.serving_label) return x.serving_label;
  const g = num(x.grams_per_unit), u = x.serving_unit || 'serving';
  if (u === 'g') return (g ? fmt(g) : '100') + ' g';
  return '1 ' + u + (g ? ', ' + fmt(g) + ' g' : '');
}
function amountLabel(e) {
  const q = num(e.quantity) || 1, u = e.serving_unit || 'serving', g = num(e.grams_per_unit);
  if (e.serving_label && q === 1) return e.serving_label;
  if (u === 'g') return (q !== 1 ? fmt(q, 2) + ' × ' : '') + fmt(g) + ' g';
  return fmt(q, 2) + ' ' + unitWord(u, q) + (g ? ', ' + fmt(g * q) + ' g' : '');
}

/* ---------- indexes and calculations ---------- */
let IDX = null;
function index() {
  if (IDX && !S.dirty) return IDX;
  const byMeal = {}, byDay = {}, totals = {};
  S.data.entries.forEach(e => { (byMeal[e.meal_id] = byMeal[e.meal_id] || []).push(e); });
  S.data.meals.forEach(m => { (byDay[m.date] = byDay[m.date] || []).push(m); });
  Object.keys(byDay).forEach(d => {
    byDay[d].sort((a, b) => String(a.time).localeCompare(String(b.time)) || mealOrder(a.meal_type) - mealOrder(b.meal_type));
    const t = zero();
    byDay[d].forEach(m => (byMeal[m.meal_id] || []).forEach(e => VALUES.forEach(v => t[v] += num(e[v]))));
    t.meals = byDay[d].length;
    totals[d] = t;
  });
  const targets = S.data.targets.slice().sort((a, b) => String(a.effective_date).localeCompare(String(b.effective_date)));
  IDX = {byMeal, byDay, totals, targets};
  S.dirty = false;
  return IDX;
}
const zero = () => ({kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sugar_g: 0, fiber_g: 0, sodium_mg: 0, meals: 0});
const itemsOf = mealId => index().byMeal[mealId] || [];
const mealsOn = day => index().byDay[day] || [];
const totalsOn = day => index().totals[day] || zero();
const logged = day => (index().totals[day] || {}).meals > 0;
function mealTotals(items) { const t = zero(); items.forEach(e => VALUES.forEach(v => t[v] += num(e[v]))); return t; }
function targetFor(day) {
  const ts = index().targets;
  if (!ts.length) return DEFAULT_TARGET;
  let t = ts[0];
  for (const x of ts) { if (x.effective_date <= day) t = x; else break; }
  return t;
}
const currentTarget = () => targetFor(today());
/* on target = total kcal at or under target (calories); protein: within 10% or above */
function dayStatus(day, measure) {
  if (!logged(day)) return 'none';
  const t = totalsOn(day), tg = targetFor(day);
  if (measure === 'protein') return t.protein_g >= num(tg.protein_g) * 0.9 ? 'on' : 'over';
  return t.kcal <= num(tg.kcal) ? 'on' : 'over';
}
const within10 = day => { const t = totalsOn(day), tg = num(targetFor(day).kcal); return Math.abs(t.kcal - tg) <= tg * 0.1; };
const macroKcal = x => num(x.protein_g) * 4 + num(x.carbs_g) * 4 + num(x.fat_g) * 9;
function macroCheck(x) {
  const mk = macroKcal(x), k = num(x.kcal);
  return {mk, k, ok: k > 0 ? Math.abs(mk - k) / k <= 0.1 : mk === 0};
}
function rescale(item, newG, newQ) {
  const og = num(item.grams_per_unit) || 0, oq = num(item.quantity) || 1;
  const ng = newG == null ? og : num(newG), nq = newQ == null ? oq : num(newQ);
  const f = (og && ng) ? (ng * nq) / (og * oq) : nq / oq;
  const out = Object.assign({}, item, {grams_per_unit: newG == null ? item.grams_per_unit : ng, quantity: nq});
  if (isFinite(f) && f > 0) VALUES.forEach(v => { if (has(item[v])) out[v] = r1(num(item[v]) * f); });
  return out;
}
/* streak = consecutive completed days on target, ending yesterday or today */
function streakInfo(measure) {
  const t = today();
  let d = dayStatus(t, measure) === 'on' ? t : addDays(t, -1), cur = 0;
  while (dayStatus(d, measure) === 'on') { cur++; d = addDays(d, -1); }
  const days = Object.keys(index().totals).sort();
  let best = 0, run = 0, bestEnd = null, prev = null;
  days.forEach(k => {
    if (dayStatus(k, measure) === 'on') { run = (prev && addDays(prev, 1) === k) ? run + 1 : 1; if (run > best) { best = run; bestEnd = k; } prev = k; }
    else { run = 0; prev = null; }
  });
  return {cur, best: Math.max(best, cur), bestEnd};
}
/* The first day anything was logged; paging back stops there rather than into empty months. */
const firstDay = () => S.data.meals.reduce((m, x) => x.date && x.date < m ? x.date : m, today());
/* "Nov 7–13", or "Oct 15 – Nov 13" across months; the year only when it isn't this one. */
function periodLabel(from, to) {
  const a = parseDay(from), b = parseDay(to), y = new Date().getFullYear(), yr = d => d.getFullYear() !== y ? ', ' + d.getFullYear() : '';
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return MON3[a.getMonth()] + ' ' + a.getDate() + '\u2013' + b.getDate() + yr(b);
  return MON3[a.getMonth()] + ' ' + a.getDate() + yr(a) + ' \u2013 ' + MON3[b.getMonth()] + ' ' + b.getDate() + yr(b);
}
function rangeDays(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
function weekBounds(day) {
  const d = parseDay(day), ws = weekStart();
  const off = (d.getDay() - ws + 7) % 7;
  const start = addDays(day, -off);
  return {start, end: addDays(start, 6)};
}
/* goal calculator: Mifflin-St Jeor */
function goalCalc(p) {
  const w = num(p.weight), h = num(p.height), a = num(p.age);
  const bmr = 10 * w + 6.25 * h - 5 * a + (p.sex === 'Female' ? -161 : 5);
  const act = (ACTIVITY.find(x => x[0] === p.activity) || ACTIVITY[1])[1];
  const maintenance = Math.round(bmr * act / 10) * 10;
  const delta = num(p.pace) * KCAL_PER_KG / 7;
  let kcal = p.goal === 'Keep' ? maintenance : p.goal === 'Gain' ? maintenance + delta : maintenance - delta;
  kcal = Math.max(1200, Math.round(kcal / 50) * 50);
  const protein = Math.round(1.65 * w);
  const fat = Math.round(kcal * 0.3 / 9);
  const carbs = Math.max(0, Math.floor((kcal - protein * 4 - fat * 9) / 4 / 5) * 5);
  const diff = Math.abs(w - num(p.target_weight));
  const weeks = p.goal === 'Keep' || !num(p.pace) ? 0 : Math.round(diff / num(p.pace));
  return {bmr, maintenance, kcal, delta: kcal - maintenance, protein, carbs, fat, weeks};
}
/* weight: exponential moving average (alpha 0.1) of weigh-ins, one value per day */
function weightSeries() {
  const rows = S.data.weight.filter(w => has(w.kg)).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let ema = null;
  return rows.map(w => { ema = ema == null ? num(w.kg) : ema + 0.1 * (num(w.kg) - ema); return {date: w.date, kg: num(w.kg), trend: ema, note: w.note}; });
}
function trendAt(series, day) { let t = null; for (const s of series) { if (s.date <= day) t = s.trend; else break; } return t; }
function maintenanceKcal() { const p = profile(); if (num(p.maintenance)) return num(p.maintenance); if (num(p.weight)) return goalCalc(p).maintenance; return null; }
/* predicted change = sum of (intake − maintenance) / 7,700 over logged days in the period */
function predictedChange(from, to) {
  const m = maintenanceKcal(); if (!m) return null;
  let s = 0; rangeDays(from, to).forEach(d => { if (logged(d) && d !== today()) s += totalsOn(d).kcal - m; });
  return s / KCAL_PER_KG;
}

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
  weeklySummary: n => gasCall('weeklySummary', n)
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
    async weeklySummary(n) { await wait(1200); return demoSummary(n); }
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

/* ---------- components ---------- */
const ICONS = {
  calendar: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
  today: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>',
  bars: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  gallery: '<path d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6"/>',
  label: '<path d="M7 3h10v18H7zM10 8h4M10 12h4M10 16h2"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  copy: '<path d="M8 8h12v12H8zM16 8V4H4v12h4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  report: '<path d="M6 3h9l4 4v14H6zM9 12h7M9 16h5M9 8h3"/>',
  rank: '<path d="M4 20h4v-7H4zM10 20h4V5h-4zM16 20h4v-10h-4z"/>',
  streak: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 8 8"/><circle cx="12" cy="12" r="2"/>',
  scale: '<path d="M5 4h14l1 16H4zM9 9a4 4 0 0 1 6 0M12 9l1.5-2"/>',
  sheet: '<path d="M5 3h14v18H5zM5 9h14M5 15h14M11 3v18"/>',
  plate: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>',
  warn: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  text: '<path d="M5 6h14M5 11h14M5 16h9"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'
};
function icon(n, size = 20, sw = 1.8, extra = '') {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + extra + '>' + ICONS[n] + '</svg>';
}

function backHeader(title, o = {}) {
  return '<header class="row" style="gap:12px">' +
    '<button class="ib" data-a="back" aria-label="Back">' + icon('back', 18, 2) + '</button>' +
    '<div class="grow" style="min-width:0">' + (o.sub ? '<div class="cap13">' + esc(o.sub) + '</div>' : '') +
    '<h1 class="title22"' + (o.small ? ' style="font-size:21px"' : '') + '>' + esc(title) + '</h1></div>' + (o.right || '') + '</header>';
}

/* an arc on a ring: frac 0..1, starts at 12 o'clock */
function arc(size, r, sw, frac, color, o = {}) {
  const C = 2 * Math.PI * r, L = clamp(frac, 0, 1) * C, c = size / 2;
  return '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="' + (o.butt ? 'butt' : 'round') + '" stroke-dasharray="' + L.toFixed(1) + ' ' + C.toFixed(1) + '"' + (o.offset ? ' stroke-dashoffset="' + o.offset + '"' : '') + ' transform="rotate(-90 ' + c + ' ' + c + ')"' + (o.cls ? ' class="' + o.cls + '"' : '') + '/>';
}

/* CalorieDial: raised disc, pressed well, glass centre, glowing mango arc */
function calorieDial(eaten, target, o = {}) {
  const left = target - eaten, over = left < 0;
  const frac = target > 0 ? eaten / target : 0;
  const label = fmt(eaten) + ' of ' + fmt(target) + ' kcal eaten' + (over ? ', ' + fmt(-left) + ' over target' : '');
  // over target: the full ring stays mango and a coral arc runs on from 12 o'clock for the excess
  const arcs = !over ? (frac > 0 ? '<g style="filter:drop-shadow(0 0 6px ' + COLOR.a + ')">' + arc(220, 100, 5, frac, COLOR.a, {cls: o.animate ? 'arcdraw' : ''}) + '</g>' : '')
    : '<g opacity=".45">' + arc(220, 100, 5, 1, COLOR.a) + '</g><g style="filter:drop-shadow(0 0 7px ' + COLOR.ov + ')">' + arc(220, 100, 6, Math.min(1, -left / target), COLOR.ov, {cls: o.animate ? 'arcdraw' : ''}) + '</g>' +
      '<line x1="110" y1="2" x2="110" y2="18" stroke="' + COLOR.ov + '" stroke-width="3" stroke-linecap="round"/>';
  return '<div class="dial raised" style="width:220px;height:220px;box-shadow:12px 12px 24px var(--lo),-10px -10px 22px var(--hi)">' +
    '<div class="well" style="width:180px;height:180px"><div class="glasscore" style="width:126px;height:126px">' +
    '<div class="num" style="font-size:50px;letter-spacing:-.04em;' + (over ? 'color:var(--ov)' : '') + '">' + fmt(Math.abs(left)) + '</div>' +
    '<div class="cap13" style="margin-top:2px' + (over ? ';color:var(--ov)' : '') + '">' + (over ? 'kcal over' : o.past ? 'kcal under' : 'kcal left') + '</div></div></div>' +
    '<svg class="arc" width="220" height="220" viewBox="0 0 220 220" role="img" aria-label="' + label + '">' + arcs + '</svg></div>';
}

/* a ring that turns coral past its limit: fill to the limit, then a coral arc for the excess */
function limitRing(size, r, sw, val, lim, color, track) {
  const frac = lim > 0 ? val / lim : 0, c = size / 2;
  let s = '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + (track || '#15161B') + '" stroke-width="' + sw + '"/>';
  if (frac <= 1) return s + (frac > 0 ? arc(size, r, sw, frac, color) : '');
  return s + '<g opacity=".5">' + arc(size, r, sw, 1, color) + '</g><g style="filter:drop-shadow(0 0 4px ' + COLOR.ov + ')">' + arc(size, r, sw, Math.min(1, frac - 1), COLOR.ov) + '</g>';
}

/* smaller ring dial with a pressed well (Goal calculator, Day summary, Consistency, Weight) */
function ringDial(size, wellSize, frac, inner, aria, o = {}) {
  const r = size / 2 - (o.inset || 4), col = o.color || COLOR.a;
  const disc = o.raised ? 'class="dial raised" style="width:' + size + 'px;height:' + size + 'px;box-shadow:10px 10px 20px var(--lo),-8px -8px 18px var(--hi)"' : 'class="dial well" style="width:' + size + 'px;height:' + size + 'px"';
  return '<div ' + disc + '>' + (o.raised ? '<div class="well" style="width:' + wellSize + 'px;height:' + wellSize + 'px">' + inner + '</div>' : inner) +
    '<svg class="arc" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + esc(aria) + '" style="filter:drop-shadow(0 0 5px ' + col + ')">' +
    (frac > 0 ? arc(size, r, o.sw || 4, frac, col) : '') + '</svg></div>';
}

function macroDial(label, val, target, color) {
  const over = target > 0 && val > target;
  return '<div class="raised r20" style="flex:1;min-width:0;padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px" role="img" aria-label="' + label + ' ' + fmt(val) + ' of ' + fmt(target) + ' grams' + (over ? ', over target' : '') + '">' +
    '<svg width="50" height="50" viewBox="0 0 52 52" aria-hidden="true">' + limitRing(52, 20, 6, val, target, color) + '</svg>' +
    '<div style="font-size:14px' + (over ? ';color:var(--ov)' : '') + '">' + fmt(val) + '<span style="font-weight:300;color:' + (over ? 'var(--ov)' : 'var(--mu)') + '"> / ' + fmt(target) + ' g</span></div>' +
    '<div class="cap"' + (over ? ' style="color:var(--ov)"' : '') + '>' + label + (over ? ', over' : '') + '</div></div>';
}

/* small tiles for sugar, fiber and sodium; fiber is a minimum, so it never turns coral */
function microDial(label, val, lim, unit, isMin) {
  const over = !isMin && lim > 0 && val > lim;
  const ring = isMin ? limitRing(36, 14, 4, Math.min(val, lim), lim, COLOR.p) : limitRing(36, 14, 4, val, lim, '#D6D8E0');
  return '<div class="raised-sm r16" style="flex:1;min-width:0;padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:4px" role="img" aria-label="' + label + ' ' + fmt(val) + ' of ' + fmt(lim) + ' ' + (unit === 'mg' ? 'milligrams' : 'grams') + (isMin ? ' minimum' : ' limit') + (over ? ', over' : '') + '">' +
    '<svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true">' + ring + '</svg>' +
    '<div style="font-size:12px;white-space:nowrap' + (over ? ';color:var(--ov)' : '') + '">' + fmt(val) + '<span style="font-weight:300;color:' + (over ? 'var(--ov)' : 'var(--mu)') + '"> / ' + fmt(lim) + ' ' + unit + '</span></div>' +
    '<div style="font-size:11px;color:' + (over ? 'var(--ov)' : 'var(--mu)') + '">' + label + (isMin ? ', at least' : over ? ', over' : '') + '</div></div>';
}

/* MacroRing: protein, carbs and fat arcs by share of calories, with small gaps */
function macroShares(t) {
  const p = num(t.protein_g) * 4, c = num(t.carbs_g) * 4, f = num(t.fat_g) * 9, s = p + c + f;
  return s > 0 ? {p: p / s, c: c / s, f: f / s} : {p: 0, c: 0, f: 0};
}
function macroRing(t, size, r, sw, gap, center, aria) {
  const sh = macroShares(t), C = 2 * Math.PI * r, segs = [['p', COLOR.p], ['c', COLOR.c], ['f', COLOR.f]].filter(x => sh[x[0]] > 0);
  const avail = C - gap * segs.length; let off = 0; const c = size / 2;
  const arcs = segs.map(([k, col]) => {
    const L = Math.max(0.1, sh[k] * avail);
    const s = '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-linecap="' + (gap ? 'round' : 'butt') + '" stroke-dasharray="' + L.toFixed(1) + ' ' + C.toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '" transform="rotate(-90 ' + c + ' ' + c + ')"/>';
    off += L + gap; return s;
  }).join('');
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + esc(aria || ('Protein ' + Math.round(sh.p * 100) + ' percent, carbs ' + Math.round(sh.c * 100) + ' percent, fat ' + Math.round(sh.f * 100) + ' percent')) + '"' + (center ? ' style="position:absolute;left:0;top:0"' : '') + '>' + (arcs || '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="#15161B" stroke-width="' + sw + '"/>') + '</svg>';
}

const CONF_TEXT = {high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence'};
function confDots(level, small) {
  level = CONF_TEXT[level] ? level : 'medium';
  const n = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  let d = '';
  for (let i = 0; i < 3; i++) d += '<span class="' + (i < n ? (level === 'low' ? 'low' : 'on') : '') + '"></span>';
  return '<span class="cdots' + (small ? ' s' : '') + '" role="img" aria-label="' + CONF_TEXT[level] + ', ' + n + ' of 3">' + d + '</span>';
}

/* chips: separate raised buttons; the selected one is pressed in and mango */
function chips(act, options, selected, label, o = {}) {
  return '<div class="chips' + (o.scroll ? ' scroll' : '') + '" role="radiogroup" aria-label="' + esc(label) + '">' + options.map(opt => {
    const [v, t] = Array.isArray(opt) ? opt : [opt, opt];
    return '<button class="chip" role="radio" aria-checked="' + (v === selected) + '" data-a="' + act + '" data-v="' + esc(v) + '"' + (o.h ? ' style="height:' + o.h + 'px"' : '') + '>' + esc(t) + '</button>';
  }).join('') + '</div>';
}
/* track: a pressed track with the selected option raised */
function track(act, options, selected, label, o = {}) {
  const role = o.tabs ? 'tab' : 'radio', attr = o.tabs ? 'aria-selected' : 'aria-checked';
  return '<div class="track' + (o.tight ? ' tight' : '') + '" role="' + (o.tabs ? 'tablist' : 'radiogroup') + '" aria-label="' + esc(label) + '"' + (o.style ? ' style="' + o.style + '"' : '') + '>' + options.map(opt => {
    const [v, t] = Array.isArray(opt) ? opt : [opt, opt];
    return '<button role="' + role + '" ' + attr + '="' + (v === selected) + '" data-a="' + act + '" data-v="' + esc(v) + '">' + esc(t) + '</button>';
  }).join('') + '</div>';
}
function stepper(val, act, label, o = {}) {
  return '<button class="st' + (o.large ? ' l' : '') + '" data-a="' + act + '" data-v="-1" aria-label="Fewer ' + esc(label) + '"' + (o.min != null && num(val) <= o.min ? ' disabled' : '') + '>−</button>' +
    (o.boxed ? '<span class="pressed-sm" style="width:56px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:17px" aria-live="polite">' + fmt(val, 2) + '</span>'
      : '<span style="min-width:18px;text-align:center" aria-live="polite">' + fmt(val, 2) + '</span>') +
    '<button class="st' + (o.large ? ' l' : '') + '" data-a="' + act + '" data-v="1" aria-label="More ' + esc(label) + '">+</button>';
}
function switchBtn(on, act, label, arg) {
  return '<button class="sw" role="switch" aria-checked="' + !!on + '" aria-label="' + esc(label) + '" data-a="' + act + '"' + (arg != null ? ' data-v="' + esc(arg) + '"' : '') + '><span class="knob"></span></button>';
}

function tabBar(active) {
  const nb = (name, ic, label) => '<button class="nb" data-a="tab" data-v="' + name + '" aria-label="' + label + '"' + (active === name ? ' aria-current="page"' : '') + '>' + icon(ic, 22) + '</button>';
  return '<div class="tabfade" aria-hidden="true"></div><nav class="tabbar" aria-label="Main">' + nb('today', 'today', 'Today') + nb('trends', 'bars', 'Trends') +
    '<button class="fab" data-a="go" data-v="log" aria-label="Log a meal">' + icon('plus', 24, 2.4) + '</button>' +
    nb('history', 'clock', 'History') + nb('targets', 'flag', 'Goals') + '</nav>';
}

function mealName(m) {
  const items = itemsOf(m.meal_id);
  if (!items.length) return m.meal_type;
  return items.map((e, i) => {
    const q = num(e.quantity);
    if (/rice/i.test(e.name) && e.serving_unit === 'cup') return fmt(q, 1) + ' cup' + (q === 1 ? '' : 's') + ' ' + lc1(e.name).replace(/^plain /, '');
    return (i ? lc1(e.name) : e.name) + (q !== 1 && e.serving_unit !== 'g' ? ' ×' + fmt(q, 1) : '');
  }).join(', ');
}
function mealKcal(m) { return sum(itemsOf(m.meal_id), e => e.kcal); }

/* MealRow: swipe left for Edit, Copy and Delete */
function mealRow(m) {
  const id = esc(m.meal_id), t = m.meal_type;
  return '<div class="swipe" data-swipe="' + id + '">' +
    '<div class="acts">' +
    '<button class="ib" data-a="editMeal" data-v="' + id + '" aria-label="Edit ' + esc(lc1(t)) + '">' + icon('pencil', 18, 2) + '</button>' +
    '<button class="ib" data-a="copyMeal" data-v="' + id + '" aria-label="Copy ' + esc(lc1(t)) + ' to another day">' + icon('copy', 18, 2) + '</button>' +
    '<button class="ib del" data-a="deleteMeal" data-v="' + id + '" aria-label="Delete ' + esc(lc1(t)) + '">' + icon('trash', 18, 2) + '</button>' +
    '</div>' +
    '<button class="front mrow" data-a="editMeal" data-v="' + id + '">' +
    '<span class="mdot"></span><span class="grow" style="min-width:0"><span style="display:block;font-size:15px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(mealName(m)) + '</span>' +
    '<span class="cap" style="display:block">' + esc(t) + ', ' + time12(m.time) + (m.edited === true || m.edited === 'TRUE' ? ', edited by you' : '') + '</span></span>' +
    '<span style="font-size:15px">' + fmt(mealKcal(m)) + '</span></button></div>';
}

/* simple sparkle-free empty icon tile */
function iconWell(n) { return '<span class="pressed-sm" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--a)">' + icon(n, 18) + '</span>'; }

function demoBadge() { return S.meta.demo ? '<div class="demo">Preview with sample data. Deploy to Apps Script to use your own Sheet and Gemini.</div>' : ''; }

/* ---------- photos: thumbnails load on demand, never with the rest of the data ---------- */
const hasPhoto = m => !!(m && (m.has_thumb || m.thumb || m.photo_url));
let thumbQueue = new Set();
function thumbEl(m, size, extra) {
  const id = m.meal_id, src = S.photos[id];
  if (src === undefined && (m.has_thumb || m.thumb)) { if (m.thumb) S.photos[id] = m.thumb; else thumbQueue.add(id); }
  const url = S.photos[id];
  return '<div class="th" data-thumb="' + esc(id) + '" role="img" aria-label="' + esc(m.meal_type) + ' photo" style="' + (size ? 'width:' + size + 'px;height:' + size + 'px;' : '') + (url ? 'background-image:url(\'' + url + '\')' : '') + (extra || '') + '">' +
    (url ? '' : (m.has_thumb || m.thumb) && url !== false ? '<span class="spinglow"><span class="spin" style="--s:16px;--t:2.5px"></span></span>' : icon(m.source === 'label' ? 'label' : m.source === 'text' ? 'text' : 'plate', 18)) + '</div>';
}
function flushThumbs() {
  if (!thumbQueue.size) return;
  const ids = Array.from(thumbQueue); thumbQueue = new Set();
  ids.forEach(id => { S.photos[id] = null; });
  API.getThumbs(ids).then(map => {
    ids.forEach(id => {
      const u = (map || {})[id] || false; S.photos[id] = u;
      document.querySelectorAll('[data-thumb="' + CSS.escape(id) + '"]').forEach(el => {
        el.innerHTML = u ? '' : icon('plate', 18);
        if (u) el.style.backgroundImage = "url('" + u + "')";
      });
    });
  }).catch(() => ids.forEach(id => { delete S.photos[id]; }));
}

/* ---------- screens: start, goals, today and logging ---------- */
const SCREENS = {};

SCREENS.welcome = () => {
  return '<div class="scr" style="align-items:center;padding:80px 24px 36px">' +
    logoTile(150) +
    wordmark(56, 'margin-top:36px') +
    '<p style="margin-top:12px;font-size:16px;font-weight:300;color:var(--mu);text-align:center;line-height:1.5;max-width:280px">Snap a meal, see what\'s left for the day.</p>' +
    '<div class="col" style="gap:14px;width:100%;margin-top:40px">' +
    [['camera', 'Photograph a plate or a label to get calories and macros'], ['target', 'Check each day against your own target'], ['sheet', 'Every meal saves as a row in your Google Sheet']]
      .map(([i, t]) => '<div class="raised-sm r18 row" style="padding:14px 16px;gap:14px">' + iconWell(i) + '<span style="font-size:14px;line-height:1.4">' + t + '</span></div>').join('') +
    '</div><div class="grow" style="min-height:28px"></div>' +
    '<button class="cta btn" data-a="connect">' + (S.ui.busy ? '<span class="spinglow"><span class="spin"></span></span>' : 'Connect Google account') + '</button>' +
    '<p class="cap" style="margin-top:16px;text-align:center;line-height:1.5">LoCal uses one Sheet and one Drive folder in your account. Meal photos are sent to Gemini for the estimate. <a data-a="go" data-v="settings" href="#">How data is stored</a></p>' +
    '</div>';
};

function logoTile(px, loading) {
  const s = Math.round(px * 116 / 150), k = s / 120;
  // loading: the dial's arc becomes the rotating trail, sized to sit exactly on the track (r 34, stroke 8)
  const ring = loading ? '<span class="spinglow logospin"><span class="spin" style="--s:' + (2 * 38 * k).toFixed(1) + 'px;--t:' + (8 * k).toFixed(1) + 'px"></span></span>' : '';
  return '<div style="position:relative;width:' + px + 'px;height:' + px + 'px;border-radius:' + Math.round(px * .253) + 'px;background:linear-gradient(145deg,#2A2D36,#1F2128);box-shadow:14px 14px 28px var(--lo),-12px -12px 24px var(--hi),inset 0 1px 0 rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
    '<svg width="' + s + '" height="' + s + '" viewBox="0 0 120 120" role="img" aria-label="LoCal app icon"><defs><linearGradient id="lw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16171C"/><stop offset="1" stop-color="#30333D"/></linearGradient><filter id="lg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
    '<circle cx="60" cy="60" r="47" fill="url(#lw)"/><circle cx="60" cy="60" r="43" fill="#23252D"/><circle cx="60" cy="60" r="34" fill="none" stroke="#17181D" stroke-width="8"/>' +
    (loading ? '' : '<circle cx="60" cy="60" r="34" fill="none" stroke="#F5A524" stroke-width="8" stroke-linecap="round" stroke-dasharray="160.2 213.6" transform="rotate(135 60 60)" filter="url(#lg)"/>' +
    '<circle cx="84" cy="84" r="5.5" fill="#FFD08A" filter="url(#lg)"/>') + '<circle cx="60" cy="60" r="18" fill="#FFFFFF" fill-opacity=".06" stroke="#FFFFFF" stroke-opacity=".16"/></svg>' + ring + '</div>';
}
function wordmark(fs, style) {
  const d = Math.round(fs * 0.57);
  return '<div role="img" aria-label="LoCal" style="display:flex;align-items:baseline;font-size:' + fs + 'px;font-weight:300;letter-spacing:-.045em;line-height:1;' + (style || '') + '"><span aria-hidden="true">L</span>' +
    '<svg width="' + d + '" height="' + d + '" viewBox="0 0 120 120" aria-hidden="true" style="margin:0 2px;position:relative;top:1px"><circle cx="60" cy="60" r="48" fill="none" stroke="#15161B" stroke-width="15"/><circle cx="60" cy="60" r="48" fill="none" stroke="#F5A524" stroke-width="15" stroke-linecap="round" stroke-dasharray="226.2 301.6" transform="rotate(135 60 60)" style="filter:drop-shadow(0 0 3px #F5A524)"/><circle cx="94" cy="94" r="8" fill="#FFD08A"/></svg>' +
    '<span aria-hidden="true">Cal</span></div>';
}

/* ---------- Goal calculator ---------- */
function gcState() {
  if (!S.ui.gc) {
    const p = profile(), ws = weightSeries(), lastW = ws.length ? ws[ws.length - 1].kg : null;
    S.ui.gc = Object.assign({age: 30, sex: 'Male', height: 170, weight: 70, activity: 'Light', goal: 'Lose', target_weight: 65, pace: 0.35}, p, lastW ? {weight: r1(lastW)} : {});
  }
  return S.ui.gc;
}
SCREENS.goals = () => {
  const p = gcState(), g = goalCalc(p), keep = p.goal === 'Keep';
  const fld = (id, label, val, step) => '<div class="col" style="gap:6px"><label for="' + id + '" class="lb">' + label + '</label><input id="' + id + '" class="fld" type="number" inputmode="decimal" step="' + (step || 1) + '" value="' + esc(val) + '" data-in="gc" data-k="' + id.slice(3) + '"></div>';
  const paceFrac = (num(p.pace) - 0.1) / 0.65;
  return '<div class="scr">' + backHeader('Goal calculator') +
    '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px">' +
    fld('gc-age', 'Age', p.age) +
    '<div class="col" style="gap:6px"><span class="lb" id="gcsex">Sex</span>' + track('gcSex', ['Male', 'Female'], p.sex, 'Sex', {style: 'height:46px;border-radius:14px'}) + '</div>' +
    fld('gc-height', 'Height, cm', p.height) + fld('gc-weight', 'Current weight, kg', p.weight, 0.1) + '</div>' +
    '<div class="col" style="gap:8px"><span class="lb">How active are you?</span>' + chips('gcAct', ACTIVITY.map(a => a[0]), p.activity, 'How active are you?') + '</div>' +
    '<div class="row" style="gap:14px;align-items:flex-end"><div class="col" style="flex:1.4;gap:8px"><span class="lb">Goal</span>' + chips('gcGoal', ['Lose', 'Keep', 'Gain'], p.goal, 'Goal') + '</div>' +
    '<div class="col" style="flex:1;gap:6px"><label for="gc-target_weight" class="lb">Target, kg</label><input id="gc-target_weight" class="fld sm" type="number" inputmode="decimal" step="0.1" value="' + esc(p.target_weight) + '" data-in="gc" data-k="target_weight"' + (keep ? ' disabled style="opacity:.5"' : '') + '></div></div>' +
    (keep ? '' : '<div class="col" style="gap:10px"><div class="between"><label for="gc-pace" class="lb">Pace</label><span data-part="gc-pv" style="font-size:14px">' + fmt(p.pace, 2) + ' kg a week</span></div>' +
      '<div style="position:relative;height:28px;display:flex;align-items:center"><div class="pressed-sm" style="position:absolute;left:0;right:0;height:12px;border-radius:6px"></div>' +
      '<div data-part="gc-pf" style="position:absolute;left:3px;width:calc(' + (paceFrac * 100).toFixed(1) + '% - 3px);height:6px;border-radius:3px;background:var(--a);box-shadow:0 0 10px var(--a)"></div>' +
      '<div data-part="gc-pk" class="raised-sm" style="position:absolute;left:calc(' + (paceFrac * 100).toFixed(1) + '% - ' + (paceFrac * 28).toFixed(1) + 'px);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;pointer-events:none"><span style="width:8px;height:8px;border-radius:50%;background:var(--a)"></span></div>' +
      '<input id="gc-pace" type="range" min="0.1" max="0.75" step="0.05" value="' + p.pace + '" aria-valuetext="' + fmt(p.pace, 2) + ' kg a week" data-in="gcPace" style="position:absolute;inset:0;width:100%;opacity:0;margin:0;cursor:pointer"></div>' +
      '<div class="between" style="font-size:11px;color:var(--mu)"><span>Gentle</span><span>Faster</span></div></div>') +
    '<section data-part="gc-res" class="raised r26" style="padding:16px;display:flex;flex-direction:column;gap:14px" aria-live="polite"><div class="row" style="gap:16px">' +
    ringDial(110, 0, g.kcal / Math.max(g.maintenance, g.kcal), '<div style="text-align:center"><div class="num" style="font-size:28px">' + fmt(g.kcal) + '</div><div style="font-size:11px;color:var(--mu)">kcal a day</div></div>', fmt(g.kcal) + ' kcal a day') +
    '<div class="col grow" style="gap:6px;font-size:13px">' +
    '<div class="between"><span class="mu">Maintenance</span><span>' + fmt(g.maintenance) + '</span></div>' +
    '<div class="between"><span class="mu">' + (g.delta < 0 ? 'Daily deficit' : g.delta > 0 ? 'Daily surplus' : 'Daily change') + '</span><span>' + fmtSigned(g.delta) + '</span></div>' +
    (keep ? '' : '<div class="between"><span class="mu">Reach ' + fmt(p.target_weight, 1) + ' kg in</span><span style="white-space:nowrap">about ' + plural(g.weeks, 'week') + '</span></div>') +
    '</div></div><div class="row" style="gap:10px">' +
    [['Protein', g.protein, COLOR.p], ['Carbs', g.carbs, COLOR.c], ['Fat', g.fat, '#B9AEFF']].map(([l, v, c]) => '<div class="pressed-sm r14" style="flex:1;padding:8px 10px"><div style="font-size:11px;color:' + c + '">' + l + '</div><div style="font-size:16px">' + fmt(v) + ' g</div></div>').join('') +
    '</div></section>' +
    '<button class="cta btn" data-a="useTargets">Use these targets</button>' +
    '<p class="cap" style="text-align:center;line-height:1.5">Estimated with the Mifflin-St Jeor formula. A starting point, not medical advice.</p></div>';
};

/* ---------- Daily targets ---------- */
function tgState() {
  if (!S.ui.tg) S.ui.tg = Object.assign({mode: 'Grams'}, currentTarget(), {
    fiber_on: num(currentTarget().fiber_min_g) > 0, sugar_on: num(currentTarget().sugar_max_g) > 0, sodium_on: num(currentTarget().sodium_max_mg) > 0,
    fiber_min_g: num(currentTarget().fiber_min_g) || 25, sugar_max_g: num(currentTarget().sugar_max_g) || 50, sodium_max_mg: num(currentTarget().sodium_max_mg) || 2300});
  return S.ui.tg;
}
SCREENS.targets = () => {
  const t = tgState(), k = num(t.kcal), mk = macroKcal(t), pct = (g, f) => k ? Math.round(g * f / k * 100) : 0;
  const macro = (key, label, f, color) => {
    const g = num(t[key]), pc = pct(g, f), val = t.mode === 'Grams' ? r0(g) : pc;
    return '<div class="col" style="gap:6px"><div class="between" style="font-size:14px;align-items:center"><label for="tg-' + key + '">' + label + '</label>' +
      '<span class="row" style="gap:8px"><input id="tg-' + key + '" class="fld" type="number" inputmode="numeric" value="' + val + '" data-in="tgMacro" data-k="' + key + '" data-f="' + f + '" style="width:76px;height:36px;text-align:right;font-size:15px;padding:0 10px">' +
      '<span data-part="tgp-' + key + '" style="min-width:48px">' + (t.mode === 'Grams' ? 'g <span class="mu">' + pc + '%</span>' : '% <span class="mu">' + fmt(g) + ' g</span>') + '</span></span></div>' +
      '<div class="mbar" data-part="tgb-' + key + '"><div style="width:' + clamp(pc / 60 * 100, 2, 100) + '%;background:' + color + ';box-shadow:0 0 8px ' + color + '"></div></div></div>';
  };
  const lim = (key, on, label, unit) => '<div class="row" style="height:50px"><label for="tg-' + key + '" style="flex-grow:1;font-size:14px">' + label + '</label>' +
    '<input id="tg-' + key + '" class="fld" type="number" inputmode="numeric" value="' + r0(t[key]) + '" data-in="tg" data-k="' + key + '" style="width:84px;height:34px;text-align:right;font-size:14px;padding:0 8px;' + (on ? '' : 'opacity:.45') + '"' + (on ? '' : ' disabled') + '>' +
    '<span class="mu" style="font-size:14px;width:26px">' + unit + '</span>' + switchBtn(on, 'tgToggle', label, key) + '</div>';
  const diff = Math.round(mk - k);
  return '<div class="scr tabbed"><header class="between" style="align-items:center"><h1 class="title">Daily targets</h1>' +
    '<button class="ib" data-a="go" data-v="settings" aria-label="Settings">' + icon('gear', 20) + '</button></header>' +
    '<section class="raised r26 row" style="padding:16px 18px;gap:14px">' +
    '<button class="ib m" data-a="tgKcal" data-v="-50" aria-label="Lower by 50" style="font-size:20px">−</button>' +
    '<div class="grow" style="text-align:center"><div class="num" style="font-size:44px;letter-spacing:-.04em">' + fmt(k) + '</div><div class="cap13" style="margin-top:4px">kcal a day</div></div>' +
    '<button class="ib m" data-a="tgKcal" data-v="50" aria-label="Raise by 50" style="font-size:20px">+</button></section>' +
    '<div class="between" style="font-size:13px;margin-top:-4px;padding:0 4px"><span class="mu">' + (profile().maintenance ? 'From the goal calculator' : 'Set by you') + '</span><a href="#" data-a="go" data-v="goals">Recalculate</a></div>' +
    '<div class="between" style="align-items:center"><h2 class="sec">Macros</h2>' + track('tgMode', ['Grams', 'Percent'], t.mode, 'Enter macros as', {tight: true, style: 'border-radius:14px'}) + '</div>' +
    '<div class="col" style="gap:14px">' + macro('protein_g', 'Protein', 4, COLOR.p) + macro('carbs_g', 'Carbs', 4, COLOR.c) + macro('fat_g', 'Fat', 9, COLOR.f) + '</div>' +
    '<p class="cap" data-part="tgsum">These add up to ' + fmt(mk) + ' kcal (4 per gram of protein and carbs, 9 per gram of fat)' + (Math.abs(diff) < 5 ? ', matching your calorie target.' : ', ' + fmt(Math.abs(diff)) + (diff < 0 ? ' under' : ' over') + ' your calorie target.') + '</p>' +
    '<div class="raised r22 col" style="padding:6px 16px">' + lim('fiber_min_g', t.fiber_on, 'Fiber, at least', 'g') + '<div class="sep"></div>' + lim('sugar_max_g', t.sugar_on, 'Sugar, at most', 'g') + '<div class="sep"></div>' + lim('sodium_max_mg', t.sodium_on, 'Sodium, at most', 'mg') + '</div>' +
    '<p class="cap">Changes apply from today. Past days are still compared with the target they had.</p>' +
    '<button class="cta btn" data-a="saveTargets" style="height:54px">' + (S.ui.busy ? '<span class="spinglow"><span class="spin"></span></span>' : 'Save targets') + '</button>' +
    '</div>' + tabBar('targets');
};

/* ---------- Settings and data ---------- */
SCREENS.settings = () => {
  const m = S.meta, h13 = t => '<h2 class="h13">' + t + '</h2>';
  const sel = (key, opts, val, label) => '<select class="pill" data-in="setting" data-k="' + key + '" aria-label="' + label + '">' + opts.map(o => '<option' + (o === val ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>';
  const link = (url, text) => url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="font-size:13px">' + text + '</a>' : '<span class="cap">' + (m.demo ? 'After deploying' : '') + '</span>';
  return '<div class="scr" style="gap:12px">' + backHeader('Settings and data') + demoBadge() +
    h13('Where your data lives') +
    '<section class="raised r22 col" style="padding:6px 16px 14px">' +
    '<div class="row" style="min-height:50px;font-size:14px"><span class="mdot" style="background:' + (m.demo ? 'var(--mu)' : 'var(--p)') + ';box-shadow:0 0 8px ' + (m.demo ? 'transparent' : 'var(--p)') + '"></span><span class="grow">' + (m.demo ? 'Preview, not connected' : 'Google account connected') + '</span></div>' +
    '<div class="sep"></div><div class="row" style="min-height:50px;font-size:14px"><span class="grow">Sheet: LoCal log</span>' + link(m.sheetUrl, 'Open in Sheets') + '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px">' + ['Entries', 'Meals', 'Favorites', 'Targets', 'Weight', 'Settings'].map(t => '<span class="tag" style="color:var(--mu);font-size:12px;padding:5px 9px;border-radius:10px">' + t + '</span>').join('') + '</div>' +
    '<div class="row" style="min-height:50px;font-size:14px;margin-top:6px"><span class="grow">Photos: Drive folder LoCal photos</span>' + link(m.folderUrl, 'Open') + '</div></section>' +
    h13('Photo analysis') +
    '<section class="raised r22 col" style="padding:6px 16px">' +
    '<div class="row" style="min-height:50px;font-size:14px"><span class="grow">Model</span><span class="mu">' + esc(m.model || 'Gemini Flash, free tier') + '</span></div><div class="sep"></div>' +
    '<div class="row" style="min-height:50px;font-size:14px"><span class="grow">API key</span><span class="' + (m.hasKey || m.demo ? 'mu' : 'ov') + '">' + (m.demo ? 'Not used in the preview' : m.hasKey ? 'Stored in Apps Script' : 'Missing. Add GEMINI_API_KEY') + '</span></div><div class="sep"></div>' +
    '<div class="row" style="min-height:50px;font-size:14px"><span class="grow">AI analyses today</span><span>' + fmt(m.analysesToday) + '</span></div></section>' +
    '<p class="cap" style="padding:0 4px">Google sets the free limits and can change them. Meals and foods you add again from search don\'t use the AI.</p>' +
    h13('Preferences') +
    '<section class="raised r22 col" style="padding:6px 16px">' +
    '<div class="row" style="min-height:50px;font-size:14px"><span class="grow">Units</span><span class="pressed-sm pill">kg and cm</span></div><div class="sep"></div>' +
    '<div class="row" style="min-height:50px;font-size:14px"><span class="grow">Week starts on</span>' + sel('week_start', ['Monday', 'Sunday'], setting('week_start', 'Monday'), 'Week starts on') + '</div></section>' +
    '<button class="raised-sm btn2" data-a="csv">Download all data as CSV</button>' +
    '<p class="cap" style="padding:0 4px;line-height:1.5">Meal photos go to Google\'s Gemini API for the estimate. On the free tier, Google may use them to improve its products. Everything else stays in your account.</p></div>';
};

/* ---------- Today ---------- */
SCREENS.today = () => {
  const t0 = today(), d = viewDay(), t = totalsOn(d), tg = targetFor(d), meals = mealsOn(d).slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const types = meals.map(m => m.meal_type);
  const next = ['Breakfast', 'Lunch', 'Dinner'].find(x => !types.includes(x));
  const anim = S.firstToday && d === t0; S.firstToday = false;
  const canNext = d < addDays(t0, 7);
  // what's over the day's target, for the warning line
  const overs = [];
  if (t.kcal > num(tg.kcal)) overs.push(fmt(t.kcal - num(tg.kcal)) + ' kcal');
  [['carbs', t.carbs_g, tg.carbs_g, 'g'], ['fat', t.fat_g, tg.fat_g, 'g'], ['sugar', t.sugar_g, tg.sugar_max_g, 'g'], ['sodium', t.sodium_mg, tg.sodium_max_mg, 'mg']]
    .forEach(([l, v, lim, u]) => { if (num(lim) > 0 && v > num(lim)) overs.push(l + ' +' + fmt(v - num(lim)) + ' ' + u); });
  const micro = [['Sugar', t.sugar_g, tg.sugar_max_g, 'g', false], ['Fiber', t.fiber_g, tg.fiber_min_g, 'g', true], ['Sodium', t.sodium_mg, tg.sodium_max_mg, 'mg', false]].filter(x => num(x[2]) > 0);
  const arrow = (dir, ok) => '<button class="ib ib40" data-a="day" data-v="' + dir + '" aria-label="' + (dir < 0 ? 'Previous day' : 'Next day') + '"' + (ok ? '' : ' disabled style="opacity:.35"') + '>' + icon(dir < 0 ? 'back' : 'next', 16, 2) + '</button>';
  return '<div class="scr tabbed" style="gap:16px">' + demoBadge() +
    '<header class="col" style="gap:10px"><div class="between" style="align-items:center">' + wordmark(22, 'color:var(--tx)') +
    '<button class="ib m" data-a="tab" data-v="history" aria-label="Pick a date">' + icon('calendar', 20) + '</button></div>' +
    '<div class="between" style="align-items:flex-end"><div><div class="cap13" style="font-size:14px">' + (d === t0 ? 'Today, ' : d === addDays(t0, -1) ? 'Yesterday, ' : d === addDays(t0, 1) ? 'Tomorrow, ' : '') + dayName(d) + '</div><h1 class="title">' + monthDay(d) + (parseDay(d).getFullYear() !== new Date().getFullYear() ? ', ' + parseDay(d).getFullYear() : '') + '</h1></div>' +
    (d !== t0 ? '<button class="raised-sm" data-a="day" data-v="today" style="height:36px;padding:0 14px;border-radius:12px;font-size:13px;color:var(--a);font-weight:500">Back to today</button>' : '') + '</div></header>' +
    '<div class="dayswipe" data-hswipe="day" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;touch-action:pan-y">' + arrow(-1, true) +
    '<div class="dialmove swmove">' + calorieDial(r0(t.kcal), num(tg.kcal), {animate: anim, past: d < t0}) + '</div>' + arrow(1, canNext) + '</div>' +
    '<div class="cap13" style="text-align:center;margin-top:-6px">' + fmt(t.kcal) + ' eaten of ' + fmt(tg.kcal) + ' kcal</div>' +
    (overs.length ? '<div class="warn row" role="status" style="gap:10px;padding:10px 14px"><span class="ov" style="flex-shrink:0;display:flex">' + icon('warn', 18, 2) + '</span><span><span class="ov" style="font-weight:500">Over target:</span> ' + esc(overs.join(', ')) + '</span></div>' : '') +
    '<div class="row">' + macroDial('Protein', r0(t.protein_g), num(tg.protein_g), COLOR.p) + macroDial('Carbs', r0(t.carbs_g), num(tg.carbs_g), COLOR.c) + macroDial('Fat', r0(t.fat_g), num(tg.fat_g), COLOR.f) + '</div>' +
    (micro.length ? '<div class="row" style="gap:10px">' + micro.map(x => microDial(x[0], r0(x[1]), num(x[2]), x[3], x[4])).join('') + '</div>' : '') +
    '<section class="col" style="gap:12px"><div class="between"><h2 class="sec">Meals</h2>' + (meals.length ? '<a href="#" data-a="go" data-v="day" data-d="' + d + '" style="font-size:13px">Day summary</a>' : '') + '</div>' +
    meals.map(mealRow).join('') +
    (next ? '<div class="pressed-sm r18 row" style="padding:8px 8px 8px 14px"><span class="mdot empty"></span><div class="grow"><div style="font-size:15px;font-weight:500">' + next + '</div><div class="cap">Nothing logged yet</div></div>' +
      '<button class="cta btn-sm" data-a="logType" data-v="' + next + '">Log ' + lc1(next) + '</button></div>' : '') +
    (meals.length ? '<p class="cap" style="text-align:center">Swipe a meal left to edit, copy or delete it. Swipe the dial for other days.</p>' : '<p class="cap" style="text-align:center">Swipe the dial or use the arrows for other days.</p>') +
    '</section></div>' + tabBar('today');
};

/* date and time pickers, shared by logging, review and the label screen */
function whenRow(prefix, date, time) {
  return '<div class="row" style="gap:10px"><label class="col grow" style="gap:4px;min-width:0"><span class="lb">Date</span><input id="' + prefix + '-date" type="date" class="fld sm" data-in="' + prefix + 'Date" value="' + esc(date) + '" style="font-size:15px"></label>' +
    '<label class="col" style="gap:4px;width:42%"><span class="lb">Time</span><input id="' + prefix + '-time" type="time" class="fld sm" data-in="' + prefix + 'Time" value="' + esc(time) + '" style="font-size:15px"></label></div>';
}

/* ---------- Log a meal ---------- */
function logState() {
  if (!S.log) {
    const d = viewDay(), type = d === today() ? mealForNow() : 'Lunch';
    S.log = {mode: 'meal', meal_type: type, date: d, time: d === today() ? nowHM() : TYPE_TIME[type], timeAuto: d !== today(), note: '', text: '', img: '', full: null, thumb: '', photo_url: '', busy: false, error: ''};
  }
  return S.log;
}
SCREENS.log = () => {
  const L = logState();
  const corners = '<div aria-hidden="true" style="position:absolute;left:66px;right:66px;top:86px;height:210px;max-width:258px;margin:0 auto">' +
    ['left:0;top:0;border-left-width:3px;border-top-width:3px;border-radius:12px 0 0 0', 'right:0;top:0;border-right-width:3px;border-top-width:3px;border-radius:0 12px 0 0', 'left:0;bottom:0;border-left-width:3px;border-bottom-width:3px;border-radius:0 0 0 12px', 'right:0;bottom:0;border-right-width:3px;border-bottom-width:3px;border-radius:0 0 12px 0'].map(s => '<div class="corner" style="' + s + '"></div>').join('') + '</div>';
  // One photo, either kind: the AI decides whether it's food or a nutrition label, so there is no mode to pick.
  const cta = L.busy ? '<button class="cta btn" disabled aria-live="polite"><span class="spinglow"><span class="spin"></span></span><span style="margin-left:10px">Analyzing photo</span></button>'
    : '<button class="cta btn" data-a="analyze">' + (L.img ? 'Analyze photo' : 'Take a photo') + '</button>';
  return '<div class="col" style="min-height:100vh;min-height:100dvh">' +
    '<div class="cam' + (L.img ? '' : ' empty') + '">' + (L.img ? '<img class="shot" src="' + L.img + '" alt="Your photo">' :
      '<button data-a="shoot" class="col" style="align-items:center;gap:10px;color:rgba(255,255,255,.75);font-size:14px;text-align:center">' + icon('camera', 40, 1.4) + '<span>Photograph your plate<br>or a nutrition label</span></button>') +
    corners +
    '<header style="position:absolute;left:18px;right:18px;top:22px;display:flex;align-items:center">' +
    '<button class="gb" data-a="closeLog" aria-label="Close" style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff">' + icon('close', 18, 2) + '</button></header></div>' +
    '<div class="sheet">' +
    '<div style="display:flex;justify-content:center;gap:28px;margin-top:-34px">' +
    '<button class="raised-md" data-a="pick" aria-label="Choose from gallery" style="width:56px;height:56px;margin-top:10px;border-radius:50%;display:flex;align-items:center;justify-content:center">' + icon('gallery', 20) + '</button>' +
    '<button class="shutter" data-a="shoot" aria-label="' + (L.img ? 'Retake photo' : 'Take photo') + '"><span></span></button>' +
    '<button class="raised-md" data-a="go" data-v="search" aria-label="Search past meals" style="width:56px;height:56px;margin-top:10px;border-radius:50%;display:flex;align-items:center;justify-content:center">' + icon('search', 20) + '</button></div>' +
    '<div class="between"><h1 class="title22">Log a meal</h1><span class="cap13">' + esc(dayLabel(L.date)) + ', ' + time12(L.time) + '</span></div>' +
    chips('logType', MEAL_TYPES, L.meal_type, 'Meal') + whenRow('log', L.date, L.time) +
    '<div class="col" style="gap:8px"><label for="lm-note" style="font-size:14px;font-weight:500">Note for the AI <span style="font-weight:300;color:var(--mu)">optional</span></label>' +
    '<textarea id="lm-note" rows="2" class="fld" data-in="logNote" placeholder="Guide the AI: what\'s in it, how much, how it was cooked, what to leave out">' + esc(L.note) + '</textarea>' +
    '<span class="cap">The AI reads this like an instruction and trusts it over the photo.</span></div>' +
    (L.error ? '<div class="warn" role="alert"><div class="ov" style="font-weight:500">' + esc(L.error) + '</div><div class="mu" style="margin-top:2px">Your photo and note are kept.</div>' +
      '<div class="row" style="margin-top:10px"><button class="raised-sm btn-sm mango" data-a="analyze" style="flex:1">Try again</button><button class="raised-sm btn-sm" data-a="go" data-v="search" style="flex:1;font-weight:500">Search past meals</button></div></div>' : '') +
    cta +
    '<div class="between" style="align-items:center;flex-wrap:wrap;gap:8px 12px"><a href="#" data-a="go" data-v="describe" style="font-size:13px">Describe it in words</a><a href="#" data-a="go" data-v="search" style="font-size:13px">Search past meals</a></div>' +
    '<input type="file" id="camIn" accept="image/*" capture="environment" data-in="photo" class="sr" tabindex="-1" aria-hidden="true">' +
    '<input type="file" id="galIn" accept="image/*" data-in="photo" class="sr" tabindex="-1" aria-hidden="true">' +
    '</div></div>';
};

/* ---------- Review the AI result (also edits a saved meal) ---------- */
SCREENS.review = () => {
  const D = S.draft; if (!D) return SCREENS.today();
  const m = D.meal, t = mealTotals(D.items), tl = lc1(m.meal_type);
  const others = mealsOn(m.date).filter(x => x.meal_id !== m.meal_id);
  const dayAfter = sum(others, x => mealKcal(x)) + t.kcal, tg = num(targetFor(m.date).kcal), left = tg - dayAfter;
  const sh = macroShares(t);
  const isNew = D.mode === 'new';
  const card = (e, i) => {
    const low = e.confidence === 'low';
    const head = '<div class="between"><button data-a="editItem" data-v="' + i + '" style="font-size:15px;font-weight:500;text-align:left">' + esc(e.name || 'Unnamed item') + '</button><span style="font-size:15px;white-space:nowrap">' + (has(e.kcal) ? fmt(e.kcal) + ' kcal' : '<span class="ov">Set kcal</span>') + '</span></div>';
    if (low) return '<div class="icard low">' + head + '<div class="ov" style="font-size:13px;font-weight:500">Low confidence: ' + esc(e.reason || 'check this item') + '</div>' +
      '<div class="cap13">' + (num(e.sodium_mg) >= 300 ? 'Sodium of ' + fmt(e.sodium_mg) + ' mg is a guess. ' : '') + 'Check it before saving. <a href="#" data-a="editItem" data-v="' + i + '">Check it</a></div></div>';
    return '<div class="icard raised-md">' + head + '<div class="row" style="gap:10px">' +
      '<button class="pressed-sm sel" data-a="editItem" data-v="' + i + '" aria-label="Serving: ' + esc(amountLabel(Object.assign({}, e, {quantity: 1}))) + '. Edit">' + esc(servingLabel(e)) + icon('down', 16, 2, ' style="color:var(--mu)"') + '</button>' +
      stepper(num(e.quantity) || 1, 'itemQty', 'of ' + (e.name || 'item'), {min: 0.5}).replace(/data-a="itemQty"/g, 'data-a="itemQty" data-i="' + i + '"') + '</div></div>';
  };
  const photo = isNew && D.source === 'photo' && S.log && S.log.img ? {src: S.log.img} : hasPhoto(m) ? {m} : null;
  const photoRow = photo ? '<button class="raised-md r20 row" data-a="viewPhoto" style="padding:10px;gap:12px;text-align:left;width:100%">' +
    (photo.src ? '<div class="th" role="img" aria-label="Meal photo" style="width:56px;height:56px;background-image:url(\'' + photo.src + '\')"></div>' : thumbEl(m, 56)) +
    '<span class="grow"><span style="display:block;font-size:15px">Meal photo</span><span class="cap" style="display:block">' + (m.note ? 'Note: ' + esc(m.note) : 'Tap to see it larger') + '</span></span><span class="mango" style="display:flex;padding-right:6px">' + icon('expand', 18) + '</span></button>' : '';
  const when = '<section class="col" style="gap:10px"><h2 class="sec15">When</h2>' + chips('draftType', MEAL_TYPES, m.meal_type, 'Meal') + whenRow('draft', m.date, m.time) + '</section>';
  return '<div class="scr">' + backHeader(isNew ? 'Review ' + tl : 'Edit ' + tl, {sub: (isNew && m.date === today() ? '' : dayLabel(m.date) + ', ' + time12(m.time)),
    right: (isNew && D.source === 'photo' && S.log && S.log.img) ? '<button class="ib m" data-a="reanalyze" aria-label="Analyze again">' + icon('refresh', 18, 2) + '</button>' : ''}) +
    (D.demo ? '<div class="demo">Preview: a sample result. No photo was sent to the AI.</div>' : '') +
    photoRow +
    '<section class="raised r28" style="padding:16px;display:flex;flex-direction:column;gap:14px"><div class="row" style="gap:16px">' +
    '<div class="dial well" style="width:118px;height:118px;flex-direction:column">' + macroRing(t, 118, 47, 7, 8, true, 'Meal calories by macro: protein ' + Math.round(sh.p * 100) + ' percent, carbs ' + Math.round(sh.c * 100) + ' percent, fat ' + Math.round(sh.f * 100) + ' percent') +
    '<div class="num" style="font-size:34px;letter-spacing:-.04em">' + fmt(t.kcal) + '</div><div class="cap">kcal</div></div>' +
    '<div class="col grow" style="gap:7px;font-size:14px">' +
    [['Protein', t.protein_g, COLOR.p], ['Carbs', t.carbs_g, COLOR.c], ['Fat', t.fat_g, COLOR.f]].map(([l, v, c]) => '<div class="row" style="gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:' + c + '"></span><span class="grow">' + l + '</span><span>' + fmt(v) + ' g</span></div>').join('') +
    '<div class="cap"' + (left < 0 ? ' style="color:var(--ov)"' : '') + '>After ' + tl + ': ' + fmt(Math.abs(left)) + ' kcal ' + (left < 0 ? 'over' : 'left') + '</div></div></div>' +
    (D.ai ? '<div class="glass-soft r16 row" style="padding:10px 12px;gap:12px">' + confDots(D.ai.confidence) +
      '<div style="font-size:13px;color:var(--mu);line-height:1.35"><span style="color:var(--tx)">' + CONF_TEXT[D.ai.confidence in CONF_TEXT ? D.ai.confidence : 'medium'] + '.</span> ' + esc(D.ai.reason || '') + '</div></div>' : '') +
    '</section>' +
    '<div class="between" style="align-items:center"><h2 class="sec">' + plural(D.items.length, 'item') + '</h2><button class="raised-sm" data-a="addItem" style="height:40px;padding:0 14px;border-radius:14px;font-size:13px;font-weight:600;color:var(--a)">Add an item</button></div>' +
    D.items.map(card).join('') +
    (D.items.length ? '<div class="cap" style="display:flex;justify-content:space-between;gap:8px;padding:0 4px;flex-wrap:wrap"><span>Sugar ' + fmt(t.sugar_g) + ' g</span><span>Fiber ' + fmt(t.fiber_g) + ' g</span><span>Sodium ' + fmt(t.sodium_mg) + ' mg</span><span>estimates</span></div>' : '<p class="cap" style="text-align:center">No items. Add one to save this meal.</p>') +
    when +
    (isNew ? '' : '<div class="col" style="gap:6px"><label for="rv-note" class="lb">Note</label><input id="rv-note" class="fld" data-in="draftNote" value="' + esc(m.note || '') + '" placeholder="Optional"></div>') +
    '<div class="grow"></div>' +
    '<div class="row">' + (isNew ? '' : '<button class="raised-sm" data-a="deleteMeal" data-v="' + esc(m.meal_id) + '" style="height:56px;padding:0 18px;border-radius:20px;font-size:15px;color:var(--ov);white-space:nowrap">Delete meal</button>') +
    '<button class="cta btn grow" data-a="saveDraft"' + (D.items.length && !S.ui.busy ? '' : ' disabled') + '>' + (S.ui.busy ? '<span class="spinglow"><span class="spin"></span></span>' : isNew ? 'Save to ' + tl : 'Save changes') + '</button></div></div>';
};

/* ---------- Edit an item (also adds or edits a saved dish) ---------- */
SCREENS.edit = () => {
  const E = S.edit; if (!E) return SCREENS.review();
  const it = E.item, u = it.serving_unit || 'serving', g = num(it.grams_per_unit), q = num(it.quantity) || 1;
  const units = UNITS.includes(u) ? UNITS : UNITS.concat([u]);
  const origG = num(E.orig.grams_per_unit) * (num(E.orig.quantity) || 1), nowG = g * q;
  const chk = macroCheck(it);
  const cell = (k, span) => {
    const c = {protein_g: COLOR.p, carbs_g: COLOR.c, fat_g: '#B9AEFF'}[k];
    const lab = '<div class="vl"' + (c ? ' style="color:' + c + '"' : '') + '>' + VALUE_LABEL[k] + '</div>';
    if (E.manual) return '<label class="v"' + (span ? ' style="grid-column:span 2"' : '') + '>' + lab + '<span class="row" style="gap:4px"><input type="number" inputmode="decimal" step="any" value="' + (has(it[k]) ? r1(it[k]) : '') + '" data-in="itemVal" data-k="' + k + '" aria-label="' + VALUE_LABEL[k] + ', ' + VALUE_UNIT[k] + '"' + (span ? ' style="font-size:22px;font-weight:250"' : '') + '><span class="cap">' + VALUE_UNIT[k] + '</span></span></label>';
    return '<div class="v"' + (span ? ' style="grid-column:span 2"' : '') + '>' + lab + '<div class="vv"' + (span ? ' style="font-size:24px;font-weight:250"' : '') + '>' + (has(it[k]) ? fmt(it[k], k === 'kcal' || k === 'sodium_mg' ? 0 : 1) + ' ' + VALUE_UNIT[k] : '—') + '</div></div>';
  };
  const nameChanged = E.orig.name && it.name !== E.orig.name;
  const forLabel = u === 'g' || g ? fmt(nowG) + ' g' : fmt(q, 2) + ' ' + unitWord(u, q);
  return '<div class="scr">' + backHeader(E.idx < 0 ? 'Add an item' : 'Edit item') +
    '<div class="col" style="gap:6px"><label for="ei-name" class="lb">Food</label><input id="ei-name" class="fld" data-in="itemName" value="' + esc(it.name || '') + '" placeholder="For example: grilled chicken" autocomplete="off">' +
    '<span class="cap" data-part="ei-cap">' + (nameChanged ? 'Changed from ' + esc(lc1(E.orig.name)) + '. Get new values for this item only.' : '') + '</span></div>' +
    '<div class="row" style="gap:10px"><button data-part="ei-ask" class="raised-sm" data-a="askAI" style="flex:1;height:44px;border-radius:14px;font-size:14px;color:var(--a);font-weight:500"' + (it.name && !E.busy ? '' : ' disabled') + '>' + (E.busy ? '<span class="spinglow"><span class="spin"></span></span>' : (E.orig.name ? 'Ask the AI again' : 'Ask the AI')) + '</button>' +
    '<button class="' + (E.manual ? 'pressed-sm' : 'raised-sm') + '" data-a="manual" aria-pressed="' + !!E.manual + '" style="flex:1;height:44px;border-radius:14px;font-size:14px;' + (E.manual ? 'color:var(--a)' : '') + '">Enter my own</button></div>' +
    '<div class="col" style="gap:8px"><span class="lb">Serving</span>' + chips('itemUnit', units.map(x => [x, UNIT_LABEL[x] || cap1(x)]), u, 'Serving', {h: 38}) +
    '<div class="row" style="gap:12px"><label for="ei-g" style="font-size:14px;flex-shrink:0">' + (u === 'g' ? 'Portion' : '1 ' + esc(u) + ' is') + '</label>' +
    '<span class="row" style="gap:6px"><input id="ei-g" class="fld" type="number" inputmode="decimal" value="' + (g || '') + '" placeholder="—" data-in="itemGrams" style="width:84px;text-align:right"><span class="mu">g</span></span>' +
    '<span class="grow"></span>' + stepper(q, 'editQty', 'servings', {min: 0.5}) + '</div></div>' +
    '<section class="raised r24" style="padding:14px;display:flex;flex-direction:column;gap:10px"><div class="between" data-part="ei-vh"><h2 class="sec15">Values for ' + forLabel + '</h2>' +
    (origG && nowG && Math.abs(origG - nowG) > 0.5 ? '<span class="cap">Rescaled from ' + fmt(origG) + ' g</span>' : '') + '</div>' +
    '<div data-part="ei-grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">' + cell('kcal', true) + VALUES.slice(1).map(k => cell(k)).join('') + '</div>' +
    '<div data-part="ei-chk" aria-live="polite">' + (has(it.kcal) ? '<div class="row" style="gap:8px;font-size:12px;color:var(--mu);align-items:flex-start"><span style="width:8px;height:8px;margin-top:4px;border-radius:50%;flex-shrink:0;background:' + (chk.ok ? 'var(--p);box-shadow:0 0 6px var(--p)' : 'var(--ov);box-shadow:0 0 6px var(--ov)') + '"></span>' +
      (chk.ok ? '<span>The macros add up to ' + fmt(chk.mk) + ' kcal, close to ' + fmt(chk.k) + '. The numbers check out.</span>'
        : '<span><span class="ov">The macros add up to ' + fmt(chk.mk) + ' kcal, but calories say ' + fmt(chk.k) + '.</span> <a href="#" data-a="useMacroKcal">Use calories from macros</a></span>') + '</div>' : '') + '</div>' +
    '</section>' +
    '<div class="row" style="gap:12px"><label for="ei-cat" class="lb" style="flex-shrink:0;font-size:14px;color:var(--tx)">Category</label><select id="ei-cat" class="fld sm" data-in="itemCat">' + CATEGORIES.map(c => '<option value="' + c + '"' + (c === (it.category || 'other') ? ' selected' : '') + '>' + CATEGORY_LABEL[c] + '</option>').join('') + '</select></div>' +
    ('<div class="col"><div class="row" style="height:48px"><span class="grow" style="font-size:14px">Mark as edited by me</span>' + switchBtn(E.edited, 'tglEdited', 'Mark as edited by me') + '</div>' +
      '<div class="row" style="height:48px"><span class="grow" style="font-size:14px">Use as my default for this dish</span>' + switchBtn(E.asDefault, 'tglDefault', 'Use as my default for this dish') + '</div></div>') +
    '<div class="grow"></div><div class="row"><button class="raised-sm" data-a="removeItem" style="height:56px;padding:0 18px;border-radius:20px;font-size:15px;color:var(--ov)">' + (E.idx < 0 ? 'Cancel' : 'Remove') + '</button>' +
    '<button data-part="ei-done" class="cta btn grow" data-a="doneItem"' + (it.name && has(it.kcal) ? '' : ' disabled') + '>' + 'Done' + '</button></div></div>';
};

/* ---------- Nutrition label ---------- */
SCREENS.label = () => {
  const Lb = S.label; if (!Lb) return SCREENS.log();
  const r = Lb.result, ps = Object.assign({}, r.per_serving), s = num(Lb.servings) || 1;
  Object.keys(Lb.manual).forEach(k => { if (has(Lb.manual[k])) ps[k] = num(Lb.manual[k]); });
  const unread = r.unread_fields || [];
  const tot = {}; VALUES.forEach(k => tot[k] = num(ps[k]) * s);
  const tr = k => {
    if (unread.includes(k)) return '<div class="sep" style="margin:4px 0"></div><div class="between" style="align-items:center;padding:4px 0 6px"><div><label for="ls-' + k + '" style="font-size:14px">' + VALUE_LABEL[k] + '</label><div class="cap ov">Cut off in the photo. Enter it.</div></div>' +
      '<input id="ls-' + k + '" class="fld bad" type="number" inputmode="decimal" placeholder="' + VALUE_UNIT[k] + '" value="' + esc(Lb.manual[k] == null ? '' : Lb.manual[k]) + '" data-in="labelVal" data-k="' + k + '" style="width:96px;height:42px;font-size:15px;padding:0 12px"></div>';
    return '<div class="between" style="height:34px;align-items:center;font-size:14px"><span>' + VALUE_LABEL[k] + '</span><span>' + (has(ps[k]) ? fmt(ps[k], 1) + ' ' + VALUE_UNIT[k] : '—') + '</span></div>';
  };
  const ordered = VALUES.filter(k => !unread.includes(k)).concat(VALUES.filter(k => unread.includes(k)));
  return '<div class="scr">' + backHeader('From the label') +
    (Lb.demo ? '<div class="demo">Preview: a sample label. No photo was sent to the AI.</div>' : '') +
    '<div class="row" style="gap:14px"><div class="pressed" style="width:84px;height:104px;flex-shrink:0;border-radius:18px;overflow:hidden;display:flex;align-items:center;justify-content:center">' +
    (Lb.img ? '<img src="' + Lb.img + '" alt="Photo of the nutrition label" style="width:100%;height:100%;object-fit:cover">' : icon('label', 32, 1.4)) + '</div>' +
    '<div class="col" style="gap:6px;min-width:0"><label class="sr" for="ls-name">Product name</label><input id="ls-name" data-in="labelName" value="' + esc(Lb.name) + '" style="font-size:17px;font-weight:500;border:0;background:none;padding:0;color:var(--tx);width:100%">' +
    '<div class="cap13">Read from the printed label, not estimated</div><div class="row" style="gap:6px;font-size:12px">' + confDots(r.confidence || 'high', true) + CONF_TEXT[r.confidence in CONF_TEXT ? r.confidence : 'high'] + '</div></div></div>' +
    '<section class="raised r24" style="padding:10px 16px;display:flex;flex-direction:column">' +
    '<div class="between" style="height:34px;align-items:center;font-size:12px;color:var(--mu)"><span>Per serving' + (num(r.serving_g) ? ', ' + fmt(r.serving_g) + ' g' : '') + '</span><span>' + (num(r.servings_per_pack) ? fmt(r.servings_per_pack, 1) + ' servings in the pack' : '') + '</span></div><div class="sep"></div>' +
    ordered.map(tr).join('') + '</section>' +
    chips('labelType', MEAL_TYPES, Lb.meal_type, 'Meal') + whenRow('log', logState().date, logState().time) +
    '<div class="row"><span class="grow" style="font-size:15px">Servings you ate</span>' + stepper(s, 'labelServ', 'servings', {large: true, boxed: true, min: 0.5}) + '</div>' +
    '<div data-part="ls-tot" class="pressed-sm r20 between" style="padding:14px 16px;align-items:center" aria-live="polite"><div><div class="num" style="font-size:30px">' + fmt(tot.kcal) + ' kcal</div><div class="cap">' + esc(Lb.meal_type) + ', ' + plural(s, 'serving') + '</div></div>' +
    '<div class="cap" style="text-align:right;line-height:1.6">Protein ' + fmt(tot.protein_g, 1) + ' g<br>Carbs ' + fmt(tot.carbs_g, 1) + ' g<br>Fat ' + fmt(tot.fat_g, 1) + ' g</div></div>' +
    '<div class="grow"></div>' +
    '<button data-part="ls-save" class="cta btn" data-a="saveLabel"' + (S.ui.busy || !has(ps.kcal) ? ' disabled' : '') + '>' + (S.ui.busy ? '<span class="spinglow"><span class="spin"></span></span>' : 'Save to ' + lc1(Lb.meal_type)) + '</button></div>';
};

/* ---------- Search what you've eaten before ---------- */
/* Built from what's actually been logged, newest first: whole meals (one per distinct
   combination of foods) and single foods (with how often they were had). */
function pastIndex() {
  const meals = [], seen = new Set(), foods = new Map();
  const byTime = S.data.meals.filter(m => itemsOf(m.meal_id).length).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  for (const m of byTime) {
    const name = mealName(m), k = name.toLowerCase();
    if (!seen.has(k)) { seen.add(k); meals.push({m, name, hay: (name + ' ' + (m.note || '') + ' ' + m.meal_type).toLowerCase()}); }
    for (const e of itemsOf(m.meal_id)) {
      const fk = String(e.name || '').trim().toLowerCase(); if (!fk) continue;
      const f = foods.get(fk);
      if (f) f.count++; else foods.set(fk, {e, date: m.date, count: 1, hay: fk});  // first seen is the most recent
    }
  }
  return {meals, foods: [...foods.values()]};
}
const matchAll = (hay, words) => words.every(w => hay.includes(w));
SCREENS.search = () => {
  const sq = S.ui.sq = S.ui.sq || {q: ''};
  const L = logState(), q = sq.q.trim(), words = q.toLowerCase().split(/\s+/).filter(Boolean), P = pastIndex();
  const often = list => list.slice().sort((a, b) => b.count - a.count || b.date.localeCompare(a.date));
  const meals = words.length ? P.meals.filter(x => matchAll(x.hay, words)).slice(0, 8) : P.meals.slice(0, 5);
  const foods = (words.length ? often(P.foods.filter(x => matchAll(x.hay, words))) : often(P.foods)).slice(0, words.length ? 12 : 8);
  const mealCard = x => '<div class="raised-md r20 row" style="padding:12px 12px 12px 16px"><div class="grow" style="min-width:0"><div class="cap">' + esc(relDay(x.m.date) + ', ' + lc1(x.m.meal_type)) + '</div>' +
    '<div style="font-size:15px">' + esc(x.name) + '</div><div class="cap">' + fmt(mealKcal(x.m)) + ' kcal</div></div>' +
    '<div class="col" style="gap:6px;align-items:flex-end"><button class="add w" data-a="copyPast" data-v="' + esc(x.m.meal_id) + '" aria-label="Add ' + esc(x.name) + '">Add</button>' +
    '<button data-a="copyChange" data-v="' + esc(x.m.meal_id) + '" style="font-size:12px;color:var(--a)">Change amount</button></div></div>';
  const foodRow = x => '<div class="lrow"><button class="grow" data-a="pastItemChange" data-v="' + esc(x.e.entry_id) + '" style="text-align:left;min-width:0">' +
    '<span style="display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.e.name) + '</span>' +
    '<span class="cap" style="display:block">' + esc(amountLabel(x.e)) + ', had ' + (x.count === 1 ? 'once' : plural(x.count, 'time')) + '</span></button>' +
    '<span style="font-size:14px;color:var(--mu)">' + fmt(x.e.kcal) + '</span>' +
    '<button class="add" data-a="addPastItem" data-v="' + esc(x.e.entry_id) + '" aria-label="Add ' + esc(lc1(x.e.name)) + '">+</button></div>';
  const head = t => '<h2 class="h13" style="padding:0">' + t + '</h2>';
  let body;
  if (!P.meals.length) body = '<p class="cap" style="text-align:center;padding:12px 0">Meals you log show up here, so you can add them again in one tap.</p>';
  else if (words.length && !meals.length && !foods.length) body = '<p class="cap" style="text-align:center;padding:8px 0 0">Nothing you\'ve logged matches “' + esc(q) + '”.</p>' +
    '<button class="raised-sm btn2" data-a="newFood" style="color:var(--a)">Add “' + esc(q) + '” as a new food</button>';
  else body = (meals.length ? head(words.length ? 'Meals' : 'Recent meals') + meals.map(mealCard).join('') : '') +
    (foods.length ? head(words.length ? 'Foods' : 'Foods you have most') + '<section class="raised r22" style="padding:4px 0;display:flex;flex-direction:column">' + foods.map(foodRow).join('<div class="sep" style="margin:0 14px"></div>') + '</section>' : '');
  return '<div class="scr">' + backHeader('Search past meals') +
    '<div style="position:relative"><label for="sq-s" class="sr">Search what you\'ve eaten before</label><span style="position:absolute;left:16px;top:15px;color:var(--mu)">' + icon('search', 18, 2) + '</span>' +
    '<input id="sq-s" type="search" enterkeyhint="search" class="fld" data-in="sqSearch" value="' + esc(sq.q) + '" placeholder="Search what you\'ve eaten before" style="height:48px;border-radius:16px;font-size:15px;padding-left:44px;box-shadow:inset 4px 4px 8px var(--lo),inset -4px -4px 8px var(--hi)" autocomplete="off"></div>' +
    chips('logType', MEAL_TYPES, L.meal_type, 'Add to meal', {h: 36}) + whenRow('log', L.date, L.time) +
    '<div data-part="sq-list" class="col" style="gap:14px">' + body + '</div>' +
    '<div class="grow"></div><button class="raised-sm btn2" data-a="go" data-v="describe">Describe a meal for the AI</button>' +
    '<p class="cap" style="text-align:center">Adding something you\'ve had before doesn\'t use the AI.</p></div>';
};

/* ---------- Describe a meal (AI estimate without a photo) ---------- */
SCREENS.describe = () => {
  const L = logState();
  return '<div class="scr">' + backHeader('Describe a meal') +
    chips('logType', MEAL_TYPES, L.meal_type, 'Meal') + whenRow('log', L.date, L.time) +
    '<div class="col" style="gap:8px"><label for="ds-text" style="font-size:14px;font-weight:500">What did you eat?</label>' +
    '<textarea id="ds-text" rows="5" class="fld" data-in="logText" placeholder="A bowl of beef stew, 1 cup of rice, a glass of iced tea">' + esc(L.text) + '</textarea>' +
    '<span class="cap">Name each food with an amount: cups, pieces, a bowl, a plate, grams. Brand names help for drinks and snacks.</span></div>' +
    (L.error && L.errorFrom === 'text' ? '<div class="warn" role="alert"><div class="ov" style="font-weight:500">' + esc(L.error) + '</div><div class="mu" style="margin-top:2px">Your description is kept.</div></div>' : '') +
    '<div class="grow"></div>' +
    (L.busy ? '<button class="cta btn" disabled aria-live="polite"><span class="spinglow"><span class="spin"></span></span><span style="margin-left:10px">Estimating</span></button>'
      : '<button class="cta btn" data-a="describe"' + (L.text.trim() ? '' : ' disabled') + ' data-part="ds-go">Estimate calories</button>') +
    '<p class="cap" style="text-align:center">Uses one AI analysis, the same as a photo. You review every item before it\'s saved.</p></div>';
};

/* ---------- screens: history and insights ---------- */

SCREENS.history = () => {
  const t = today(), ym = S.ui.month || t.slice(0, 7);
  const [y, mo] = ym.split('-').map(Number);
  const first = ymd(new Date(y, mo - 1, 1)), daysIn = new Date(y, mo, 0).getDate(), ws = weekStart();
  const lead = (parseDay(first).getDay() - ws + 7) % 7;
  const heads = (ws ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span aria-hidden="true"></span>';
  for (let n = 1; n <= daysIn; n++) {
    const d = first.slice(0, 8) + pad(n), fut = d > t, st = fut ? '' : dayStatus(d);
    const lab = longDay(d) + (fut ? '' : st === 'on' ? ', on target' : st === 'over' ? ', over target' : ', nothing logged');
    cells += fut ? '<span class="day fut" aria-label="' + lab + '"><span>' + n + '</span><span class="dot"></span></span>'
      : '<button class="day' + (d === t ? ' today' : '') + '" data-a="go" data-v="day" data-d="' + d + '" aria-label="' + lab + '"><span>' + n + '</span><span class="dot ' + st + '"></span></button>';
  }
  const prevM = ymd(new Date(y, mo - 2, 1)).slice(0, 7), nextM = ymd(new Date(y, mo, 1)).slice(0, 7), canNext = nextM <= t.slice(0, 7), canPrev = prevM >= firstDay().slice(0, 7);
  const end = ym === t.slice(0, 7) ? t : first.slice(0, 8) + pad(daysIn);
  const list = rangeDays(first, end).reverse().filter(logged).slice(0, 8);
  const dayRow = (d, i) => {
    const st = dayStatus(d), tt = totalsOn(d), tg = num(targetFor(d).kcal);
    return '<button class="dr mrow ' + (i === 0 && d === t ? 'pressed-sm' : 'raised-sm') + '" data-a="go" data-v="day" data-d="' + d + '"><span class="grow"><span style="display:block;font-size:15px">' + (d === t ? 'Today, ' + MON3[parseDay(d).getMonth()] + ' ' + parseDay(d).getDate() : longDay(d)) + '</span>' +
      '<span class="cap" style="display:block' + (st === 'over' ? ';color:var(--ov)' : '') + '">' + (st === 'over' ? fmt(tt.kcal - tg) + ' kcal over' : plural(tt.meals, 'meal') + ', on target') + '</span></span><span style="font-size:15px">' + fmt(tt.kcal) + '</span><span class="mu">' + icon('next', 16, 2) + '</span></button>';
  };
  return '<div class="scr tabbed" style="gap:16px"><header class="between" style="align-items:center"><h1 class="title">History</h1><div class="row" style="gap:8px">' +
    '<button class="ib ib40" data-a="monthStep" data-v="-1" aria-label="Previous month"' + (canPrev ? '' : ' disabled style="color:var(--mu);opacity:.5"') + '>' + icon('back', 16, 2) + '</button>' +
    '<span style="font-size:15px;width:96px;text-align:center" aria-live="polite">' + MONTHS[mo - 1] + (y !== new Date().getFullYear() ? ' ' + y : '') + '</span>' +
    '<button class="ib ib40" data-a="monthStep" data-v="1" aria-label="Next month"' + (canNext ? '' : ' disabled style="color:var(--mu);opacity:.5"') + '>' + icon('next', 16, 2) + '</button></div></header>' +
    '<section class="raised r26" data-hswipe="monthStep" style="padding:14px;overflow:hidden"><div class="swmove" style="display:flex;flex-direction:column;gap:6px">' +
    '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;font-size:11px;color:var(--mu);text-align:center" aria-hidden="true">' + heads.map(h => '<span>' + h + '</span>').join('') + '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">' + cells + '</div>' +
    '<div class="row" style="gap:14px;font-size:11px;color:var(--mu);margin-top:6px;padding:0 4px;flex-wrap:wrap">' +
    '<span class="row" style="gap:5px"><span class="dot on"></span>On target</span><span class="row" style="gap:5px"><span class="dot over"></span>Over</span><span class="row" style="gap:5px"><span class="dot none"></span>Nothing logged</span></div></div></section>' +
    '<section class="col" style="gap:12px">' + (list.length ? list.map(dayRow).join('') : '<p class="cap" style="text-align:center">Nothing logged in ' + MONTHS[mo - 1] + '.</p>') + '</section>' +
    '</div>' + tabBar('history');
};

SCREENS.day = () => {
  const d = route().p.d || today(), t = totalsOn(d), tg = targetFor(d), meals = mealsOn(d), isToday = d === today();
  const bar = (l, v, target, color) => {
    const over = v > num(target) * 1.0 && l !== 'Protein';
    return '<div><div class="between"><span>' + l + '</span><span style="color:' + (over ? 'var(--ov)' : 'var(--mu)') + '">' + fmt(v) + ' / ' + fmt(target) + ' g</span></div><div class="bar"><div style="width:' + clamp(num(target) ? v / num(target) * 100 : 0, 0, 100) + '%;background:' + color + '"></div></div></div>';
  };
  const thumb = m => thumbEl(m);
  return '<div class="scr">' + backHeader(monthDay(d), {sub: dayName(d)}) +
    '<section class="raised r26 row" style="padding:16px;gap:16px">' +
    '<div class="dial well" style="width:112px;height:112px;flex-direction:column"><svg class="arc" width="112" height="112" viewBox="0 0 112 112" role="img" aria-label="' + fmt(t.kcal) + ' of ' + fmt(tg.kcal) + ' kcal" style="filter:drop-shadow(0 0 4px ' + (t.kcal > num(tg.kcal) ? COLOR.ov : COLOR.a) + ')">' + (t.kcal ? arc(112, 48, 5, t.kcal / num(tg.kcal), t.kcal > num(tg.kcal) ? COLOR.ov : COLOR.a) : '') + '</svg>' +
    '<div class="num" style="font-size:28px">' + fmt(t.kcal) + '</div><div style="font-size:11px;color:var(--mu)">of ' + fmt(tg.kcal) + ' kcal</div></div>' +
    '<div class="col grow" style="gap:8px;font-size:12px">' + bar('Protein', t.protein_g, tg.protein_g, COLOR.p) + bar('Carbs', t.carbs_g, tg.carbs_g, COLOR.c) + bar('Fat', t.fat_g, tg.fat_g, COLOR.f) + '</div></section>' +
    '<div class="pressed-sm r16" style="padding:10px 14px;display:flex;justify-content:space-between;font-size:12px;color:var(--mu)"><span>Sugar ' + fmt(t.sugar_g) + ' g</span><span>Fiber ' + fmt(t.fiber_g) + ' g</span><span>Sodium ' + fmt(t.sodium_mg) + ' mg</span></div>' +
    '<section class="col" style="gap:12px">' + (meals.length ? meals.map(m =>
      '<div class="raised-md r20 row" style="padding:12px"><button class="row grow" data-a="editMeal" data-v="' + esc(m.meal_id) + '" style="gap:12px;text-align:left;min-width:0">' + thumb(m) +
      '<span class="grow" style="min-width:0"><span class="cap" style="display:block">' + esc(m.meal_type) + ', ' + time12(m.time) + '</span><span style="display:block;font-size:15px">' + esc(mealName(m)) + '</span><span class="cap" style="display:block">' + fmt(mealKcal(m)) + ' kcal</span></span></button>' +
      (isToday ? '' : '<button class="raised-sm" data-a="copyToToday" data-v="' + esc(m.meal_id) + '" style="height:36px;padding:0 12px;border-radius:12px;font-size:12px;color:var(--a);flex-shrink:0">Add to today</button>') + '</div>').join('')
      : '<p class="cap" style="text-align:center">Nothing logged on this day.</p>') + '</section>' +
    '<p class="cap" style="line-height:1.5">Tap a meal to edit or delete it.' + (isToday ? '' : ' Adding to today copies its saved values without a new photo analysis.') + '</p></div>';
};

/* ---------- Trends ---------- */
function trendRange() {
  const t = today(), r = S.ui.range || '7 days';
  if (r === 'Custom') { const c = S.ui.custom || {from: addDays(t, -13), to: t}; return {from: c.from, to: c.to, r}; }
  const n = r === '7 days' ? 7 : 30, to = addDays(t, -n * (S.ui.tOff || 0));
  return {from: addDays(to, -(n - 1)), to, r, n};
}
/* Can the trend period move back or forward? Back stops before there is no data at all. */
function trendCan(rg) {
  const t = today(), first = firstDay();
  return {prev: addDays(rg.from, -1) >= first, next: rg.to < t};
}
SCREENS.trends = () => {
  const {from, to, r} = trendRange(), t = today();
  const days = rangeDays(from, to), done = days.filter(d => logged(d) && d !== t);
  const loggedN = days.filter(logged).length;
  const can = trendCan({from, to}), dis = ' disabled style="color:var(--mu);opacity:.5"';
  const head = '<header class="between" style="align-items:center"><h1 class="title">Trends</h1>' + track('range', ['7 days', '30 days', 'Custom'], r, 'Range', {tight: true}) + '</header>' +
    '<div class="between" style="align-items:center"><button class="ib ib40" data-a="trendStep" data-v="-1" aria-label="Earlier period"' + (can.prev ? '' : dis) + '>' + icon('back', 16, 2) + '</button>' +
    '<span style="font-size:15px" aria-live="polite">' + periodLabel(from, to) + '</span>' +
    '<button class="ib ib40" data-a="trendStep" data-v="1" aria-label="Later period"' + (can.next ? '' : dis) + '>' + icon('next', 16, 2) + '</button></div>' +
    (r === 'Custom' ? '<div class="row" style="gap:10px"><label class="col grow" style="gap:4px"><span class="lb">From</span><input type="date" class="fld sm" data-in="custom" data-k="from" value="' + from + '" max="' + t + '"></label><label class="col grow" style="gap:4px"><span class="lb">To</span><input type="date" class="fld sm" data-in="custom" data-k="to" value="' + to + '" max="' + t + '"></label></div>' : '');
  if (loggedN < 3) return '<div class="scr tabbed">' + head + '<section class="raised r26 col" data-hswipe="trendStep" style="padding:28px 20px;gap:14px;align-items:center;text-align:center">' + iconWell('bars') +
    '<h2 class="sec">Log 3 days to see trends</h2><p class="cap13">You have ' + plural(loggedN, 'day') + ' in this range. Averages and charts appear after three.</p><button class="cta btn-sm" data-a="go" data-v="log">Log a meal</button></section>' + tiles() + '</div>' + tabBar('trends');
  const avgK = avg(done.length ? done : days.filter(logged), d => totalsOn(d).kcal);
  const onT = done.filter(d => dayStatus(d) === 'on').length;
  const maxK = Math.max(...days.map(d => totalsOn(d).kcal), ...days.map(d => num(targetFor(d).kcal) * 1.25));
  const tgNow = num(targetFor(to).kcal), H = 118, many = days.length > 10;
  const bars = days.map(d => {
    const k = totalsOn(d).kcal, h = clamp(k / maxK, 0, 1) * (H - 6), st = dayStatus(d);
    const style = d === t ? 'background:repeating-linear-gradient(135deg,#F5A524 0 3px,transparent 3px 8px);opacity:.55' : st === 'over' ? 'background:var(--ov);box-shadow:0 0 14px -2px var(--ov)' : 'background:var(--a);box-shadow:0 0 14px -2px var(--a)';
    return '<div class="trk' + (many ? ' thin' : '') + '" style="height:' + H + 'px" title="' + shortDay(d) + ': ' + fmt(k) + ' kcal"><div style="height:' + (k ? Math.max(4, h) : 0).toFixed(0) + 'px;' + style + '"></div></div>';
  }).join('');
  // The target line follows the target history: each day's segment sits at the target in effect
  // that day (the Targets tab keeps every change with its date). Where it changed, a diagonal runs
  // from the middle of the last bar on the old target to the middle of the first bar on the new one,
  // and the flat segments stop at those middles. Labels go on the current target, and on earlier
  // ones that last long enough to read.
  const G = many ? 3 : 12, n = days.length, tgs = days.map(d => num(targetFor(d).kcal)), yOf = k => (k / maxK) * (H - 6) + (many ? 2 : 3);
  const runs = [];
  tgs.forEach((k, i) => { if (!i || k !== tgs[i - 1]) runs.push({s: i, k}); });
  runs.forEach((r, j) => { r.e = j + 1 < runs.length ? runs[j + 1].s : n; });
  const labelAt = {};
  runs.forEach((r, j) => {
    const last = j === runs.length - 1; if (!last && r.e - r.s < 3) return;
    const right = r.s > n / 2;   // a run starting late is labelled from its right end, so the text stays inside the chart
    labelAt[right ? r.e - 1 : r.s] = {text: (last ? 'Target ' : '') + fmt(r.k), right};
  });
  const tLab = 'position:absolute;font-size:11px;color:var(--mu);background:var(--g);padding:1px 6px;border-radius:6px;white-space:nowrap;';
  const dash = 'border-top:1.5px dashed var(--mu);opacity:.8';
  const stepCell = (k, i) => {
    const y = yOf(k), lab = labelAt[i];
    const fromPrev = i > 0 && k !== tgs[i - 1], toNext = i < n - 1 && tgs[i + 1] !== k;
    const l = fromPrev ? '50%' : (i === 0 ? -4 : -G / 2) + 'px', r = toNext ? '50%' : (i === n - 1 ? -4 : -G / 2) + 'px';
    let h = fromPrev && toNext ? '' : '<i style="position:absolute;left:' + l + ';right:' + r + ';bottom:' + y.toFixed(1) + 'px;' + dash + '"></i>';
    if (fromPrev) {
      // spans from the previous bar's middle to this bar's middle: half a bar and one gap back, one bar and one gap wide
      // (an svg ignores 'right' when both sides are set, so the width is explicit)
      const y0 = yOf(tgs[i - 1]), lo = Math.min(y, y0), hgt = Math.max(1, Math.abs(y - y0)), down = y < y0;
      h += '<svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;left:calc(-50% - ' + G + 'px);width:calc(100% + ' + G + 'px);bottom:' + (lo + 0.75).toFixed(1) + 'px;height:' + hgt.toFixed(1) + 'px;overflow:visible;color:var(--mu);opacity:.8">' +
        '<line x1="0" y1="' + (down ? 0 : 100) + '" x2="100" y2="' + (down ? 100 : 0) + '" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/></svg>';
    }
    if (lab) h += '<span style="' + tLab + (lab.right ? 'right:' + r : 'left:' + l) + ';bottom:' + (y + 4).toFixed(0) + 'px">' + lab.text + '</span>';
    return '<div style="flex:1;min-width:0;position:relative">' + h + '</div>';
  };
  const targetLine = '<div aria-hidden="true" style="position:absolute;top:0;bottom:0;left:4px;right:4px;display:flex;gap:' + G + 'px;pointer-events:none;z-index:1">' + tgs.map(stepCell).join('') + '</div>';
  const targetText = runs.length === 1 ? 'a target of ' + fmt(tgNow) + ' kcal' : 'your daily target, ' + runs.map(r => fmt(r.k) + ' kcal from ' + MON3[parseDay(days[r.s]).getMonth()] + ' ' + parseDay(days[r.s]).getDate()).join(', then ');
  const labels = days.map((d, i) => '<span style="flex:1;min-width:0;' + (d === t ? 'color:var(--a);font-weight:600' : '') + '">' + (!many ? WD3[parseDay(d).getDay()][0] : (i % 5 === 0 || d === t) ? parseDay(d).getDate() : '') + '</span>').join('');
  const diffs = done.map(d => ({d, x: totalsOn(d).kcal - num(targetFor(d).kcal)}));
  const closest = diffs.slice().sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0], furthest = diffs.slice().sort((a, b) => Math.abs(b.x) - Math.abs(a.x))[0];
  const dlab = o => o ? WD3[parseDay(o.d).getDay()] + (many ? ' ' + parseDay(o.d).getDate() : '') + ', ' + fmt(Math.abs(o.x)) + (o.x > 0 ? ' over' : ' under') : '—';
  const tot = zero(); days.filter(logged).forEach(d => VALUES.forEach(v => tot[v] += totalsOn(d)[v]));
  const sh = macroShares(tot), gs = macroShares(targetFor(to));
  const split = (l, a, g, c) => '<div><div class="between"><span>' + l + ' ' + Math.round(a * 100) + '%</span><span class="mu">' + Math.round(g * 100) + '%</span></div><div class="col" style="gap:2px"><div style="height:6px;border-radius:3px;width:' + clamp(a * 200, 2, 100) + '%;background:' + c + '"></div><div class="pressed-sm" style="height:6px;border-radius:3px;width:' + clamp(g * 200, 2, 100) + '%"></div></div></div>';
  return '<div class="scr tabbed">' + head +
    '<section class="raised r26" data-hswipe="trendStep" style="padding:16px;overflow:hidden"><div class="swmove" style="display:flex;flex-direction:column;gap:12px"><div class="between">' +
    '<div><div class="num" style="font-size:30px">' + fmt(avgK) + '</div><div class="cap">average kcal a day</div></div>' +
    '<div style="text-align:right"><div class="num" style="font-size:30px">' + onT + ' of ' + done.length + '</div><div class="cap">days on target</div></div></div>' +
    '<div role="img" aria-label="Daily calories for ' + days.length + ' days against ' + targetText + '. ' + onT + ' of ' + done.length + ' completed days on target." style="position:relative;height:' + (H + 6) + 'px;display:flex;align-items:flex-end;gap:' + (many ? 3 : 12) + 'px;padding:0 4px">' +
    targetLine + bars + '</div>' +
    '<div class="row" style="gap:' + (many ? 3 : 12) + 'px;padding:0 4px;font-size:12px;color:var(--mu);text-align:center" aria-hidden="true">' + labels + '</div>' +
    '<div class="row" style="gap:10px;font-size:12px"><div class="pressed-sm" style="flex:1;border-radius:12px;padding:8px 10px"><div class="mu">Closest day</div><div>' + dlab(closest) + '</div></div>' +
    '<div class="pressed-sm" style="flex:1;border-radius:12px;padding:8px 10px"><div class="mu">Furthest day</div><div' + (furthest && furthest.x > 0 ? ' class="ov"' : '') + '>' + dlab(furthest) + '</div></div></div></div></section>' +
    '<section class="raised r24 row" style="padding:14px 16px;gap:16px"><div class="dial raised-md" style="width:96px;height:96px">' + macroRing(tot, 86, 30, 12, 0, false) + '</div>' +
    '<div class="col grow" style="gap:8px;font-size:12px"><div class="between"><span style="font-size:14px">Macro split</span><span class="mu">you and goal</span></div>' +
    split('Protein', sh.p, gs.p, COLOR.p) + split('Carbs', sh.c, gs.c, COLOR.c) + split('Fat', sh.f, gs.f, COLOR.f) + '</div></section>' + tiles() + '</div>' + tabBar('trends');
};
function tiles() {
  return '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">' +
    [['weekly', 'report', 'Weekly report'], ['topfoods', 'rank', 'Top foods'], ['consistency', 'streak', 'Consistency'], ['weight', 'scale', 'Weight']]
      .map(([r, i, l]) => '<button class="tile raised-md" data-a="go" data-v="' + r + '"><span class="mango">' + icon(i, 18) + '</span>' + l + '</button>').join('') + '</div>';
}

/* ---------- Weekly report ---------- */
function weekNumbers(start) {
  const end = addDays(start, 6), days = rangeDays(start, end), t = today();
  const done = days.filter(d => logged(d) && d < t);
  const tg = targetFor(end);
  const ws = weightSeries(), inWeek = ws.filter(w => w.date >= start && w.date <= end);
  return {
    start, end, days, done,
    avg: avg(done, d => totalsOn(d).kcal), onT: done.filter(d => dayStatus(d) === 'on').length,
    protein: avg(done, d => totalsOn(d).protein_g), proteinGoal: num(tg.protein_g),
    w0: inWeek.length ? inWeek[0].kg : null, w1: inWeek.length ? inWeek[inWeek.length - 1].kg : null,
    closest: done.slice().sort((a, b) => Math.abs(totalsOn(a).kcal - num(targetFor(a).kcal)) - Math.abs(totalsOn(b).kcal - num(targetFor(b).kcal)))[0],
    furthest: done.slice().sort((a, b) => Math.abs(totalsOn(b).kcal - num(targetFor(b).kcal)) - Math.abs(totalsOn(a).kcal - num(targetFor(a).kcal)))[0]
  };
}
SCREENS.weekly = () => {
  const t = today(), cur = weekBounds(t).start, start = S.ui.week || addDays(cur, -7);
  const n = weekNumbers(start), prev = weekNumbers(addDays(start, -7));
  const fmtRange = (a, b) => { const A = parseDay(a), B = parseDay(b); return MON3[A.getMonth()] + ' ' + A.getDate() + ' to ' + (A.getMonth() === B.getMonth() ? '' : MON3[B.getMonth()] + ' ') + B.getDate(); };
  const dots = n.days.map(d => { const st = d >= t ? 'none' : dayStatus(d); return '<span class="dd ' + st + '">' + WD3[parseDay(d).getDay()][0] + '</span>'; }).join('');
  const aria = n.days.map(d => WD3[parseDay(d).getDay()] + ' ' + (d >= t ? 'not finished' : { on: 'on target', over: 'over', none: 'nothing logged'}[dayStatus(d)])).join(', ');
  const diff = n.avg - prev.avg;
  const saved = (() => { try { return JSON.parse(setting('weekly_summary:' + start, 'null')); } catch (e) { return null; } })();
  const stat = (l, big, small, sc) => '<div class="raised r20 col" style="padding:14px;gap:2px"><span class="cap">' + l + '</span><span class="num" style="font-size:28px;line-height:1.2">' + big + '</span><span class="cap"' + (sc ? ' style="color:' + sc + '"' : '') + '>' + small + '</span></div>';
  const dayK = d => d ? WD3[parseDay(d).getDay()] + ', ' + fmt(totalsOn(d).kcal) + ' kcal' : '—';
  return '<div class="scr">' + backHeader(fmtRange(n.start, n.end), {sub: 'Weekly report', right:
    '<button class="ib ib40" data-a="week" data-v="' + addDays(start, -7) + '" aria-label="Previous week">' + icon('back', 16, 2) + '</button>' +
    '<button class="ib ib40" data-a="week" data-v="' + addDays(start, 7) + '" aria-label="Next week"' + (addDays(start, 7) > cur ? ' disabled style="opacity:.4"' : '') + '>' + icon('next', 16, 2) + '</button>'}) +
    '<div class="between" role="img" aria-label="' + aria + '">' + dots + '</div>' +
    (n.done.length ? '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">' +
      stat('Average a day', fmt(n.avg), prev.done.length ? fmt(Math.abs(diff)) + ' kcal ' + (diff <= 0 ? 'less' : 'more') + ' than last week' : 'No data for last week', prev.done.length ? (diff <= 0 ? COLOR.p : COLOR.ov) : '') +
      stat('Days on target', n.onT + ' of ' + n.done.length, 'Last week: ' + prev.onT + ' of ' + prev.done.length) +
      stat('Protein average', fmt(n.protein) + ' g', 'Goal ' + fmt(n.proteinGoal) + ' g') +
      stat('Weight', n.w0 != null && n.w1 != null && n.w0 !== n.w1 ? fmtSigned(n.w1 - n.w0, 1) + ' kg' : '—', n.w0 != null ? fmt(n.w0, 1) + ' to ' + fmt(n.w1, 1) + ' kg' : 'No weigh-ins') + '</div>' +
      '<div class="row" style="gap:12px;font-size:13px"><div class="pressed-sm r16" style="flex:1;padding:10px 12px"><div class="cap">Closest day</div><div>' + dayK(n.closest) + '</div></div>' +
      '<div class="pressed-sm r16" style="flex:1;padding:10px 12px"><div class="cap">Furthest day</div><div' + (n.furthest && dayStatus(n.furthest) === 'over' ? ' class="ov"' : '') + '>' + dayK(n.furthest) + '</div></div></div>' +
      '<section class="glass-soft r24" style="padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),8px 8px 18px var(--lo)">' +
      '<div class="between"><h2 class="sec15">Summary</h2><span class="cap">Written by the AI from your numbers</span></div>' +
      (S.ui.sumBusy ? '<div class="row cap13"><span class="spinglow"><span class="spin"></span></span>Writing a summary</div>' : saved ? '<p style="font-size:14px;line-height:1.55;color:var(--soft)">' + esc(saved.text) + '</p><div class="col" style="gap:8px;font-size:14px;line-height:1.45">' + (saved.suggestions || []).map(s => '<div class="row" style="gap:10px;align-items:flex-start"><span class="bul"></span><span>' + esc(s) + '</span></div>').join('') + '</div>'
        : '<p class="cap13">No summary for this week yet.</p>') +
      (S.ui.sumErr ? '<p class="cap ov">' + esc(S.ui.sumErr) + '</p>' : '') + '</section>' +
      '<div class="grow"></div><button class="raised-sm btn2" data-a="writeSummary"' + (S.ui.sumBusy ? ' disabled' : '') + '>' + (saved ? 'Write a new summary' : 'Write a summary') + '</button>'
      : '<section class="raised r24 col" style="padding:24px;gap:8px;text-align:center"><h2 class="sec">Nothing logged this week</h2><p class="cap13">Pick another week, or log a meal to start one.</p></section>') + '</div>';
};

/* ---------- Where calories come from ---------- */
SCREENS.topfoods = () => {
  const MEASURES = {Calories: 'kcal', Protein: 'protein_g', Carbs: 'carbs_g', Fat: 'fat_g', Sugar: 'sugar_g', Fiber: 'fiber_g', Sodium: 'sodium_mg'};
  const m = MEASURES[S.ui.measure] ? S.ui.measure : 'Calories', key = MEASURES[m], unit = VALUE_UNIT[key];
  const from = addDays(today(), -29), ids = new Set(S.data.meals.filter(x => x.date >= from).map(x => x.meal_id));
  const es = S.data.entries.filter(e => ids.has(e.meal_id));
  const total = sum(es, e => e[key]);
  const byCat = {}; CATEGORIES.forEach(c => byCat[c] = 0); es.forEach(e => { const c = CATEGORIES.includes(e.category) ? e.category : 'other'; byCat[c] += num(e[key]); });
  const cats = CATEGORIES.map(c => [c, byCat[c]]).sort((a, b) => b[1] - a[1]);
  const top = cats.length ? cats[0][1] : 0;
  const byFood = {}; es.forEach(e => { const k = e.name; const f = byFood[k] = byFood[k] || {name: k, v: 0, q: 0, unit: e.serving_unit, label: e.serving_label}; f.v += num(e[key]); f.q += num(e.quantity) || 1; });
  const foods = Object.values(byFood).sort((a, b) => b.v - a.v).slice(0, 5);
  const amt = f => f.unit === 'g' ? fmt(f.q, 1) + ' portions' : f.label && /piece|stick|sachet|plate/.test(f.label) ? plural(f.q, f.label.replace(/^1 /, '').split(',')[0]) : plural(f.q, f.unit || 'serving');
  return '<div class="scr">' + backHeader('Where ' + (m === 'Calories' ? 'calories come' : 'your ' + m.toLowerCase() + ' comes') + ' from', {sub: 'Last 30 days', small: true}) +
    chips('measure', Object.keys(MEASURES), m, 'Measure', {scroll: true}) +  // macros and micros: seven don't fit a track, so a scrolling chip row
    (total > 0 ? '<section class="raised r26" style="padding:16px;display:flex;flex-direction:column;gap:12px"><h2 class="sec15">By category</h2>' +
      cats.map(([c, v], i) => { const p = total ? v / total : 0; return '<div class="col" style="gap:5px"><div class="between" style="font-size:13px"><span>' + CATEGORY_LABEL[c] + '</span><span>' + Math.round(p * 100) + '%</span></div><div class="tk"><div style="width:' + (top ? v / top * 100 : 0).toFixed(1) + '%;' + (i === 0 ? 'box-shadow:0 0 8px var(--a)' : 'opacity:' + Math.max(.5, .85 - i * .1)) + '"></div></div></div>'; }).join('') + '</section>' +
      '<section class="raised r26" style="padding:10px 16px;display:flex;flex-direction:column"><h2 class="sec15" style="margin:6px 0 2px">Your top five foods</h2>' +
      foods.map((f, i) => '<div class="row" style="height:50px"><span class="rk">' + (i + 1) + '</span><div class="grow" style="min-width:0"><div style="font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(f.name) + '</div><div class="cap">' + esc(amt(f)) + '</div></div><span>' + fmt(f.v) + (unit === 'kcal' ? '' : ' ' + unit) + '</span></div>').join('<div class="sep"></div>') + '</section>' +
      '<p class="cap" style="line-height:1.5">' + (unit === 'kcal' ? 'Kcal' : m) + ' totals for the period. The AI picks a category when it logs each item; you can change it when editing.</p>'
      : '<section class="raised r24 col" style="padding:24px;text-align:center;gap:6px"><h2 class="sec">Nothing logged in the last 30 days</h2></section>') + '</div>';
};

/* ---------- Consistency ---------- */
SCREENS.consistency = () => {
  const ms = S.ui.cm || 'Calories', measure = ms === 'Protein' ? 'protein' : 'kcal', t = today();
  const si = streakInfo(measure);
  const last30 = rangeDays(addDays(t, -30), addDays(t, -1)).filter(logged);
  const pct = last30.length ? Math.round(last30.filter(d => measure === 'protein' ? Math.abs(totalsOn(d).protein_g - num(targetFor(d).protein_g)) <= num(targetFor(d).protein_g) * 0.1 || totalsOn(d).protein_g >= num(targetFor(d).protein_g) : within10(d)).length / last30.length * 100) : 0;
  const wb = weekBounds(t), start = addDays(wb.start, -28);
  const cells = rangeDays(start, wb.end).map(d => {
    const cls = d > t ? 'fut' : d === t ? (dayStatus(d, measure) === 'on' ? 'on' : 'today') : dayStatus(d, measure);
    return '<div class="hm ' + cls + '" title="' + shortDay(d) + '"></div>';
  }).join('');
  const sw = rangeDays(addDays(t, -13), addDays(t, -1));
  const vals = sw.map(d => ({d, v: measure === 'protein' ? totalsOn(d).protein_g : totalsOn(d).kcal, tg: measure === 'protein' ? num(targetFor(d).protein_g) : num(targetFor(d).kcal), l: logged(d)}));
  const tgv = vals.length ? vals[vals.length - 1].tg : 1, spanV = Math.max(tgv * 0.35, ...vals.filter(x => x.l).map(x => Math.abs(x.v - x.tg))) || 1;
  const W = 322, Hh = 96, y = v => (Hh / 2 - (v - tgv) / spanV * (Hh / 2 - 8)).toFixed(1), bandH = (tgv * 0.1 / spanV) * (Hh / 2 - 8);
  const pts = vals.map((x, i) => x.l ? '<circle cx="' + (12 + i * (W - 24) / (vals.length - 1)).toFixed(1) + '" cy="' + y(x.v) + '" r="5" fill="' + (Math.abs(x.v - x.tg) <= x.tg * 0.1 ? COLOR.a : COLOR.ov) + '"/>' : '').join('');
  const lg = vals.filter(x => x.l), diffs = lg.map(x => Math.abs(x.v - x.tg)).sort((a, b) => a - b), med = diffs.length ? diffs[Math.floor(diffs.length / 2)] : 0;
  const misses = lg.filter(x => Math.abs(x.v - x.tg) > x.tg * 0.1), wkMiss = misses.filter(x => [0, 6].includes(parseDay(x.d).getDay())).length;
  const u = measure === 'protein' ? 'g of protein' : 'kcal';
  const bestWhen = si.bestEnd ? (si.bestEnd >= addDays(t, -1) ? 'your current run' : 'set in ' + MONTHS[parseDay(si.bestEnd).getMonth()]) : '';
  return '<div class="scr">' + backHeader('Consistency') + track('cm', ['Calories', 'Protein'], ms, 'Target') +
    '<section class="row" style="gap:16px">' + ringDial(150, 118, si.best ? si.cur / si.best : 0, '<div class="num" style="font-size:44px">' + si.cur + '</div><div class="cap">day streak</div>', 'Streak of ' + si.cur + ' days, best ' + si.best, {raised: true, inset: 7}) +
    '<div class="col" style="gap:12px"><div><div class="num" style="font-size:24px;line-height:1.2">' + plural(si.best, 'day') + '</div><div class="cap">Best streak' + (bestWhen ? ', ' + bestWhen : '') + '</div></div>' +
    '<div><div class="num" style="font-size:24px;line-height:1.2">' + pct + '%</div><div class="cap">of days within 10% of target in 30 days</div></div></div></section>' +
    '<section class="raised r24" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px"><div class="between"><h2 class="sec15">Last 5 weeks</h2><span class="cap">' + (weekStart() ? 'Mon to Sun' : 'Sun to Sat') + '</span></div>' +
    '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px" role="img" aria-label="Days on ' + (measure === 'protein' ? 'protein' : 'calorie') + ' target over the last 5 weeks">' + cells + '</div>' +
    '<div class="row cap" style="gap:14px;flex-wrap:wrap"><span class="row" style="gap:5px"><span class="hm on" style="width:8px"></span>On target</span><span class="row" style="gap:5px"><span class="hm over" style="width:8px"></span>' + (measure === 'protein' ? 'Under' : 'Over') + '</span><span class="row" style="gap:5px"><span class="hm none" style="width:8px"></span>Nothing logged</span></div></section>' +
    '<section class="raised r24" style="padding:14px 16px;display:flex;flex-direction:column;gap:8px"><div class="between"><h2 class="sec15">Day-to-day swing</h2><span class="cap">last 13 days</span></div>' +
    '<svg width="100%" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Daily ' + u + ' against a band of 10 percent around the target. Median distance ' + fmt(med) + ' ' + u + '.">' +
    '<rect x="0" y="' + (Hh / 2 - bandH).toFixed(1) + '" width="' + W + '" height="' + (bandH * 2).toFixed(1) + '" rx="8" fill="#F5A524" fill-opacity=".1"/><line x1="0" y1="' + Hh / 2 + '" x2="' + W + '" y2="' + Hh / 2 + '" stroke="#A2A7B6" stroke-dasharray="4 4"/>' + pts + '</svg>' +
    '<div style="font-size:13px;line-height:1.45;color:var(--soft)">' + (lg.length ? 'Most days sit within ' + fmt(Math.round(med / (measure === 'protein' ? 1 : 10)) * (measure === 'protein' ? 1 : 10)) + ' ' + u + ' of your target.' + (misses.length >= 2 ? (wkMiss / misses.length >= 0.5 ? ' The misses cluster on weekends.' : ' The misses are spread across the week.') : '') : 'Log a few days to see your swing.') + '</div></section></div>';
};

/* ---------- Weight ---------- */
SCREENS.weight = () => {
  const ws = weightSeries(), t = today(), p = profile(), goal = num(p.target_weight);
  const last = ws.length ? ws[ws.length - 1] : null, cur = last ? last.trend : null;
  const from = addDays(t, -30), win = ws.filter(w => w.date >= from);
  const startTrend = trendAt(ws, from) != null ? trendAt(ws, from) : (win.length ? win[0].trend : null);
  const change = cur != null && startTrend != null ? cur - startTrend : null;
  const first = ws.length ? ws[0].kg : null;
  const prog = goal && first != null && cur != null && first !== goal ? clamp((first - cur) / (first - goal), 0, 1) : 0;
  const pred = predictedChange(win.length ? win[0].date : from, t);
  // chart
  const W = 326, H = 104, x0 = 8, x1 = 318;
  let chart = '<p class="cap">Add a few weigh-ins to see your trend.</p>';
  if (win.length >= 2) {
    const d0 = win[0].date, span = Math.max(1, daysBetween(d0, win[win.length - 1].date));
    const predEnd = pred != null ? win[0].trend + pred : null;
    const vs = win.map(w => w.kg).concat(win.map(w => w.trend)).concat(predEnd != null ? [predEnd] : []);
    const lo = Math.min(...vs) - 0.2, hi = Math.max(...vs) + 0.2;
    const X = d => (x0 + daysBetween(d0, d) / span * (x1 - x0)).toFixed(1), Y = v => (8 + (hi - v) / (hi - lo) * (H - 16)).toFixed(1);
    const trendPath = win.map((w, i) => (i ? 'L' : 'M') + X(w.date) + ' ' + Y(w.trend)).join('');
    chart = '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Weigh-ins bounce around a trend line that moves from ' + fmt(win[0].trend, 1) + ' to ' + fmt(cur, 1) + ' kilograms.' + (predEnd != null ? ' The intake estimate ends at ' + fmt(predEnd, 1) + '.' : '') + '">' +
      '<g stroke="#2F323C" stroke-width="1"><line x1="0" y1="20" x2="' + W + '" y2="20"/><line x1="0" y1="50" x2="' + W + '" y2="50"/><line x1="0" y1="80" x2="' + W + '" y2="80"/></g>' +
      (predEnd != null ? '<path d="M' + X(d0) + ' ' + Y(win[0].trend) + 'L' + X(win[win.length - 1].date) + ' ' + Y(predEnd) + '" stroke="#A495FF" stroke-width="2" stroke-dasharray="5 5" fill="none"/>' : '') +
      '<path d="' + trendPath + '" stroke="#F5A524" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px #F5A524)"/>' +
      '<g fill="#ECEDF2" fill-opacity=".55">' + win.map(w => '<circle cx="' + X(w.date) + '" cy="' + Y(w.kg) + '" r="3"/>').join('') + '</g>' +
      '<circle cx="' + X(last.date) + '" cy="' + Y(cur) + '" r="5" fill="#FFD08A"/></svg>' +
      '<div class="row cap" style="gap:14px;flex-wrap:wrap"><span class="row" style="gap:6px"><span style="width:14px;height:3px;border-radius:2px;background:var(--a)"></span>Trend</span><span class="row" style="gap:6px"><span style="width:6px;height:6px;border-radius:50%;background:#ECEDF2;opacity:.55"></span>Weigh-ins</span>' + (predEnd != null ? '<span class="row" style="gap:6px"><span style="width:14px;border-top:2px dashed var(--f)"></span>Predicted from intake</span>' : '') + '</div>';
  }
  let verdict = '';
  if (pred != null && change != null && win.length >= 2) {
    const agree = Math.abs(pred - change) <= Math.max(0.3, Math.abs(change) * 0.35);
    verdict = 'Your intake predicted a ' + fmt(Math.abs(pred), 1) + ' kg ' + (pred <= 0 ? 'drop' : 'gain') + ' (about 7,700 kcal per kg). The trend shows ' + fmt(Math.abs(change), 1) + ' kg' + (change <= 0 ? ' down' : ' up') + ', so ' +
      (agree ? 'your target looks right.' : (Math.abs(change) < Math.abs(pred) ? 'real results are slower than the estimate. Logging may be missing something, or maintenance is lower than calculated.' : 'you are losing faster than the estimate. Maintenance may be higher than calculated.')) + ' <a href="#" data-a="go" data-v="goals">Re-tune target</a>';
  }
  const recent = ws.slice().reverse().slice(0, 4);
  return '<div class="scr">' + backHeader('Weight') +
    '<section class="row" style="gap:18px">' + ringDial(144, 112, prog, '<div class="num" style="font-size:30px">' + (cur != null ? fmt(cur, 1) : '—') + '</div><div class="cap">kg, trend</div>', goal && cur != null ? Math.round(prog * 100) + ' percent of the way from ' + fmt(first, 1) + ' to ' + fmt(goal, 1) + ' kilograms' : 'Weight trend', {raised: true, inset: 7}) +
    '<div class="col" style="gap:10px"><div><div class="num" style="font-size:22px;line-height:1.2">' + (change != null ? fmtSigned(change, 1) + ' kg' : '—') + '</div><div class="cap">in 30 days</div></div>' +
    '<div><div class="num" style="font-size:22px;line-height:1.2">' + (goal && cur != null ? fmt(Math.abs(cur - goal), 1) + ' kg to go' : 'No goal set') + '</div><div class="cap">' + (goal ? 'Goal ' + fmt(goal, 1) + ' kg' : '<a href="#" data-a="go" data-v="goals">Set one</a>') + '</div></div></div></section>' +
    '<section class="raised r24" style="padding:14px 16px;display:flex;flex-direction:column;gap:8px"><div class="between"><h2 class="sec15">Last 30 days</h2>' + (win.length >= 2 ? '<span class="cap">' + fmt(win[0].trend, 1) + ' to ' + fmt(cur, 1) + ' kg</span>' : '') + '</div>' + chart + '</section>' +
    (verdict ? '<div class="pressed-sm r18" style="padding:12px 14px;font-size:13px;line-height:1.5;color:var(--soft)">' + verdict + '</div>' : '') +
    '<section class="raised r22" style="padding:12px 14px;display:flex;flex-direction:column;gap:10px"><div class="row" style="gap:10px">' +
    '<label for="wt-in" class="grow" style="font-size:15px">Add today\'s weight</label><input id="wt-in" class="fld" type="number" inputmode="decimal" step="0.1" value="' + esc(S.ui.wIn != null ? S.ui.wIn : (last ? r1(last.kg) : '')) + '" data-in="wIn" style="width:80px;height:44px;text-align:right;padding:0 12px">' +
    '<span class="mu" style="font-size:14px">kg</span><button class="cta btn-sm" data-a="saveWeight">Save</button></div>' +
    '<input class="fld sm" data-in="wNote" value="' + esc(S.ui.wNote || '') + '" placeholder="Note, optional" aria-label="Note for this weigh-in" style="font-size:14px">' +
    recent.map(w => '<div class="sep"></div><div class="row" style="height:44px;font-size:14px"><span class="grow">' + shortDay(w.date) + (w.note ? ' <span class="cap">' + esc(w.note) + '</span>' : '') + '</span><span>' + fmt(w.kg, 1) + ' kg</span></div>').join('') + '</section></div>';
};

/* ---------- router, rendering, events ---------- */
const TABS = ['today', 'trends', 'history', 'targets'];
const app = () => document.getElementById('app');
let lastRoute = '';

function render() {
  const a = document.activeElement, fid = a && a.id;
  let sel = null; try { if (a && a.setSelectionRange && a.type !== 'number') sel = [a.selectionStart, a.selectionEnd]; } catch (e) { /* ignore */ }
  const name = route().name, same = name === lastRoute, y = window.scrollY;
  app().innerHTML = (SCREENS[name] || SCREENS.today)() + overlays();
  if (S.ui.openSwipe) { const s = app().querySelector('[data-swipe="' + CSS.escape(S.ui.openSwipe) + '"]'); if (s) s.classList.add('open'); }
  if (same) window.scrollTo(0, y); else { window.scrollTo(0, 0); const h = app().querySelector('h1'); if (h && !fid) { h.setAttribute('tabindex', '-1'); h.focus({preventScroll: true}); } }
  if (fid && same) { const el = document.getElementById(fid); if (el) { el.focus({preventScroll: true}); try { if (sel) el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* ignore */ } } }
  lastRoute = name;
  // a scrolling chip row keeps its selected chip in view, centred where it can be
  app().querySelectorAll('.chips.scroll').forEach(c => { const on = c.querySelector('[aria-checked="true"]'); if (on) c.scrollLeft = on.offsetLeft - (c.clientWidth - on.offsetWidth) / 2; });
  flushThumbs();
}
/* Swap only computed regions, so a field being typed in keeps focus and the keyboard stays up. */
function refreshParts() {
  const tpl = document.createElement('div'); tpl.innerHTML = (SCREENS[route().name] || SCREENS.today)();
  document.querySelectorAll('#app [data-part]').forEach(el => {
    if (el.contains(document.activeElement)) return;
    const n = tpl.querySelector('[data-part="' + el.getAttribute('data-part') + '"]');
    if (n) el.replaceWith(n);
  });
}
function overlays() {
  let h = '';
  if (S.menu) h += '<div class="scrim" data-a="menuClose"><div class="menu glass" role="dialog" aria-modal="true" aria-label="' + esc(S.menu.title || 'Options') + '" data-stop="1">' +
    (S.menu.title ? '<div class="sec15" style="text-align:center">' + esc(S.menu.title) + '</div>' : '') + (S.menu.text ? '<p class="cap13" style="text-align:center;line-height:1.45">' + esc(S.menu.text) + '</p>' : '') +
    S.menu.items.map((it, i) => '<button class="mi ' + (it.primary ? 'cta' : 'raised-sm') + '" data-a="menuPick" data-v="' + i + '"' + (it.danger ? ' style="color:var(--ov)"' : '') + '>' + esc(it.label) + '</button>').join('') +
    '<button class="mi" data-a="menuClose" style="color:var(--mu)">Cancel</button></div></div>';
  if (S.viewer) h += '<div class="scrim" data-a="closeViewer" style="align-items:center;padding:20px;background:rgba(10,10,14,.88)"><div class="col" role="dialog" aria-modal="true" aria-label="Meal photo" data-stop="1" style="gap:14px;align-items:center;width:min(100%,430px)">' +
    '<div style="position:relative;width:100%;border-radius:24px;overflow:hidden;background:#15161B;box-shadow:0 20px 40px -10px rgba(0,0,0,.8)">' +
    (S.viewer.src ? '<img src="' + S.viewer.src + '" alt="Meal photo" style="display:block;width:100%;max-height:70vh;object-fit:contain' + (S.viewer.loading ? ';filter:blur(6px);opacity:.7' : '') + '">' : '<div style="height:260px"></div>') +
    (S.viewer.loading ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span class="spinglow"><span class="spin" style="--s:40px;--t:5px"></span></span></div>' : '') + '</div>' +
    (S.viewer.msg ? '<p class="cap13" style="text-align:center">' + esc(S.viewer.msg) + '</p>' : '') +
    '<button class="raised-sm" data-a="closeViewer" style="height:46px;padding:0 22px;border-radius:16px;font-size:15px">Close</button></div></div>';
  if (S.toast) h += '<div class="toast glass' + (TABS.includes(route().name) ? '' : ' notab') + '" role="status"><span>' + esc(S.toast.text) + '</span>' + (S.toast.undo ? '<button data-a="undo" style="color:var(--a);font-weight:600">Undo</button>' : '') + '</div>';
  return h;
}
let toastTimer = null;
function toast(text, undo) { S.toast = {text, undo}; clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = null; const t = document.querySelector('.toast'); if (t) t.remove(); }, undo ? 5000 : 2600); render(); }
function menu(m) { S.menu = m; render(); const b = document.querySelector('.menu button'); if (b) b.focus(); }
function confirmBox(title, text, label, fn) { menu({title, text, items: [{label, danger: true, fn}]}); }

function go(name, p = {}) { S.stack.push({name, p}); S.ui.openSwipe = null; pushHistory(); render(); }
function replace(name, p = {}) { S.stack[S.stack.length - 1] = {name, p}; render(); }
/* After stepping a period, slide the new one in from the side it came from. */
function slideIn(act, dir) {
  const el = document.querySelector('[data-hswipe="' + act + '"] .swmove'); if (!el) return;
  el.classList.remove('swin-fwd', 'swin-back'); void el.offsetWidth; el.classList.add(dir > 0 ? 'swin-fwd' : 'swin-back');
}
function home(toastText) { S.stack = [{name: 'today', p: {}}]; S.ui.openSwipe = null; if (toastText) toast(toastText); else render(); }
function back() {
  const cur = route().name;
  if (cur === 'edit') S.edit = null;
  if (cur === 'label') S.label = null;
  if (cur === 'review' && S.draft && S.draft.mode === 'edit') S.draft = null;
  if (S.stack.length > 1) S.stack.pop(); else S.stack = [{name: 'today', p: {}}];
  S.ui.openSwipe = null; render();
}
function pushHistory() {
  try { if (IN_GAS) google.script.history.push({d: S.stack.length}); else history.pushState({d: S.stack.length}, ''); } catch (e) { /* ignore */ }
}

function friendly(e) {
  let m = String((e && (e.message || e)) || '');
  const fromServer = /^SERVER:/.test(m); m = m.replace(/^SERVER:\s*/, '');
  if (/QUOTA|RESOURCE_EXHAUSTED/i.test(m)) return 'Today\'s free photo analyses are used up. Add something you\'ve had before from search, or try again tomorrow.';
  if (/NO_FOOD/.test(m)) return 'No food or nutrition label found in this photo. Try another angle, or search past meals.';
  if (/NO_KEY/.test(m)) return 'The Gemini API key is missing. Add GEMINI_API_KEY in Script Properties.';
  if (/PERMISSION|do not have permission|UrlFetchApp/i.test(m)) return 'Apps Script hasn\'t been allowed to contact Gemini yet. In the script editor, run testGemini once and approve the permission, then deploy a new version.';
  // only a failed google.script.run call is a connection problem; server messages are shown as they are
  if (!fromServer && /NetworkError|network error|Failed to fetch|timed? ?out/i.test(m)) return 'Couldn\'t reach the server. Check your connection and try again.';
  return m.replace(/^Error:\s*/, '').replace(/^Exception:\s*/, '') || 'Something went wrong. Try again.';
}

/* ---------- images ---------- */
function loadImage(file) {
  return new Promise((res, rej) => { const url = URL.createObjectURL(file), img = new Image(); img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 1000); }; img.onerror = () => rej(new Error('That file isn\'t an image this browser can read.')); img.src = url; });
}
function drawTo(img, max, square, q) {
  let w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
  if (square) { const m = Math.min(w, h); sx = (w - m) / 2; sy = (h - m) / 2; sw = sh = m; w = h = max; }
  else { const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s); }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return c.toDataURL('image/jpeg', q);
}

/* ---------- photo analysis helpers ---------- */
/* The Drive link from the parallel upload; waits at most 15 s, then saves without it. */
async function photoUrl() {
  const L = S.log; if (!L) return '';
  if (L.photo_url) return L.photo_url;
  if (!L.photoP) return '';
  return Promise.race([L.photoP, new Promise(r => setTimeout(() => r(''), 15000))]);
}
/* Portions the user has eaten or corrected, sent with the photo so the server doesn't read the
   Sheet. Their own corrections first, then the most used. */
function aiHints() {
  const dishes = S.data.favorites.filter(f => has(f.kcal) && (f.user_corrected === true || num(f.use_count) > 0))
    .sort((a, b) => (b.user_corrected === true) - (a.user_corrected === true) || num(b.use_count) - num(a.use_count)).slice(0, 40)
    .map(f => f.name + ' (' + servingLabel(f) + '): ' + fmt(f.kcal) + ' kcal, P' + fmt(f.protein_g, 1) + ' C' + fmt(f.carbs_g, 1) + ' F' + fmt(f.fat_g, 1) + (f.user_corrected === true ? ' *' : ''));
  return {dishes};
}

/* ---------- builders ---------- */
function newMeal(type, extra) { const L = logState(); return Object.assign({meal_id: uid('meal'), date: L.date || today(), time: L.time || nowHM(), meal_type: type, photo_url: '', note: '', confidence: '', confidence_reason: '', source: 'photo', edited: false, thumb: ''}, extra || {}); }
function entryFrom(src, mealId, q) {
  const e = {entry_id: uid('ent'), meal_id: mealId, name: src.name, category: src.category || 'other', serving_unit: src.serving_unit || 'serving', grams_per_unit: src.grams_per_unit, serving_label: src.serving_label || '', quantity: q || 1, confidence: src.confidence || 'high', edited: false, reason: src.reason || ''};
  VALUES.forEach(v => e[v] = has(src[v]) ? r1(num(src[v]) * (q || 1)) : '');
  return e;
}
function aiItem(x, mealId) {
  const q = num(x.quantity) || 1;
  const e = {entry_id: uid('ent'), meal_id: mealId, name: x.name || 'Food', category: CATEGORIES.includes(x.category) ? x.category : 'other', serving_unit: x.serving_unit || 'serving',
    grams_per_unit: num(x.grams_per_unit) || (num(x.grams) ? r0(num(x.grams) / q) : ''), serving_label: '', quantity: q, confidence: x.confidence || 'medium', reason: x.reason || '', edited: false};
  VALUES.forEach(v => e[v] = has(x[v]) ? r1(x[v]) : 0);
  return e;
}
function copyItems(mealId, newId) { return itemsOf(mealId).map(e => Object.assign({}, e, {entry_id: uid('ent'), meal_id: newId})); }
async function persistMeal(meal, entries) {
  const res = await API.saveMeal({meal, entries});
  applyMeal(res && res.meal ? res.meal : meal, res && res.entries ? res.entries : entries);
}
async function bumpFavorite(f) {
  const h = new Date().getHours(), n = Math.min(num(f.use_count), 9);
  const nf = Object.assign({}, f, {use_count: num(f.use_count) + 1, usual_hour: has(f.usual_hour) ? Math.round((num(f.usual_hour) * n + h) / (n + 1)) : h, last_used: new Date().toISOString()});
  applyFavorite(nf); API.saveFavorite(nf).catch(() => {});
}
function favPerUnit(it, base) {
  const q = num(it.quantity) || 1, f = Object.assign({}, base || {}, {name: it.name, category: it.category, serving_unit: it.serving_unit, grams_per_unit: it.grams_per_unit, serving_label: q === 1 ? (it.serving_label || '') : ''});
  VALUES.forEach(v => f[v] = has(it[v]) ? r1(num(it[v]) / q) : '');
  return f;
}
/* adds items to that meal on the chosen date, or starts the meal */
async function addToMealToday(type, entries, source, toastVerb) {
  const L = logState(), d = L.date || today(), existing = mealsOn(d).find(m => m.meal_type === type);
  let meal, all;
  if (existing) { meal = Object.assign({}, existing); all = itemsOf(existing.meal_id).concat(entries.map(e => Object.assign(e, {meal_id: existing.meal_id}))); }
  else { meal = newMeal(type, {source}); all = entries.map(e => Object.assign(e, {meal_id: meal.meal_id})); }
  await persistMeal(meal, all);
  toast((toastVerb || 'Added to') + ' ' + lc1(type) + (d === today() ? '' : ', ' + dayLabel(d)));
}
const savedText = (verb, meal) => verb + ' ' + lc1(meal.meal_type) + (meal.date === today() ? '' : ', ' + dayLabel(meal.date));
async function copyMealTo(id, day, type) {
  const m = S.data.meals.find(x => x.meal_id === id); if (!m) return;
  const nm = Object.assign({}, m, {meal_id: uid('meal'), date: day, time: day === today() ? nowHM() : m.time, meal_type: type || m.meal_type, source: 'copy'});
  await persistMeal(nm, copyItems(id, nm.meal_id));
}
function csvData() {
  const head = ['date', 'time', 'meal_type', 'item', 'category', 'amount'].concat(VALUES).concat(['confidence', 'edited', 'note', 'photo_url']);
  const q = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [head.join(',')];
  S.data.meals.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).forEach(m => itemsOf(m.meal_id).forEach(e => {
    rows.push([m.date, m.time, m.meal_type, e.name, e.category, amountLabel(e)].concat(VALUES.map(v => e[v])).concat([e.confidence, e.edited, m.note, m.photo_url]).map(q).join(','));
  }));
  return rows.join('\n');
}

/* ---------- edit-item helpers ---------- */
function openEdit(ctx, idx, item, o = {}) {
  const it = Object.assign({quantity: 1, serving_unit: 'serving', category: 'other'}, JSON.parse(JSON.stringify(item)));
  S.edit = {ctx, idx, item: it, orig: JSON.parse(JSON.stringify(it)), ref: snap(it), manual: !!o.manual, busy: false, edited: it.edited === true || it.edited === 'TRUE', asDefault: false, isNew: !!o.isNew, favId: o.favId || null};
  go('edit');
}
function snap(it) { const r = {g: num(it.grams_per_unit), q: num(it.quantity) || 1}; VALUES.forEach(v => r[v] = it[v]); return r; }
function applyRef() {
  const E = S.edit, it = E.item, g = num(it.grams_per_unit), q = num(it.quantity) || 1, R = E.ref;
  let f = null;
  if (R.g && g) f = (g * q) / (R.g * R.q); else if (!R.g && !g) f = q / R.q;
  if (f == null) { E.ref = snap(it); return; }
  VALUES.forEach(v => { if (has(R[v])) it[v] = r1(num(R[v]) * f); });
}
const stepQ = (q, d, u) => {
  if (['cup', 'bowl', 'g'].includes(u)) return Math.max(0.5, q + d * 0.5);
  return d > 0 ? (q < 1 ? q + 0.5 : q + 1) : (q <= 1 ? Math.max(0.5, q - 0.5) : q - 1);
};

/* ---------- click actions ---------- */
const A = {
  back: () => back(),
  tab: el => { S.stack = [{name: el.dataset.v, p: {}}]; S.ui.openSwipe = null; pushHistory(); render(); },
  go: el => {
    const v = el.dataset.v;
    if (['log', 'search', 'describe'].includes(v)) {
      const L = logState(), from = route().name;
      if (TABS.includes(from) && !L.img && !L.busy) { const d = from === 'today' ? viewDay() : today(); if (L.date !== d) { L.date = d; L.time = d === today() ? nowHM() : TYPE_TIME[L.meal_type]; L.timeAuto = d !== today(); } }
      L.error = '';
    }
    if (v === 'targets') S.ui.tg = null;
    if (v === 'goals') S.ui.gc = null;
    go(v, el.dataset.d ? {d: el.dataset.d} : {});
  },
  menuClose: (el, ev) => { if (ev && ev.target.closest('[data-stop]') && el.classList.contains('scrim')) return; S.menu = null; render(); },
  menuPick: el => { const it = S.menu.items[+el.dataset.v]; S.menu = null; render(); if (it && it.fn) it.fn(); },
  undo: () => { const u = S.toast && S.toast.undo; S.toast = null; if (u) u(); },

  async connect() {
    if (S.ui.busy) return; S.ui.busy = true; render();
    try { const r = await API.setup(); loadData(r); S.ui.busy = false; S.ui.gc = null; S.stack = [{name: 'welcome', p: {}}]; go('goals'); }
    catch (e) { S.ui.busy = false; toast(friendly(e)); }
  },
  gcSex: el => { gcState().sex = el.dataset.v; render(); },
  gcAct: el => { gcState().activity = el.dataset.v; render(); },
  gcGoal: el => { gcState().goal = el.dataset.v; render(); },
  async useTargets() {
    const p = gcState(), g = goalCalc(p), cur = currentTarget();
    const row = {effective_date: today(), kcal: g.kcal, protein_g: g.protein, carbs_g: g.carbs, fat_g: g.fat, fiber_min_g: num(cur.fiber_min_g) || 25, sugar_max_g: num(cur.sugar_max_g) || 50, sodium_max_mg: num(cur.sodium_max_mg) || 2300};
    const prof = Object.assign({}, p, {maintenance: g.maintenance});
    try {
      await Promise.all([API.saveTargets(row), API.saveSettings({profile: JSON.stringify(prof), onboarded: 'yes'})]);
      S.data.targets = S.data.targets.filter(t => t.effective_date !== row.effective_date).concat([row]);
      S.data.settings.profile = JSON.stringify(prof); S.data.settings.onboarded = 'yes'; S.dirty = true; S.ui.tg = null;
      S.stack = [{name: 'targets', p: {}}]; toast('Targets set from the calculator');
    } catch (e) { toast(friendly(e)); }
  },

  tgKcal: el => { const t = tgState(); t.kcal = Math.max(800, num(t.kcal) + +el.dataset.v); render(); },
  tgMode: el => { tgState().mode = el.dataset.v; render(); },
  tgToggle: el => { const k = el.dataset.v, t = tgState(), key = k.split('_')[0] + '_on'; t[key] = !t[key]; render(); },
  async saveTargets() {
    const t = tgState(); if (S.ui.busy) return;
    const row = {effective_date: today(), kcal: r0(t.kcal), protein_g: r0(t.protein_g), carbs_g: r0(t.carbs_g), fat_g: r0(t.fat_g),
      fiber_min_g: t.fiber_on ? r0(t.fiber_min_g) : 0, sugar_max_g: t.sugar_on ? r0(t.sugar_max_g) : 0, sodium_max_mg: t.sodium_on ? r0(t.sodium_max_mg) : 0};
    S.ui.busy = true; render();
    try { await API.saveTargets(row); S.data.targets = S.data.targets.filter(x => x.effective_date !== row.effective_date).concat([row]); S.dirty = true; S.ui.busy = false; S.ui.tg = null; home('Targets saved'); }
    catch (e) { S.ui.busy = false; toast(friendly(e)); }
  },
  csv() {
    if (S.meta.demo) { toast('The preview can\'t save files. In your deployed app this downloads a CSV.'); return; }
    try {
      const blob = new Blob([csvData()], {type: 'text/csv'}), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'LoCal-' + today() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
      toast('Downloaded LoCal-' + today() + '.csv');
    } catch (e) { toast('This browser blocked the download. Open the Sheet and use File, then Download.'); }
  },

  logType: el => {
    const L = logState();
    if (route().name === 'today' && !L.img && !L.busy) { L.date = viewDay(); L.timeAuto = L.date !== today(); if (!L.timeAuto) L.time = nowHM(); }
    L.meal_type = el.dataset.v; if (L.timeAuto) L.time = TYPE_TIME[L.meal_type];
    if (route().name === 'today') go('log'); else render();
  },
  labelType: el => { S.label.meal_type = el.dataset.v; const L = logState(); if (L.timeAuto) L.time = TYPE_TIME[el.dataset.v]; render(); },
  draftType: el => { S.draft.meal.meal_type = el.dataset.v; render(); },
  day: el => {
    const v = el.dataset.v, t = today();
    let d = v === 'today' ? t : addDays(viewDay(), +v);
    if (d > addDays(t, 7)) return;
    S.ui.day = d === t ? null : d; S.ui.openSwipe = null; render();
    if (v !== 'today') slideIn('day', +v);
  },
  async viewPhoto() {
    const D = S.draft; if (!D) return;
    const m = D.meal, L = S.log;
    if (D.mode === 'new' && D.source === 'photo' && L && L.img) { S.viewer = {src: L.img}; render(); return; }
    const id = m.meal_id;
    if (S.full[id]) { S.viewer = {src: S.full[id]}; render(); return; }
    S.viewer = {src: S.photos[id] || '', loading: true}; render();
    try {
      const r = m.photo_url ? await API.getPhoto({url: m.photo_url}) : null;
      if (!S.viewer) return;
      if (r && r.data) { S.full[id] = 'data:' + (r.mime || 'image/jpeg') + ';base64,' + r.data; S.viewer = {src: S.full[id]}; }
      else S.viewer = {src: S.photos[id] || '', msg: S.meta.demo ? 'The preview keeps only a small copy. Your deployed app loads the full photo from Drive.' : 'The full photo isn\'t in your Drive folder any more. This is the small copy saved with the meal.'};
    } catch (e) { if (S.viewer) S.viewer = {src: S.photos[id] || '', msg: friendly(e)}; }
    render();
  },
  closeViewer: (el, ev) => { if (ev && el.classList.contains('scrim') && ev.target.closest('[data-stop]') && !ev.target.closest('button')) return; S.viewer = null; render(); },
  async describe() {
    const L = logState(); if (L.busy || !L.text.trim()) return;
    L.busy = true; L.error = ''; render();
    try {
      const res = await API.analyzeText({text: L.text.trim(), meal_type: L.meal_type, hints: aiHints()});
      if (res.analysesToday != null) S.meta.analysesToday = res.analysesToday;
      if (res.error) throw new Error('SERVER: ' + res.error);
      const r = res.result;
      const meal = newMeal(L.meal_type, {note: L.text.trim(), confidence: r.confidence || 'medium', confidence_reason: r.reason || '', source: 'text'});
      const items = (r.items || []).map(x => aiItem(x, meal.meal_id));
      if (!items.length) throw new Error('NO_FOOD');
      S.draft = {mode: 'new', source: 'text', meal, items, ai: {confidence: r.confidence || 'medium', reason: r.reason || ''}, demo: S.meta.demo};
      L.busy = false; go('review');
    } catch (e) { L.busy = false; L.error = /NO_FOOD/.test(String(e && e.message)) ? 'No food found in that description. Name each food with an amount.' : friendly(e); L.errorFrom = 'text'; render(); }
  },
  closeLog: () => { S.log = null; back(); },
  shoot: () => { const i = document.getElementById('camIn'); if (i) { i.value = ''; i.click(); } },
  pick: () => { const i = document.getElementById('galIn'); if (i) { i.value = ''; i.click(); } },
  async analyze() {
    const L = logState(); if (L.busy) return;
    if (!L.img) return A.shoot();
    L.busy = true; L.error = ''; render();
    // Save the photo to Drive in a parallel call, so the estimate never waits for Drive.
    if (!L.photoP) L.photoP = API.savePhoto({image: L.full.data, mime: L.full.mime, meal_type: L.meal_type})
      .then(u => { L.photo_url = u || ''; return L.photo_url; }).catch(() => { L.photoP = null; return ''; });
    try {
      // mode 'auto': the AI decides whether the photo is food or a nutrition label
      const res = await API.analyzePhoto({image: L.full.data, mime: L.full.mime, note: L.note, mode: 'auto', meal_type: L.meal_type, hints: aiHints()});
      if (res.analysesToday != null) S.meta.analysesToday = res.analysesToday;
      if (res.error) throw new Error('SERVER: ' + res.error);
      const r = res.result;
      if (r.kind === 'label' || (!r.items && r.per_serving)) {
        S.label = {result: r, name: r.product || 'Packaged food', servings: 1, manual: {}, meal_type: L.meal_type, img: L.img, demo: S.meta.demo};
        L.busy = false; go('label');
      } else {
        const meal = newMeal(L.meal_type, {photo_url: L.photo_url, note: L.note, confidence: r.confidence || 'medium', confidence_reason: r.reason || '', thumb: L.thumb, source: 'photo'});
        const items = (r.items || []).map(x => aiItem(x, meal.meal_id));
        if (!items.length) throw new Error('NO_FOOD');
        S.draft = {mode: 'new', source: 'photo', meal, items, ai: {confidence: r.confidence || 'medium', reason: r.reason || ''}, demo: S.meta.demo};
        L.busy = false; go('review');
      }
    } catch (e) { L.busy = false; L.error = friendly(e); render(); }
  },
  reanalyze: () => { if (S.stack.length > 1) S.stack.pop(); S.draft = null; render(); A.analyze(); },

  editItem: el => { const i = +el.dataset.v; openEdit('draft', i, S.draft.items[i]); },
  itemQty: el => { const i = +el.dataset.i, it = S.draft.items[i]; S.draft.items[i] = rescale(it, null, stepQ(num(it.quantity) || 1, +el.dataset.v, it.serving_unit)); render(); },
  addItem: () => openEdit('draft', -1, {name: '', serving_unit: 'g', grams_per_unit: 100, quantity: 1, category: 'other', confidence: 'high', kcal: '', protein_g: '', carbs_g: '', fat_g: '', sugar_g: '', fiber_g: '', sodium_mg: ''}, {manual: true}),
  async saveDraft() {
    const D = S.draft; if (!D || S.ui.busy || !D.items.length) return;
    const meal = Object.assign({}, D.meal, {edited: D.meal.edited === true || D.items.some(e => e.edited === true)});
    S.ui.busy = true; render();
    try {
      if (D.mode === 'new' && D.source === 'photo' && !meal.photo_url) meal.photo_url = await photoUrl();
      await persistMeal(meal, D.items);
      (D.favs || []).forEach(f => bumpFavorite(f));
      S.ui.busy = false; const isNew = D.mode === 'new'; S.draft = null;
      if (isNew && (D.source === 'photo' || D.source === 'text')) S.log = null;
      if (meal.thumb) { S.photos[meal.meal_id] = meal.thumb; meal.has_thumb = true; }
      S.ui.day = meal.date === today() ? null : meal.date;
      home(savedText(isNew ? 'Saved to' : 'Saved changes to', meal));
    } catch (e) { S.ui.busy = false; toast(friendly(e)); }
  },

  editMeal: el => {
    const id = el.dataset.v;
    if (el.classList.contains('front') && S.ui.openSwipe) { S.ui.openSwipe = null; render(); return; }
    const m = S.data.meals.find(x => x.meal_id === id); if (!m) return;
    S.draft = {mode: 'edit', source: m.source, meal: Object.assign({}, m), items: JSON.parse(JSON.stringify(itemsOf(id))), ai: null};
    go('review');
  },
  copyMeal: el => {
    const id = el.dataset.v, m = S.data.meals.find(x => x.meal_id === id); if (!m) return;
    menu({title: 'Copy ' + lc1(m.meal_type), items: [
      {label: 'Add again today', fn: async () => { try { await copyMealTo(id, today()); S.ui.day = null; home('Copied to today\'s ' + lc1(m.meal_type)); } catch (e) { toast(friendly(e)); } }},
      {label: 'Copy to another date or meal', primary: true, fn: () => {
        S.ui.openSwipe = null; const L = logState(); L.date = viewDay(); L.time = m.time; L.timeAuto = false;
        const meal = newMeal(m.meal_type, {source: 'copy', note: m.note, photo_url: m.photo_url});
        S.draft = {mode: 'new', source: 'copy', meal, items: copyItems(id, meal.meal_id), ai: null}; go('review');
        setTimeout(() => { const f = document.getElementById('draft-date'); if (f) { f.scrollIntoView({block: 'center'}); f.focus({preventScroll: true}); } }, 60);
      }}]});
  },
  deleteMeal: el => {
    const id = el.dataset.v, m = S.data.meals.find(x => x.meal_id === id);
    const t = m ? lc1(m.meal_type) : 'meal';
    confirmBox('Delete ' + t + '?', 'This removes the meal and its items from your Sheet.', 'Delete ' + t, async () => {
      try {
        await API.deleteMeal(id);
        S.data.meals = S.data.meals.filter(x => x.meal_id !== id); S.data.entries = S.data.entries.filter(x => x.meal_id !== id); S.dirty = true;
        S.ui.openSwipe = null;
        if (route().name === 'review') { S.draft = null; S.stack.pop(); }
        toast('Deleted ' + t);
      } catch (e) { toast(friendly(e)); }
    });
  },
  async copyToToday(el) {
    const id = el.dataset.v, m = S.data.meals.find(x => x.meal_id === id); if (!m) return;
    try { await copyMealTo(id, today()); toast('Added to today\'s ' + lc1(m.meal_type)); } catch (e) { toast(friendly(e)); }
  },

  manual: () => { S.edit.manual = !S.edit.manual; render(); },
  itemUnit: el => { const it = S.edit.item; it.serving_unit = el.dataset.v; it.serving_label = ''; S.edit.ref.q = num(it.quantity) || 1; S.edit.ref.g = num(it.grams_per_unit); render(); },
  editQty: el => { const it = S.edit.item; it.quantity = stepQ(num(it.quantity) || 1, +el.dataset.v, it.serving_unit); it.serving_label = ''; applyRef(); render(); },
  useMacroKcal: () => { const it = S.edit.item; it.kcal = r0(macroKcal(it)); S.edit.ref = snap(it); S.edit.edited = true; render(); },
  tglEdited: () => { S.edit.edited = !S.edit.edited; render(); },
  tglDefault: () => { S.edit.asDefault = !S.edit.asDefault; if (S.edit.asDefault) S.edit.edited = true; render(); },
  async askAI() {
    const E = S.edit, it = E.item; if (E.busy || !it.name) return;
    E.busy = true; render();
    try {
      const r = await API.analyzeItem({name: it.name, serving_unit: it.serving_unit, grams_per_unit: it.grams_per_unit, quantity: it.quantity, category: it.category, note: S.draft && S.draft.meal ? S.draft.meal.note : ''});
      VALUES.forEach(v => { if (has(r[v])) it[v] = r1(r[v]); });
      if (r.category && CATEGORIES.includes(r.category)) it.category = r.category;
      it.confidence = r.confidence || 'medium'; it.reason = r.reason || '';
      E.ref = snap(it); E.orig = JSON.parse(JSON.stringify(it)); E.manual = false;
    } catch (e) { toast(friendly(e)); }
    E.busy = false; render();
  },
  removeItem: () => { const E = S.edit; if (E.ctx === 'draft' && E.idx >= 0) S.draft.items.splice(E.idx, 1); back(); },
  async doneItem() {
    const E = S.edit, it = Object.assign({}, E.item); if (!it.name || !has(it.kcal)) return;
    VALUES.forEach(v => { if (!has(it[v])) it[v] = 0; });
    it.edited = E.edited;
    if (it.edited && it.confidence === 'low') it.confidence = 'medium';
    if (E.idx >= 0) S.draft.items[E.idx] = it; else S.draft.items.push(Object.assign(it, {entry_id: uid('ent'), meal_id: S.draft.meal.meal_id}));
    if (E.asDefault) {
      const ex = S.data.favorites.find(f => f.name.toLowerCase() === it.name.toLowerCase());
      const f = favPerUnit(it, ex || {food_id: uid('food'), pinned: false, use_count: 0, usual_hour: new Date().getHours(), last_used: '', is_local_dish: false, dish_group: ''});
      f.user_corrected = true; applyFavorite(f); API.saveFavorite(f).catch(err => toast(friendly(err)));
    }
    S.edit = null; S.stack.pop(); render();
  },

  labelServ: el => { const Lb = S.label; Lb.servings = Math.max(0.5, (num(Lb.servings) || 1) + 0.5 * +el.dataset.v); render(); },
  async saveLabel() {
    const Lb = S.label, L = logState(); if (!Lb || S.ui.busy) return;
    const ps = Object.assign({}, Lb.result.per_serving); Object.keys(Lb.manual).forEach(k => { if (has(Lb.manual[k])) ps[k] = num(Lb.manual[k]); });
    const meal = newMeal(Lb.meal_type, {photo_url: L.photo_url, thumb: L.thumb, source: 'label', confidence: Lb.result.confidence || 'high', confidence_reason: 'Read from the printed label'});
    const src = Object.assign({name: Lb.name, category: 'snacks and sweets', serving_unit: 'serving', grams_per_unit: num(Lb.result.serving_g) || '', confidence: Lb.result.confidence || 'high'}, ps);
    if (/drink|juice|soda|milk|coffee|tea/i.test(Lb.name)) src.category = 'drinks';
    if (/noodle|bread|rice|cracker|biscuit|pasta|cereal/i.test(Lb.name)) src.category = /cracker|biscuit/i.test(Lb.name) ? 'snacks and sweets' : 'staple';
    const e = entryFrom(src, meal.meal_id, num(Lb.servings) || 1);
    S.ui.busy = true; render();
    try { if (!meal.photo_url) meal.photo_url = await photoUrl(); await persistMeal(meal, [e]); if (meal.thumb) S.photos[meal.meal_id] = meal.thumb; S.ui.busy = false; S.label = null; S.log = null; S.ui.day = meal.date === today() ? null : meal.date; home(savedText('Saved to', meal)); }
    catch (err) { S.ui.busy = false; toast(friendly(err)); }
  },

  async addPastItem(el) {
    const e = S.data.entries.find(x => x.entry_id === el.dataset.v); if (!e) return;
    const type = logState().meal_type;
    try { await addToMealToday(type, [Object.assign({}, e, {entry_id: uid('ent'), meal_id: '', edited: false})], 'quick add'); } catch (err) { toast(friendly(err)); }
  },
  pastItemChange: el => {
    const e = S.data.entries.find(x => x.entry_id === el.dataset.v); if (!e) return;
    const meal = newMeal(logState().meal_type, {source: 'quick add'});
    S.draft = {mode: 'new', source: 'quick', meal, items: [Object.assign({}, e, {entry_id: uid('ent'), meal_id: meal.meal_id, edited: false})], ai: null}; go('review');
  },
  // Nothing matched: start a meal with one blank item named after the search, values entered by hand.
  newFood: () => {
    const name = ((S.ui.sq && S.ui.sq.q) || '').trim();
    const meal = newMeal(logState().meal_type, {source: 'quick add'});
    S.draft = {mode: 'new', source: 'quick', meal, items: [], ai: null}; go('review');
    openEdit('draft', -1, {name, serving_unit: 'g', grams_per_unit: 100, quantity: 1, category: 'other', confidence: 'high', kcal: '', protein_g: '', carbs_g: '', fat_g: '', sugar_g: '', fiber_g: '', sodium_mg: ''}, {manual: true});
  },
  async copyPast(el) {
    const type = logState().meal_type;
    try { await addToMealToday(type, copyItems(el.dataset.v, ''), 'copy', 'Copied to'); } catch (e) { toast(friendly(e)); }
  },
  copyChange: el => {
    const m = S.data.meals.find(x => x.meal_id === el.dataset.v); if (!m) return;
    const meal = newMeal(logState().meal_type, {source: 'copy', note: m.note, thumb: m.thumb, photo_url: m.photo_url});
    S.draft = {mode: 'new', source: 'copy', meal, items: copyItems(m.meal_id, meal.meal_id), ai: null}; go('review');
  },

  monthStep: el => {
    const dir = +el.dataset.v, t = today(), [y, mo] = (S.ui.month || t.slice(0, 7)).split('-').map(Number);
    const m = ymd(new Date(y, mo - 1 + dir, 1)).slice(0, 7);
    if (m > t.slice(0, 7) || m < firstDay().slice(0, 7)) return;
    S.ui.month = m; render(); slideIn('monthStep', dir);
  },
  trendStep: el => {
    const dir = +el.dataset.v, rg = trendRange(), can = trendCan(rg);
    if (dir < 0 ? !can.prev : !can.next) return;
    if (rg.r === 'Custom') {
      const len = daysBetween(rg.from, rg.to) + 1, to = dir > 0 ? (addDays(rg.to, len) > today() ? today() : addDays(rg.to, len)) : addDays(rg.to, -len);
      S.ui.custom = {from: addDays(to, -(len - 1)), to};
    } else S.ui.tOff = (S.ui.tOff || 0) - dir;
    render(); slideIn('trendStep', dir);
  },
  range: el => { S.ui.range = el.dataset.v; S.ui.tOff = 0; render(); },
  week: el => { if (el.disabled) return; S.ui.week = el.dataset.v; S.ui.sumErr = ''; render(); },
  measure: el => { S.ui.measure = el.dataset.v; render(); },
  cm: el => { S.ui.cm = el.dataset.v; render(); },
  async writeSummary() {
    const start = S.ui.week || addDays(weekBounds(today()).start, -7), n = weekNumbers(start), p = weekNumbers(addDays(start, -7));
    const payload = {week_start: n.start, week_end: n.end, avg_kcal: r0(n.avg), target_kcal: num(targetFor(n.end).kcal), days_logged: n.done.length, days_on_target: n.onT,
      prev_avg_kcal: r0(p.avg), prev_days_on_target: p.onT, prev_days_logged: p.done.length, protein_avg: r0(n.protein), protein_goal: n.proteinGoal,
      weight_start: n.w0, weight_end: n.w1,
      days: n.done.map(d => ({date: d, weekday: dayName(d), kcal: r0(totalsOn(d).kcal), target: num(targetFor(d).kcal), protein: r0(totalsOn(d).protein_g), status: dayStatus(d)}))};
    S.ui.sumBusy = true; S.ui.sumErr = ''; render();
    try {
      const r = await API.weeklySummary(payload), key = 'weekly_summary:' + start, val = JSON.stringify({text: r.text, suggestions: r.suggestions || []});
      S.data.settings[key] = val; API.saveSettings({[key]: val}).catch(() => {});
    } catch (e) { S.ui.sumErr = friendly(e); }
    S.ui.sumBusy = false; render();
  },
  async saveWeight() {
    const kg = num(S.ui.wIn != null ? S.ui.wIn : (document.getElementById('wt-in') || {}).value);
    if (!(kg >= 20 && kg <= 400)) { toast('Enter a weight in kilograms, such as 72.4'); return; }
    const row = {date: today(), kg: r1(kg), note: (S.ui.wNote || '').trim()};
    try { await API.addWeight(row); S.data.weight = S.data.weight.filter(w => w.date !== row.date).concat([row]); S.ui.wNote = ''; S.ui.wIn = null; toast('Saved ' + fmt(row.kg, 1) + ' kg'); }
    catch (e) { toast(friendly(e)); }
  }
};

/* ---------- input handlers (no full re-render while typing) ---------- */
const I = {
  gc: el => { gcState()[el.dataset.k] = el.value; },
  gcPace: el => { gcState().pace = num(el.value); },
  tg: el => { tgState()[el.dataset.k] = el.value; },
  tgMacro: el => { const t = tgState(), k = el.dataset.k, f = +el.dataset.f; t[k] = t.mode === 'Grams' ? num(el.value) : Math.round(num(el.value) / 100 * num(t.kcal) / f); },
  logNote: el => { logState().note = el.value; },
  logText: el => { logState().text = el.value; },
  logDate: el => { if (el.value) { const L = logState(); L.date = el.value; } },
  logTime: el => { if (el.value) { const L = logState(); L.time = el.value; L.timeAuto = false; } },
  draftDate: el => { if (el.value) S.draft.meal.date = el.value; },
  draftTime: el => { if (el.value) S.draft.meal.time = el.value; },
  draftNote: el => { S.draft.meal.note = el.value; },
  itemName: el => { S.edit.item.name = el.value; },
  itemGrams: el => { const it = S.edit.item; it.grams_per_unit = el.value === '' ? '' : num(el.value); it.serving_label = ''; applyRef(); },
  itemVal: el => { const it = S.edit.item; it[el.dataset.k] = el.value === '' ? '' : num(el.value); S.edit.ref = snap(it); S.edit.edited = true; },
  itemCat: el => { S.edit.item.category = el.value; },
  labelVal: el => { S.label.manual[el.dataset.k] = el.value; },
  labelName: el => { S.label.name = el.value; },
  sqSearch: el => { S.ui.sq.q = el.value; },
  custom: el => { const r = trendRange(); S.ui.custom = {from: r.from, to: r.to}; S.ui.custom[el.dataset.k] = el.value; if (S.ui.custom.from > S.ui.custom.to) S.ui.custom.from = S.ui.custom.to; },
  wIn: el => { S.ui.wIn = el.value; },
  wNote: el => { S.ui.wNote = el.value; },
  async setting(el) {
    const k = el.dataset.k, v = el.value; S.data.settings[k] = v;
    const patch = {[k]: v};
    try { await API.saveSettings(patch); toast('Saved'); } catch (e) { toast(friendly(e)); }
  },
  async photo(el) {
    const file = el.files && el.files[0]; if (!file) return;
    const L = logState();
    try {
      const img = await loadImage(file);
      // 768 px is plenty for food and label text, and uploads much faster than full size
      const full = drawTo(img, 768, false, 0.8);
      L.img = full; L.full = {data: full.split(',')[1], mime: 'image/jpeg'}; L.thumb = drawTo(img, 160, true, 0.6); L.photo_url = ''; L.photoP = null; L.error = '';
    } catch (e) { L.error = friendly(e); }
    render();
  }
};
/* inputs whose change should redraw everything (choices, not typing) */
const FULL_ON_INPUT = new Set(['setting', 'photo', 'custom', 'itemCat', 'logDate', 'logTime', 'draftDate', 'draftTime']);

function bindEvents() {
  document.addEventListener('click', ev => {
    if (S.ui.suppressClick) { ev.preventDefault(); ev.stopPropagation(); return; }
    const el = ev.target.closest('[data-a]'); if (!el) return;
    if (el.tagName === 'A') ev.preventDefault();
    if (el.disabled) return;
    if (el.classList.contains('scrim') && ev.target.closest('[data-stop]')) return;
    const fn = A[el.dataset.a]; if (fn) fn(el, ev);
  }, true);
  document.addEventListener('input', ev => {
    const el = ev.target.closest('[data-in]'); if (!el) return;
    const n = el.dataset.in, fn = I[n]; if (!fn) return;
    if (FULL_ON_INPUT.has(n)) return; // handled on change
    fn(el); refreshParts();
  });
  document.addEventListener('change', ev => {
    const el = ev.target.closest('[data-in]'); if (!el) return;
    const n = el.dataset.in, fn = I[n]; if (!fn) return;
    // typing fields already updated their computed regions on 'input'; a full redraw here would steal focus
    if (FULL_ON_INPUT.has(n)) { const r = fn(el); if (!(r && r.then)) render(); }
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && (S.menu || S.viewer)) { S.menu = null; S.viewer = null; render(); }
    if (ev.key === 'Enter' && ev.target.matches('input.fld') && ev.target.dataset.in === 'wIn') A.saveWeight();
  });
  /* swipe a meal row left to reveal Edit, Copy and Delete */
  /* Swipe zones: [data-hswipe="<action>"] runs that action with +1 for a swipe left (later) and
     -1 for a swipe right (earlier). A swipe may start on a button, since calendar days are
     buttons; a drag suppresses the click after it, so a plain tap still works. */
  let ds = null;
  document.addEventListener('pointerdown', ev => {
    const z = ev.target.closest('[data-hswipe]'); if (!z) return;
    ds = {x0: ev.clientX, y0: ev.clientY, dx: 0, drag: false, act: z.dataset.hswipe, el: z.querySelector('.swmove')};
  });
  document.addEventListener('pointermove', ev => {
    if (!ds) return;
    const dx = ev.clientX - ds.x0, dy = ev.clientY - ds.y0;
    if (!ds.drag && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) ds.drag = true;
    if (!ds.drag) return;
    ds.dx = dx; if (ds.el) { ds.el.style.transition = 'none'; ds.el.style.transform = 'translateX(' + clamp(dx * 0.5, -60, 60) + 'px)'; ds.el.style.opacity = String(1 - Math.min(Math.abs(dx) / 400, .5)); }
  });
  const dsEnd = () => {
    if (!ds) return; const s = ds; ds = null;
    if (s.el) { s.el.style.transform = ''; s.el.style.opacity = ''; }
    if (!s.drag) return;
    S.ui.suppressClick = true; setTimeout(() => { S.ui.suppressClick = false; }, 250);
    if (Math.abs(s.dx) > 50 && A[s.act]) A[s.act]({dataset: {v: s.dx < 0 ? '1' : '-1'}});
  };
  /* Trackpads and sideways mouse wheels: a horizontal scroll over a zone steps it once. */
  let wx = 0, wLock = 0;
  document.addEventListener('wheel', ev => {
    const z = ev.target.closest('[data-hswipe]'); if (!z || Math.abs(ev.deltaX) <= Math.abs(ev.deltaY)) return;
    ev.preventDefault();
    if (Date.now() < wLock) return;
    wx += ev.deltaX;
    if (Math.abs(wx) > 60 && A[z.dataset.hswipe]) { const v = wx > 0 ? '1' : '-1'; wx = 0; wLock = Date.now() + 450; A[z.dataset.hswipe]({dataset: {v}}); }
  }, {passive: false});
  document.addEventListener('pointerup', dsEnd);
  document.addEventListener('pointercancel', dsEnd);
  let sw = null;
  document.addEventListener('pointerdown', ev => {
    const f = ev.target.closest('.swipe .front'); if (!f) return;
    const box = f.parentElement; sw = {box, x0: ev.clientX, y0: ev.clientY, open: box.classList.contains('open'), dx: 0, drag: false};
  });
  document.addEventListener('pointermove', ev => {
    if (!sw) return;
    const dx = ev.clientX - sw.x0, dy = ev.clientY - sw.y0;
    if (!sw.drag && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { sw.drag = true; sw.box.classList.add('dragging'); }
    if (!sw.drag) return;
    sw.dx = dx; const base = sw.open ? -158 : 0;
    sw.box.querySelector('.front').style.transform = 'translateX(' + clamp(base + dx, -170, 0) + 'px)';
  });
  const end = () => {
    if (!sw) return;
    const s = sw; sw = null;
    s.box.classList.remove('dragging'); s.box.querySelector('.front').style.transform = '';
    if (!s.drag) return;
    const open = s.open ? s.dx > -60 && s.dx < 60 ? true : s.dx <= -60 : s.dx < -60;
    const id = s.box.dataset.swipe;
    document.querySelectorAll('.swipe.open').forEach(x => x.classList.remove('open'));
    if (open) { s.box.classList.add('open'); S.ui.openSwipe = id; } else S.ui.openSwipe = null;
    if (s.open && s.dx > 30) { s.box.classList.remove('open'); S.ui.openSwipe = null; }
    S.ui.suppressClick = true; setTimeout(() => { S.ui.suppressClick = false; }, 250);
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  /* system back button */
  const onBack = () => { if (S.menu) { S.menu = null; render(); return; } if (S.stack.length > 1) back(); };
  try { if (IN_GAS) google.script.history.setChangeHandler(onBack); else window.addEventListener('popstate', onBack); } catch (e) { /* ignore */ }
}

function loadData(r) {
  const d = r.data || {};
  S.data.meals = (d.meals || []).map(normMeal);
  S.data.entries = (d.entries || []).map(normEntry);
  S.data.favorites = (d.favorites || []).map(normFav);
  S.data.targets = (d.targets || []).map(t => Object.assign({}, t, {effective_date: dayKey(t.effective_date)}));
  S.data.weight = (d.weight || []).map(w => Object.assign({}, w, {date: dayKey(w.date), kg: num(w.kg)}));
  S.data.settings = d.settings || {};
  Object.assign(S.meta, r.meta || {});
  S.dirty = true;
}
const bool = v => v === true || v === 'TRUE' || v === 'true';
const dayKey = v => { if (!v) return ''; if (v instanceof Date) return ymd(v); const s = String(v); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : (isNaN(Date.parse(s)) ? s : ymd(new Date(s))); };
const hmKey = v => { if (!v) return ''; const s = String(v); const m = s.match(/(\d{1,2}):(\d{2})/); return m ? pad(+m[1]) + ':' + m[2] : s; };
function normMeal(m) {
  const o = Object.assign({}, m, {date: dayKey(m.date), time: hmKey(m.time), edited: bool(m.edited), has_thumb: bool(m.has_thumb) || !!m.thumb});
  if (o.thumb) S.photos[o.meal_id] = o.thumb;
  delete o.thumb;
  return o;
}
function normEntry(e) { const o = Object.assign({}, e, {edited: bool(e.edited), quantity: num(e.quantity) || 1}); VALUES.forEach(v => { if (has(o[v])) o[v] = num(o[v]); }); return o; }
function normFav(f) { return Object.assign({}, f, {pinned: bool(f.pinned), is_local_dish: bool(f.is_local_dish), user_corrected: bool(f.user_corrected), use_count: num(f.use_count)}); }

async function boot() {
  bindEvents();
  app().innerHTML = '<div class="boot">' + logoTile(96, true) + '<span>Opening your log</span></div>';
  try {
    const r = await API.bootstrap();
    loadData(r);
    if (setting('onboarded', '') !== 'yes') S.stack = [{name: 'welcome', p: {}}];
    render();
  } catch (e) {
    app().innerHTML = '<div class="boot" style="padding:24px;text-align:center">' + logoTile(96) + '<span class="ov">' + esc(friendly(e)) + '</span><button class="raised-sm btn-sm mango" onclick="location.reload()">Try again</button></div>';
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
