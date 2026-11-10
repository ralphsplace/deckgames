// Makes the pictures for a game's guide:   npm run shots -- solitaire   (or several names, or none for every game)
//
// A game opts in with games/<game>/guide.shots.js, which exports `shots` (and optionally a default `viewport`): a list of
//   { name, caption?, url?, viewport?, setup(page, tools) }
// setup puts the page in the position to show (usually page.evaluate(window.deckgame.load, ...) and real clicks),
// then marks it with tools.label / tools.arrow and says what to capture with tools.clip. Each picture is written to
// games/<game>/guide/img/<name>.png. The site is served from this checkout, so the pictures show the code as it is.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { overlay } from './overlay.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

const games = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(path.join(ROOT, 'games')).filter(g => fs.existsSync(path.join(ROOT, 'games', g, 'guide.shots.js')));

// After a game's pictures are made, give every <img src="img/<name>.png"> in its guide the picture's size (in CSS
// pixels: the pictures are taken at 2x), so the page lays out before the pictures load and sizes never go stale.
function stampSizes(game) {
  const page = path.join(ROOT, 'games', game, 'guide', 'index.html');
  if (!fs.existsSync(page)) return;
  const html = fs.readFileSync(page, 'utf8').replace(/<img src="img\/([\w-]+)\.png"([^>]*)>/g, (tag, name, rest) => {
    const file = path.join(ROOT, 'games', game, 'guide', 'img', name + '.png');
    if (!fs.existsSync(file)) { console.error(`  ${game}/guide/index.html shows img/${name}.png, which no shot makes`); failed++; return tag; }
    const b = fs.readFileSync(file);                                  // PNG header: width and height at bytes 16 and 20
    const w = Math.round(b.readUInt32BE(16) / 2), h = Math.round(b.readUInt32BE(20) / 2);
    return `<img src="img/${name}.png" width="${w}" height="${h}"${rest.replace(/\s(width|height)="\d+"/g, '')}>`;
  });
  fs.writeFileSync(page, html);
}

const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch();
let failed = 0;
try {
  for (const game of games) {
    const { shots, viewport } = await import(pathToFileURL(path.join(ROOT, 'games', game, 'guide.shots.js')));
    const out = path.join(ROOT, 'games', game, 'guide', 'img');
    fs.mkdirSync(out, { recursive: true });
    for (const shot of shots) {
      const page = await browser.newPage({ viewport: shot.viewport || viewport || { width: 900, height: 760 }, deviceScaleFactor: 2,
        reducedMotion: 'no-preference' });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      try {
        await page.goto(`${base}/games/${game}/${shot.url || ''}`);
        let clip = null;
        const tools = overlay(page, c => { clip = c; });
        await shot.setup(page, tools);
        await page.evaluate(() => document.fonts.ready);
        const file = path.join(out, shot.name + '.png');
        await page.screenshot({ path: file, ...(clip ? { clip: await clip() } : { fullPage: false }) });
        if (errors.length) throw new Error(errors.join('\n'));
        console.log(`  ${game}/${shot.name}.png`);
      } catch (e) {
        failed++; console.error(`  FAILED ${game}/${shot.name}: ${e.message}`);
      } finally { await page.close(); }
    }
    stampSizes(game);
  }
} finally {
  await browser.close(); srv.close();
}
process.exit(failed ? 1 : 0);
