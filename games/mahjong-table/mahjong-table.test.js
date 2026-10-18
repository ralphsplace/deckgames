import test from 'node:test';
import assert from 'node:assert/strict';
import { shanten, isComplete, decompositions, isThirteenOrphans } from './engine/hand.js';
import { hk } from './engine/rules/hk.js';
import { Round } from './engine/round.js';
import { Match } from './engine/match.js';
import { buildWall, sortTiles } from './engine/tiles.js';
import * as R from './ai/robot.js';
import { rng } from '../../shared/rng.js';

const T = s => s.split(' ');
const ev = (concealed, o = {}) => hk.evaluate({ concealed: T(concealed), melds: [], bonus: [], wind: 0, round: 0, selfDraw: false, ...o });

test('wall sizes', () => {
  assert.equal(buildWall(true).length, 144);
  assert.equal(buildWall(false).length, 136);
});

test('shanten and completeness', () => {
  assert.equal(shanten(T('c1 c2 c3 d4 d5 d6 b7 b8 b9 E E E R R')), -1);
  assert.equal(shanten(T('c1 c2 c3 d4 d5 d6 b7 b8 b9 E E E R'), 0), 0);
  assert.ok(isThirteenOrphans(T('c1 c9 d1 d9 b1 b9 E S W N R G P P')));
  assert.equal(shanten(T('c1 c9 d1 d9 b1 b9 E S W N R G P P')), -1);
  assert.ok(shanten(T('c1 c4 c7 d2 d5 d8 b3 b6 b9 E S W N')) >= 5);
  assert.equal([...decompositions(T('c1 c1 c1 c2 c3 c4 d5 d5 d5 b7 b8 b9 R R'), 4)].length > 0, true);
});

test('hong kong scoring', () => {
  // pure one suit, all chows, concealed, no flowers => 7 + common 1 + concealed 1 + no flowers 1 = 10 capped
  let r = ev('c1 c2 c3 c4 c5 c6 c7 c8 c9 c2 c3 c4 c9 c9');
  assert.ok(r.items.some(i => i.name === 'Pure one suit') && r.faan === 10);
  // all pungs with dragon pung, claimed meld
  r = hk.evaluate({ concealed: T('c2 c2 c2 d5 d5 d5 b9 b9'), melds: [{ type: 'pung', tiles: ['R', 'R', 'R'], open: true }, { type: 'kong', tiles: ['E', 'E', 'E', 'E'], open: true }],
    bonus: ['F1'], wind: 0, round: 0, selfDraw: false });
  const names = r.items.map(i => i.name);
  assert.ok(names.includes('All pungs') && names.includes('Dragon pung') && names.includes('Seat wind pung') && names.includes('Round wind pung') && names.includes('Seat flower'));
  assert.ok(!names.includes('Concealed hand') && !names.includes('No flowers'));
  // common hand needs a plain pair
  r = ev('c1 c2 c3 d4 d5 d6 b7 b8 b9 c5 c6 c7 d2 d2');
  assert.ok(r.items.some(i => i.name === 'Common hand'));
  r = ev('c1 c2 c3 d4 d5 d6 b7 b8 b9 c5 c6 c7 R R');
  assert.ok(!r.items.some(i => i.name === 'Common hand'));
  // thirteen orphans is a limit hand
  r = ev('c1 c9 d1 d9 b1 b9 E S W N R G P P');
  assert.equal(r.faan, 10);
  // not a hand
  assert.equal(ev('c1 c4 c7 d2 d5 d8 b3 b6 b9 E S W N N'), null);
  assert.equal(hk.points(3), 8);
  assert.deepEqual(hk.payments(1, null, 8), [-8, 24, -8, -8]);
  assert.deepEqual(hk.payments(2, 3, 16), [0, 0, 16, -16]);
});

