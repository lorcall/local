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
  gear: '<path d="M18.88 9.87 L21.36 10.39 L21.36 13.61 L18.88 14.13 L18.37 15.36 L19.76 17.48 L17.48 19.76 L15.36 18.37 L14.13 18.88 L13.61 21.36 L10.39 21.36 L9.87 18.88 L8.64 18.37 L6.52 19.76 L4.24 17.48 L5.63 15.36 L5.12 14.13 L2.64 13.61 L2.64 10.39 L5.12 9.87 L5.63 8.64 L4.24 6.52 L6.52 4.24 L8.64 5.63 L9.87 5.12 L10.39 2.64 L13.61 2.64 L14.13 5.12 L15.36 5.63 L17.48 4.24 L19.76 6.52 L18.37 8.64 Z"/><circle cx="12" cy="12" r="3"/>',
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
  return '<div class="chips' + (o.scroll ? ' scroll' : '') + '" role="radiogroup" aria-label="' + esc(label) + '"' + (o.view ? ' data-view' : '') + '><span class="selind" aria-hidden="true"></span>' + options.map(opt => {
    const [v, t] = Array.isArray(opt) ? opt : [opt, opt];
    return '<button class="chip" role="radio" aria-checked="' + (v === selected) + '" data-a="' + act + '" data-v="' + esc(v) + '"' + (o.h ? ' style="height:' + o.h + 'px"' : '') + '><span class="cl">' + esc(t) + '</span></button>';
  }).join('') + '</div>';
}
/* track: a pressed track with the selected option raised */
function track(act, options, selected, label, o = {}) {
  const role = o.tabs ? 'tab' : 'radio', attr = o.tabs ? 'aria-selected' : 'aria-checked';
  return '<div class="track' + (o.tight ? ' tight' : '') + '" role="' + (o.tabs ? 'tablist' : 'radiogroup') + '" aria-label="' + esc(label) + '"' + (o.style ? ' style="' + o.style + '"' : '') + (o.view ? ' data-view' : '') + '><span class="selind" aria-hidden="true"></span>' + options.map(opt => {
    const [v, t] = Array.isArray(opt) ? opt : [opt, opt];
    return '<button role="' + role + '" ' + attr + '="' + (v === selected) + '" data-a="' + act + '" data-v="' + esc(v) + '"><span class="cl">' + esc(t) + '</span></button>';
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
  return '<div class="tabfade" aria-hidden="true"></div><nav class="tabbar" aria-label="Main"><span class="tabind" aria-hidden="true"></span>' + nb('today', 'today', 'Today') + nb('trends', 'bars', 'Trends') +
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
  const raw = S.photos[id], url = raw == null ? raw : (safeImg(raw) || false);
  return '<div class="th" data-thumb="' + esc(id) + '" role="img" aria-label="' + esc(m.meal_type) + ' photo" style="' + (size ? 'width:' + size + 'px;height:' + size + 'px;' : '') + (url ? 'background-image:url(\'' + url + '\')' : '') + (extra || '') + '">' +
    (url ? '' : (m.has_thumb || m.thumb) && url !== false ? '<span class="spinglow"><span class="spin" style="--s:16px;--t:2.5px"></span></span>' : icon(m.source === 'label' ? 'label' : m.source === 'text' ? 'text' : 'plate', 18)) + '</div>';
}
function flushThumbs() {
  if (!thumbQueue.size) return;
  const ids = Array.from(thumbQueue); thumbQueue = new Set();
  ids.forEach(id => { S.photos[id] = null; });
  API.getThumbs(ids).then(map => {
    ids.forEach(id => {
      const u = safeImg((map || {})[id]) || false; S.photos[id] = u;
      document.querySelectorAll('[data-thumb="' + CSS.escape(id) + '"]').forEach(el => {
        el.innerHTML = u ? '' : icon('plate', 18);
        if (u) el.style.backgroundImage = "url('" + u + "')";
      });
    });
  }).catch(() => ids.forEach(id => { delete S.photos[id]; }));
}
