import test from 'node:test';
import assert from 'node:assert/strict';
import { SHEET_RULES as R } from './engine/rules.js';
import { makeDeck, handPoints, isWild } from './engine/cards.js';
import { parseContract, meetsContract } from './engine/contracts.js';
import { makeBook, makeRun, extendMeld } from './engine/melds.js';
import { Round, RuleError } from './engine/round.js';
import { Game } from './engine/game.js';
import { plan } from './ai/planner.js';
import { robotTurn } from './ai/robot.js';
import { rng } from '../../shared/rng.js';

let nid = 1000;
const C = (r, s = 'S') => ({ id: nid++, r, s });
const J = () => ({ id: nid++, joker: true, s: 'X', r: 0 });
const types = m => m.cells.map(x => x.as);

test('deck: two decks with jokers, 108 distinct ids, 12 wilds', () => {
  const d = makeDeck(R);
  assert.equal(d.length, 108);
  assert.equal(new Set(d.map(c => c.id)).size, 108);
  assert.equal(d.filter(c => isWild(c, R)).length, 4 + 8);
});

test('penalty points match the sheet: A, 2, joker 50; 10-K 10; 3-9 5', () => {
  assert.equal(handPoints([C(14), C(2), J()], R), 150);
  assert.equal(handPoints([C(10), C(11), C(12), C(13)], R), 40);
  assert.equal(handPoints([C(3), C(9)], R), 10);
});

test('every contract on the sheet parses', () => {
  assert.equal(R.contracts.length, 13);
  assert.deepEqual(parseContract('1 Book+1 Run of 3'), [{ type: 'book', n: 3 }, { type: 'run', n: 3 }]);
  assert.deepEqual(parseContract('Run of 4+book of3'), [{ type: 'run', n: 4 }, { type: 'book', n: 3 }]);
  assert.deepEqual(parseContract('3 Runs of 3').length, 3);
  assert.deepEqual(parseContract('1 Book of 7'), [{ type: 'book', n: 7 }]);
  for (const c of R.contracts) assert.ok(parseContract(c).length >= 1);
});

test('contract matching: right types, long enough, groups may be longer', () => {
  const q = parseContract('Run of 4+book of3');
  assert.ok(meetsContract([{ type: 'book', size: 3 }, { type: 'run', size: 4 }], q));
  assert.ok(meetsContract([{ type: 'book', size: 5 }, { type: 'run', size: 6 }], q));
  assert.ok(!meetsContract([{ type: 'book', size: 3 }, { type: 'run', size: 3 }], q));
  assert.ok(!meetsContract([{ type: 'book', size: 3 }, { type: 'book', size: 4 }], q));
  assert.ok(!meetsContract([{ type: 'run', size: 4 }], q));
});

test('books: one rank, any suits, wilds fill in, need a natural', () => {
  assert.ok(makeBook([C(7, 'S'), C(7, 'H'), C(7, 'S')], R));             // duplicates from two decks are fine
  assert.ok(makeBook([C(7), C(2), J()], R));
  assert.equal(makeBook([C(7), C(8), C(7)], R), null);
  assert.equal(makeBook([C(2), J(), C(2)], R), null);                    // all wild
  assert.equal(makeBook([C(7), C(7)], R), null);
});

test('runs: one suit, in a row, ace high only, wilds fill gaps then extend upward', () => {
  assert.deepEqual(types(makeRun([C(5), C(6), C(7)], R)), [5, 6, 7]);
  assert.deepEqual(types(makeRun([C(5), J(), C(7)], R)), [5, 6, 7]);
  assert.deepEqual(types(makeRun([C(5), C(6), J()], R)), [5, 6, 7]);
  assert.deepEqual(types(makeRun([C(13), C(14), J()], R)), [12, 13, 14]); // can't go past the ace, so it goes low
  assert.ok(makeRun([C(12), C(13), C(14)], R));                          // Q-K-A
  assert.equal(makeRun([C(14), C(3), J()], R), null);                    // A-2-3 isn't allowed
  assert.deepEqual(types(makeRun([C(3), C(4), J()], R)), [3, 4, 5]);
  assert.deepEqual(types(makeRun([C(3), C(14, 'H'), J()].slice(0, 1).concat([J(), J()]), R)), [3, 4, 5]);
  assert.equal(makeRun([C(5), C(6, 'H'), C(7)], R), null);              // mixed suits
  assert.equal(makeRun([C(5), C(5), C(6)], R), null);                   // repeated rank
  assert.equal(makeRun([C(5), C(9), J()], R), null);                    // gap too big
});

test('laying off: books take the rank or a wild; runs grow at either end', () => {
  const b = makeBook([C(9), C(9), C(9)], R);
  assert.ok(extendMeld(b, C(9, 'D'), R));
  assert.ok(extendMeld(b, J(), R));
  assert.equal(extendMeld(b, C(8), R), null);
  const r = makeRun([C(5), C(6), C(7)], R);
  assert.deepEqual(types(extendMeld(r, C(8), R)), [5, 6, 7, 8]);
  assert.deepEqual(types(extendMeld(r, C(4), R)), [4, 5, 6, 7]);
  assert.equal(extendMeld(r, C(8, 'H'), R), null);
  assert.deepEqual(types(extendMeld(r, J(), R, 'low')), [4, 5, 6, 7]);
  const top = makeRun([C(12), C(13), C(14)], R);
  assert.equal(extendMeld(top, C(3), R), null);                          // no wrap past the ace
  assert.deepEqual(types(extendMeld(top, J(), R)), [11, 12, 13, 14]);    // a wild goes where there's room
});

