// The pictures in guide/index.html. Run:  npm run shots -- bridge   (see tools/guide-shots/shoot.mjs)
// Real deals from fixed seeds (?seed=n), played through the page with the robots running at full speed (?fast).

export const viewport = { width: 960, height: 900 };

// open the table in a mode, and wait until it's your move
async function open(page, mode, seed) {
  await page.evaluate(m => { try { localStorage.setItem('deckgames.bridge.mode', m); localStorage.removeItem(`deckgames.bridge.totals.${m}`); } catch {} }, mode);
  await page.goto(page.url().split('?')[0] + `?fast&seed=${seed}`);
  await yourMove(page);
}
const yourMove = page => page.waitForFunction(() => { const d = window.deckgame; return d.table && !d.busy && (d.table.isHumanTurn() || d.table.phase === 'done'); });
// play the first legal card, as you would by clicking it
async function playOne(page) { await page.click('.fan .card.legal >> nth=0', { position: { x: 6, y: 20 } }); await yourMove(page); }   // its visible edge: the next card covers the rest

export const shots = [
  {
    name: 'table',
    async setup(page, t) {
      await open(page, 'declare', 3);
      await t.style('#status { margin-bottom: 70px !important; } #tbl { margin-top: 30px; }');   // before any label: it moves things
      await t.label('#n .fan', "Dummy: your partner's cards, face up. You play them too", { at: 'top', box: true, dy: -24 });
      await t.label('#s .fan', 'Your hand: you are the declarer', { at: 'bottom' });
      await t.label('#w .pill', 'Defender', { at: 'bottom' });
      await t.label('#e .pill', 'Defender', { at: 'bottom' });
      await t.label('#c', 'The trick', { at: 'right', dx: 60 });
      await t.label('#status b', 'The contract, and the tricks you need', { at: 'right', box: true, dx: 270 });
      await t.clip('#app', 4);
    },
  },
  {
    name: 'follow',
    async setup(page, t) {
      await open(page, 'declare', 3);
      // play on until your own hand must follow suit and can't play everything
      for (let i = 0; i < 52; i++) {
        const ok = await page.evaluate(() => { const p = window.deckgame.table.play; return p && p.turn === 'S' && p.trick.length > 0 && document.querySelector('#s .card.dim'); });
        if (ok) break;
        await playOne(page);
      }
      await t.style('#s { padding-bottom: 54px; }');
      await t.label('#s .card.legal >> nth=0', 'You can play these…', { at: 'bottom', box: true });
      await t.label('#s .card.dim >> nth=-1', '…not these: you must follow suit', { at: 'bottom', box: true, dx: 60 });
      await t.label('#c', 'Led suit', { at: 'right' });
      await t.hide('#n, #w, #e');
      await t.clip(['#c', '#s'], 18);
    },
  },
  {
    name: 'result',
    async setup(page, t) {
      await open(page, 'declare', 3);
      while (await page.evaluate(() => window.deckgame.table.phase !== 'done')) await playOne(page);
      await t.style('#status { margin-bottom: 40px !important; }');
      await t.label('#status b >> nth=1', 'Made, or down, and the score', { at: 'bottom', box: true });
      await t.label('#next', 'Deal the next hand', { at: 'bottom' });
      await t.label('#stats', 'Your running total', { at: 'bottom', dy: 40 });
      await t.clip(['header', '#status'], 14);
    },
  },
  {
    name: 'bidding',
    async setup(page, t) {
      await open(page, 'full', 4);
      await t.style('#bidpane { gap: 40px 60px !important; margin-top: 54px !important; }');
      await t.label('table.auc', 'The auction: everyone’s calls so far', { at: 'top', box: true });
      await t.label('#box', 'Your bidding box: grey means not allowed now', { at: 'top', box: true, dx: 40 });
      await t.label('#box .wide', 'Pass, double, redouble', { at: 'bottom' });
      await t.clip(['#bidpane', '#status'], 14);
    },
  },
  {
    name: 'explain',
    async setup(page, t) {
      // a deal where a robot's bid before your first call has a meaning to show
      let seed = 1;
      for (; seed < 60; seed++) { await open(page, 'full', seed); if (await page.locator('table.auc td.alert').count()) break; }
      await page.click('table.auc td.alert >> nth=0');
      await t.style('#bidpane { margin-top: 54px !important; } #alert { margin-top: 40px !important; }');
      await t.label('table.auc td.alert >> nth=0', 'Click a dotted bid…', { at: 'top', box: true });
      await t.label('#alert', '…to see what it means', { at: 'bottom', box: true });
      await t.clip(['#bidpane'], 14);
    },
  },
  {
    name: 'toolbar',
    viewport: { width: 960, height: 300 },
    async setup(page, t) {
      await open(page, 'declare', 3);
      await t.hide('#status, #tbl, #bidpane');
      await page.evaluate(() => { document.getElementById('app').style.paddingTop = '64px'; });
      await t.label('#mode', 'Just declare, or Bid and play', { at: 'top' });
      await t.label('#stats', 'Hands played and total score', { at: 'bottom' });
      await t.label('a.help', 'This guide', { at: 'top' });
      await t.clip('header', 14);
    },
  },
];
