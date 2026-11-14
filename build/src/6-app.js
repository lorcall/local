/* ---------- router, rendering, events ---------- */
const TABS = ['today', 'trends', 'history', 'targets'];
const app = () => document.getElementById('app');
let lastRoute = '';

function render() {
  const a = document.activeElement, fid = a && a.id;
  let sel = null; try { if (a && a.setSelectionRange && a.type !== 'number') sel = [a.selectionStart, a.selectionEnd]; } catch (e) { /* ignore */ }
  const name = route().name, same = name === lastRoute, y = window.scrollY;
  const before = same ? selSnapshot() : null;
  app().innerHTML = (SCREENS[name] || SCREENS.today)() + overlays();
  placeTile();
  if (S.ui.openSwipe) { const s = app().querySelector('[data-swipe="' + CSS.escape(S.ui.openSwipe) + '"]'); if (s) s.classList.add('open'); }
  if (same) window.scrollTo(0, y); else { window.scrollTo(0, 0); const h = app().querySelector('h1'); if (h && !fid) { h.setAttribute('tabindex', '-1'); h.focus({preventScroll: true}); } }
  if (fid && same) { const el = document.getElementById(fid); if (el) { el.focus({preventScroll: true}); try { if (sel) el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* ignore */ } } }
  lastRoute = name;
  selMotion(before);
  flushThumbs();
  syncPlace();
}
/* Swap only computed regions, so a field being typed in keeps focus and the keyboard stays up. */
function refreshParts() {
  const tpl = document.createElement('div'); tpl.innerHTML = (SCREENS[route().name] || SCREENS.today)();
  document.querySelectorAll('#app [data-part]').forEach(el => {
    if (el.contains(document.activeElement)) return;
    const n = tpl.querySelector('[data-part="' + el.getAttribute('data-part') + '"]');
    if (n) el.replaceWith(n);
  });
  placeAllSel();
}
function overlays() {
  let h = '';
  if (S.menu) h += '<div class="scrim" data-a="menuClose"><div class="menu glass" role="dialog" aria-modal="true" aria-label="' + esc(S.menu.title || 'Options') + '" data-stop="1">' +
    (S.menu.title ? '<div class="sec15" style="text-align:center">' + esc(S.menu.title) + '</div>' : '') + (S.menu.text ? '<p class="cap13" style="text-align:center;line-height:1.45">' + esc(S.menu.text) + '</p>' : '') +
    S.menu.items.map((it, i) => '<button class="mi ' + (it.primary ? 'cta' : 'raised-sm') + '" data-a="menuPick" data-v="' + i + '"' + (it.danger ? ' style="color:var(--ov)"' : '') + '>' + esc(it.label) + '</button>').join('') +
    '<button class="mi" data-a="menuClose" style="color:var(--mu)">Cancel</button></div></div>';
  if (S.viewer) h += '<div class="scrim" data-a="closeViewer" style="align-items:center;padding:20px;background:rgba(10,10,14,.88)"><div class="col" role="dialog" aria-modal="true" aria-label="Meal photo" data-stop="1" style="gap:14px;align-items:center;width:min(100%,430px)">' +
    '<div style="position:relative;width:100%;border-radius:24px;overflow:hidden;background:#15161B;box-shadow:0 20px 40px -10px rgba(0,0,0,.8)">' +
    (S.viewer.src ? '<img src="' + safeImg(S.viewer.src) + '" alt="Meal photo" style="display:block;width:100%;max-height:70vh;object-fit:contain' + (S.viewer.loading ? ';filter:blur(6px);opacity:.7' : '') + '">' : '<div style="height:260px"></div>') +
    (S.viewer.loading ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span class="spinglow"><span class="spin" style="--s:40px;--t:5px"></span></span></div>' : '') + '</div>' +
    (S.viewer.msg ? '<p class="cap13" style="text-align:center">' + esc(S.viewer.msg) + '</p>' : '') +
    '<button class="raised-sm" data-a="closeViewer" style="height:46px;padding:0 22px;border-radius:16px;font-size:15px">Close</button></div></div>';
  if (S.toast) h += '<div class="toast glass' + (TABS.includes(route().name) ? '' : ' notab') + '" role="status"><span>' + esc(S.toast.text) + '</span>' + (S.toast.undo ? '<button data-a="undo" style="color:var(--link);font-weight:600">Undo</button>' : '') + '</div>';
  return h;
}
let toastTimer = null;
function toast(text, undo) { S.toast = {text, undo}; clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = null; const t = document.querySelector('.toast'); if (t) t.remove(); syncPlace(); }, undo ? 5000 : 2600); render(); }
function menu(m) { S.menu = m; render(); const b = document.querySelector('.menu button'); if (b) b.focus(); }
function confirmBox(title, text, label, fn) { menu({title, text, items: [{label, danger: true, fn}]}); }

