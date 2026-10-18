import test from 'node:test';
import assert from 'node:assert/strict';
import { deal, rng, dealer, hcp, side, SEATS } from './engine/cards.js';
import { newAuction, addCall, turn, isComplete, isLegal, contractOf, PASS, X, XX, bid } from './engine/auction.js';
import { chooseCall, chooseCallRaw } from './ai/bidder.js';

const hand = s => s.split(' ').flatMap((g, i) => [...g].map(ch => ({ s: 'SHDC'[i], r: '23456789TJQKA'.indexOf(ch) + 2 })));
const parse = t => t === 'P' ? PASS : t === 'X' ? X : t === 'XX' ? XX : bid(+t[0], t[1]);
const auction = (dlr, calls) => { const a = newAuction(dlr); calls.forEach(t => addCall(a, parse(t))); return a; };
const show = c => c.type === 'bid' ? `${c.level}${c.strain}` : c.type === 'pass' ? 'P' : c.type.toUpperCase();
const call = (h, a) => show(chooseCall(hand(h), a, turn(a)));

test('openings', () => {
  assert.equal(call('AK32 KQ4 QJ2 J73', newAuction('N')), '1N');       // balanced 16
  assert.equal(call('KQT987 5 K32 654', newAuction('N')), '2S');       // weak two
  assert.equal(call('AKQ2 AKQ AK32 K2', newAuction('N')), '2C');       // 22+
  assert.equal(call('AKJ2 KQ4 QJ2 T73', newAuction('N')), '1N');       // balanced 16
  assert.equal(call('J532 J32 Q54 432', newAuction('N')), 'P');        // nothing
  assert.equal(call('AQJ98 K32 K54 52', newAuction('N')), '1S');       // 5-card major
  assert.equal(call('AK32 KQ54 J2 Q73', newAuction('N')), '1N');       // balanced 15, 4-4 majors
  assert.equal(call('AK32 K54 J2 Q7653', newAuction('N')), '1C');      // 12+ unbalanced, longest minor
});

test('1NT responses and replies', () => {
  const a = auction('N', ['1N', 'P']);
  assert.equal(call('KJ32 Q432 A65 76', a), '2C');                      // Stayman
  assert.equal(call('Q5 K98765 54 J76', a), '2D');                      // transfer to hearts
  assert.equal(call('J532 J32 Q54 432', a), 'P');
  assert.equal(call('KQ5 J43 K654 Q76', a), '3N');                      // 10 HCP, no major: game
  const b = auction('N', ['1N', 'P', '2C', 'P']);
  assert.equal(call('AK32 KQ4 QJ2 J73', b), '2S');                      // 4 spades, 3 hearts
  assert.equal(call('A32 KQ54 QJ2 J73', b), '2H');                      // 4 hearts
  assert.equal(call('AK32 K54 QJ2 J73', b), '2S');                      // 4 spades only
  assert.equal(call('AK3 K54 QJ2 J732', b), '2D');                      // no major
  const c = auction('N', ['1N', 'P', '2D', 'P']);
  assert.equal(call('AK3 K54 QJ2 J732', c), '2H');                      // completes the transfer
});

test('major-suit responses', () => {
  const a = auction('N', ['1S', 'P']);
  assert.equal(call('Q54 KJ32 9764 A5', a), '2S');                      // raise
  assert.equal(call('54 KJ32 9764 A65', a), '1N');                      // no fit, 6-10
  assert.equal(call('J5 Q32 9764 8642', a), 'P');                       // too weak
});

test('every simulated auction is legal, finishes, and is calibrated', () => {
  let illegal = 0, game = [], part = [], slam = 0, total = 0;
  for (let i = 0; i < 1500; i++) {
    const hands = deal(rng(900 + i)), a = newAuction(dealer((i % 16) + 1));
    let g = 0;
    while (!isComplete(a)) {
      const seat = turn(a), c = chooseCallRaw(hands[seat], a, seat);
      if (!c || !isLegal(a, c)) illegal++;
      addCall(a, c && isLegal(a, c) ? c : PASS);
      assert.ok(++g < 80, 'auction ran away');
    }
    const k = contractOf(a);
    if (!k) continue;
    total++;
    const comb = SEATS.filter(s => side(s) === side(k.declarer)).reduce((n, s) => n + hcp(hands[s]), 0);
    const gl = k.strain === 'N' ? 3 : (k.strain === 'S' || k.strain === 'H') ? 4 : 5;
    if (k.level >= 6) slam++; else (k.level >= gl ? game : part).push(comb);
  }
  assert.equal(illegal, 0);
  const mean = x => x.reduce((a, b) => a + b, 0) / x.length;
  assert.ok(mean(game) > 23.5 && mean(game) < 27, 'game contracts should average about 25 combined HCP, got ' + mean(game));
  assert.ok(slam / total < 0.05, 'too many slams');
  assert.ok(game.length / total > 0.15 && game.length / total < 0.45, 'game frequency out of range');
});
