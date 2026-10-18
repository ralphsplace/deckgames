import test from 'node:test';
import assert from 'node:assert/strict';
import { deal, rng, hcp, SEATS } from './engine/cards.js';
import { newAuction, addCall, bid, PASS, X, isComplete, isLegal, contractOf } from './engine/auction.js';
import { trickWinner } from './engine/play.js';
import { score } from './engine/scoring.js';
import { Table } from './engine/table.js';
import { pickContract } from './ai/contract.js';
import { choosePlay } from './ai/player.js';
import { chooseCall } from './ai/bidder.js';

const C = (level, strain, dbl = 0) => ({ level, strain, dbl, declarer: 'S' });

test('deal: 4 x 13 distinct cards, 40 HCP total', () => {
  const h = deal(rng(1));
  const all = SEATS.flatMap(s => h[s]);
  assert.equal(new Set(all.map(c => c.s + c.r)).size, 52);
  assert.equal(all.length === 52 && SEATS.reduce((n, s) => n + hcp(h[s]), 0), 40);
});

test('scoring', () => {
  assert.equal(score(C(4, 'S'), 10, false), 420);
  assert.equal(score(C(3, 'N'), 10, false), 430);
  assert.equal(score(C(4, 'H', 1), 10, false), 590);
  assert.equal(score(C(6, 'N'), 12, false), 990);
  assert.equal(score(C(7, 'N'), 13, true), 2220);
  assert.equal(score(C(2, 'H'), 6, true), -200);
  assert.equal(score(C(3, 'N', 1), 6, false), -500);
  assert.equal(score(C(3, 'N', 1), 6, true), -800);
});

test('auction: contract, declarer, legality', () => {
  const a = newAuction('N');
  addCall(a, bid(1, 'H')); addCall(a, PASS); addCall(a, bid(2, 'H'));
  assert.equal(isLegal(a, bid(2, 'H')), false);   // insufficient bid
  assert.equal(isLegal(a, X), true);              // West may double South's bid
  addCall(a, PASS);                               // West passes
  assert.equal(isLegal(a, X), false);             // North may not double his own side's bid
  addCall(a, PASS); addCall(a, PASS);             // North, East pass
  assert.ok(isComplete(a));
  assert.deepEqual(contractOf(a), { level: 2, strain: 'H', dbl: 0, declarer: 'N' });
});

test('auction: passed out', () => {
  const a = newAuction('W');
  for (let i = 0; i < 4; i++) addCall(a, PASS);
  assert.ok(isComplete(a));
  assert.equal(contractOf(a), null);
});

test('trick winner: trump beats led suit, highest of led suit otherwise', () => {
  const t = [{ seat: 'W', card: { s: 'S', r: 5 } }, { seat: 'N', card: { s: 'S', r: 14 } },
             { seat: 'E', card: { s: 'H', r: 2 } }, { seat: 'S', card: { s: 'D', r: 14 } }];
  assert.equal(trickWinner(t, null), 'N');
  assert.equal(trickWinner(t, 'H'), 'E');
});

test('100 robot-played boards finish legally with 13 tricks', () => {
  for (let i = 0; i < 100; i++) {
    const t = new Table({ mode: 'declare', rand: rng(1000 + i), contractProvider: pickContract, bidder: chooseCall, player: choosePlay });
    let guard = 0;
    while (t.phase !== 'done') { t.robotStep(); assert.ok(++guard <= 52); }
    assert.equal(t.play.history.length, 13);
    assert.equal(t.play.tricks.NS + t.play.tricks.EW, 13);
    assert.ok(Number.isFinite(t.result.ns));
    assert.equal(t.play.contract.declarer, 'S');   // declare mode always puts the human in the declarer's chair
  }
});

test('full mode: robots bid, play, score, and move to the next board', () => {
  for (let i = 0; i < 50; i++) {
    const t = new Table({ mode: 'full', rand: rng(500 + i), contractProvider: pickContract, bidder: chooseCall, player: choosePlay });
    let guard = 0;
    while (t.phase !== 'done') { t.robotStep(); assert.ok(++guard <= 120); }
    assert.ok(t.result.passedOut || t.play.history.length === 13);
    assert.ok(Number.isFinite(t.result.ns));
  }
  const t = new Table({ mode: 'full', rand: rng(7), contractProvider: pickContract, bidder: chooseCall, player: choosePlay });
  t.nextBoard();
  assert.equal(t.board, 2);
  assert.equal(t.phase, 'auction');
});
