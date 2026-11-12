/**
 * gemini.gs (proxy copy) — trimmed for the standalone proxy project: the functions that
 * touched the user's Sheet or Drive are gone, because this project has neither. Keep it in
 * step with apps-script/gemini.gs when the prompts or models change.
 *
 * gemini.gs — photo analysis, label reading, single-item estimates and the weekly summary.
 * Calls Gemini only from the server, with the key from Script Properties.
 *
 * Tuned for speed:
 *  - The fastest model goes first (Flash-Lite) with thinking at its lowest level.
 *  - The model and API that answered last time are remembered and tried first.
 *  - Photo analysis reads nothing from the Sheet and writes nothing to Drive;
 *    the page sends the portion hints and saves the photo in a parallel call.
 *  - One photo call handles both kinds of picture: the model decides whether it shows food or
 *    a nutrition label, so the page never asks which.
 *
 * Models: Google renames Flash models often. The list below was current in October 2026
 * (all on the free tier). Set GEMINI_MODEL in Script Properties to pin one, for example
 * gemini-3.8-flash for better recognition at some cost in speed.
 */
var GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'];
var GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/';
var CATEGORY_LIST = ['staple', 'meat and fish', 'vegetables', 'fruit', 'drinks', 'snacks and sweets', 'other'];
var VALUE_KEYS = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'sugar_g', 'fiber_g', 'sodium_mg'];

function modelLabel_() {
  var route = cachedRoute_();
  var m = prop_('GEMINI_MODEL') || (route && route.model) || GEMINI_MODELS[0];
  return m.replace(/^gemini-/, 'Gemini ').replace(/-flash-lite/, ' Flash-Lite').replace(/-flash/, ' Flash') + ', free tier';
}

/**
 * Run this from the editor (choose testGemini, press Run) to check the setup and the speed.
 * The first run asks for permission to connect to an external service; approve it.
 * It forgets the remembered model, finds the fastest one that works, then times a second call.
 */
function testGemini() {
  var key = prop_('GEMINI_API_KEY');
  if (!key) { Logger.log('No GEMINI_API_KEY in Script Properties. Add it under Project Settings > Script Properties.'); return; }
  Logger.log('Key found (' + key.length + ' characters, starts ' + key.slice(0, 4) + ').');
  PropertiesService.getScriptProperties().deleteProperty('GEMINI_ROUTE');
  var schema = obj_({ok: {type: 'boolean'}}, ['ok']);
  var log = function (s) { Logger.log(s); };
  var t0 = Date.now();
  try {
    geminiJson_([{text: 'Reply with {"ok": true}.'}], schema, log);
    var r = cachedRoute_();
    Logger.log('Working route: ' + r.model + ' via ' + r.api + (r.think ? ', thinking ' + thinkLevel_(r.model) : ', default thinking') + '. Found in ' + secs_(t0) + '.');
    var t1 = Date.now();
    geminiJson_([{text: 'Reply with {"ok": true}.'}], schema);
    Logger.log('Second call on the remembered route: ' + secs_(t1) + '. Photo analysis adds a few seconds for the image.');
  } catch (e) {
    Logger.log('No route worked: ' + e.message);
  }
}

/* ---------- server API ---------- */




/** Re-asks for one item only (the food type or amount changed). p: {name, serving_unit, grams_per_unit, quantity, category, note} */
function analyzeItem(p) {
  var q = Number(p.quantity) || 1, g = Number(p.grams_per_unit) || 0;
  var amount = q + ' ' + (p.serving_unit || 'serving') + (g ? ' (' + g + ' g each, ' + Math.round(g * q) + ' g total)' : '');
  var prompt = [
    'Nutrition for ' + amount + ' of "' + p.name + '". Values for the whole amount.',
    'Sugar and fiber are part of carbs. kcal close to protein*4 + carbs*4 + fat*9.',
    'category: one of ' + CATEGORY_LIST.join(', ') + '. confidence high, medium or low; reason under 6 words.',
    p.note ? 'User note: "' + p.note + '".' : ''
  ].join('\n');
  var schema = obj_(merge_(values_(), {name: str_(), category: {type: 'string', enum: CATEGORY_LIST}, confidence: conf_(), reason: str_()}), VALUE_KEYS.concat(['category', 'confidence', 'reason']));
  return geminiJson_([{text: prompt}], schema);
}

