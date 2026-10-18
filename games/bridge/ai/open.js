// Opening bids: 2/1 game force, 5-card majors, 15-17 NT, strong artificial 2C, weak twos.
import { bid, PASS } from '../engine/auction.js';
import { analyze, goodSuit } from './hand.js';
import { M } from './meaning.js';

const mk = (level, strain, meaning) => ({ ...bid(level, strain), meaning });
const SUIT_NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };

export function openBid(hand) {
  const h = analyze(hand), { len } = h;
  const two = [...h.shape].slice(0, 2).reduce((a, b) => a + b, 0);
  const rule20 = h.hcp + two >= 20 && h.hcp >= 10;
  const fiveMajor = len.S >= 5 || len.H >= 5;

  if (h.hcp >= 22) return mk(2, 'C', M('strong, artificial, 22+ HCP', { hcp: [22, 40], forcing: true, gf: true }));
  if (h.balanced && h.hcp >= 20) return mk(2, 'N', M('balanced 20-21 HCP', { hcp: [20, 21], bal: true }));
  const nt = h.hcp >= 15 && h.hcp <= 17 && !(h.hcp === 17 && fiveMajor);
  if (h.balanced && nt) return mk(1, 'N', M('balanced 15-17 HCP', { hcp: [15, 17], bal: true }));

  // preempts (disciplined: honors in the suit, no 5-card major on the side for weak twos)
  for (const s of ['S', 'H', 'D', 'C']) {
    if (h.hcp > 10) break;
    if (len[s] >= 8 && h.hcp <= 9) return mk(4, s, M(`preempt, 8+ ${SUIT_NAME[s]}`, { hcp: [4, 9], len: { [s]: 8 } }));
    if (len[s] === 7 && h.hcp <= 9 && goodSuit(hand, s)) return mk(3, s, M(`preempt, 7 ${SUIT_NAME[s]}`, { hcp: [4, 9], len: { [s]: 7 } }));
    if (len[s] === 6 && s !== 'C' && h.hcp >= 5 && goodSuit(hand, s) && !(s !== 'H' && len.H >= 4) && !(s === 'D' && len.S >= 4))
      return mk(2, s, M(`weak two, 6 ${SUIT_NAME[s]}`, { hcp: [5, 10], len: { [s]: 6 } }));
  }
  if (h.hcp < 12 && !rule20) return PASS;

  if (fiveMajor) {
    const s = len.S >= 5 && len.S >= len.H ? 'S' : 'H';
    return mk(1, s, M(`5+ ${SUIT_NAME[s]}, 12-21`, { hcp: [12, 21], len: { [s]: 5 } }));
  }
  const m = len.D > len.C ? 'D' : len.C > len.D ? 'C' : len.D >= 4 ? 'D' : 'C';
  return mk(1, m, M(m === 'C' ? '3+ clubs (could be 3), 12-21' : '4+ diamonds (usually), 12-21',
    { hcp: [12, 21], len: { [m]: m === 'C' ? 3 : 4 } }));
}
