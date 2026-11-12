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
const DISH_GROUPS = ['All', 'Ulam', 'Rice', 'Soup', 'Street food', 'Merienda'];
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
const riceServing = () => { const m = String(setting('rice_serving', '1 cup, 160 g')).match(/(\d+)\s*g/); return m ? +m[1] : 160; };

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
