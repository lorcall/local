/* ---------- screens: start, goals, today and logging ---------- */
const SCREENS = {};

SCREENS.welcome = () => {
  return '<div class="scr" style="align-items:center;padding:80px 24px 36px">' +
    logoTile(150) +
    wordmark(56, 'margin-top:36px') +
    '<div class="tagline" style="margin-top:10px">AI calorie tracker</div>' +
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
  return '<div class="nosel" style="position:relative;width:' + px + 'px;height:' + px + 'px;border-radius:' + Math.round(px * .253) + 'px;background:linear-gradient(145deg,var(--lt-a,#2A2D36),var(--lt-b,#1F2128));box-shadow:14px 14px 28px var(--lo),-12px -12px 24px var(--hi),inset 0 1px 0 var(--lt-sheen,rgba(255,255,255,.06));display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
    '<svg width="' + s + '" height="' + s + '" viewBox="0 0 120 120" role="img" aria-label="LoCal app icon"><defs><linearGradient id="lw" x1="0" y1="0" x2="1" y2="1"><stop class="lt-s1" offset="0" stop-color="#16171C"/><stop class="lt-s2" offset="1" stop-color="#30333D"/></linearGradient><filter id="lg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
    '<circle cx="60" cy="60" r="47" fill="url(#lw)"/><circle class="lt-face" cx="60" cy="60" r="43" fill="#23252D"/><circle class="lt-groove" cx="60" cy="60" r="34" fill="none" stroke="#17181D" stroke-width="8"/>' +
    (loading ? '' : '<circle cx="60" cy="60" r="34" fill="none" stroke="#F5A524" stroke-width="8" stroke-linecap="round" stroke-dasharray="160.2 213.6" transform="rotate(135 60 60)" filter="url(#lg)"/>' +
    '<circle cx="84" cy="84" r="5.5" fill="#FFD08A" filter="url(#lg)"/>') + '<circle class="lt-core" cx="60" cy="60" r="18" fill="#FFFFFF" fill-opacity=".06" stroke="#FFFFFF" stroke-opacity=".16"/></svg>' + ring + '</div>';
}
/* The LoCal wordmark is a picture (icons/wordmark.png, embedded by the build), drawn once from
   Geologica and the dial: it can't be selected, dragged or broken by a missing font or a style
   change. fs is the font size it stands in for; the picture is 0.738 of that tall. */
const WORDMARK = '__WORDMARK_PNG__', WORDMARK_LIGHT = '__WORDMARK_LIGHT_PNG__';
function wordmark(fs, style) {
  const img = (src, cls, alt) => '<img class="wordmark ' + cls + '" src="' + src + '" alt="' + alt + '" draggable="false" style="height:' + (fs * 0.7381).toFixed(1) + 'px;' + (style || '') + '">';
  return img(WORDMARK, 'on-dark', 'LoCal') + img(WORDMARK_LIGHT, 'on-light', '');   // the stylesheet shows one, for the theme's ground
}

