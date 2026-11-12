// Runs the proxy's real code from the request to Gemini and back, with only Google's services faked.
const vm = require('vm'), fs = require('fs');
const props = {GEMINI_API_KEY: 'k', OWNER_EMAIL: 'o@x.com', ACCESS_SHEET_ID: 's', CLIENT_ID: 'c', SECRET: 'z'};
const ans = JSON.stringify({kind: 'meal', items: [{name: 'Banana', category: 'fruit', serving_unit: 'piece', quantity: 1, grams_per_unit: 118, kcal: 105, protein_g: 1, carbs_g: 27, fat_g: 0, sugar_g: 14, fiber_g: 3, sodium_mg: 1, confidence: 'high', reason: ''}], confidence: 'high', reason: 'clear'});
const resp = (code, body) => ({getResponseCode: () => code, getContentText: () => body});
const ctx = {console, Logger: {log() {}}, Utilities: {DigestAlgorithm: {SHA_256: 1}, computeDigest: (a, s) => [...require('crypto').createHash('sha256').update(String(s)).digest()], base64Encode: b => Buffer.from(b).toString('base64'), computeHmacSha256Signature: () => [1], base64EncodeWebSafe: () => 'x', sleep() {}},
  PropertiesService: {getScriptProperties: () => ({getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; }})},
  CacheService: {getScriptCache: () => ({get: k => /^acc_/.test(k) ? 'approved' : null, put() {}, remove() {}})},
  ContentService: {MimeType: {JSON: 'json'}, createTextOutput: t => ({setMimeType: () => ({text: t})})},
  UrlFetchApp: {fetch: (url) => /tokeninfo/.test(url) ? resp(200, JSON.stringify({aud: props.CLIENT_ID, email: 'friend@x.com', email_verified: 'true', expires_in: '3000'}))
    : resp(200, JSON.stringify({outputs: [{type: 'text', text: ans}], candidates: [{content: {parts: [{text: ans}]}}]}))},
  MailApp: {sendEmail() {}}, SpreadsheetApp: {openById: () => { throw new Error('sheet should not be opened when cached'); }}};
vm.createContext(ctx);
for (const f of fs.readdirSync(require('path').join(__dirname, '../../proxy'))) vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../../proxy', f), 'utf8'), ctx);
let fails = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fails++; };
const post = body => JSON.parse(ctx.doPost({postData: {contents: JSON.stringify(body)}}).text);
let out = post({token: 't', action: 'analyzePhoto', payload: {image: 'aGk=', mode: 'auto', note: ''}});
ok(!out.error && out.result && out.result.items && out.result.items[0].kcal === 105, 'photo analysis returns the estimate: ' + JSON.stringify(out).slice(0, 120));
ok(!!props.GEMINI_ROUTE, 'the working Gemini route is remembered');
out = post({token: 't', action: 'analyzePhoto', payload: {image: 'aGk=', mode: 'auto'}});
ok(!out.error && out.result.items, 'second analysis (cached route) works');
out = post({token: 't', action: 'analyzeText', payload: {text: '1 banana'}});
ok(!out.error, 'text estimate works: ' + JSON.stringify(out).slice(0, 100));
out = post({token: 't', action: 'access'});
ok(out.result && out.result.approved, 'access check approved');
process.exitCode = fails ? 1 : 0; console.log(fails ? fails + ' failed' : 'all passed');