function go(name, p = {}) { S.stack.push({name, p}); S.ui.openSwipe = null; pushHistory(); render(); }
function replace(name, p = {}) { S.stack[S.stack.length - 1] = {name, p}; render(); }
/* The goal calculator's weight is a weigh-in too. Older profiles never wrote one, so once, if the
   Weight sheet is empty, it's added on the day the first target was set (when the calculator ran). */
function seedWeight() {
  const p = profile();
  if (S.data.weight.length || !(num(p.weight) >= 20) || setting('weight_seeded', '') === 'yes') return;
  const firstTarget = S.data.targets.map(x => x.effective_date).filter(Boolean).sort()[0];
  const date = p.measured_on || firstTarget || firstDay() || today();
  const row = {date: date > today() ? today() : date, kg: r1(num(p.weight)), note: 'From goal calculator'};
  S.data.weight = [row]; S.data.settings.weight_seeded = 'yes';
  queueJob({kind: 'weight', row, label: 'starting weight'});
  queueJob({kind: 'settings', values: {weight_seeded: 'yes'}, label: 'starting weight'});
}

/* ---------- background saving ----------
   Every write is a job: kept in order, run one at a time, and stored on the device until done, so
   a save survives the app being closed mid-way (it's replayed and finished on the next open). A
   failed job stays at the front with a Retry, and nothing after it runs until it succeeds. */
const SYNC_KEY = 'local-pending-v1';
const SYNC = {jobs: [], running: false, hideT: 0, last: null};
function syncStore() { try { localStorage.setItem(SYNC_KEY, JSON.stringify(SYNC.jobs)); } catch (e) { /* full or blocked: still runs this session */ } }
function syncLoad() { try { const j = JSON.parse(localStorage.getItem(SYNC_KEY) || '[]'); return Array.isArray(j) ? j : []; } catch (e) { return []; } }
function queueJob(job) { job.job = uid('job'); SYNC.jobs.push(job); syncStore(); syncRun(); }
/* what a job looks like once done, applied to the in-memory log (used when replaying after a reload) */
function syncApplyLocal(j) {
  if (j.kind === 'meal') { const m = Object.assign({}, j.meal); if (m.thumb) { S.photos[m.meal_id] = m.thumb; m.has_thumb = true; } delete m.thumb; applyMeal(normMeal(m), j.entries.map(normEntry)); }
  else if (j.kind === 'deleteMeal') { S.data.meals = S.data.meals.filter(x => x.meal_id !== j.mealId); S.data.entries = S.data.entries.filter(x => x.meal_id !== j.mealId); }
  else if (j.kind === 'targets') S.data.targets = S.data.targets.filter(x => x.effective_date !== j.row.effective_date).concat([j.row]);
  else if (j.kind === 'weight') S.data.weight = S.data.weight.filter(w => w.date !== j.row.date).concat([j.row]);
  else if (j.kind === 'weightDelete') S.data.weight = S.data.weight.filter(w => w.date !== j.date);
  else if (j.kind === 'settings') Object.assign(S.data.settings, j.values);
}
async function syncJob(j) {
  if (j.kind === 'meal') {
    const cur = S.data.meals.find(x => x.meal_id === j.meal.meal_id);
    if (j.photo && !j.meal.photo_url) {
      j.meal.photo_url = (await API.savePhoto({image: j.photo.data, mime: j.photo.mime, meal_type: j.meal.meal_type, mode: j.photo.mode})) || '';
      j.photo = null; syncStore();                       // a retry won't upload it twice
      if (cur) cur.photo_url = j.meal.photo_url;
    } else if (!j.meal.photo_url && cur && cur.photo_url) j.meal.photo_url = cur.photo_url;   // an edit made while the upload ran
    await API.saveMeal({meal: j.meal, entries: j.entries});
  } else if (j.kind === 'deleteMeal') await API.deleteMeal(j.mealId);
  else if (j.kind === 'targets') await API.saveTargets(j.row);
  else if (j.kind === 'weight') await API.addWeight(j.row);
  else if (j.kind === 'weightDelete') await API.deleteWeight(j.date);
  else if (j.kind === 'settings') await API.saveSettings(j.values);
}
async function syncRun() {
  if (SYNC.running) return;
  SYNC.running = true;
  while (SYNC.jobs.length) {
    const j = SYNC.jobs[0];
    syncShow('busy', j);
    try { await syncJob(j); SYNC.jobs.shift(); syncStore(); }
    catch (e) { SYNC.running = false; syncShow('error', j, friendly(e)); return; }
  }
  SYNC.running = false; syncShow('done');
}
const syncVerb = j => /delete/i.test(j.kind) ? ['Deleting', 'Deleted', 'Delete'] : ['Saving', 'Saved', 'Save'];
function syncShow(state, j, err) {
  let el = document.getElementById('syncpill');
  if (!el) { el = document.createElement('div'); el.id = 'syncpill'; el.className = 'syncpill glass'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
  clearTimeout(SYNC.hideT); clearTimeout(SYNC.outT); el.classList.remove('out'); el.hidden = false; syncPlace();
  const what = j ? ' ' + esc(j.label || '') : '';
  if (state === 'busy') { SYNC.last = j; el.dataset.state = 'busy'; el.title = ''; el.innerHTML = '<span class="spin" style="--s:12px;--t:2px"></span><span>' + syncVerb(j)[0] + what + '</span>'; }
  else if (state === 'error') { el.dataset.state = 'error'; el.title = err || ''; el.innerHTML = '<span class="ov" style="display:flex">' + icon('warn', 14, 2) + '</span><span>' + 'Couldn\'t ' + syncVerb(j)[2].toLowerCase() + what + '</span><button data-a="syncRetry">Retry</button>'; }
  else { const l = SYNC.last; el.dataset.state = 'done'; el.title = ''; el.innerHTML = '<span class="mango" style="display:flex">' + icon('check', 14, 2.4) + '</span><span>' + (l ? syncVerb(l)[1] + ' ' + esc(l.label || '') : 'Saved') + '</span>'; SYNC.hideT = setTimeout(() => { el.classList.add('out'); SYNC.outT = setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 320); }, 1600); }
}
/* above the tab bar where there is one, at the top otherwise, like toasts */
function syncPlace() {
  const el = document.getElementById('syncpill'); if (!el) return;
  const top = !app().querySelector('.tabbar'); el.classList.toggle('notab', top);
  // a toast in the same spot: sit just beyond it instead of on top of it, and slide back after
  const t = document.querySelector('#app .toast');
  el.style.bottom = ''; el.style.top = '';
  if (t && !el.hidden) {
    // from where the toast settles, not where its slide-in has got to
    const cs = getComputedStyle(t), h = t.offsetHeight;
    if (t.classList.contains('notab')) el.style.top = (parseFloat(cs.top) + h + 10) + 'px';
    else el.style.bottom = (parseFloat(cs.bottom) + h + 10) + 'px';
    if (t.classList.contains('notab') !== top) el.classList.toggle('notab', t.classList.contains('notab'));
  }
}

