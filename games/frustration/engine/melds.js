// Books (same rank, any suits) and runs (same suit, consecutive ranks), with wild cards.
// A meld on the table: {type:'book', rank, cells:[{card, as}]} or {type:'run', suit, cells:[{card, as}]} with run cells
// in rank order; `as` is the rank each card stands for (a wild's chosen rank). Pure functions, no state.
import { isWild } from './cards.js';

const LOW = rules => (rules.aceLow ? 1 : 2);          // lowest rank a run can start at (2 is a real rank, played by a wild)
const asRank = (r, rules) => (rules.aceLow && r === 1 ? 14 : r);

export function makeBook(cards, rules) {
  const nat = cards.filter(c => !isWild(c, rules));
  if (nat.length < rules.minNaturals || cards.length < 3) return null;
  const rank = nat[0]?.r;
  if (nat.some(c => c.r !== rank)) return null;
  return { type: 'book', rank, cells: cards.map(c => ({ card: c, as: rank })) };
}

// Wilds fill the gaps first, then lengthen the run upward (toward the ace), then downward.
export function makeRun(cards, rules) {
  const nat = cards.filter(c => !isWild(c, rules)), wild = cards.filter(c => isWild(c, rules));
  if (nat.length < rules.minNaturals || cards.length < 3) return null;
  const suit = nat[0].s;
  if (nat.some(c => c.s !== suit)) return null;
  const ranks = nat.map(c => c.r).sort((a, b) => a - b);
  if (new Set(ranks).size !== ranks.length) return null;            // a duplicate rank can't sit in one run
  let lo = ranks[0], hi = ranks[ranks.length - 1];
  const gaps = hi - lo + 1 - ranks.length;
  if (gaps > wild.length) return null;
  let spare = wild.length - gaps;
  while (spare > 0 && hi < 14) { hi++; spare--; }
  while (spare > 0 && lo > LOW(rules)) { lo--; spare--; }
  if (spare > 0) return null;                                      // longer than 2..A
  const cells = [], pool = [...wild];
  for (let r = lo; r <= hi; r++) {
    const c = nat.find(x => x.r === r);
    cells.push({ card: c || pool.shift(), as: r });
  }
  return { type: 'run', suit, cells };
}

export const makeMeld = (type, cards, rules) => (type === 'book' ? makeBook(cards, rules) : makeRun(cards, rules));

// Add one card to a meld already on the table; returns the new meld or null. For a run, `end` ('high'|'low') picks
// the end a wild goes on; by default the high end while there is room.
export function extendMeld(meld, card, rules, end) {
  const wild = isWild(card, rules);
  if (meld.type === 'book') {
    if (!wild && card.r !== meld.rank) return null;
    return { ...meld, cells: [...meld.cells, { card, as: meld.rank }] };
  }
  const lo = meld.cells[0].as, hi = meld.cells[meld.cells.length - 1].as;
  const canHi = hi < 14, canLo = lo > LOW(rules);
  let side = null;
  if (wild) side = end === 'low' ? (canLo ? 'low' : null) : end === 'high' ? (canHi ? 'high' : null) : canHi ? 'high' : canLo ? 'low' : null;
  else if (card.s === meld.suit && asRank(card.r, rules) === hi + 1) side = 'high';
  else if (card.s === meld.suit && card.r === lo - 1) side = 'low';
  if (!side) return null;
  return side === 'high'
    ? { ...meld, cells: [...meld.cells, { card, as: hi + 1 }] }
    : { ...meld, cells: [{ card, as: lo - 1 }, ...meld.cells] };
}
