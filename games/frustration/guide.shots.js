// The pictures in guide/index.html. Run:  npm run shots -- frustration   (see tools/guide-shots/shoot.mjs)
// Every position is a real deal from a fixed seed; where a picture needs particular cards, they are swapped in from the
// stock or the robots' hands (rig.give), so all 108 cards stay in play and every move shown is legal.

// In-page helpers, added to the page before each picture.
const RIG = `
window.rig = (() => {
  const RANKS = { A: 14, K: 13, Q: 12, J: 11 };
  const parse = code => code === 'JK' ? { joker: true } : { r: RANKS[code.slice(0, -1)] || +code.slice(0, -1), s: code.slice(-1) };
  const fits = (c, w) => (w.joker ? !!c.joker : !c.joker && c.r === w.r && c.s === w.s);
  const r = () => window.deckgame.game.current;                     // the game's round (the page catches up on refresh)
  // the first matching card outside seat's hand: stock first, then the other hands
  function source(seat, w) {
    for (const from of [r().stock, ...r().players.filter((_, s) => s !== seat).map(p => p.hand)]) {
      const i = from.findIndex(c => fits(c, w)); if (i >= 0) return { from, i };
    }
    throw new Error('no card left to rig');
  }
  return {
    // seat's hand gets these cards (codes like '7S', '10H', 'KD', 'JK'); the rest of the hand is kept
    give(seat, codes) {
      const hand = r().players[seat].hand, pool = [...hand], got = [];
      const missing = [];
      for (const code of codes) {
        const w = parse(code), i = pool.findIndex(c => fits(c, w));
        if (i >= 0) got.push(pool.splice(i, 1)[0]); else missing.push(w);
      }
      for (const w of missing) { const { from, i } = source(seat, w); got.push(from[i]); from[i] = pool.pop(); }
      r().players[seat].hand = got.concat(pool);
    },
    // the next card drawn from the stock
    next(code) {
      const w = parse(code), st = r().stock, i = st.findIndex(c => fits(c, w));
      if (i >= 0) { [st[i], st[st.length - 1]] = [st[st.length - 1], st[i]]; return; }
      const s = source(0, w); [s.from[s.i], st[st.length - 1]] = [st[st.length - 1], s.from[s.i]];
    },
    // id of the card in seat 0's hand matching code (the n-th if several)
    id(code, n = 0) { const w = parse(code); return r().players[0].hand.filter(c => fits(c, w))[n].id; },
    // robots play every seat (yours too) to the end of this contract, then the next one is dealt and the robots play
    // up to your turn: a real game, moved on to round k
    async advanceTo(k) {
      const { robotTurn } = await import('./ai/robot.js');
      const g = window.deckgame.game;
      while (g.index + 1 < k) {
        const rd = g.current;
        while (rd.phase !== 'over') for (const _ of robotTurn(rd, rd.turn));
        g.finish(); g.next();
      }
      const rd = g.current;
      while (rd.turn !== 0 && rd.phase !== 'over') for (const _ of robotTurn(rd, rd.turn));
    },
  };
})();`;

export const viewport = { width: 1040, height: 900 };              // wide enough for the score sheet beside the table
const START = '?fast&seed=11';
// room above and below the action buttons, so labels there don't cover cards or other buttons
const ROOMY = '#actions { margin: 46px 0 !important; } #staged { margin-top: 46px !important; }';
const card = id => `#hand .card[data-id="${id}"]`;
const btn = text => `#actions button:has-text("${text}")`;
async function open(page, setup) {
  await page.evaluate(() => { try { localStorage.setItem('deckgames.frustration.players', '4'); } catch {} });
  await page.goto(page.url().split('?')[0] + START);
  await page.waitForSelector('#hand .card');
  await page.addScriptTag({ content: RIG });
  if (setup) await page.evaluate(setup);
  await page.evaluate(() => window.deckgame.refresh());
}
// click cards by code; returns their ids
async function pick(page, codes) {
  const ids = [];
  for (const [code, n] of codes.map(c => (Array.isArray(c) ? c : [c, 0]))) {
    const id = await page.evaluate(([c, k]) => window.rig.id(c, k), [code, n]);
    await page.click(card(id), { position: { x: 12, y: 12 } }); ids.push(id);
  }
  return ids;
}
// a round-1 hand holding two books, plus extras
const BOOKS = () => window.rig.give(0, ['7S', '7H', '7D', 'KC', 'KD', 'JK', '7C', '4H', '9S', 'QC']);

