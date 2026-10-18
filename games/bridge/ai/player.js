// Heuristic play AI (placeholder for a simulation-based one). Interface: (playState) => card.
import { SUITS, side } from '../engine/cards.js';
import { legalPlays, trickWinner, trumpOf } from '../engine/play.js';
export function choosePlay(st) {
  const legal = legalPlays(st), seat = st.turn, trump = trumpOf(st);
  if (legal.length === 1) return legal[0];
  const lo = (a, b) => a.r - b.r;
  if (!st.trick.length) {                                    // lead
    const hand = st.hands[seat], cnt = s => hand.filter(c => c.s === s).length;
    let pool = SUITS.filter(s => cnt(s) && s !== trump);
    if (!pool.length) pool = SUITS.filter(cnt);
    const best = pool.sort((a, b) => cnt(b) - cnt(a))[0];
    const cs = hand.filter(c => c.s === best).sort((a, b) => b.r - a.r);
    if (cs.length >= 2 && cs[0].r >= 11 && cs[0].r - cs[1].r === 1) return cs[0];   // top of a sequence
    return cs[Math.min(3, cs.length - 1)];                                          // else 4th best
  }
  const partnerWinning = side(trickWinner(st.trick, trump)) === side(seat);
  const beaters = legal.filter(c => trickWinner([...st.trick, { seat, card: c }], trump) === seat).sort(lo);
  if (!partnerWinning && beaters.length) return beaters[0];                          // cheapest winner
  const sorted = [...legal].sort(lo), offTrump = sorted.filter(c => c.s !== trump);
  return (offTrump.length ? offTrump : sorted)[0];                                   // else duck / discard low
}
