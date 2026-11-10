// The pictures in guide/index.html. Run:  npm run shots -- solitaire   (see tools/guide-shots/shoot.mjs)
// Each position comes from playing the real rules from a fixed seed, so the pictures are reproducible and legal.
import * as K from './engine/game.js';
import { rng } from '../../shared/rng.js';

// ---- finding positions ----
const piles = ['waste', ...[0, 1, 2, 3, 4, 5, 6].map(i => 't' + i)];
const tabs = [0, 1, 2, 3, 4, 5, 6].map(i => 't' + i);

// every move a player could make now, as { sel, target }
function moves(G) {
  const out = [];
  for (const from of piles) {
    const p = K.pileOf(G, from);
    const starts = from === 'waste' ? (p.length ? [p.length - 1] : []) : p.map((c, i) => (c.up ? i : -1)).filter(i => i >= 0);
    for (const idx of starts) {
      const sel = { pile: from, idx };
      for (const target of [...tabs, 'f0', 'f1', 'f2', 'f3']) if (K.canMove(G, sel, target)) out.push({ sel, target });
    }
  }
  return out;
}
// play at random from a seed until `want(G, moves)` returns something; that and the position are the answer
function find(want, { seeds = 400, steps = 160 } = {}) {
  for (let seed = 1; seed <= seeds; seed++) {
    const r = rng(seed), G = K.deal(r);
    for (let s = 0; s < steps; s++) {
      const ms = moves(G);
      const hit = want(G, ms);
      if (hit) return { state: structuredClone(G), ...hit };
      const useful = ms.filter(m => !(m.sel.pile[0] === 't' && m.sel.idx === 0 && m.target[0] === 't'));   // no king shuffling
      if (useful.length && r() < 0.7) { const m = useful[Math.floor(r() * useful.length)]; K.move(G, m.sel, m.target); }
      else if (!K.draw(G, 1)) break;
    }
  }
  throw new Error('no position found');
}
const moveWhere = test => (G, ms) => { const m = ms.find(x => test(G, x)); return m && { move: m }; };
const under = (G, m) => K.pileOf(G, m.sel.pile)[m.sel.idx - 1];

// ---- the ending: stock and waste empty, every card face up ----
function ending(splitLast) {
  const C = (s, r) => ({ s, r, up: true });                         // s: 0 spades, 1 hearts, 2 diamonds, 3 clubs
  const G = { stock: [], waste: [], found: [0, 1, 2, 3].map(s => [1, 2, 3, 4, 5, 6, 7, 8, 9].map(r => C(s, r))),
    tab: [[C(0, 13), C(1, 12), C(0, 11), C(1, 10)], [C(1, 13), C(0, 12), C(1, 11), C(0, 10)],
          [C(3, 13), C(2, 12), C(3, 11), C(2, 10)], [C(2, 13), C(3, 12), C(2, 11), C(3, 10)], [], [], []], moves: 141 };
  if (splitLast) G.tab[4].push(G.tab[3].pop());                      // one move left to make: 10♣ back onto J♦
  return G;
}

// ---- helpers for the page ----
const load = (page, state, draw = 1) => page.evaluate(a => window.deckgame.load(a), { state, draw });
const card = (pile, idx) => `#${pile} .card[data-idx="${idx}"]`;
const top = pile => `#${pile} .card:last-child`;
const spot = pile => `#${pile}`;
// click a card where a player would: its visible top strip (cards lower in the pile cover the rest)
const pick = (page, sel) => page.click(sel, { position: { x: 20, y: 8 } });                                     // a pile, empty or not
const BOARD = '#board';
// a board-only picture: the header stays out of it, so name tags above the cards sit on clear felt
async function board(page, t, state, draw = 1) { await load(page, state, draw); await t.hide('header'); }

