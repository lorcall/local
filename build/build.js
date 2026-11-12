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
const bootHtml = '<div class="boot">' + new Function(logoSrc + 'return logoTile(96, true);')() + '<span>Opening your log</span></div>';
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
console.log('built', (src.length / 1024).toFixed(1) + ' KB js');