/* ---------- tab switching ----------
   The whole app redraws on every change, so a tab switch is animated from a snapshot: where the
   tile sat and the screen that was showing, taken just before the redraw. The tile then stretches
   to the new tab (front edge first, back edge catching up) and the screens glide: the old one
   drifts out toward the side being left while the new one drifts in from the side tapped toward. */
const TAB_ORDER = ['today', 'trends', 'history', 'targets'];
const calmMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
let tabGhost = null;
function placeTile() {
  const bar = app().querySelector('.tabbar'), ind = bar && bar.querySelector('.tabind');
  if (!ind) return null;
  const on = bar.querySelector('.nb[aria-current]');
  if (!on) { ind.style.opacity = '0'; return null; }
  const x = on.offsetLeft + on.offsetWidth / 2 - 24;
  ind.style.left = x + 'px'; ind.style.width = '48px'; ind.style.opacity = '1';
  return {ind, x};
}
function tabSnapshot() {
  if (tabGhost) { tabGhost.remove(); tabGhost = null; }
  const bar = app().querySelector('.tabbar'), ind = bar && bar.querySelector('.tabind'), scr = app().querySelector(':scope > .scr');
  const snap = {name: route().name, tile: null, scr: null};
  if (ind && ind.style.opacity !== '0') {
    const r = ind.getBoundingClientRect(), b = bar.getBoundingClientRect();
    snap.tile = {x: r.left - b.left, w: r.width};          // mid-stretch included, so quick taps carry on
  }
  if (scr) {
    const cs = getComputedStyle(scr), a = app().getBoundingClientRect();
    snap.scr = {el: scr, top: scr.getBoundingClientRect().top, left: a.left, width: a.width, opacity: cs.opacity, transform: cs.transform === 'none' ? 'translateX(0px)' : cs.transform};
  }
  return snap;
}
function tabMotion(snap) {
  const name = route().name;
  if (!snap || snap.name === name || calmMotion()) return;
  const i0 = TAB_ORDER.indexOf(snap.name), i1 = TAB_ORDER.indexOf(name);
  const dir = i0 < 0 || i1 < 0 ? 1 : i1 > i0 ? 1 : -1;
  // tile: stretch from where it was
  const t = placeTile();
  if (t && snap.tile && t.ind.animate) stretchTo(t.ind, snap.tile.x, snap.tile.w, t.x, 48);
  // screens: glide
  const scr = app().querySelector(':scope > .scr');
  if (scr) glideIn(scr, dir);
  ghostOut(snap.scr, dir, 0);
}
/* Lays the screen being left over the new one and lets it drift out. clip hides everything above
   that line, for a change that only swaps the lower part of a screen. */
