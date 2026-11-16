/* ---------- Food suggestions ----------
   Opt-in (Settings, saved to the Sheet). A card on Today opens a sheet with two lists: the person's
   own past meals and foods that fit what's left (worked out here, no AI), and four new ideas from the
   AI. Logging any of them opens the usual review screen, so nothing is saved without a look. */
const sugOn = () => setting('suggest', 'off') === 'on';
/* the meal the ideas are for: by the clock today, otherwise the first main meal not logged yet */
function sugType(d) {
  if (d === today()) return mealForNow();
  const types = mealsOn(d).map(m => m.meal_type);
  return ['Breakfast', 'Lunch', 'Dinner'].find(x => !types.includes(x)) || 'Snack';
}
/* what's left of the day's targets; sugar and sodium are room under their limits (no limit: plenty) */
function sugLeft(d) {
  const t = totalsOn(d), tg = targetFor(d), left = (a, b) => Math.max(0, r0(num(a) - num(b)));
  return {kcal: left(tg.kcal, t.kcal), protein_g: left(tg.protein_g, t.protein_g), carbs_g: left(tg.carbs_g, t.carbs_g), fat_g: left(tg.fat_g, t.fat_g),
    fiber_g: left(tg.fiber_min_g, t.fiber_g), sugar_g: num(tg.sugar_max_g) > 0 ? left(tg.sugar_max_g, t.sugar_g) : 300, sodium_mg: num(tg.sodium_max_mg) > 0 ? left(tg.sodium_max_mg, t.sodium_mg) : 9000};
}
const sugTotals = es => VALUES.reduce((o, k) => (o[k] = sum(es, e => num(e[k])), o), {});
/* How well something fits what's left: credit for closing gaps (protein counts double, fibre a bit),
   a penalty for running past what's left. Too big for the calories left: not a fit at all. When the
   day's calories are used up, only something light (about 150 kcal) can fit. */
function sugScore(v, L, tg) {
  const k = num(v.kcal); if (k < 30) return -1;
  const room = Math.max(L.kcal, 150);
  if (k > room * 1.15 + 40) return -1;
  const T = {p: num(tg.protein_g) || 100, c: num(tg.carbs_g) || 200, f: num(tg.fat_g) || 60, fi: num(tg.fiber_min_g) || 25};
  const part = (x, left, tot) => Math.min(num(x), left) / tot, over = (x, left, tot) => Math.max(0, num(x) - left) / tot;
  return 2 * part(v.protein_g, L.protein_g, T.p) + part(v.carbs_g, L.carbs_g, T.c) + part(v.fat_g, L.fat_g, T.f) + 0.8 * part(v.fiber_g, L.fiber_g, T.fi)
    - 1.5 * (over(v.carbs_g, L.carbs_g, T.c) + over(v.fat_g, L.fat_g, T.f) + 0.3 * over(v.protein_g, L.protein_g, T.p)) - 0.5 * Math.max(0, k - L.kcal) / room;
}
/* Past meals and saved foods that fit, best first: two of each when both kinds fit, up to four. */
function sugLocal(d, L, type) {
  const tg = targetFor(d), eaten = new Set(mealsOn(d).map(m => mealName(m).toLowerCase())), seen = new Set(), all = [];
  pastIndex().meals.slice(0, 150).forEach(x => {
    const k = x.name.toLowerCase(); if (eaten.has(k) || seen.has(k)) return; seen.add(k);
    const v = sugTotals(itemsOf(x.m.meal_id));
    all.push({kind: 'meal', id: x.m.meal_id, name: x.name, sub: 'Last had ' + relDay(x.m.date), v, score: sugScore(v, L, tg) + (x.m.meal_type === type ? 0.15 : 0)});
  });
  S.data.favorites.filter(f => f.pinned || num(f.use_count) > 0).forEach(f => {
    const k = String(f.name || '').trim().toLowerCase(); if (!k || seen.has(k) || eaten.has(k)) return; seen.add(k);
    const v = VALUES.reduce((o, x) => (o[x] = num(f[x]), o), {});
    all.push({kind: 'food', id: f.food_id, name: f.name, sub: servingLabel(f) + (f.pinned ? ', saved' : ''), v, score: sugScore(v, L, tg) + (f.pinned ? 0.1 : 0)});
  });
  const fit = all.filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  const pick = fit.filter(x => x.kind === 'meal').slice(0, 2).concat(fit.filter(x => x.kind === 'food').slice(0, 2));
  fit.forEach(x => { if (pick.length < 4 && !pick.includes(x)) pick.push(x); });
  return pick.sort((a, b) => b.score - a.score);
}
/* the gap line under a heading: what's left, and the protein still to go */
function sugGap(L, d) {
  const t = totalsOn(d), tg = targetFor(d), pShort = r0(num(tg.protein_g) - t.protein_g);
  return L.kcal >= 50 ? fmt(L.kcal) + ' kcal left' + (pShort >= 5 ? ' · protein ' + fmt(pShort) + ' g short' : '')
    : 'You\'ve reached your calories. Light ideas if you\'re still hungry';
}
function sugCard(d) {
  if (!sugOn()) return '';
  return '<section class="pressed-sm r22 col" aria-label="Food suggestions" style="gap:12px;padding:14px 16px">' +
    '<div class="row" style="gap:10px"><span style="color:var(--ai);display:flex">' + icon('spark', 20) + '</span>' +
    '<div class="grow"><div style="font-size:15px;font-weight:500">' + sugType(d) + ' ideas</div><div class="cap">' + esc(sugGap(sugLeft(d), d)) + '</div></div></div>' +
    '<button class="raised-sm btn2" data-a="sugOpen" style="height:46px;border-radius:15px">Suggest something</button></section>';
}
/* what's in a suggestion: the items with amounts, for a past meal, a saved food or an AI idea */
function sugItems(x) {
  if (x.kind === 'meal') return itemsOf(x.id).map(e => ({name: e.name, amount: amountLabel(e), kcal: num(e.kcal)}));
  if (x.kind === 'food') return [{name: x.name, amount: x.sub.replace(/, saved$/, ''), kcal: num(x.v.kcal)}];
  return (x.items || []).map(e => ({name: e.name, amount: amountLabel(e), kcal: num(e.kcal)}));
}
/* Tapping a suggestion opens its details under it: calories, macros and micros, what's in it, and
   for an AI idea that came with one, the recipe. */
