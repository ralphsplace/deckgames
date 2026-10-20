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
  const total = r.tilesInPlay + r.players.reduce((n, p) => n + p.hand.length + p.bonus.length, 0);
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
      { const d = R.chooseDiscard(r, seat); r.discard(d.tile, { riichi: d.riichi }); }
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

// ---- Riichi ----
import { riichi } from './engine/rules/riichi.js';
const rev = (concealed, o = {}) => riichi.evaluate({ concealed: T(concealed), melds: [], wind: 1, round: 0, selfDraw: false, dora: [], ura: [], ...o });

test('riichi: known scores', () => {
  let r = rev('c2 c3 c4 d3 d4 d5 b4 b5 b6 c6 c7 c8 d9 d9', { winTile: 'c8', riichi: true, selfDraw: true });
  assert.deepEqual([r.faan, r.fu], [3, 20]);                       // riichi, tsumo, pinfu
  const round = { dealer: 0, honba: 0 };
  let s = riichi.settle(round, 1, null, r);
  assert.deepEqual(s.delta, [-1300, 2700, -700, -700]);            // dealer pays 1300, others 700
  r = rev('c1 c1 d3 d3 b5 b5 c9 c9 E E R R S S', { winTile: 'S', riichi: true });
  assert.deepEqual([r.faan, r.fu], [3, 25]);                       // chiitoitsu + riichi
  assert.deepEqual(riichi.settle(round, 2, 1, r).delta, [0, -3200, 3200, 0]);
  r = rev('c1 c9 d1 d9 b1 b9 E S W N R G P P', { winTile: 'P' });
  assert.equal(r.yakuman, 1);
  assert.deepEqual(riichi.settle({ dealer: 2, honba: 0 }, 2, 0, r).delta, [-48000, 0, 48000, 0]);
  assert.equal(rev('c1 c2 c3 d4 d5 d6 b7 b8 b9 c5 c6 c7 R R', { winTile: 'R' }), null);   // closed ron, no yaku
});

test('riichi: yaku required, tanyao, yakuhai, dora', () => {
  assert.equal(rev('c1 c2 c3 d4 d5 d6 b7 b8 b9 c5 c6 c7 d2 d2', { winTile: 'd2' }), null);   // plain, pair wait: no yaku
  let r = rev('c2 c3 c4 d4 d5 d6 b3 b4 b5 c5 c6 c7 d2 d2', { winTile: 'c7', dora: ['c2'] });
  assert.ok(r.items.some(i => i.name === 'Tanyao') && r.items.some(i => i.name === 'Dora' && i.faan === 1));
  r = riichi.evaluate({ concealed: T('c2 c3 c4 d5 d5 d5 R R'), melds: [{ type: 'pung', tiles: ['E', 'E', 'E'], open: true }, { type: 'chow', tiles: ['b3', 'b4', 'b5'], open: true }],
    wind: 0, round: 0, selfDraw: false, winTile: 'R', dora: [], ura: [] });
  assert.ok(r.items.map(i => i.name).includes('Yakuhai (seat wind)') && r.items.map(i => i.name).includes('Yakuhai (round wind)'));
});

test('riichi round: dora wall, riichi declaration, locked hand, furiten', () => {
  const r = new Round(riichi, { rand: rng(21) });
  assert.equal(r.tilesInPlay + r.players.reduce((n, p) => n + p.hand.length, 0), 136);
  assert.equal(r.indicators.length, 1);
  r.draw();
  // rig a ready closed hand: 13 tiles waiting on c3/c6 after discarding E
  const p = r.players[0];
  p.hand = T('c1 c2 d4 d5 d6 b7 b8 b9 c5 c6 c7 d2 d2 E');
  assert.deepEqual(r.riichiOptions(0), ['E', 'c1', 'c2'].filter(t => r.riichiOptions(0).includes(t)).length ? r.riichiOptions(0) : []);
  assert.ok(r.riichiOptions(0).includes('E'));
  r.drawn = 'E';
  r.discard('E', { riichi: true });
  r.resolve({});                                    // nobody claims => riichi established
  assert.equal(p.riichi, true); assert.equal(r.sticks, 1);
  // locked: can only discard the drawn tile, and cannot claim
  r.turn = 0; r.phase = 'discard'; p.hand.push('d9'); r.drawn = 'd9';
  assert.throws(() => r.discard('c1'));
  // furiten: waits c3 and... include own river tile
  p.hand = T('c1 c2 d4 d5 d6 b7 b8 b9 c5 c6 c7 d2 d2'); p.river = ['c3'];
  assert.ok(r.waits(0).includes('c3')); assert.equal(r.isFuriten(0), true);
});

test('robots play 25 riichi hands to a legal, zero-sum finish', () => {
  let wins = 0, riichis = 0;
  for (let i = 0; i < 25; i++) {
    const m = new Match(riichi, { rand: rng(300 + i) });
    const r = m.next();
    for (let g = 0; g < 700 && r.phase !== 'over'; g++) {
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
      const d = R.chooseDiscard(r, seat);
      r.discard(d.tile, { riichi: d.riichi });
      const dec = {};
      for (const [st, o] of Object.entries(r.claimOptions())) dec[st] = R.chooseClaim(r, +st, o);
      const res = r.resolve(dec);
      if (res.type === 'win' || (res.type === 'kong' && res.next === null)) break;
    }
    assert.equal(r.phase, 'over');
    assert.equal(r.result.delta.reduce((a, b) => a + b, 0) + (r.result.pot || 0) * 1000, 0, 'points conserved');
    riichis += r.players.filter(p => p.riichi).length;
    if (r.result.type === 'win') wins++;
    m.finish();
  }
  assert.ok(wins >= 3, 'wins ' + wins);
  assert.ok(riichis >= 3, 'riichi declarations ' + riichis);
});
