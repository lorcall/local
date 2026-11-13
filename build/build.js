// Builds apps-script/app.html from build/src/*.js, and a standalone preview (demo mode).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readdirSync(path.join(__dirname, 'src')).filter(f => f.endsWith('.js')).sort()
  .map(f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8')).join('\n');
if (/<\/script/i.test(src)) throw new Error('Source contains a closing script tag');
fs.writeFileSync(path.join(__dirname, 'app.bundle.js'), src);
fs.writeFileSync(path.join(root, 'apps-script', 'app.html'), '<script>\n' + src + '\n</script>\n');
// The loading screen is written into the page, so it shows before the script has run.
const logoSrc = src.slice(src.indexOf('function logoTile('), src.indexOf('function wordmark('));
const bootHtml = '<div class="boot">' + new Function(logoSrc + 'return logoTile(96, true);')() + '<div class="tagline">AI calorie tracker</div><span>Opening your log</span></div>';
const indexPath = path.join(root, 'apps-script', 'index.html');
fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8').replace(/<!--boot-->[\s\S]*?<!--\/boot-->/, '<!--boot-->' + bootHtml + '<!--/boot-->'));
const styles = fs.readFileSync(path.join(root, 'apps-script', 'styles.html'), 'utf8');
let index = fs.readFileSync(path.join(root, 'apps-script', 'index.html'), 'utf8');
index = index.replace("<?!= include('styles') ?>", styles.trim())
  .replace("<?!= include('app') ?>", '<script>\n' + src + '\n</script>')
  .replace('<base target="_top">', '<title>LoCal</title>\n  <link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(fs.readFileSync(path.join(root, 'icons', 'favicon.svg'), 'utf8')) + '">');
fs.writeFileSync(path.join(root, 'preview.html'), index);
// Artifact version: no document skeleton (the host adds it), a fixed dark look.
const art = '<title>LoCal</title>\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Geologica:wght@200..700&display=swap" rel="stylesheet">\n' +
  styles.trim().replace('<style>', '<style>\n:root{color-scheme:dark}') + '\n<div id="app">' + bootHtml + '</div>\n<script>\n' + src + '\n</script>\n';
fs.writeFileSync(path.join(__dirname, 'artifact', 'LoCal.html'), art);
// Web build: the same bundle, plus the stylesheet as a real file. web/index.html loads
// api.js before app.js, so 2-api.js picks WebAPI() instead of the Apps Script transport.
const webDir = path.join(root, 'web');
if (fs.existsSync(webDir)) {
  fs.writeFileSync(path.join(webDir, 'app.js'), src);
  const css = styles.replace(/^[\s\S]*?<style>/, '').replace(/<\/style>[\s\S]*$/, '').trim() + '\n';
  fs.writeFileSync(path.join(webDir, 'styles.css'), css);
  const webIndex = path.join(webDir, 'index.html');
  // Cache busting, not cosmetics: Pages sends a long max-age and iOS Safari holds these
  // files hard, so without a changing URL a deploy can simply never arrive.
  const apiSrc = fs.readFileSync(path.join(webDir, 'api.js'), 'utf8');
  const stamp = require('crypto').createHash('sha1').update(src + css + apiSrc).digest('hex').slice(0, 8);
  const html = fs.readFileSync(webIndex, 'utf8')
    .replace(/<!--boot-->[\s\S]*?<!--\/boot-->/, '<!--boot-->' + bootHtml + '<!--/boot-->')
    .replace(/(href=")styles\.css(\?v=[a-f0-9]+)?(")/, '$1styles.css?v=' + stamp + '$3')
    .replace(/(src=")api\.js(\?v=[a-f0-9]+)?(")/, '$1api.js?v=' + stamp + '$3')
    .replace(/(s\.src = ')app\.js(\?v=[a-f0-9]+)?(')/, '$1app.js?v=' + stamp + '$3');
  fs.writeFileSync(webIndex, withCsp(html));
  console.log('web stamped', stamp);
}
console.log('built', (src.length / 1024).toFixed(1) + ' KB js');

/**
 * The page's Content Security Policy. The browser then runs only our own files, Google's sign-in
 * script and the one inline script below (by its hash), and only talks to Google. So even if some
 * hostile text in a Sheet or an AI answer ever slipped past esc(), it could neither run nor send
 * the sign-in token anywhere. GitHub Pages can't set headers, so it goes in a meta tag; the hash
 * is recomputed on every build because the inline script carries the cache-busting stamp.
 */
function withCsp(html) {
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m =>
    "'sha256-" + require('crypto').createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
  const policy = [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com/gsi/client " + inline.join(' '),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data: blob:",
    "connect-src 'self' https://www.googleapis.com https://sheets.googleapis.com https://script.google.com https://script.googleusercontent.com https://accounts.google.com/gsi/",
    'frame-src https://accounts.google.com/gsi/',
    "object-src 'none'", "base-uri 'none'", "form-action 'none'"
  ].join('; ');
  const tag = '<meta http-equiv="Content-Security-Policy" content="' + policy + '">';
  return /<meta http-equiv="Content-Security-Policy"[^>]*>/.test(html)
    ? html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, tag)
    : html.replace(/(<meta charset="utf-8">)/, '$1\n  ' + tag);
}
