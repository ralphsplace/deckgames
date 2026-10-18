// Hand evaluation used by every bidding module. Pure functions, no auction knowledge.
import { SUITS, hcp } from '../engine/cards.js';
const HONOR = 11; // J and up

export function analyze(hand) {
  const len = { S: 0, H: 0, D: 0, C: 0 }, hon = { S: 0, H: 0, D: 0, C: 0 };
  for (const c of hand) { len[c.s]++; if (c.r >= HONOR) hon[c.s]++; }
  const shape = Object.values(len).sort((a, b) => b - a);
  // GIB "total points": HCP + void 3 / single 2 / double 1, short suit with an honor loses 1
  let tp = hcp(hand);
  for (const s of SUITS) {
    const n = len[s];
    if (n <= 2) tp += Math.max(0, (n === 0 ? 3 : n === 1 ? 2 : 1) - (hon[s] ? 1 : 0));
  }
  const balanced = shape[3] >= 2 && shape[0] <= 5 && (shape[0] < 5 || shape[1] <= 3) &&
                   shape.filter(n => n === 2).length <= 1 && !shape.includes(1) && !shape.includes(0);
  const has = (s, ranks) => ranks.every(r => hand.some(c => c.s === s && c.r === r));
  const top3 = s => hand.filter(c => c.s === s && c.r >= 12).length;       // A K Q count
  const stopper = s => len[s] >= 4 || hand.some(c => c.s === s && c.r === 14) ||
                       (hand.some(c => c.s === s && c.r === 13) && len[s] >= 2) ||
                       (hand.some(c => c.s === s && c.r === 12) && len[s] >= 3) ||
                       (hand.some(c => c.s === s && c.r === 11) && len[s] >= 4);
  const longest = (list = SUITS) => list.reduce((b, s) => (len[s] > len[b] ? s : b), list[0]);
  return { len, hon, shape, hcp: hcp(hand), tp, balanced, has, top3, stopper, longest };
}

// "good" suit for a weak two / overcall: at least two of the top three honors, or three of top five
export function goodSuit(hand, s) {
  const c = hand.filter(x => x.s === s);
  return c.filter(x => x.r >= 12).length >= 2 || c.filter(x => x.r >= 10).length >= 3;
}
