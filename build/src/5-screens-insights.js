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
  const prevM = ymd(new Date(y, mo - 2, 1)).slice(0, 7), nextM = ymd(new Date(y, mo, 1)).slice(0, 7), canNext = nextM <= t.slice(0, 7);
  const end = ym === t.slice(0, 7) ? t : first.slice(0, 8) + pad(daysIn);
  const list = rangeDays(first, end).reverse().filter(logged).slice(0, 8);
  const dayRow = (d, i) => {
    const st = dayStatus(d), tt = totalsOn(d), tg = num(targetFor(d).kcal);
    return '<button class="dr mrow ' + (i === 0 && d === t ? 'pressed-sm' : 'raised-sm') + '" data-a="go" data-v="day" data-d="' + d + '"><span class="grow"><span style="display:block;font-size:15px">' + (d === t ? 'Today, ' + MON3[parseDay(d).getMonth()] + ' ' + parseDay(d).getDate() : longDay(d)) + '</span>' +
      '<span class="cap" style="display:block' + (st === 'over' ? ';color:var(--ov)' : '') + '">' + (st === 'over' ? fmt(tt.kcal - tg) + ' kcal over' : plural(tt.meals, 'meal') + ', on target') + '</span></span><span style="font-size:15px">' + fmt(tt.kcal) + '</span><span class="mu">' + icon('next', 16, 2) + '</span></button>';
  };
  return '<div class="scr tabbed" style="gap:16px"><header class="between" style="align-items:center"><h1 class="title">History</h1><div class="row" style="gap:8px">' +
    '<button class="ib ib40" data-a="month" data-v="' + prevM + '" aria-label="Previous month">' + icon('back', 16, 2) + '</button>' +
    '<span style="font-size:15px;width:96px;text-align:center" aria-live="polite">' + MONTHS[mo - 1] + (y !== new Date().getFullYear() ? ' ' + y : '') + '</span>' +
    '<button class="ib ib40" data-a="month" data-v="' + nextM + '" aria-label="Next month"' + (canNext ? '' : ' disabled style="color:var(--mu);opacity:.5"') + '>' + icon('next', 16, 2) + '</button></div></header>' +
    '<section class="raised r26" style="padding:14px;display:flex;flex-direction:column;gap:6px">' +
    '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;font-size:11px;color:var(--mu);text-align:center" aria-hidden="true">' + heads.map(h => '<span>' + h + '</span>').join('') + '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">' + cells + '</div>' +
    '<div class="row" style="gap:14px;font-size:11px;color:var(--mu);margin-top:6px;padding:0 4px;flex-wrap:wrap">' +
    '<span class="row" style="gap:5px"><span class="dot on"></span>On target</span><span class="row" style="gap:5px"><span class="dot over"></span>Over</span><span class="row" style="gap:5px"><span class="dot none"></span>Nothing logged</span></div></section>' +
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
  return {from: addDays(t, r === '7 days' ? -6 : -29), to: t, r};
}
SCREENS.trends = () => {
  const {from, to, r} = trendRange(), t = today();
  const days = rangeDays(from, to), done = days.filter(d => logged(d) && d !== t);
  const loggedN = days.filter(logged).length;
  const head = '<header class="between" style="align-items:center"><h1 class="title">Trends</h1>' + track('range', ['7 days', '30 days', 'Custom'], r, 'Range', {tight: true}) + '</header>' +
    (r === 'Custom' ? '<div class="row" style="gap:10px"><label class="col grow" style="gap:4px"><span class="lb">From</span><input type="date" class="fld sm" data-in="custom" data-k="from" value="' + from + '" max="' + t + '"></label><label class="col grow" style="gap:4px"><span class="lb">To</span><input type="date" class="fld sm" data-in="custom" data-k="to" value="' + to + '" max="' + t + '"></label></div>' : '');
  if (loggedN < 3) return '<div class="scr tabbed">' + head + '<section class="raised r26 col" style="padding:28px 20px;gap:14px;align-items:center;text-align:center">' + iconWell('bars') +
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
  const lineB = (tgNow / maxK) * (H - 6) + 3;
  const labels = days.map((d, i) => '<span style="flex:1;min-width:0;' + (d === t ? 'color:var(--a);font-weight:600' : '') + '">' + (!many ? WD3[parseDay(d).getDay()][0] : (i % 5 === 0 || d === t) ? parseDay(d).getDate() : '') + '</span>').join('');
  const diffs = done.map(d => ({d, x: totalsOn(d).kcal - num(targetFor(d).kcal)}));
  const closest = diffs.slice().sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0], furthest = diffs.slice().sort((a, b) => Math.abs(b.x) - Math.abs(a.x))[0];
  const dlab = o => o ? WD3[parseDay(o.d).getDay()] + (many ? ' ' + parseDay(o.d).getDate() : '') + ', ' + fmt(Math.abs(o.x)) + (o.x > 0 ? ' over' : ' under') : '—';
  const tot = zero(); days.filter(logged).forEach(d => VALUES.forEach(v => tot[v] += totalsOn(d)[v]));
  const sh = macroShares(tot), gs = macroShares(targetFor(to));
  const split = (l, a, g, c) => '<div><div class="between"><span>' + l + ' ' + Math.round(a * 100) + '%</span><span class="mu">' + Math.round(g * 100) + '%</span></div><div class="col" style="gap:2px"><div style="height:6px;border-radius:3px;width:' + clamp(a * 200, 2, 100) + '%;background:' + c + '"></div><div class="pressed-sm" style="height:6px;border-radius:3px;width:' + clamp(g * 200, 2, 100) + '%"></div></div></div>';
  return '<div class="scr tabbed">' + head +
    '<section class="raised r26" style="padding:16px;display:flex;flex-direction:column;gap:12px"><div class="between">' +
    '<div><div class="num" style="font-size:30px">' + fmt(avgK) + '</div><div class="cap">average kcal a day</div></div>' +
    '<div style="text-align:right"><div class="num" style="font-size:30px">' + onT + ' of ' + done.length + '</div><div class="cap">days on target</div></div></div>' +
    '<div role="img" aria-label="Daily calories for ' + days.length + ' days against a target of ' + fmt(tgNow) + ' kcal. ' + onT + ' of ' + done.length + ' completed days on target." style="position:relative;height:' + (H + 6) + 'px;display:flex;align-items:flex-end;gap:' + (many ? 3 : 12) + 'px;padding:0 4px">' +
    '<div style="position:absolute;left:0;right:0;bottom:' + lineB.toFixed(0) + 'px;border-top:1.5px dashed var(--mu);opacity:.8;z-index:1;pointer-events:none"></div>' +
    '<div style="position:absolute;left:0;bottom:' + (lineB + 4).toFixed(0) + 'px;font-size:11px;color:var(--mu);background:var(--g);padding:1px 6px 1px 0;border-radius:0 6px 6px 0;z-index:2">Target ' + fmt(tgNow) + '</div>' + bars + '</div>' +
    '<div class="row" style="gap:' + (many ? 3 : 12) + 'px;padding:0 4px;font-size:12px;color:var(--mu);text-align:center" aria-hidden="true">' + labels + '</div>' +
    '<div class="row" style="gap:10px;font-size:12px"><div class="pressed-sm" style="flex:1;border-radius:12px;padding:8px 10px"><div class="mu">Closest day</div><div>' + dlab(closest) + '</div></div>' +
    '<div class="pressed-sm" style="flex:1;border-radius:12px;padding:8px 10px"><div class="mu">Furthest day</div><div' + (furthest && furthest.x > 0 ? ' class="ov"' : '') + '>' + dlab(furthest) + '</div></div></div></section>' +
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
  const m = S.ui.measure || 'Calories', key = {Calories: 'kcal', Protein: 'protein_g', Sugar: 'sugar_g', Sodium: 'sodium_mg'}[m], unit = VALUE_UNIT[key];
  const from = addDays(today(), -29), ids = new Set(S.data.meals.filter(x => x.date >= from).map(x => x.meal_id));
  const es = S.data.entries.filter(e => ids.has(e.meal_id));
  const total = sum(es, e => e[key]);
  const byCat = {}; CATEGORIES.forEach(c => byCat[c] = 0); es.forEach(e => { const c = CATEGORIES.includes(e.category) ? e.category : 'other'; byCat[c] += num(e[key]); });
  const cats = CATEGORIES.map(c => [c, byCat[c]]).sort((a, b) => b[1] - a[1]);
  const top = cats.length ? cats[0][1] : 0;
  const byFood = {}; es.forEach(e => { const k = e.name; const f = byFood[k] = byFood[k] || {name: k, v: 0, q: 0, unit: e.serving_unit, label: e.serving_label}; f.v += num(e[key]); f.q += num(e.quantity) || 1; });
  const foods = Object.values(byFood).sort((a, b) => b.v - a.v).slice(0, 5);
  const amt = f => f.unit === 'g' ? fmt(f.q, 1) + ' portions' : f.label && /piece|stick|sachet|plate/.test(f.label) ? plural(f.q, f.label.replace(/^1 /, '').split(',')[0]) : plural(f.q, f.unit || 'serving');
  return '<div class="scr">' + backHeader('Where calories come from', {sub: 'Last 30 days', small: true}) +
    track('measure', ['Calories', 'Protein', 'Sugar', 'Sodium'], m, 'Measure') +
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