/** n: the week's computed numbers (no photos). Returns {text, suggestions}. */
function weeklySummary(n) {
  var prompt = [
    'Write a short weekly summary for a personal calorie tracker, using only these numbers.',
    '2 to 3 plain sentences, calm and friendly: the week against the calorie target, where the misses were, protein against its goal.',
    'Then exactly 2 practical suggestions for next week, one sentence each, with a concrete food or portion.',
    'No emoji, no exclamation marks, no medical advice, no judgment. Round kcal to the nearest 10.',
    'Numbers: ' + JSON.stringify(n)
  ].join('\n');
  var schema = obj_({text: str_(), suggestions: {type: 'array', items: str_()}}, ['text', 'suggestions']);
  var out = geminiJson_([{text: prompt}], schema);
  return {text: String(out.text || ''), suggestions: (out.suggestions || []).slice(0, 2)};
}

/* ---------- prompts ---------- */

/** Rules for estimating a meal, shared by photo and written estimates. Cuisine-neutral on purpose. */
function mealRules_(h) {
  return [
    'One item per distinct food or drink being eaten. Name each dish the way the people who cook it do, local names included; never relabel a dish as a different cuisine\'s.',
    'Per item: name, category (' + CATEGORY_LIST.join(', ') + '), serving_unit (cup, bowl, piece, plate, serving, slice, tbsp, glass or g), quantity, grams_per_unit, and values for the whole item.',
    'Sugar and fiber are part of carbs. kcal close to protein*4 + carbs*4 + fat*9. Count likely cooking oil, sauces, dressings and condiments.',
    'confidence high, medium or low per item and overall. Item reason under 6 words. Overall reason: one short sentence; say if the note settled something.',
    h && h.dishes && h.dishes.length ? 'Known portions (use when a dish matches; * = the user\'s own values):\n' + h.dishes.slice(0, 40).join('\n') : ''
  ];
}

function mealItemSchema_() {
  return obj_(merge_(values_(), {
    name: str_(), category: {type: 'string', enum: CATEGORY_LIST}, serving_unit: str_(), quantity: numT_(), grams_per_unit: numT_(), confidence: conf_(), reason: str_()
  }), ['name', 'category', 'serving_unit', 'quantity', 'grams_per_unit'].concat(VALUE_KEYS).concat(['confidence', 'reason']));
}

function cleanItems_(items) {
  items.forEach(function (it) { VALUE_KEYS.forEach(function (k) { it[k] = Math.max(0, Number(it[k]) || 0); }); });
  return items;
}

function estimateMeal_(p) {
  var h = p.hints || hintsFromSheet_();
  var written = !p.image && p.description;
  var prompt = [
    written ? 'Estimate nutrition for the meal described below, for a calorie tracker. Use the amounts given; when none is given, assume a typical serving and set that item\'s confidence to low.'
      : 'Estimate nutrition from this meal photo for a calorie tracker.'
  ].concat(mealRules_(h)).concat([
    written ? 'The meal, as the user described it: "' + p.description + '"' : (p.note ? 'User note, more reliable than the photo: "' + p.note + '"' : ''),
    written ? 'If the text names no food: no_food true and empty items.' : 'No food in the photo: no_food true and empty items.'
  ]).filter(String).join('\n');
  var schema = obj_({items: {type: 'array', items: mealItemSchema_()}, confidence: conf_(), reason: str_(), no_food: {type: 'boolean'}}, ['items', 'confidence', 'reason']);
  var out = geminiJson_(written ? [{text: prompt}] : [{image: p.image, mime: p.mime || 'image/jpeg'}, {text: prompt}], schema);
  if (out.no_food || !out.items || !out.items.length) throw new Error('NO_FOOD');
  cleanItems_(out.items);
  return out;
}

/* Label-reading rules, shared by the label-only call and the combined photo call. */
var LABEL_RULES = [
  'Copy the printed numbers; do not estimate. product (name, or a short description), serving_g, servings_per_pack, per_serving: kcal, protein_g, carbs_g (total carbohydrate), fat_g (total fat), sugar_g, fiber_g, sodium_mg.',
  'kJ only: divide by 4.184. Salt only: sodium_mg = salt g * 400. Per 100 g only: convert to one serving.',
  'Blurry, cut off or missing value: 0, and list its key in unread_fields.'
];
function labelSchema_() {
  return obj_({
    product: str_(), serving_g: numT_(), servings_per_pack: numT_(), per_serving: obj_(values_(), VALUE_KEYS),
    unread_fields: {type: 'array', items: {type: 'string', enum: VALUE_KEYS}}, confidence: conf_()
  }, ['product', 'serving_g', 'servings_per_pack', 'per_serving', 'unread_fields', 'confidence']);
}
function cleanLabel_(l) {
  (l.unread_fields || []).forEach(function (k) { if (l.per_serving) l.per_serving[k] = null; });
  return l;
}