test('round: deal, bonus handling, claims', () => {
  const r = new Round(hk, { rand: rng(7) });
  r.players.forEach(p => assert.equal(p.hand.length, 13));
  const total = r.wall.length + r.players.reduce((n, p) => n + p.hand.length + p.bonus.length, 0);
  assert.equal(total, 144);
  const t = r.draw();
  assert.equal(r.players[0].hand.length, 14); assert.ok(t);
  // rig a pung + chow claim
  const p1 = r.players[1], p2 = r.players[2];
  p2.hand = T('c5 c5 c9 d1 d1 d3 d4 d6 b2 b4 b6 b8 E');
  p1.hand = T('c1 c2 c3 c4 c6 d9 d9 b1 b1 b3 S S W');
  r.players[0].hand = T('c5 c1 c9 d9 d2 d3 d7 b5 b6 R G E S N');
  r.discard('c5');
  const o = r.claimOptions();
  assert.ok(o[2].pung && !o[2].kong);
  assert.deepEqual(o[1].chows.map(c => c.join('')).sort(), ['c3c4', 'c4c6'].sort());
  const res = r.resolve({ 2: { action: 'pung' } });
  assert.equal(res.type, 'pung'); assert.equal(r.turn, 2); assert.equal(r.phase, 'discard');
  assert.equal(r.players[2].melds[0].open, true); assert.equal(r.players[0].discards.length, 0);
});

test('a winning hand below the minimum cannot be declared', () => {
  const r = new Round(hk, { rand: rng(3) });
  r.draw();
  // chow-only hand with a dragon pair and flowers missing counts <3 faan => no win offered
  r.players[0].hand = T('c1 c2 c3 d4 d5 d6 b7 b8 b9 c5 c6 c7 R R');
  r.players[0].bonus = ['F2'];
  r.players[0].melds = [{ type: 'pung', tiles: ['E', 'E', 'E'], open: true }]; // wrong count -> not evaluated as win
  assert.equal(r.selfOptions().win, null);
  r.players[0].melds = [];
  const full = hk.evaluate({ concealed: r.players[0].hand, melds: [], bonus: ['F2'], wind: 0, round: 0, selfDraw: true });
  assert.equal(full.faan, 2); // concealed hand + self-drawn only; dragon pair blocks common hand, F2 is not the seat flower
  assert.equal(r.selfOptions().win, null);
});

test('robots play 25 full hands to a legal finish', () => {
  let wins = 0;
  for (let i = 0; i < 25; i++) {
    const m = new Match(hk, { rand: rng(100 + i) });
    const r = m.next();
    for (let g = 0; g < 600 && r.phase !== 'over'; g++) {
      if (r.phase === 'draw' && r.draw() === null) break;
      const seat = r.turn;
      let done = false;
      for (;;) {
        const s = R.chooseSelf(r, seat);
        if (!s) break;
        if (s.action === 'win') { r.selfWin(); done = true; break; }
        if (r.kong(s.tile) === null) { done = true; break; }
      }
      if (done) break;
      r.discard(R.chooseDiscard(r, seat));
      const dec = {};
      for (const [st, o] of Object.entries(r.claimOptions())) dec[st] = R.chooseClaim(r, +st, o);
      const res = r.resolve(dec);
      if (res.type === 'win' || (res.type === 'kong' && res.next === null)) break;
    }
    assert.equal(r.phase, 'over', 'hand ' + i + ' did not finish');
    assert.equal(r.result.delta.reduce((a, b) => a + b, 0), 0, 'zero-sum');
    if (r.result.type === 'win') { wins++; assert.ok(r.result.faan >= 3); }
    m.finish();
  }
  assert.ok(wins >= 5, 'robots should win some hands, got ' + wins);
});

test('match rotates the dealer when the dealer loses', () => {
  const m = new Match(hk, { rand: rng(1) });
  m.next(); m.current.result = { type: 'win', winner: 2, delta: [0, 0, 8, -8] }; m.current.phase = 'over';
  m.finish(); assert.equal(m.dealer, 1);
  m.next(); m.current.result = { type: 'draw', delta: [0, 0, 0, 0] }; m.finish(); assert.equal(m.dealer, 1);
});