export const shots = [
  {
    name: 'table',
    async setup(page, t) {
      await open(page);
      await t.label('#opps', 'The robots: cards left, score, and whether they are down', { at: 'top', box: false, dx: -60 });
      await t.label(['#stock', '#disc'], 'Stock and discard pile', { at: 'left', dx: 250, dy: 62 });
      await t.label('#contract', "This round's contract", { at: 'right' });
      await t.label('#hand', 'Your hand', { at: 'bottom', box: true });
      await t.label('#sheet', 'The score sheet', { at: 'left', box: true, dy: 40 });
      await t.clip('#app', 4);
    },
  },
  {
    name: 'draw',
    async setup(page, t) {
      await open(page);
      await t.label('#stock', 'Draw from the stock…', { at: 'top' });
      await t.label('#disc', '…or take the top discard', { at: 'right' });
      await t.clip(['#mid', '#msg'], 14);
    },
  },
  {
    name: 'make-book',
    async setup(page, t) {
      await open(page, BOOKS);
      await t.style(ROOMY);
      await page.click('#stock');
      await pick(page, ['7S', '7H', '7D']);
      await t.label('#hand .card.sel >> nth=1', 'Pick three or more cards…', { at: 'bottom', box: false });
      await t.label(btn('Make a book'), '…then say what they make', { at: 'top' });
      await t.clip(['#actions', '#hand', '#msg'], 14);
    },
  },
  {
    name: 'find',
    async setup(page, t) {
      await open(page, BOOKS);
      await page.click('#stock');
      await t.style(ROOMY);
      await page.click(btn('Find my contract'));
      await t.label('#staged', 'Your contract, arranged', { at: 'top', box: false });
      await t.label(btn('Find my contract'), 'Or let the game find it', { at: 'bottom' });
      await t.label(btn('Lay down'), 'Then lay it down', { at: 'top' });
      await t.clip(['#staged', '#actions', '#hand'], 14);
    },
  },
  {
    name: 'down',
    async setup(page, t) {
      await open(page, BOOKS);
      await page.click('#stock');
      await page.click(btn('Find my contract'));
      await page.click(btn('Lay down'));
      await t.style(ROOMY);
      await t.hide('#mid, #opps, #msg');
      await pick(page, ['7C']);
      await t.label('#hand .card.sel', 'A card that fits…', { at: 'bottom', box: false });
      await t.arrow('#hand .card.sel', '#table .meld.fit', { from: 'top', to: 'bottom', bend: -0.2 });
      await t.label('#table .meld.fit', '…lights up the melds it can join: click one', { at: 'top', box: false });
      await t.clip(['#table', '#actions', '#hand'], 14);
    },
  },
  {
    name: 'wild',
    async setup(page, t) {
      await open(page, async () => {
        await window.rig.advanceTo(2);                                // 2 runs of 3
        window.rig.give(0, ['5H', '6H', 'JK', '9C', '10C', '2D', '4S', 'KS', '8D', '3C']);
      });
      await page.click('#stock');
      await page.click(btn('Find my contract'));
      await page.click(btn('Lay down'));
      const mine = '#table .owner:has(small:text-is("You"))';
      await t.style('#table .owner { padding: 46px 8px 10px !important; }');
      await t.label(`${mine} .meld .card.joker`, 'The joker plays the 7♥', { at: 'top', box: true });
      await t.label(`${mine} .meld >> nth=1`, 'and this 2♦ the J♣', { at: 'right', box: false });
      await t.clip(mine, 10);
    },
  },
  {
    name: 'discard',
    async setup(page, t) {
      await open(page, BOOKS);
      await page.click('#stock');
      await t.style(ROOMY);
      await pick(page, ['QC']);
      await t.label('#hand .card.sel', 'Pick one card', { at: 'bottom', box: false });
      await t.label(btn('Discard'), 'Discard it to end your turn', { at: 'top' });
      await t.clip(['#actions', '#hand'], 14);
    },
  },
  {
    name: 'round-over',
    viewport: { width: 1100, height: 900 },
    async setup(page, t) {
      await open(page, () => {
        window.rig.give(0, ['9S', '9H', '9D', '9C', '9S', 'KC', 'KD', 'KH', 'KS', 'JK']);
        window.rig.next('5D');
      });
      await page.click('#stock');
      await page.click(btn('Find my contract'));
      await page.click(btn('Lay down'));
      // lay off whatever fits, then discard the last card
      for (let i = 0; i < 8; i++) {
        const fit = await page.evaluate(() => { const r = window.deckgame.round; const c = r.hand(0).find(x => r.fits(x).length); return c ? c.id : null; });
        if (fit == null || (await page.locator('#hand .card').count()) === 1) break;
        await page.click(card(fit), { position: { x: 12, y: 12 } });
        await page.click('#table .meld.fit >> nth=0');
      }
      await page.click('#hand .card >> nth=0', { position: { x: 12, y: 12 } });
      await page.click(btn('Discard'));
      await page.waitForSelector('#over.show');
      await t.clip('#over > div', 0);
    },
  },
  {
    name: 'sheet',
    async setup(page, t) {
      await open(page, () => window.rig.advanceTo(6));
      await t.hide('header, main');
      await t.label('#sheet tr.now', 'The round being played', { at: 'left' });
      await t.label(['#sheet tbody tr:nth-child(2) td.p >> nth=0', '#sheet tbody tr:nth-child(2) td.t >> nth=0'],
        'Each round: your points, then your running total', { at: 'left', box: true, dx: -260 });
      await t.label('#sheet tfoot tr', 'Totals: lowest wins', { at: 'left' });
      await t.clip('#sheet', 12);
    },
  },
];
