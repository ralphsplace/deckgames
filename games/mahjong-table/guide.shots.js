// The pictures in guide/index.html. Run:  npm run shots -- mahjong-table   (see tools/guide-shots/shoot.mjs)
// Real deals from fixed seeds (?seed), robots at full speed (?fast). Where a picture needs a particular hand, ?hand
// and ?draw swap those tiles in from the wall, so every tile count stays legal.

export const viewport = { width: 1000, height: 900 };

// open a match and wait until you have something to do
async function open(page, { variant = 'hk', seed = 3, hand, draw } = {}) {
  await page.evaluate(v => { try { localStorage.setItem('deckgames.mjtable.variant', v); } catch {} }, variant);
  const q = new URLSearchParams({ fast: '', seed: String(seed) });
  if (hand) q.set('hand', hand.join(','));
  if (draw) q.set('draw', draw);
  await page.goto(page.url().split('?')[0] + '?' + q);
  await yourMove(page);
}
const yourMove = page => page.waitForFunction(() =>
  document.querySelector('#hand .tile.pick') || document.querySelector('#actions button') || document.querySelector('#over.show'));
const has = (page, text) => page.locator(`#actions button:has-text("${text}")`).count();
// your next n moves: pass on every claim, throw out the tile you drew (stops early if the hand ends)
async function playOn(page, n) {
  for (let i = 0; i < n && !(await page.locator('#over.show').count()); i++) {
    if (await has(page, 'Pass')) await page.click('#actions button:has-text("Pass")');
    else await page.click('#hand .tile.pick >> nth=-1');
    await yourMove(page);
  }
}

// the dealer's hand that wins on its first draw with three dragon pungs (3 faan in Hong Kong rules, plus self-draw)
const DRAGONS = { hand: ['R', 'R', 'R', 'G', 'G', 'G', 'P', 'P', 'P', 'b1', 'b2', 'b3', 'd5'], draw: 'd5' };
// ready (one tile from winning, waiting on c3), and the first draw doesn't help: time to declare riichi
const READY = { hand: ['c1', 'c2', 'd4', 'd5', 'd6', 'b7', 'b8', 'b9', 'c5', 'c6', 'c7', 'd2', 'd2'], draw: 'N' };

export const shots = [
  {
    name: 'table',
    async setup(page, t) {
      await open(page);
      await playOn(page, 7);
      await page.waitForSelector('#hand .tile.drawn');
      await t.style('#mid { margin: 40px 0 !important; } #me { margin-top: 40px !important; } #app > .seat#s2 { margin-top: 40px; }');
      await t.label('#info', 'Rules, round, tiles left in the wall', { at: 'bottom', box: true, dx: 260, dy: -6 });
      await t.label('#s2 h3', 'The robots: Across, Left and Right', { at: 'top', box: true, dx: -260 });
      await t.label('#pool', 'Discards, by player; the latest has a gold edge', { at: 'top', box: true });
      await t.label('#hand .tile.drawn', 'Just drawn', { at: 'right', box: true });
      await t.label('#me h3', 'You, your seat wind, and your score', { at: 'top', box: true, dx: -200 });
      await t.clip('#app', 4);
    },
  },
  {
    name: 'discard',
    async setup(page, t) {
      await open(page);
      await t.style('#me { margin-top: 46px !important; padding-bottom: 50px !important; }');
      await t.label('#hand .tile.pick >> nth=4', 'Your turn: click a tile to throw it out', { at: 'bottom', box: true });
      await t.label('#hand .tile.drawn', 'The tile you just drew sits apart', { at: 'top', box: true, dx: -60 });
      await t.clip('#me', 14);
    },
  },
  {
    name: 'claim',
    async setup(page, t) {
      // play real deals, passing and throwing out the drawn tile, until a robot discards a tile you can pung
      found: for (let seed = 1; seed < 40; seed++) {
        await open(page, { seed });
        for (let step = 0; step < 300; step++) {
          if (await page.locator('#over.show').count()) break;
          if (await has(page, 'Pung')) break found;
          if (await has(page, 'Pass')) await page.click('#actions button:has-text("Pass")');
          else if (await page.locator('#hand .tile.pick').count()) await page.click('#hand .tile.pick >> nth=-1');
          await yourMove(page);
        }
      }
      await t.style('#actions { margin: 50px 0 !important; }');
      await t.label('#pool .tile.last', 'A robot threw this out', { at: 'bottom', box: true });
      await t.label('#actions', 'Take it to make a set, or let it go', { at: 'bottom', box: true });
      await t.hide('#s2, #s1, #s3');
      await t.clip(['#mid', '#actions', '#me'], 10);
    },
  },
  {
    name: 'win',
    async setup(page, t) {
      await open(page, DRAGONS);
      await t.style('#actions { margin: 50px 0 !important; }');
      await t.label('#actions button.win', 'A winning hand: declare it', { at: 'top', box: true });
      await t.label('#hand', 'Three pungs of dragons, a chow and a pair', { at: 'bottom', box: true });
      await t.clip(['#actions', '#me'], 10);
    },
  },
  {
    name: 'win-result',
    async setup(page, t) {
      await open(page, DRAGONS);
      await page.click('#actions button.win');
      await page.waitForSelector('#over.show');
      await t.clip('#over > div', 0);
    },
  },
  {
    name: 'riichi',
    async setup(page, t) {
      await open(page, { variant: 'riichi', ...READY });
      await t.style('#actions { margin: 50px 0 !important; }');
      await t.label('#actions button:has-text("Riichi")', 'One tile from winning? Declare riichi', { at: 'top', box: true, dx: 120 });
      await t.clip(['#actions', '#me'], 10);
    },
  },
  {
    name: 'riichi-discard',
    async setup(page, t) {
      await open(page, { variant: 'riichi', ...READY });
      await page.click('#actions button:has-text("Riichi")');
      await page.waitForSelector('#hand .tile.last');
      await t.style('#actions { margin: 50px 0 !important; } #me { padding-bottom: 50px !important; }');
      await t.label('#actions button:has-text("Cancel riichi")', 'Changed your mind?', { at: 'top', box: true, dx: 40 });
      await t.label('#hand .tile.last >> nth=0', 'Then throw out a gold-edged tile: it keeps you one away', { at: 'bottom', box: true, dx: -60 });
      await t.clip(['#actions', '#me'], 10);
    },
  },
  {
    name: 'rules',
    viewport: { width: 1000, height: 320 },
    async setup(page, t) {
      await open(page, { variant: 'riichi' });
      await page.evaluate(() => { document.getElementById('app').style.paddingTop = '60px'; });
      await t.hide('#msg, #s2, #mid, #actions, #me');
      await t.label('#variant', 'Hong Kong or Riichi rules', { at: 'top' });
      await t.label('#new', 'Start again', { at: 'top', dx: 60 });
      await t.label('#info', 'Riichi shows the dora indicator, honba and riichi sticks here', { at: 'bottom', box: true, dx: -40 });
      await t.clip('header', 14);
    },
  },
];