/* ---------- Goal calculator ---------- */
function gcState() {
  if (!S.ui.gc) {
    const p = profile(), ws = weightSeries(), lastW = ws.length ? ws[ws.length - 1].kg : null;
    const ln = lastNotes();
    S.ui.gc = Object.assign({age: 30, sex: 'Male', height: 170, weight: 70, activity: 'Light', goal: 'Lose', target_weight: 65, pace: 0.35}, p, lastW ? {weight: r1(lastW)} : {},
      {notes: ln ? ln.notes : '', notesFrom: ln && ln.notes ? ln : null, ai: null, aiBusy: false, aiErr: ''});
  }
  return S.ui.gc;
}
/* the profile part of the calculator, as saved in Settings and sent to the AI */
const GC_KEYS = ['age', 'sex', 'height', 'weight', 'activity', 'goal', 'target_weight', 'pace'];
const gcProfile = p => GC_KEYS.reduce((o, k) => (o[k] = p[k], o), {});
/* the seven targets the calculator would save, before any AI check */
function gcBase(p) {
  const g = goalCalc(p), cur = currentTarget();
  return {kcal: g.kcal, maintenance: g.maintenance, protein_g: g.protein, carbs_g: g.carbs, fat_g: g.fat,
    fiber_min_g: num(cur.fiber_min_g) || 25, sugar_max_g: num(cur.sugar_max_g) || 50, sodium_max_mg: num(cur.sodium_max_mg) || 2300};
}
/* what an AI check was made against: if any of it changes, the check is out of date */
const gcKey = p => JSON.stringify(GC_KEYS.map(k => String(p[k])).concat([String(p.notes || '').trim()]));
const gcFresh = p => !!(p.ai && p.ai.key === gcKey(p));
/* notes from the last time the calculator set the targets; cleared notes stay cleared */
function lastNotes() {
  const r = S.data.targets.filter(t => /^Calculator/.test(String(t.basis || ''))).sort((a, b) => String(b.effective_date).localeCompare(String(a.effective_date)))[0];
  return r ? {notes: String(r.notes || ''), date: r.effective_date} : null;
}
const TG_FIELDS = [['kcal', 'Calories', ' kcal'], ['protein_g', 'Protein', ' g'], ['carbs_g', 'Carbs', ' g'], ['fat_g', 'Fat', ' g'],
  ['fiber_min_g', 'Fiber, at least', ' g'], ['sugar_max_g', 'Sugar, at most', ' g'], ['sodium_max_mg', 'Sodium, at most', ' mg']];
function gcAiPart(p) {
  const notes = String(p.notes || '').trim(), fresh = gcFresh(p), a = p.ai;
  let card = '';
  if (a) {
    const why = {}; (a.changes || []).forEach(c => { if (c && c.field) why[c.field] = c.reason; });
    const rows = TG_FIELDS.map(([k, label, unit]) => {
      const b = r0(num(a.base[k])), v = r0(num(a[k])), ch = b !== v;
      return '<span>' + label + '</span><span class="mu" style="text-align:right">' + fmt(b) + '</span>' +
        '<span style="text-align:right;white-space:nowrap;' + (ch ? 'color:var(--ai);font-weight:500' : '') + '">' + fmt(v) + unit + '</span>' +
        (ch && why[k] ? '<span class="gc-why">' + esc(why[k]) + '</span>' : '');
    }).join('');
    card = '<section class="raised r26 col" style="padding:16px;gap:12px' + (fresh ? '' : ';opacity:.55') + '" aria-label="AI check of your targets">' +
      '<div class="between" style="align-items:baseline"><h2 class="sec15" style="margin:0">Checked with AI</h2>' +
      (fresh ? '' : '<span class="cap">Out of date</span>') + '</div>' +
      '<div class="gc-cmp"><span class="cap">Daily</span><span class="cap" style="text-align:right">Calculated</span><span class="cap" style="text-align:right">With your notes</span>' + rows + '</div>' +
      (a.summary ? '<p style="margin:0;font-size:14px;line-height:1.5">' + esc(a.summary) + '</p>' : '') +
      (a.caution ? '<p class="cap" style="margin:0;line-height:1.5">' + esc(a.caution) + '</p>' : '') +
      (fresh ? '' : '<p class="cap" style="margin:0">Your details or notes changed after this check. Check again to update it.</p>') + '</section>';
  }
  const err = p.aiErr ? '<div class="warn" role="alert"><div class="ov" style="font-weight:500">' + esc(p.aiErr) + '</div><div class="mu" style="margin-top:2px">Your notes are kept.</div></div>' : '';
  let btns;
  if (p.aiBusy) btns = '<button class="cta btn" disabled><span class="spinglow"><span class="spin"></span></span><span style="margin-left:10px">Checking with AI</span></button>';
  else if (fresh) btns = '<button class="cta btn" data-a="useTargets" data-v="ai">Use adjusted targets</button><button class="raised-sm btn2" data-a="useTargets">Use calculated targets</button>';
  else if (notes) btns = '<button class="cta btn" data-a="gcAsk">' + (a ? 'Check again with AI' : 'Check with AI') + '</button><button class="raised-sm btn2" data-a="useTargets">Use calculated targets</button>';
  else btns = '<button class="cta btn" data-a="useTargets">Use these targets</button>';
  return card + err + btns;
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
    [['Protein', g.protein, COLOR.p], ['Carbs', g.carbs, COLOR.c], ['Fat', g.fat, COLOR.f2]].map(([l, v, c]) => '<div class="pressed-sm r14" style="flex:1;padding:8px 10px"><div style="font-size:11px;color:' + c + '">' + l + '</div><div style="font-size:16px">' + fmt(v) + ' g</div></div>').join('') +
    '</div></section>' +
    '<section class="col" style="gap:8px"><div class="between" style="align-items:baseline"><label for="gc-notes" style="font-size:14px;font-weight:500">Notes for the AI</label>' +
    '<span data-part="gc-nclr">' + (String(p.notes || '').trim() ? '<a href="#" data-a="gcClear" style="font-size:13px">Clear notes</a>' : '') + '</span></div>' +
    '<textarea id="gc-notes" rows="4" maxlength="4000" class="fld" data-in="gcNotes" placeholder="For example: Light most weeks, moderate when I feel like it. I run twice a week. I want to lose fat but keep muscle, down to about 20% body fat. My doctor says not too much protein.">' + esc(p.notes || '') + '</textarea>' +
    '<span class="cap" data-part="gc-nfrom">' + (p.notesFrom && String(p.notes || '') === p.notesFrom.notes ? 'Your notes from ' + esc(monthDay(p.notesFrom.date)) + '. Keep them, add to them, or clear them for new ones.'
      : 'Optional. Anything the choices above can\'t say: how your activity really varies, keeping muscle while losing fat, a body fat goal, health conditions, food preferences. The AI adjusts the targets above to fit.') + '</span></section>' +
    '<div data-part="gc-ai" class="col" style="gap:12px">' + gcAiPart(p) + '</div>' +
    '<p class="cap" style="text-align:center;line-height:1.5">Estimated with the Mifflin-St Jeor formula' + (String(p.notes || '').trim() ? ', then checked by AI against your notes' : '') + '. A starting point, not medical advice.</p></div>';
};