function sugDetail(x) {
  const v = x.v, cell = (label, val, unit, color) => '<div class="col" style="gap:2px;min-width:0"><span class="cap">' + label + '</span><span style="font-size:14px' + (color ? ';color:' + color : '') + '">' + fmt(r0(num(val))) + ' ' + unit + '</span></div>';
  const grid = '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 8px">' +
    cell('Calories', v.kcal, 'kcal', 'var(--ai)') + cell('Protein', v.protein_g, 'g', 'var(--p)') + cell('Carbs', v.carbs_g, 'g', 'var(--c)') + cell('Fat', v.fat_g, 'g', 'var(--f)') +
    cell('Sugar', v.sugar_g, 'g') + cell('Fiber', v.fiber_g, 'g') + cell('Sodium', v.sodium_mg, 'mg') + '</div>';
  const items = sugItems(x), r = x.recipe || {};
  const list = items.length > 1 || x.kind !== 'food' ? '<div class="col" style="gap:4px"><span class="cap" style="font-weight:500">What\'s in it</span>' +
    items.map(e => '<div class="between" style="font-size:13px;gap:10px"><span style="min-width:0">' + esc(e.name) + ' <span class="mu">' + esc(e.amount) + '</span></span><span class="mu" style="flex-shrink:0">' + fmt(r0(e.kcal)) + '</span></div>').join('') + '</div>' : '';
  const recipe = (r.ingredients && r.ingredients.length) || (r.steps && r.steps.length) ?
    '<div class="col" style="gap:6px"><span class="cap" style="font-weight:500">Ingredients</span><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.5">' + (r.ingredients || []).map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' +
    (r.steps && r.steps.length ? '<span class="cap" style="font-weight:500;margin-top:4px">How to make it</span><ol style="margin:0;padding-left:20px;font-size:13px;line-height:1.5">' + r.steps.map(s => '<li style="margin-bottom:3px">' + esc(s) + '</li>').join('') + '</ol>' : '') + '</div>' : '';
  return '<div class="pressed-sm col" style="gap:12px;margin:0 14px 12px;padding:12px 14px;border-radius:14px">' + grid + list + recipe + '</div>';
}
function sugRow(x, v, primary) {
  const G = S.sug, k = r0(num(x.v.kcal)), leaves = G.left.kcal - k, p = r0(num(x.v.protein_g)), open = G.open === v;
  return '<div class="col"><div class="row" style="gap:12px;padding:12px 14px"><button class="grow" data-a="sugDetail" data-v="' + v + '" aria-expanded="' + open + '" style="min-width:0;text-align:left;display:block">' +
    '<div style="font-size:14px;display:flex;align-items:center;gap:6px"><span style="min-width:0">' + esc(x.name) + '</span>' + (x.recipe && x.recipe.steps && x.recipe.steps.length ? '<span class="cap" style="flex-shrink:0">· recipe</span>' : '') +
    '<span aria-hidden="true" style="flex-shrink:0;display:flex;color:var(--mu);transform:rotate(' + (open ? 90 : 0) + 'deg)">' + icon('next', 12, 2.2) + '</span></div>' +
    '<div class="cap">' + fmt(k) + ' kcal' + (p >= 1 ? ' · <span style="color:var(--p)">protein +' + fmt(p) + ' g</span>' : '') + ' · ' +
      (leaves >= 0 ? 'leaves ' + fmt(leaves) + ' kcal' : '<span class="ov">' + fmt(-leaves) + ' kcal over</span>') + '</div>' +
    (x.why || x.sub ? '<div class="cap" style="margin-top:2px">' + esc(x.why || x.sub) + '</div>' : '') + '</button>' +
    '<button class="' + (primary ? 'cta' : 'raised-sm') + ' btn-sm" data-a="sugLog" data-v="' + v + '" style="height:38px;padding:0 14px;border-radius:12px;font-size:13px;flex-shrink:0' + (primary ? '' : ';color:var(--link);font-weight:500') + '" aria-label="Log ' + esc(x.name) + '">Log</button></div>' +
    (open ? sugDetail(x) : '') + '</div>';
}
const sugList = rows => '<section class="raised r20" style="display:flex;flex-direction:column">' + rows.join('<div class="sep" style="margin:0 14px"></div>') + '</section>';
function sugSheet() {
  const G = S.sug; if (!G) return '';
  const notes = (lastNotes() || {}).notes;
  const head = (t, side) => '<div class="between" style="align-items:baseline"><h3 class="sec15" style="margin:0">' + t + '</h3><span class="cap">' + side + '</span></div>';
  const ask = String(S.ui.sugAsk || '');
  const list = G.busy ? '<div class="raised r20 row" style="gap:12px;padding:16px;justify-content:center" aria-live="polite"><span class="spinglow"><span class="spin" style="--s:20px;--t:3px"></span></span><span class="cap13">Finding ideas</span></div>'
    : G.err ? '<div class="warn" role="alert"><div class="ov" style="font-weight:500">' + esc(G.err) + '</div><div class="mu" style="margin-top:2px">Your own foods above still work without the AI.</div></div>'
    : G.ideas.length ? sugList(G.ideas.map((x, i) => sugRow(x, 'a' + i, i === 0))) : '';
  // what to ask: optional, kept between openings; the button is the only thing that calls the AI
  const askBox = '<label for="sug-ask" class="sr">Ask the AI</label>' +
    '<textarea id="sug-ask" rows="3" maxlength="600" class="fld" data-in="sugAsk" placeholder="Optional. I only have eggs… I have chicken, pechay and garlic, what can I make? Where can I add protein powder?">' + esc(ask) + '</textarea>';
  const label = G.err ? 'Try again' : G.ideas.length && ask.trim() === (G.asked || '') ? 'More ideas' : 'Ask AI for ideas';
  const ai = list + askBox +
    '<button class="' + (G.ideas.length ? 'raised-sm btn2' : 'cta btn') + '" data-a="sugMore"' + (G.busy ? ' disabled style="opacity:.55"' : '') + '>' + label + '</button>';
  return '<div class="scrim" data-a="sugClose"><div class="menu glass sugsheet" role="dialog" aria-modal="true" aria-label="' + G.type + ' ideas" data-stop="1">' +
    '<div aria-hidden="true" style="width:40px;height:5px;border-radius:3px;background:var(--mu);opacity:.5;align-self:center;margin-top:-6px"></div>' +
    '<div class="row" style="gap:12px;align-items:flex-start"><div class="grow"><h2 class="title22" style="margin:0">' + G.type + ' ideas</h2>' +
    '<p class="cap" style="margin-top:4px">' + esc(sugGap(G.left, G.d)) + (G.left.kcal >= 50 ? ' · carbs ' + fmt(G.left.carbs_g) + ' g · fat ' + fmt(G.left.fat_g) + ' g left' : '') + '</p></div>' +
    '<button class="raised-sm" data-a="sugClose" aria-label="Close" style="width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + icon('close', 16, 2.2) + '</button></div>' +
    head('From your foods', 'No AI used') +
    (G.local.length ? sugList(G.local.map((x, i) => sugRow(x, 'l' + i, false))) : '<p class="cap" style="margin:0">Nothing you\'ve logged or saved fits what\'s left yet. The ideas below are made for it.</p>') +
    head('New ideas', notes ? 'From AI · fits your notes' : 'From AI') + ai +
    '<p class="cap" style="text-align:center;margin:0">Each set of ideas uses 1 AI analysis. Estimates, not medical advice.</p></div></div>';
}