/**
 * One call for any photo: the model first decides what it shows, then answers in that shape.
 * Returns {kind: 'meal', items, confidence, reason} or {kind: 'label', product, ..., per_serving}.
 */
function analyzeImage_(p) {
  var h = p.hints || hintsFromSheet_();
  var prompt = [
    'This photo is for a calorie tracker. First decide what it shows and set kind:',
    '"label" if it shows a printed nutrition facts panel. Then fill label only, and read it:',
    LABEL_RULES.join('\n'),
    '"meal" if it shows food or drink to be eaten, including packaged food with no readable nutrition panel. Then fill items, confidence and reason only, and estimate:',
    mealRules_(h).filter(String).join('\n'),
    '"none" if it shows neither.',
    p.note ? 'User note, more reliable than the photo: "' + p.note + '"' : ''
  ].filter(String).join('\n');
  var schema = obj_({
    kind: {type: 'string', enum: ['meal', 'label', 'none']},
    items: {type: 'array', items: mealItemSchema_()}, confidence: conf_(), reason: str_(),
    label: labelSchema_()
  }, ['kind']);
  var out = geminiJson_([{image: p.image, mime: p.mime || 'image/jpeg'}, {text: prompt}], schema);
  if (out.kind === 'label' && out.label && out.label.per_serving) return merge_({kind: 'label'}, cleanLabel_(out.label));
  if (out.kind === 'none' || !out.items || !out.items.length) throw new Error('NO_FOOD');
  return {kind: 'meal', items: cleanItems_(out.items), confidence: out.confidence || 'medium', reason: out.reason || ''};
}

/** The label-only call, kept for pages that still ask for it by mode. */
function readLabel_(p) {
  var prompt = ['Read the nutrition facts label in this photo.'].concat(LABEL_RULES).concat(['Not a nutrition label: not_a_label true.']).join('\n');
  var schema = labelSchema_();
  schema.properties.not_a_label = {type: 'boolean'};
  var out = geminiJson_([{image: p.image, mime: p.mime || 'image/jpeg'}, {text: prompt}], schema);
  if (out.not_a_label) throw new Error('That photo doesn\'t look like a nutrition label. Try again closer.');
  return cleanLabel_(out);
}

/** The proxy has no Sheet to read, so the page must send its own hints. */
function hintsFromSheet_() { return {dishes: []}; }

/* ---------- Gemini transport ---------- */

/** The lowest thinking level each model family accepts. */
function thinkLevel_(model) { return /flash-lite/.test(model) ? 'minimal' : 'low'; }

function cachedRoute_() {
  try { return JSON.parse(prop_('GEMINI_ROUTE') || 'null'); } catch (e) { return null; }
}

/** Every way to ask, fastest first: the remembered route, then per model, with and without a thinking setting. */
function routes_() {
  var models = prop_('GEMINI_MODEL') ? [prop_('GEMINI_MODEL')] : GEMINI_MODELS;
  var list = [];
  models.forEach(function (m) {
    list.push({model: m, api: 'interactions', think: true});
    list.push({model: m, api: 'generateContent', think: true});
    list.push({model: m, api: 'generateContent', think: false});
  });
  var c = cachedRoute_();
  if (c && models.indexOf(c.model) >= 0) {
    list = [c].concat(list.filter(function (r) { return !(r.model === c.model && r.api === c.api && r.think === c.think); }));
  }
  return list;
}