/* ---------- Daily targets ---------- */
function tgState() {
  if (!S.ui.tg) S.ui.tg = Object.assign({mode: 'Grams'}, currentTarget(), {
    fiber_on: num(currentTarget().fiber_min_g) > 0, sugar_on: num(currentTarget().sugar_max_g) > 0, sodium_on: num(currentTarget().sodium_max_mg) > 0,
    fiber_min_g: num(currentTarget().fiber_min_g) || 25, sugar_max_g: num(currentTarget().sugar_max_g) || 50, sodium_max_mg: num(currentTarget().sodium_max_mg) || 2300});
  return S.ui.tg;
}
/* what Save targets would write, and whether it differs from the target in force today */
function tgRow(t) {
  return {effective_date: today(), kcal: r0(t.kcal), protein_g: r0(t.protein_g), carbs_g: r0(t.carbs_g), fat_g: r0(t.fat_g),
    fiber_min_g: t.fiber_on ? r0(t.fiber_min_g) : 0, sugar_max_g: t.sugar_on ? r0(t.sugar_max_g) : 0, sodium_max_mg: t.sodium_on ? r0(t.sodium_max_mg) : 0};
}
function tgBasis() {
  const b = String(currentTarget().basis || '');
  return b === 'Calculator + AI' ? 'From the goal calculator, adjusted by AI for your notes' : b === 'Calculator' ? 'From the goal calculator'
    : b === 'Manual' ? 'Set by you' : profile().maintenance ? 'From the goal calculator' : 'Set by you';
}
function tgChanged() {
  const row = tgRow(tgState()), cur = currentTarget();
  return ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_min_g', 'sugar_max_g', 'sodium_max_mg'].some(k => row[k] !== r0(num(cur[k])));
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
    '<div class="between" style="font-size:13px;margin-top:-4px;padding:0 4px"><span class="mu">' + tgBasis() + '</span><a href="#" data-a="go" data-v="goals">Recalculate</a></div>' +
    (currentTarget().basis === 'Calculator + AI' && currentTarget().ai_summary ? '<p class="cap" style="margin:-6px 4px 0;line-height:1.5">' + esc(currentTarget().ai_summary) + '</p>' : '') +
    '<div class="between" style="align-items:center"><h2 class="sec">Macros</h2>' + track('tgMode', ['Grams', 'Percent'], t.mode, 'Enter macros as', {tight: true, style: 'border-radius:14px'}) + '</div>' +
    '<div class="col" style="gap:14px">' + macro('protein_g', 'Protein', 4, COLOR.p) + macro('carbs_g', 'Carbs', 4, COLOR.c) + macro('fat_g', 'Fat', 9, COLOR.f) + '</div>' +
    '<p class="cap" data-part="tgsum">These add up to ' + fmt(mk) + ' kcal (4 per gram of protein and carbs, 9 per gram of fat)' + (Math.abs(diff) < 5 ? ', matching your calorie target.' : ', ' + fmt(Math.abs(diff)) + (diff < 0 ? ' under' : ' over') + ' your calorie target.') + '</p>' +
    '<div class="raised r22 col" style="padding:6px 16px">' + lim('fiber_min_g', t.fiber_on, 'Fiber, at least', 'g') + '<div class="sep"></div>' + lim('sugar_max_g', t.sugar_on, 'Sugar, at most', 'g') + '<div class="sep"></div>' + lim('sodium_max_mg', t.sodium_on, 'Sodium, at most', 'mg') + '</div>' +
    '<p class="cap">Changes apply from today. Past days are still compared with the target they had.</p>' +
    // greyed out until something would actually change; a marked part, so it updates while typing
    (S.ui.busy || tgChanged() ? '<button data-part="tg-save" class="cta btn" data-a="saveTargets" style="height:54px">' + (S.ui.busy ? '<span class="spinglow"><span class="spin"></span></span>' : 'Save targets') + '</button>'
      : '<button data-part="tg-save" class="cta btn idle" disabled style="height:54px">Save targets</button>') +
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
    '<div class="row" style="min-height:58px;font-size:14px;gap:12px"><span class="grow">Theme</span>' + track('setTheme', THEMES, currentTheme(), 'Theme', {tight: true}) + '</div>' +
    '<p class="cap" style="margin:-4px 0 10px;line-height:1.45">Saved to your Sheet, so it follows you to any device.</p><div class="sep"></div>' +
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
    (d !== t0 ? '<button class="raised-sm" data-a="day" data-v="today" style="height:36px;padding:0 14px;border-radius:12px;font-size:13px;color:var(--link);font-weight:500">Back to today</button>' : '') + '</div></header>' +
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
    '<div class="cam' + (L.img ? '' : ' empty') + '">' + (L.img ? '<img class="shot" src="' + safeImg(L.img) + '" alt="Your photo">' :
      '<button data-a="shoot" class="col camhint" style="align-items:center;gap:10px;font-size:14px;text-align:center">' + icon('camera', 40, 1.4) + '<span>Photograph your plate<br>or a nutrition label</span></button>') +
    corners +
    '<header style="position:absolute;left:18px;right:18px;top:22px;display:flex;align-items:center">' +
    '<button class="gb" data-a="closeLog" aria-label="Close" style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center">' + icon('close', 18, 2) + '</button></header></div>' +
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
    (photo.src ? '<div class="th" role="img" aria-label="Meal photo" style="width:56px;height:56px;background-image:url(\'' + safeImg(photo.src) + '\')"></div>' : thumbEl(m, 56)) +
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
    '<div class="cap"' + (left < 0 ? ' style="color:var(--ov)"' : '') + '>After ' + esc(tl) + ': ' + fmt(Math.abs(left)) + ' kcal ' + (left < 0 ? 'over' : 'left') + '</div></div></div>' +
    (D.ai ? '<div class="glass-soft r16 row" style="padding:10px 12px;gap:12px">' + confDots(D.ai.confidence) +
      '<div style="font-size:13px;color:var(--mu);line-height:1.35"><span style="color:var(--tx)">' + CONF_TEXT[D.ai.confidence in CONF_TEXT ? D.ai.confidence : 'medium'] + '.</span> ' + esc(D.ai.reason || '') + '</div></div>' : '') +
    '</section>' +
    '<div class="between" style="align-items:center"><h2 class="sec">' + plural(D.items.length, 'item') + '</h2><button class="raised-sm" data-a="addItem" style="height:40px;padding:0 14px;border-radius:14px;font-size:13px;font-weight:600;color:var(--link)">Add an item</button></div>' +
    D.items.map(card).join('') +
    (D.items.length ? '<div class="cap" style="display:flex;justify-content:space-between;gap:8px;padding:0 4px;flex-wrap:wrap"><span>Sugar ' + fmt(t.sugar_g) + ' g</span><span>Fiber ' + fmt(t.fiber_g) + ' g</span><span>Sodium ' + fmt(t.sodium_mg) + ' mg</span><span>estimates</span></div>' : '<p class="cap" style="text-align:center">No items. Add one to save this meal.</p>') +
    when +
    (isNew ? '' : '<div class="col" style="gap:6px"><label for="rv-note" class="lb">Note</label><input id="rv-note" class="fld" data-in="draftNote" value="' + esc(m.note || '') + '" placeholder="Optional"></div>') +
    '<div class="grow"></div>' +
    // editing: the meal as shown here (edits included) can also go to today or another day; this one stays as it is
    (isNew ? '' : '<div class="row" style="gap:10px"><button class="raised-sm grow" data-a="draftToToday"' + (D.items.length ? '' : ' disabled') + ' style="height:48px;border-radius:16px;font-size:14px;color:var(--link)">Add to today</button>' +
      '<button class="raised-sm grow" data-a="draftToDay"' + (D.items.length ? '' : ' disabled') + ' style="height:48px;border-radius:16px;font-size:14px;color:var(--link)">Add to another day</button></div>') +
    '<div class="row">' + (isNew ? '<button class="raised-sm" data-a="discardDraft" style="height:56px;padding:0 20px;border-radius:20px;font-size:15px;color:var(--mu);white-space:nowrap">Cancel</button>' : '<button class="raised-sm" data-a="deleteMeal" data-v="' + esc(m.meal_id) + '" style="height:56px;padding:0 18px;border-radius:20px;font-size:15px;color:var(--ov);white-space:nowrap">Delete meal</button>') +
    '<button class="cta btn grow" data-a="saveDraft"' + (D.items.length ? '' : ' disabled') + '>' + (isNew ? 'Save to ' + tl : 'Save changes') + '</button></div></div>';
};

