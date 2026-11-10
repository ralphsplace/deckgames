// The pictures in guide/index.html. Run:  npm run shots -- mahjong   (see tools/guide-shots/shoot.mjs)
// Real deals from fixed seeds; positions further in are reached by removing real matching pairs.

export const viewport = { width: 900, height: 820 };
const tile = i => `#board .tile >> nth=${i}`;                        // tiles are drawn in game.tiles order

async function open(page, seed, prepare) {
  await page.goto(page.url().split('?')[0] + `?seed=${seed}`);
  await page.waitForSelector('#board .tile');
  if (prepare) await page.evaluate(prepare);
  await page.evaluate(() => window.deckgame.refresh());
}
// index of the first tile matching a test run in the page: (tile, game) => boolean
const find = async (page, test) => {
  const i = await page.evaluate(src => {
    const g = window.deckgame.game, f = eval(src);
    return g.tiles.findIndex(t => !t.removed && f(t, g));
  }, String(test));
  if (i < 0) throw new Error('no tile like that: ' + test);            // never fall back to some other tile
  return i;
};
// nothing on top of it, so you can see it (blocked or not)
const SEEN = '!g.tiles.some(o => !o.removed && o.z === t.z + 1 && Math.abs(o.x - t.x) < 2 && Math.abs(o.y - t.y) < 2)';

export const shots = [
  {
    name: 'board',
    async setup(page, t) {
      await open(page, 5);
      const top = await find(page, (t, g) => t.z === Math.max(...g.tiles.map(x => x.z)));
      const blocked = await find(page, eval(`(t, g) => !g.free(t) && t.z === 0 && t.y >= 12 && t.x >= 10 && ${SEEN}`));
      const free = await find(page, (t, g) => g.free(t) && t.z === 0 && t.x <= 2);
      await t.label(tile(top), 'Top of the pile: free', { at: 'top' });
      await t.label(tile(free), 'Free: an open side', { at: 'top', box: true, dx: 50 });
      await t.label(tile(blocked), 'Blocked: tiles on both sides', { at: 'bottom', box: true });
      await t.clip(['header', '#board'], 12);
    },
  },
  {
    name: 'match',
    async setup(page, t) {
      await open(page, 5);
      const [a, b] = await page.evaluate(() => { const g = window.deckgame.game; return g.hint().map(x => g.tiles.indexOf(x)); });
      await page.click(tile(a));
      await t.label(tile(a), '1. Click a free tile', { at: 'top', box: false, dy: -6 });
      await t.arrow(tile(a), tile(b), { from: 'bottom', to: 'bottom', bend: 0.3 });
      await t.label(tile(b), '2. Click its twin: both go', { at: 'bottom', box: true, dy: 40 });
      await t.clip(['header', '#board'], 12);
    },
  },
  {
    name: 'flowers',
    async setup(page, t) {
      // clear real pairs until two different flowers (or seasons) are free at once
      let seed = 1, found = null;
      for (; seed < 40 && !found; seed++) {
        await open(page, seed);
        found = await page.evaluate(() => {
          const g = window.deckgame.game;
          for (const [a, b] of g.solution) {
            for (const kind of ['flower', 'season']) {
              const free = g.tiles.filter(x => g.free(x) && x.face.kind === kind);
              const pair = free.find(x => free.some(y => y.face.n !== x.face.n));
              if (pair) return [g.tiles.indexOf(pair), g.tiles.indexOf(free.find(y => y.face.n !== pair.face.n)), kind];
            }
            g.remove(g.tiles[a], g.tiles[b]);
          }
          return null;
        });
      }
      await page.evaluate(() => window.deckgame.refresh());
      const [a, b, kind] = found;
      await t.label(tile(a), '', { box: true });
      await t.label(tile(b), `Different ${kind}s, but they match`, { at: 'bottom', box: true, dy: 40 });
      await t.arrow(tile(a), tile(b), { from: 'bottom', to: 'bottom', bend: 0.3 });
      await t.clip(['header', '#board'], 12);
    },
  },
  {
    name: 'hint',
    async setup(page, t) {
      await open(page, 8);
      await page.click('#hint');
      const [a, b] = await page.evaluate(() => { const g = window.deckgame.game; return g.hint().map(x => g.tiles.indexOf(x)); });
      await page.waitForTimeout(700);                                // the hint pulses; catch it lit up
      await t.label('#hint', 'Hint…', { at: 'bottom' });
      await t.label(tile(a), '', { box: true });
      await t.label(tile(b), '…shows a pair you can take', { at: 'bottom', box: true, dy: 40 });
      await t.clip(['header', '#board'], 20);
    },
  },
  {
    name: 'stuck',
    async setup(page, t) {
      // take free pairs in deal order until no pair is left: it happens to everyone
      for (let seed = 1; seed < 60; seed++) {
        await open(page, seed);
        const stuck = await page.evaluate(() => {
          const g = window.deckgame.game;
          for (let m; (m = g.hint()); ) {
            const free = g.tiles.filter(x => g.free(x));
            // a careless player: the pair whose tiles come first on the board, not the safe order
            const a = free.find(x => free.some(y => y !== x && g.canRemove(x, y)));
            g.remove(a, free.find(y => y !== a && g.canRemove(a, y)));
          }
          return g.stuck && g.left > 40;
        });
        if (stuck) break;
      }
      await page.evaluate(() => window.deckgame.refresh());
      await t.style('#msg { margin-bottom: 44px !important; }');
      await page.evaluate(() => window.deckgame.refresh());
      await t.label('#msg b', 'No pairs left to take', { at: 'bottom', box: true });
      await t.label('#shuffle', 'Shuffle: deals the rest again, always solvable', { at: 'bottom', dx: -120, dy: 50 });
      await t.clip(['header', '#msg', '#board'], 16);
    },
  },
  {
    name: 'toolbar',
    viewport: { width: 900, height: 320 },
    async setup(page, t) {
      await open(page, 5);
      await page.evaluate(() => { document.getElementById('app').style.paddingTop = '64px'; });
      await t.style('#stats { margin-top: 44px; }');
      await t.label('#undo', 'Take back a pair', { at: 'top', dx: -30 });
      await t.label('#shuffle', 'Rearrange', { at: 'top' });
      await t.label('#restart', 'This deal again', { at: 'bottom' });
      await t.label('#new', 'A new deal', { at: 'top', dx: 30 });
      await t.label('#stats', 'Tiles left, moves, time, best time', { at: 'bottom', box: false, dx: -160, dy: -2 });
      await t.hide('#msg, #board');
      await t.clip(['header'], 14);
    },
  },
  {
    name: 'won',
    async setup(page, t) {
      await open(page, 5, () => {
        const g = window.deckgame.game;
        g.solution.slice(0, -1).forEach(([a, b]) => g.remove(g.tiles[a], g.tiles[b]));
      });
      const [a, b] = await page.evaluate(() => { const g = window.deckgame.game; return g.solution.at(-1); });
      await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 7 * 60e3 + 42e3; });   // as if it took 7:42
      await page.click(tile(a)); await page.click(tile(b));
      await page.waitForSelector('#over.show');
      await t.clip('#over > div', 0);
    },
  },
];