export const shots = [
  {
    name: 'table',
    async setup(page, t) {
      await board(page, t, K.deal(rng(7)));
      await page.click('#stock');                                    // one card in the waste, so it shows
      await t.label(spot('stock'), 'Stock', { at: 'top' });
      await t.label(spot('waste'), 'Waste', { at: 'top' });
      await t.label([spot('f0'), spot('f3')], 'Foundations: build each suit up from the ace', { at: 'top' });
      await t.label([spot('t0'), spot('t6')], 'Tableau: seven piles to sort out', { at: 'bottom', box: false });
      await t.clip(BOARD, 18);
    },
  },
  {
    name: 'toolbar',
    viewport: { width: 900, height: 300 },
    async setup(page, t) {
      await load(page, K.deal(rng(7)));
      await page.evaluate(() => { document.getElementById('app').style.paddingTop = '64px'; });
      await t.hide('#board');
      await t.label('#draw', 'Draw 1 or 3 cards', { at: 'top' });
      await t.label('#undo', 'Take back a move', { at: 'bottom' });
      await t.label('#new', 'Deal again', { at: 'top' });
      await t.label('a.help', 'This guide', { at: 'bottom' });
      await t.label('#stats', 'Moves so far', { at: 'bottom' });
      await t.clip('header', 14);
    },
  },
  {
    name: 'move-pick',
    async setup(page, t) {
      const f = find(moveWhere((G, m) => m.sel.pile[0] === 't' && m.target[0] === 't'
        && K.selected(G, m.sel).length === 1 && under(G, m) && !under(G, m).up), { steps: 1 });
      await board(page, t, f.state);
      await pick(page, card(f.move.sel.pile, f.move.sel.idx));      // a real click: the card is picked up
      await t.label(card(f.move.sel.pile, f.move.sel.idx), '1. Click a card', { at: 'bottom', box: false, dy: 4 });
      await t.arrow(card(f.move.sel.pile, f.move.sel.idx), top(f.move.target), { from: 'top', to: 'bottom', bend: 0.25 });
      await t.label(top(f.move.target), '2. Click where it goes', { at: 'top', box: false });
      await t.clip(BOARD, 18);
    },
  },
  {
    name: 'move-done',
    async setup(page, t) {
      const f = find(moveWhere((G, m) => m.sel.pile[0] === 't' && m.target[0] === 't'
        && K.selected(G, m.sel).length === 1 && under(G, m) && !under(G, m).up), { steps: 1 });
      await board(page, t, f.state);
      await pick(page, card(f.move.sel.pile, f.move.sel.idx));
      await pick(page, top(f.move.target));
      await t.label(top(f.move.target), 'One lower, other colour', { at: 'bottom', dy: -8 });
      await t.label(top(f.move.sel.pile), 'Turned over for you', { at: 'top' });
      await t.clip(BOARD, 18);
    },
  },
  {
    name: 'move-run',
    async setup(page, t) {
      const f = find(moveWhere((G, m) => m.sel.pile[0] === 't' && m.target[0] === 't' && m.sel.idx > 0 && K.selected(G, m.sel).length >= 2));
      await board(page, t, f.state);
      await pick(page, card(f.move.sel.pile, f.move.sel.idx));
      await t.label(`#${f.move.sel.pile} .card.sel >> nth=-1`, 'Click the highest card of a run: the cards on it come along', { at: 'bottom', box: false, dy: 52 });
      await t.arrow(`#${f.move.sel.pile} .card.sel >> nth=-1`, top(f.move.target), { from: 'bottom', to: 'bottom', bend: -0.18 });
      await t.clip(BOARD, 18);
    },
  },
  {
    name: 'king',
    async setup(page, t) {
      const f = find(moveWhere((G, m) => !K.pileOf(G, m.target).length && m.target[0] === 't'
        && K.selected(G, m.sel)[0].r === 13 && (m.sel.pile === 'waste' || m.sel.idx > 0)));
      await board(page, t, f.state);
      await t.label(card(f.move.sel.pile, f.move.sel.idx), 'Only a king can go on an empty pile', { at: 'top', box: false });
      await t.label(spot(f.move.target), '');
      await t.arrow(card(f.move.sel.pile, f.move.sel.idx), spot(f.move.target), { from: 'bottom', to: 'center', bend: 0.2 });
      await t.clip(BOARD, 18);
    },
  },
  {
    name: 'stock',
    async setup(page, t) {
      await board(page, t, K.deal(rng(12)));
      for (let i = 0; i < 4; i++) await page.click('#stock');
      await t.label(spot('stock'), 'Click for the next card', { at: 'top', dx: -40 });
      await t.label(top('waste'), 'The top card plays like any other', { at: 'top', dx: 170 });
      await t.clip(BOARD, 18);
    },
  },
  {
    name: 'draw3',
    async setup(page, t) {
      await board(page, t, K.deal(rng(12)), 3);
      for (let i = 0; i < 2; i++) await page.click('#stock');
      await t.label(spot('waste'), 'Draw 3: three come out, only the top one plays', { at: 'top', dx: 160 });
      await t.clip(BOARD, 18);
    },
  },
  {
    name: 'recycle',
    async setup(page, t) {
      const G = K.deal(rng(12));
      while (G.stock.length) K.draw(G, 1);
      await board(page, t, G);
      await t.label(spot('stock'), 'Stock used up: click it to turn the waste back over', { at: 'top', dx: 200 });
      await t.clip(BOARD, 18);
    },
  },
  {
    name: 'foundation',
    async setup(page, t) {
      const f = find(moveWhere((G, m) => m.target === 'f0' && m.sel.pile[0] === 't' && G.found.every(x => !x.length)));
      await board(page, t, f.state);
      await t.label(top(f.move.sel.pile), 'Double-click an ace', { at: 'bottom' });
      await t.arrow(top(f.move.sel.pile), spot('f0'), { from: 'top', to: 'bottom', bend: 0.2 });
      await t.label(spot('f0'), 'It goes up by itself', { at: 'top' });
      await t.clip(BOARD, 18);
    },
  },
  {
    name: 'finish',
    async setup(page, t) {
      await board(page, t, ending(true));
      await t.label([spot('stock'), spot('waste')], 'Stock and waste empty', { at: 'top' });
      await t.arrow(top('t4'), top('t3'), { from: 'top', to: 'right', bend: 0.25 });
      await t.label(top('t4'), 'Make one more move…', { at: 'bottom' });
      await t.label([spot('f0'), spot('f3')], '…and every card flies up here by itself', { at: 'top' });
      await t.clip(BOARD, 18);
    },
  },
  {
    name: 'won',
    async setup(page, t) {
      await load(page, ending(true));
      await pick(page, top('t4'));
      await pick(page, top('t3'));                                   // the last move: collection starts
      await page.waitForSelector('#win.show', { timeout: 20000 });
      await t.clip(['#win > div', BOARD], 0);
    },
  },
  {
    name: 'phone',
    viewport: { width: 390, height: 760 },
    async setup(page, t) {
      await load(page, K.deal(rng(7)));
      await page.click('#stock');
      await t.clip('#app', 0);
    },
  },
];