/* ---------- Edit an item (also adds or edits a saved dish) ---------- */
SCREENS.edit = () => {
  const E = S.edit; if (!E) return SCREENS.review();
  const it = E.item, u = it.serving_unit || 'serving', g = num(it.grams_per_unit), q = num(it.quantity) || 1;
  const units = UNITS.includes(u) ? UNITS : UNITS.concat([u]);
  const origG = num(E.orig.grams_per_unit) * (num(E.orig.quantity) || 1), nowG = g * q;
  const chk = macroCheck(it);
  const cell = (k, span) => {
    const c = {protein_g: COLOR.p, carbs_g: COLOR.c, fat_g: COLOR.f2}[k];
    const lab = '<div class="vl"' + (c ? ' style="color:' + c + '"' : '') + '>' + VALUE_LABEL[k] + '</div>';
    if (E.manual) return '<label class="v"' + (span ? ' style="grid-column:span 2"' : '') + '>' + lab + '<span class="row" style="gap:4px"><input type="number" inputmode="decimal" step="any" value="' + (has(it[k]) ? r1(it[k]) : '') + '" data-in="itemVal" data-k="' + k + '" aria-label="' + VALUE_LABEL[k] + ', ' + VALUE_UNIT[k] + '"' + (span ? ' style="font-size:22px;font-weight:250"' : '') + '><span class="cap">' + VALUE_UNIT[k] + '</span></span></label>';
    return '<div class="v"' + (span ? ' style="grid-column:span 2"' : '') + '>' + lab + '<div class="vv"' + (span ? ' style="font-size:24px;font-weight:250"' : '') + '>' + (has(it[k]) ? fmt(it[k], k === 'kcal' || k === 'sodium_mg' ? 0 : 1) + ' ' + VALUE_UNIT[k] : '—') + '</div></div>';
  };
  const nameChanged = E.orig.name && it.name !== E.orig.name;
  const forLabel = u === 'g' || g ? fmt(nowG) + ' g' : fmt(q, 2) + ' ' + unitWord(u, q);
  return '<div class="scr">' + backHeader(E.idx < 0 ? 'Add an item' : 'Edit item') +
    '<div class="col" style="gap:6px"><label for="ei-name" class="lb">Food</label><input id="ei-name" class="fld" data-in="itemName" value="' + esc(it.name || '') + '" placeholder="For example: grilled chicken" autocomplete="off">' +
    '<span class="cap" data-part="ei-cap">' + (nameChanged ? 'Changed from ' + esc(lc1(E.orig.name)) + '. Get new values for this item only.' : '') + '</span></div>' +
    '<div class="row" style="gap:10px"><button data-part="ei-ask" class="raised-sm" data-a="askAI" style="flex:1;height:44px;border-radius:14px;font-size:14px;color:var(--link);font-weight:500"' + (it.name && !E.busy ? '' : ' disabled') + '>' + (E.busy ? '<span class="spinglow"><span class="spin"></span></span>' : (E.orig.name ? 'Ask the AI again' : 'Ask the AI')) + '</button>' +
    '<button class="' + (E.manual ? 'pressed-sm' : 'raised-sm') + '" data-a="manual" aria-pressed="' + !!E.manual + '" style="flex:1;height:44px;border-radius:14px;font-size:14px;' + (E.manual ? 'color:var(--link)' : '') + '">Enter my own</button></div>' +
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
    (Lb.img ? '<img src="' + safeImg(Lb.img) + '" alt="Photo of the nutrition label" style="width:100%;height:100%;object-fit:cover">' : icon('label', 32, 1.4)) + '</div>' +
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
    '<div class="row"><button class="raised-sm" data-a="discardDraft" style="height:56px;padding:0 20px;border-radius:20px;font-size:15px;color:var(--mu);white-space:nowrap">Cancel</button>' +
    '<button data-part="ls-save" class="cta btn grow" data-a="saveLabel"' + (!has(ps.kcal) ? ' disabled' : '') + '>Save to ' + esc(lc1(Lb.meal_type)) + '</button></div></div>';
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
    '<button data-a="copyChange" data-v="' + esc(x.m.meal_id) + '" style="font-size:12px;color:var(--link)">Change amount</button></div></div>';
  const foodRow = x => '<div class="lrow"><button class="grow" data-a="pastItemChange" data-v="' + esc(x.e.entry_id) + '" style="text-align:left;min-width:0">' +
    '<span style="display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.e.name) + '</span>' +
    '<span class="cap" style="display:block">' + esc(amountLabel(x.e)) + ', had ' + (x.count === 1 ? 'once' : plural(x.count, 'time')) + '</span></button>' +
    '<span style="font-size:14px;color:var(--mu)">' + fmt(x.e.kcal) + '</span>' +
    '<button class="add" data-a="addPastItem" data-v="' + esc(x.e.entry_id) + '" aria-label="Add ' + esc(lc1(x.e.name)) + '">+</button></div>';
  const head = t => '<h2 class="h13" style="padding:0">' + t + '</h2>';
  let body;
  if (!P.meals.length) body = '<p class="cap" style="text-align:center;padding:12px 0">Meals you log show up here, so you can add them again in one tap.</p>';
  else if (words.length && !meals.length && !foods.length) body = '<p class="cap" style="text-align:center;padding:8px 0 0">Nothing you\'ve logged matches “' + esc(q) + '”.</p>' +
    '<button class="raised-sm btn2" data-a="newFood" style="color:var(--link)">Add “' + esc(q) + '” as a new food</button>';
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
