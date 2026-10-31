import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from './engine/game.js';
import { rng } from '../../shared/rng.js';

const C = (r, s, up = true) => ({ r, s, up });                       // s: 0 spades, 1 hearts, 2 diamonds, 3 clubs
const empty = () => ({ stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []], moves: 0 });

test('deal: 52 distinct cards, 1-7 to the tableau with only the top face up, 24 in the stock', () => {
  const G = K.deal(rng(7));
  assert.deepEqual(G.tab.map(c => c.length), [1, 2, 3, 4, 5, 6, 7]);
  for (const col of G.tab) assert.deepEqual(col.map(c => c.up), col.map((_, i) => i === col.length - 1));
  assert.equal(G.stock.length, 24);
  assert.ok(G.stock.every(c => !c.up));
  const all = [...G.stock, ...G.tab.flat()];
  assert.equal(new Set(all.map(c => `${c.s}:${c.r}`)).size, 52);
});

test('deal: the same seed gives the same deal, another seed a different one', () => {
  const key = G => JSON.stringify(G);
  assert.equal(key(K.deal(rng(1))), key(K.deal(rng(1))));
  assert.notEqual(key(K.deal(rng(1))), key(K.deal(rng(2))));
});

test('foundations take an ace first, then the next rank of the same suit', () => {
  assert.ok(K.foundOK(C(1, 0), []));
  assert.ok(!K.foundOK(C(2, 0), []));
  assert.ok(K.foundOK(C(2, 0), [C(1, 0)]));
  assert.ok(!K.foundOK(C(2, 1), [C(1, 0)]));                         // other suit
  assert.ok(!K.foundOK(C(3, 0), [C(1, 0)]));                         // skips a rank
});

test('tableau piles take a king when empty, else one rank lower in the other colour on a face-up card', () => {
  assert.ok(K.tabOK(C(13, 0), []));
  assert.ok(!K.tabOK(C(12, 0), []));
  assert.ok(K.tabOK(C(6, 1), [C(7, 0)]));                            // red 6 on black 7
  assert.ok(!K.tabOK(C(6, 3), [C(7, 0)]));                           // black on black
  assert.ok(!K.tabOK(C(5, 1), [C(7, 0)]));                           // two ranks lower
  assert.ok(!K.tabOK(C(6, 1), [C(7, 0, false)]));                    // onto a face-down card
});

test('moving a run takes every card above the one picked, and turns over the card left behind', () => {
  const G = empty();
  G.tab[0] = [C(9, 0, false), C(8, 1), C(7, 0)];
  G.tab[1] = [C(9, 3)];
  assert.ok(K.move(G, { pile: 't0', idx: 1 }, 't1'));
  assert.deepEqual(G.tab[1].map(c => c.r), [9, 8, 7]);
  assert.deepEqual(G.tab[0], [C(9, 0, true)]);
  assert.equal(G.moves, 1);
});

test('a move the rules refuse changes nothing', () => {
  const G = empty();
  G.tab[0] = [C(8, 1)];
  G.tab[1] = [C(9, 1)];                                              // same colour
  const before = JSON.stringify(G);
  assert.ok(!K.move(G, { pile: 't0', idx: 0 }, 't1'));
  assert.ok(!K.move(G, { pile: 't0', idx: 0 }, 't0'));               // onto itself
  assert.ok(!K.move(G, { pile: 't0', idx: 0 }, 'waste'));
  assert.equal(JSON.stringify(G), before);
});

test('only one card at a time goes to a foundation, from the waste or a tableau pile', () => {
  const G = empty();
  G.waste = [C(1, 2)];
  G.tab[0] = [C(2, 2), C(1, 0)];
  assert.ok(K.move(G, { pile: 'waste', idx: 0 }, 'f0'));
  assert.ok(!K.move(G, { pile: 't0', idx: 0 }, 'f0'));               // a run of two
  assert.ok(K.move(G, { pile: 't0', idx: 1 }, 'f1'));
  assert.ok(K.move(G, { pile: 't0', idx: 0 }, 'f0'));
  assert.deepEqual(G.found[0].map(c => c.r), [1, 2]);
});

test('a card can come back down from a foundation', () => {
  const G = empty();
  G.found[0] = [C(1, 1), C(2, 1)];
  G.tab[0] = [C(3, 0)];
  assert.ok(K.move(G, { pile: 'f0', idx: 1 }, 't0'));
  assert.equal(G.found[0].length, 1);
});

test('drawing moves n cards face up to the waste, and an empty stock turns the waste back over', () => {
  const G = empty();
  G.stock = [C(1, 0, false), C(2, 0, false), C(3, 0, false), C(4, 0, false)];
  assert.ok(K.draw(G, 3));
  assert.deepEqual(G.waste.map(c => [c.r, c.up]), [[4, true], [3, true], [2, true]]);
  assert.ok(K.draw(G, 3));                                           // only one left
  assert.equal(G.stock.length, 0);
  assert.ok(K.draw(G, 3));                                           // redeal
  assert.deepEqual(G.stock.map(c => [c.r, c.up]), [[1, false], [2, false], [3, false], [4, false]]);
  assert.equal(G.waste.length, 0);
  assert.ok(!K.draw(empty(), 1));
});

test('flip turns over only a face-down top card of a tableau pile', () => {
  const G = empty();
  G.tab[0] = [C(5, 0, false)];
  assert.ok(K.flip(G, 't0'));
  assert.ok(G.tab[0][0].up);
  assert.ok(!K.flip(G, 't0'));
  assert.ok(!K.flip(G, 't1'));
});

test('collection: waits for the stock and waste to empty, takes the lowest card first, and wins', () => {
  const G = empty();
  for (let s = 0; s < 4; s++) G.found[s] = Array.from({ length: 11 }, (_, i) => C(i + 1, s));  // A-J up
  G.tab[0] = [C(13, 0), C(12, 1)];
  G.tab[1] = [C(13, 1), C(12, 0)];
  G.tab[2] = [C(13, 2), C(12, 3)];
  G.tab[3] = [C(13, 3), C(12, 2)];
  G.waste = [C(1, 0)];                                               // not empty yet: no collecting
  assert.ok(!K.canCollect(G));
  G.waste = [];
  assert.ok(K.canCollect(G));
  let steps = 0, m;
  while ((m = K.nextToCollect(G))) {
    assert.equal(K.pileOf(G, m.pile).at(-1).r, Math.min(...G.tab.filter(c => c.length).map(c => c.at(-1).r)));
    K.collect(G, m);
    steps++;
  }
  assert.equal(steps, 8);
  assert.ok(K.won(G));
});
