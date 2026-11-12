const {chromium} = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'icons');
const jobs = [['icon.svg', 512, 'icon-512.png'], ['icon.svg', 192, 'icon-192.png'], ['icon.svg', 180, 'apple-touch-icon.png'], ['icon-maskable.svg', 512, 'icon-512-maskable.png'], ['favicon.svg', 32, 'favicon-32.png'], ['favicon.svg', 16, 'favicon-16.png']];
(async () => {
  const b = await chromium.launch();
  for (const [src, px, out] of jobs) {
    const p = await b.newPage({viewport: {width: px, height: px}});
    const svg = fs.readFileSync(path.join(dir, src), 'utf8').replace(/width="\d+" height="\d+"/, `width="${px}" height="${px}"`);
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.screenshot({path: path.join(dir, out), omitBackground: true, clip: {x: 0, y: 0, width: px, height: px}});
    await p.close();
  }
  await b.close(); console.log('icons done');
})();