function ghostOut(s, dir, clip) {
  if (!s || !s.el.animate) return;
  if (tabGhost) { tabGhost.remove(); tabGhost = null; }
  const old = s.el;
  old.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  old.setAttribute('aria-hidden', 'true'); old.setAttribute('inert', '');
  old.style.marginTop = s.top + 'px';
  const g = document.createElement('div');
  g.className = 'tabghost'; g.style.left = s.left + 'px'; g.style.width = s.width + 'px';
  if (clip > 0) g.style.clipPath = 'inset(' + clip + 'px 0 0 0)';
  g.appendChild(old); document.body.appendChild(g); tabGhost = g;
  const a = old.animate([{opacity: s.opacity, transform: s.transform}, {opacity: 0, transform: 'translateX(' + (-dir * 28) + 'px)'}],
    {duration: 200, easing: 'ease-in', fill: 'forwards'});
  a.onfinish = () => { if (tabGhost === g) tabGhost = null; g.remove(); };
}
const glideIn = (el, dir) => el.animate && el.animate([{opacity: 0, transform: 'translateX(' + (dir * 28) + 'px)'}, {opacity: 1, transform: 'translateX(0px)'}],
  {duration: 360, delay: 80, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards'});
/* The tile's left edge and width move together as plain layout properties. Moving it with
   transform instead let Safari run the position on the compositor with different timing from the
   width, so the far edge overshot the target; one timing curve for the whole animation, too. */
function stretchTo(ind, from, fromW, to, toW) {
  const left = Math.min(from, to), span = Math.max(from + fromW, to + toW) - left;
  ind.animate([
    {left: from + 'px', width: fromW + 'px'},
    {left: left + 'px', width: span + 'px', offset: .46},
    {left: to + 'px', width: toW + 'px'}
  ], {duration: 460, easing: 'cubic-bezier(.55,0,.3,1)'});
}

/* ---------- chip rows and tracks ----------
   Same pair of motions inside a screen: the selection stretches to the new choice, and rows that
   switch what the screen shows (data-view) glide everything below them. Every render places the
   indicators; a render that changed a selection animates from a snapshot taken just before it. */
const selGroups = () => [...app().querySelectorAll('.chips, .track')];
const selItems = g => [...g.querySelectorAll(':scope > [data-v]')];
const selOn = g => g.querySelector(':scope > [aria-checked="true"], :scope > [aria-selected="true"]');
const selKey = (g, i) => i + '|' + (g.getAttribute('aria-label') || '') + '|' + ((selItems(g)[0] || {dataset: {}}).dataset.a || '');
function placeSel(g) {
  const ind = g.querySelector(':scope > .selind'), on = selOn(g);
  if (!ind) return null;
  if (!on) { ind.style.opacity = '0'; return null; }
  // exact sub-pixel boxes: chips that share a row's width are fractions of a pixel wide
  const r = on.getBoundingClientRect(), b = g.getBoundingClientRect();
  const box = {x: r.left - b.left - g.clientLeft + g.scrollLeft, y: r.top - b.top - g.clientTop + g.scrollTop, w: r.width, h: r.height};
  ind.style.left = box.x + 'px'; ind.style.top = box.y + 'px';
  ind.style.width = box.w + 'px'; ind.style.height = box.h + 'px';
  ind.style.borderRadius = getComputedStyle(on).borderRadius; ind.style.opacity = '1';
  return {ind, box};
}
function placeAllSel() { selGroups().forEach(placeSel); placeTile(); }
function selSnapshot() {
  const groups = selGroups();
  if (!groups.length) return null;
  const scr = app().querySelector(':scope > .scr');
  const snap = {groups: groups.map((g, i) => {
    const on = selOn(g), ind = g.querySelector(':scope > .selind');
    let x = null, w = null;
    if (ind && ind.style.opacity !== '0') {                  // where it's drawn now, mid-stretch included
      const r = ind.getBoundingClientRect(), b = g.getBoundingClientRect();
      x = r.left - b.left - g.clientLeft + g.scrollLeft; w = r.width;
    }
    let a = g; while (a.parentElement && a.parentElement !== scr) a = a.parentElement;
    return {key: selKey(g, i), idx: on ? selItems(g).indexOf(on) : -1, x, w, scroll: g.scrollLeft, view: g.hasAttribute('data-view'), below: a.getBoundingClientRect().bottom};
  }), scr: null};
  if (scr) {
    const cs = getComputedStyle(scr), ar = app().getBoundingClientRect();
    snap.scr = {el: scr, top: scr.getBoundingClientRect().top, left: ar.left, width: ar.width, opacity: cs.opacity, transform: cs.transform === 'none' ? 'translateX(0px)' : cs.transform};
  }
  return snap;
}
function selMotion(before) {
  const calm = calmMotion(), scr = app().querySelector(':scope > .scr');
  let glide = null;
  selGroups().forEach((g, i) => {
    const now = placeSel(g), on = selOn(g), idx = on ? selItems(g).indexOf(on) : -1;
    const old = before && before.groups.find(o => o.key === selKey(g, i));
    const moved = !!(old && now && idx >= 0 && old.idx >= 0 && old.idx !== idx);
    if (g.classList.contains('scroll')) {
      // the chosen chip comes into view, centred where it can be; unchanged rows stay where they were scrolled
      const target = on ? Math.max(0, on.offsetLeft - (g.clientWidth - on.offsetWidth) / 2) : 0;
      if (old && !moved) g.scrollLeft = old.scroll;
      else if (moved && !calm) { g.scrollLeft = old.scroll; try { g.scrollTo({left: target, behavior: 'smooth'}); } catch (e) { g.scrollLeft = target; } }
      else g.scrollLeft = target;
    }
    if (!moved || calm || old.x == null || !now.ind.animate) return;
    stretchTo(now.ind, old.x, old.w, now.box.x, now.box.w);
    if (old.view && !glide) glide = {g, dir: idx > old.idx ? 1 : -1, clip: old.below};
  });
  if (!glide || !scr || !before.scr) return;
  ghostOut(before.scr, glide.dir, glide.clip);
  let a = glide.g; while (a.parentElement && a.parentElement !== scr) a = a.parentElement;
  for (let el = a.nextElementSibling; el; el = el.nextElementSibling) glideIn(el, glide.dir);
}

/* bring History's open day into view if it's below the fold, without jumping */
function showOpenDay() {
  const p = S.ui.hOpen && document.getElementById('hp-' + S.ui.hOpen); if (!p) return;
  const row = p.closest('.hrow'), r = row.getBoundingClientRect(), bottom = window.innerHeight - 110;   // clear of the tab bar
  if (r.bottom > bottom) window.scrollBy({top: Math.min(r.bottom - bottom, r.top - 80), behavior: calmMotion() ? 'auto' : 'smooth'});
}
/* After stepping a period, slide the new one in from the side it came from. */
function slideIn(act, dir) {
  const el = document.querySelector('[data-hswipe="' + act + '"] .swmove'); if (!el) return;
  el.classList.remove('swin-fwd', 'swin-back'); void el.offsetWidth; el.classList.add(dir > 0 ? 'swin-fwd' : 'swin-back');
}
function home(toastText) { const from = S.ui.logFrom; S.ui.logFrom = null; S.stack = [{name: from || 'today', p: {}}]; S.ui.openSwipe = null; if (toastText) toast(toastText); else render(); }
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
/* The photo being logged, to upload when its meal is saved; null if there's none or it's already up. */
function pendingPhoto(mode) {
  const L = S.log; if (!L || !L.full || L.photo_url) return null;
  return {data: L.full.data, mime: L.full.mime || 'image/jpeg', mode: mode || 'meal'};
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
/* Saves look instant: the meal shows straight away and the upload and Sheet writes run in the
   background, one at a time, with a small status pill (see the sync section below). */
function persistMeal(meal, entries, photo) {
  const m = Object.assign({}, meal), es = entries.map(e => Object.assign({}, e, {meal_id: m.meal_id}));
  if (m.thumb) { S.photos[m.meal_id] = m.thumb; m.has_thumb = true; }
  const local = Object.assign({}, m); delete local.thumb;
  applyMeal(local, es);
  queueJob({kind: 'meal', meal: m, entries: es, photo: photo || null, label: lc1(m.meal_type)});
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
  persistMeal(meal, all);
  toast((toastVerb || 'Added to') + ' ' + lc1(type) + (d === today() ? '' : ', ' + dayLabel(d)));
}
const savedText = (verb, meal) => verb + ' ' + lc1(meal.meal_type) + (meal.date === today() ? '' : ', ' + dayLabel(meal.date));
/* the thumbnail a copy of m should carry: already on screen, or fetched once */
async function thumbOf(m) {
  const t = thumbSource(m), key = t.meal_id;
  if (typeof S.photos[key] === 'string' && safeImg(S.photos[key])) return S.photos[key];
  if (!t.has_thumb && !t.thumb) return '';
  try { const map = await API.getThumbs([key]); return safeImg((map || {})[key]); } catch (e) { return ''; }
}
async function copyMealTo(id, day, type) {
  const m = S.data.meals.find(x => x.meal_id === id); if (!m) return;
  const nm = Object.assign({}, m, {meal_id: uid('meal'), date: day, time: day === today() ? nowHM() : m.time, meal_type: type || m.meal_type, source: 'copy', thumb: await thumbOf(m)});
  persistMeal(nm, copyItems(id, nm.meal_id));
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
  tab: el => { const snap = tabSnapshot(); S.ui.logFrom = null; S.stack = [{name: el.dataset.v, p: {}}]; S.ui.openSwipe = null; pushHistory(); render(); tabMotion(snap); },
  describeQ() {
    // the search words start the description; anything already written is kept
    const L = logState(), q = S.ui.sq ? S.ui.sq.q.trim() : '';
    if (q && !L.text.toLowerCase().includes(q.toLowerCase())) L.text = L.text.trim() ? L.text.trim() + '\n' + q : q;
    L.error = ''; go('describe');
  },
  go: el => {
    const v = el.dataset.v;
    if (['log', 'search', 'describe'].includes(v)) {
      const L = logState(), from = route().name, day = el.dataset.day;
      // a day picked in History logs to that day, and saving goes back there
      if (TABS.includes(from)) S.ui.logFrom = day ? from : null;
      if ((TABS.includes(from) || day) && !L.img && !L.busy) { const d = day || (from === 'today' ? viewDay() : today()); if (L.date !== d) { L.date = d; L.time = d === today() ? nowHM() : TYPE_TIME[L.meal_type]; L.timeAuto = d !== today(); } }
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
  /* Saved like every other change: applied here at once, written to the Sheet in the background.
     The notes and how the targets were reached go in the same Targets row. */
  useTargets(el) {
    const p = gcState(), g = goalCalc(p), base = gcBase(p), useAi = el && el.dataset.v === 'ai' && gcFresh(p);
    const src = useAi ? p.ai : base, notes = String(p.notes || '').trim();
    const row = {effective_date: today(), basis: useAi ? 'Calculator + AI' : 'Calculator', notes, ai_summary: useAi ? String(p.ai.summary || '') : ''};
    TG_FIELDS.forEach(([k]) => { row[k] = r0(num(src[k])); });
    const prof = Object.assign(gcProfile(p), {maintenance: g.maintenance, measured_on: today()});
    const wRow = num(p.weight) >= 20 ? {date: today(), kg: r1(num(p.weight)), note: 'From goal calculator'} : null;
    S.data.targets = S.data.targets.filter(t => t.effective_date !== row.effective_date).concat([row]);
    queueJob({kind: 'targets', row, label: 'targets'});
    const sv = {profile: JSON.stringify(prof), onboarded: 'yes'}; Object.assign(S.data.settings, sv);
    queueJob({kind: 'settings', values: sv, label: 'profile'});
    if (wRow) { const had = S.data.weight.find(w => w.date === wRow.date); if (!had || r1(had.kg) !== wRow.kg) { S.data.weight = S.data.weight.filter(w => w.date !== wRow.date).concat([wRow]); queueJob({kind: 'weight', row: wRow, label: fmt(wRow.kg, 1) + ' kg'}); } }
    S.data.settings.weight_seeded = 'yes'; S.dirty = true; S.ui.tg = null; S.ui.gc = null;
    S.stack = [{name: 'targets', p: {}}]; toast(useAi ? 'Targets set with your notes' : 'Targets set from the calculator');
  },
  async gcAsk() {
    const p = gcState(), notes = String(p.notes || '').trim();
    if (p.aiBusy || !notes) return;
    const key = gcKey(p), base = gcBase(p);
    p.aiBusy = true; p.aiErr = ''; render();
    const res = await API.adjustTargets({profile: gcProfile(p), base, notes});
    p.aiBusy = false;
    if (res.error) p.aiErr = /NO_NOTES/.test(res.error) ? 'Add a note for the AI to check against.' : friendly(res.error);
    else { p.ai = Object.assign({}, res.result, {key, base}); if (res.analysesToday != null) S.meta.analysesToday = res.analysesToday; }
    if (S.ui.gc === p && route().name === 'goals') render();
  },
  gcClear() {
    const p = gcState(); p.notes = ''; p.ai = null; p.aiErr = ''; render();
    const t = document.getElementById('gc-notes'); if (t) t.focus({preventScroll: true});
  },

  tgKcal: el => { const t = tgState(); t.kcal = Math.max(800, num(t.kcal) + +el.dataset.v); render(); },
  tgMode: el => { tgState().mode = el.dataset.v; render(); },
  tgToggle: el => { const k = el.dataset.v, t = tgState(), key = k.split('_')[0] + '_on'; t[key] = !t[key]; render(); },
  async saveTargets() {
    const t = tgState(); if (S.ui.busy || !tgChanged()) return;
    const row = Object.assign(tgRow(t), {basis: 'Manual'});
    S.data.targets = S.data.targets.filter(x => x.effective_date !== row.effective_date).concat([row]); S.dirty = true; S.ui.tg = null;
    queueJob({kind: 'targets', row, label: 'targets'}); home();
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
      if (r && r.data) { S.full[id] = safeImg('data:' + (IMG_MIME.test(r.mime || '') ? r.mime : 'image/jpeg') + ';base64,' + r.data); S.viewer = {src: S.full[id]}; }
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
    // Nothing is stored yet: the photo goes to Drive only when the meal is saved (see persistMeal).
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
    const isNew = D.mode === 'new';
    persistMeal(meal, D.items, isNew && D.source === 'photo' && !meal.photo_url ? pendingPhoto('meal') : null);
    (D.favs || []).forEach(f => bumpFavorite(f));
    S.draft = null;
    if (isNew && (D.source === 'photo' || D.source === 'text')) S.log = null;
    S.ui.day = meal.date === today() ? null : meal.date;
    home();
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
      {label: 'Add again today', fn: async () => { await copyMealTo(id, today()); S.ui.day = null; home(); }},
      {label: 'Copy to another date or meal', primary: true, fn: async () => {
        S.ui.openSwipe = null; const L = logState(); L.date = viewDay(); L.time = m.time; L.timeAuto = false;
        const meal = newMeal(m.meal_type, {source: 'copy', note: m.note, photo_url: m.photo_url, thumb: await thumbOf(m)});
        S.draft = {mode: 'new', source: 'copy', meal, items: copyItems(id, meal.meal_id), ai: null}; go('review');
        setTimeout(() => { const f = document.getElementById('draft-date'); if (f) { f.scrollIntoView({block: 'center'}); f.focus({preventScroll: true}); } }, 60);
      }}]});
  },
  // from the edit screen: a copy of the meal as shown (edits included), the original untouched
  draftToToday: async () => {
    const D = S.draft; if (!D || !D.items.length) return;
    const orig = S.data.meals.find(x => x.meal_id === D.meal.meal_id) || D.meal;
    const nm = Object.assign({}, D.meal, {meal_id: uid('meal'), date: today(), time: nowHM(), source: 'copy', edited: 'FALSE', thumb: await thumbOf(orig)});
    persistMeal(nm, D.items.map(e => Object.assign({}, e, {entry_id: uid('ent'), meal_id: nm.meal_id})));
    S.draft = null; S.ui.day = null; home('Added to today\'s ' + lc1(nm.meal_type));
  },
  draftToDay: async () => {
    const D = S.draft; if (!D || !D.items.length) return;
    const orig = S.data.meals.find(x => x.meal_id === D.meal.meal_id) || D.meal;
    const L = logState(); L.date = today(); L.time = D.meal.time; L.timeAuto = false;
    const meal = newMeal(D.meal.meal_type, {source: 'copy', note: D.meal.note, photo_url: D.meal.photo_url, thumb: await thumbOf(orig)});
    S.draft = {mode: 'new', source: 'copy', meal, items: D.items.map(e => Object.assign({}, e, {entry_id: uid('ent'), meal_id: meal.meal_id})), ai: null};
    replace('review');
    setTimeout(() => { const f = document.getElementById('draft-date'); if (f) { f.scrollIntoView({block: 'center'}); f.focus({preventScroll: true}); } }, 60);
  },
  deleteMeal: el => {
    const id = el.dataset.v, m = S.data.meals.find(x => x.meal_id === id);
    const t = m ? lc1(m.meal_type) : 'meal';
    confirmBox('Delete ' + t + '?', 'This removes the meal and its items from your Sheet.', 'Delete ' + t, async () => {
      S.data.meals = S.data.meals.filter(x => x.meal_id !== id); S.data.entries = S.data.entries.filter(x => x.meal_id !== id); S.dirty = true;
      S.ui.openSwipe = null;
      if (route().name === 'review') { S.draft = null; S.stack.pop(); }
      queueJob({kind: 'deleteMeal', mealId: id, label: t});
      render();
    });
  },
  async copyToToday(el) {
    const id = el.dataset.v, m = S.data.meals.find(x => x.meal_id === id); if (!m) return;
    await copyMealTo(id, today()); render();
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
    persistMeal(meal, [e], meal.photo_url ? null : pendingPhoto('label'));
    S.label = null; S.log = null; S.ui.day = meal.date === today() ? null : meal.date; home();
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
  copyChange: async el => {
    const m = S.data.meals.find(x => x.meal_id === el.dataset.v); if (!m) return;
    const meal = newMeal(logState().meal_type, {source: 'copy', note: m.note, thumb: await thumbOf(m), photo_url: m.photo_url});
    S.draft = {mode: 'new', source: 'copy', meal, items: copyItems(m.meal_id, meal.meal_id), ai: null}; go('review');
  },

  syncRetry: () => syncRun(),
  // Default, Light or Dark: applied at once, kept in the Sheet's Settings (and on the device, so the
  // next open starts in it before the Sheet has loaded)
  setTheme: el => {
    const t = el.dataset.v; if (!THEMES.includes(t) || t === currentTheme()) return;
    applyTheme(t, true); S.data.settings.theme = t;
    queueJob({kind: 'settings', values: {theme: t}, label: 'theme'});
    render();
  },
  // leave a new entry without saving anything: back to wherever logging started
  discardDraft: () => {
    S.draft = null; S.label = null; S.log = null; S.edit = null;
    while (S.stack.length > 1 && ['review', 'label', 'log', 'search', 'describe', 'edit'].includes(route().name)) S.stack.pop();
    if (['review', 'label', 'log', 'search', 'describe', 'edit'].includes(route().name)) S.stack = [{name: 'today', p: {}}];
    S.ui.openSwipe = null; render();
  },
  // History: pick a date on the calendar (the week below moves to end there) or a row (the week stays put)
  hDate: el => { const d = el.dataset.d; S.ui.hSel = S.ui.hAnchor = S.ui.hOpen = S.ui.hAnim = d; render(); showOpenDay(); },
  hPick: el => {
    const d = el.dataset.d;
    if (S.ui.hOpen === d) S.ui.hOpen = null; else S.ui.hOpen = S.ui.hAnim = d;
    S.ui.hSel = d; S.ui.month = d.slice(0, 7); render(); showOpenDay();
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
  // a weigh-in for any day up to today; when changing one, a new date moves it
  async saveWeight() {
    const ed = S.ui.wEdit ? S.data.weight.find(w => w.date === S.ui.wEdit) : null;
    const kg = num(S.ui.wIn != null ? S.ui.wIn : (document.getElementById('wt-in') || {}).value || (ed ? ed.kg : ''));
    if (!(kg >= 20 && kg <= 400)) { toast('Enter a weight in kilograms, such as 72.4'); return; }
    const date = S.ui.wDate || (document.getElementById('wt-date') || {}).value || (ed ? ed.date : today());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) { toast('Pick a date up to today'); return; }
    const note = (S.ui.wNote != null ? S.ui.wNote : (ed ? ed.note || '' : '')).trim();
    const row = {date, kg: r1(kg), note};
    if (ed && ed.date !== date) { S.data.weight = S.data.weight.filter(w => w.date !== ed.date); queueJob({kind: 'weightDelete', date: ed.date, label: 'weigh-in'}); }
    S.data.weight = S.data.weight.filter(w => w.date !== row.date).concat([row]);
    S.ui.wEdit = null; S.ui.wIn = null; S.ui.wNote = null; S.ui.wDate = null;
    queueJob({kind: 'weight', row, label: fmt(row.kg, 1) + ' kg'}); render();
  },
  wEdit: el => {
    const w = S.data.weight.find(x => x.date === el.dataset.v); if (!w) return;
    S.ui.wEdit = w.date; S.ui.wIn = null; S.ui.wNote = null; S.ui.wDate = null; render();
    const f = document.getElementById('wt-form'); if (f) f.scrollIntoView({block: 'start', behavior: calmMotion() ? 'auto' : 'smooth'});
  },
  wCancel: () => { S.ui.wEdit = null; S.ui.wIn = null; S.ui.wNote = null; S.ui.wDate = null; render(); },
  wAll: () => { S.ui.wAll = true; render(); },
  wDelete: () => {
    const d = S.ui.wEdit; if (!d) return;
    S.data.weight = S.data.weight.filter(w => w.date !== d);
    S.ui.wEdit = null; S.ui.wIn = null; S.ui.wNote = null; S.ui.wDate = null;
    queueJob({kind: 'weightDelete', date: d, label: 'weigh-in'}); render();
  }
};

/* ---------- input handlers (no full re-render while typing) ---------- */
const I = {
  gc: el => { gcState()[el.dataset.k] = el.value; },
  gcPace: el => { gcState().pace = num(el.value); },
  gcNotes: el => { gcState().notes = el.value; },
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
  wDate: el => { S.ui.wDate = el.value; },
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
  // a save still running when the page is closed: ask the browser to hold on (it's kept on the device either way)
  window.addEventListener('beforeunload', ev => { if (SYNC.jobs.length) { ev.preventDefault(); ev.returnValue = ''; } });
  window.addEventListener('online', () => { if (SYNC.jobs.length && !SYNC.running) syncRun(); });
  // widths change with the window and once the font arrives; the selection indicators follow
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(placeAllSel, 80); });
  try { document.fonts.ready.then(placeAllSel); } catch (e) { /* ignore */ }
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
    // saves still waiting from last time: show them as made, then finish them
    SYNC.jobs = syncLoad(); SYNC.jobs.forEach(syncApplyLocal);
    seedWeight();
    applyTheme(currentTheme());
    if (SYNC.jobs.length) setTimeout(syncRun, 300);
    if (setting('onboarded', '') !== 'yes') S.stack = [{name: 'welcome', p: {}}];
    render();
  } catch (e) {
    app().innerHTML = '<div class="boot" style="padding:24px;text-align:center">' + logoTile(96) + '<span class="ov">' + esc(friendly(e)) + '</span><button class="raised-sm btn-sm mango" id="bootRetry">Try again</button></div>';
    const rb = document.getElementById('bootRetry'); if (rb) rb.addEventListener('click', () => location.reload());
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