function rigged(hands, top, contract = '2 Books of 3', players = 2) {
  const r = new Round(R, { contract, players, dealer: players - 1, rand: rng(1) });
  hands.forEach((h, s) => { r.players[s].hand = [...h]; });           // a copy: the round edits its hands
  r.discards = [top];
  return r;
}

test('a turn: draw, lay down the contract, lay off, discard; turn passes', () => {
  const a = [C(4), C(4, 'H'), C(4, 'D'), C(9), C(9, 'C'), J(), C(4, 'C'), C(12), C(13)];
  const r = rigged([a, [C(5), C(6), C(7)]], C(8, 'H'));
  assert.equal(r.turn, 0);
  assert.throws(() => r.discard(0, a[0].id), RuleError);                 // must draw first
  r.draw(0, 'discard');
  assert.throws(() => r.draw(0), RuleError);                             // only one draw
  assert.throws(() => r.layDown(0, [{ type: 'book', ids: [a[0].id, a[1].id, a[2].id] }]), RuleError);   // one book isn't the contract
  assert.throws(() => r.layOff(0, a[6].id, 1), RuleError);              // not down yet
  r.layDown(0, [{ type: 'book', ids: [a[0].id, a[1].id, a[2].id] }, { type: 'book', ids: [a[3].id, a[4].id, a[5].id] }]);
  assert.equal(r.melds.length, 2);
  r.layOff(0, a[6].id, r.melds[0].id);
  assert.equal(r.melds[0].cells.length, 4);
  assert.throws(() => r.layOff(0, a[7].id, r.melds[0].id), RuleError);  // a queen isn't a four
  r.discard(0, a[7].id);
  assert.equal(r.turn, 1); assert.equal(r.phase, 'draw');
  assert.equal(r.top.id, a[7].id);
});

test('going out ends the round: the others score what they hold, the winner 0', () => {
  const a = [C(4), C(4, 'H'), C(4, 'D'), C(9), C(9, 'C'), C(9, 'H')];
  const r = rigged([a, [C(14), C(2), C(10), C(3)]], C(11));
  r.draw(0, 'discard');
  r.layDown(0, [{ type: 'book', ids: a.slice(0, 3).map(c => c.id) }, { type: 'book', ids: a.slice(3).map(c => c.id) }]);
  r.discard(0, r.hand(0)[0].id);
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result, { outBy: 0, points: [0, 50 + 50 + 10 + 5] });
});

test('playing the last card onto the table also goes out', () => {
  const a = [C(4), C(4, 'H'), C(4, 'D'), C(9), C(9, 'C'), C(9, 'H')];
  const r = rigged([a, [C(5)]], C(4, 'S'));
  r.draw(0, 'discard');
  r.layDown(0, [{ type: 'book', ids: a.slice(0, 3).map(c => c.id) }, { type: 'book', ids: a.slice(3).map(c => c.id) }]);
  r.layOff(0, r.hand(0)[0].id, r.melds[0].id);
  assert.equal(r.phase, 'over'); assert.equal(r.result.outBy, 0);
});

test('planner finds a contract that needs wilds, and counts what is missing', () => {
  const h = [C(5, 'H'), C(6, 'H'), C(8, 'H'), J(), C(9, 'C'), C(10, 'C'), C(11, 'C'), C(2, 'D'), C(3)];   // 5-6-W-8, 9-10-J-W
  const p = plan(h, parseContract('2 Runs of 4'), R);
  assert.equal(p.missing, 0);
  const r = rigged([h, [C(3)]], C(13), '2 Runs of 4');
  r.draw(0);
  r.layDown(0, p.groups);
  assert.ok(r.players[0].down);
  assert.equal(plan([C(5), C(7, 'H'), C(13)], parseContract('2 Books of 3'), R).missing, 4);
  assert.equal(plan([C(5), C(5, 'H'), J()], parseContract('1 Book of 7'), R).missing, 4);
});

test('robots play complete 13-round games for 2 to 6 players, every move legal', () => {
  for (let players = 2; players <= 6; players++) {
    const G = new Game(R, { players, rand: rng(100 + players) });
    let rounds = 0;
    while (G.next()) {
      const r = G.current; let guard = 0;
      while (r.phase !== 'over') { for (const _ of robotTurn(r, r.turn)); assert.ok(++guard < 2000, 'round ran away'); }
      // all 108 cards accounted for
      const n = r.stock.length + r.discards.length + r.players.reduce((a, p) => a + p.hand.length, 0) + r.melds.reduce((a, m) => a + m.cells.length, 0);
      assert.equal(n, 108);
      for (const m of r.melds) assert.ok(m.cells.length >= 3);
      G.finish(); rounds++;
    }
    assert.equal(rounds, 13);
    assert.ok(G.over);
    assert.equal(G.sheet[0].length, 13);
    assert.ok(G.leaders().length >= 1);
  }
});

test('first round is led by seat 0, and the deal moves round to round', () => {
  const G = new Game(R, { players: 4, rand: rng(3) });
  assert.equal(G.next().turn, 0);
  G.current._end(0); G.finish();
  assert.equal(G.next().turn, 1);
});