/** parts: [{text}] and/or [{image, mime}]. Returns the parsed JSON object. */
function geminiJson_(parts, schema, log) {
  var key = prop_('GEMINI_API_KEY');
  if (!key) throw new Error('NO_KEY');
  var routes = routes_(), lastErr = null, quotaModels = {}, cached = cachedRoute_();
  for (var i = 0; i < routes.length; i++) {
    var r = routes[i];
    if (quotaModels[r.model]) continue;
    var req = r.api === 'interactions' ? interactionsRequest_(r, parts, schema) : legacyRequest_(r, parts, schema);
    var t0 = Date.now(), res;
    try {
      res = UrlFetchApp.fetch(req.url, {method: 'post', contentType: 'application/json', headers: {'x-goog-api-key': key}, payload: JSON.stringify(req.body), muteHttpExceptions: true});
    } catch (e) {
      if (/permission/i.test(e.message)) throw new Error('PERMISSION: ' + e.message);
      lastErr = new Error('Apps Script couldn\'t connect to Gemini: ' + e.message);
      if (log) log(describe_(r) + ': connection failed after ' + secs_(t0));
      continue;
    }
    var code = res.getResponseCode(), body = res.getContentText();
    if (log) log(describe_(r) + ': ' + code + ' in ' + secs_(t0) + (code === 200 ? '' : ', ' + shortErr_(body)));
    if (code === 200) {
      var parsed = parseJsonLoose_(extractText_(JSON.parse(body)));
      if (parsed) {
        if (!cached || cached.model !== r.model || cached.api !== r.api || cached.think !== r.think) setProp_('GEMINI_ROUTE', JSON.stringify(r));
        return parsed;
      }
      lastErr = new Error('Gemini returned something that isn\'t valid JSON.');
      continue;
    }
    if (code === 429) { quotaModels[r.model] = true; lastErr = new Error('QUOTA: ' + shortErr_(body)); continue; }
    if (code === 401 || code === 403) throw new Error('Gemini refused the API key (' + code + '). Check GEMINI_API_KEY. ' + shortErr_(body));
    if (cached && r.model === cached.model && r.api === cached.api) PropertiesService.getScriptProperties().deleteProperty('GEMINI_ROUTE');
    lastErr = new Error('Gemini error ' + code + ': ' + shortErr_(body));
  }
  if (Object.keys(quotaModels).length) throw new Error('QUOTA: the free Gemini limit for now is used up.');
  throw lastErr || new Error('Gemini didn\'t answer.');
}

function interactionsRequest_(r, parts, schema) {
  var input = parts.map(function (p) { return p.image ? {type: 'image', mime_type: p.mime, data: p.image} : {type: 'text', text: p.text}; });
  var body = {model: r.model, input: input, response_format: {type: 'text', mime_type: 'application/json', schema: schema}};
  if (r.think) body.generation_config = {thinking_level: thinkLevel_(r.model)};
  return {url: GEMINI_BASE + 'interactions', body: body};
}

function legacyRequest_(r, parts, schema) {
  var p = parts.map(function (x) { return x.image ? {inline_data: {mime_type: x.mime, data: x.image}} : {text: x.text}; });
  var config = {responseMimeType: 'application/json', responseJsonSchema: schema};
  if (r.think) config.thinkingConfig = {thinkingLevel: thinkLevel_(r.model)};
  return {url: GEMINI_BASE + 'models/' + encodeURIComponent(r.model) + ':generateContent', body: {contents: [{role: 'user', parts: p}], generationConfig: config}};
}

/** Finds the model's text in either API's response shape. */
function extractText_(j) {
  if (!j) return '';
  if (j.steps && j.steps.length) {
    var out = [];
    j.steps.forEach(function (s) { if (s.type === 'model_output' && s.content) s.content.forEach(function (c) { if (c.type === 'text' && c.text) out.push(c.text); }); });
    if (out.length) return out.join('');
  }
  if (typeof j.output_text === 'string') return j.output_text;
  if (j.outputs && j.outputs.length) {
    var t = j.outputs.filter(function (o) { return o.type === 'text' && o.text; }).map(function (o) { return o.text; });
    if (t.length) return t[t.length - 1];
  }
  if (j.candidates && j.candidates.length && j.candidates[0].content) {
    return (j.candidates[0].content.parts || []).filter(function (p) { return p.text && !p.thought; }).map(function (p) { return p.text; }).join('');
  }
  return '';
}

function parseJsonLoose_(text) {
  if (!text) return null;
  var t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) { /* try the outermost object */ }
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e2) { return null; } }
  return null;
}

function shortErr_(body) {
  try { var j = JSON.parse(body); return String((j.error && (j.error.message || j.error.status)) || body).slice(0, 220); } catch (e) { return String(body).slice(0, 220); }
}

/* ---------- small helpers ---------- */

function describe_(r) { return r.model + ' via ' + (r.api === 'interactions' ? 'Interactions API' : 'generateContent') + (r.think ? ' (thinking ' + thinkLevel_(r.model) + ')' : ' (default thinking)'); }
function secs_(t0) { return ((Date.now() - t0) / 1000).toFixed(1) + ' s'; }



function str_() { return {type: 'string'}; }
function numT_() { return {type: 'number'}; }
function conf_() { return {type: 'string', enum: ['high', 'medium', 'low']}; }
function values_() { var o = {}; VALUE_KEYS.forEach(function (k) { o[k] = {type: 'number'}; }); return o; }
function obj_(props, required) { return {type: 'object', properties: props, required: required || Object.keys(props)}; }
function merge_(a, b) { var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; }); Object.keys(b).forEach(function (k) { o[k] = b[k]; }); return o; }
