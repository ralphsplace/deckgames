// Card-play rules. State is a plain object; playCard mutates it.
import { SEATS, next, partner, side, same } from './cards.js';

export function startPlay(contract, hands) {
  const copy = Object.fromEntries(SEATS.map(s => [s, hands[s].map(c => ({ ...c }))]));
  return { contract, hands: copy, dummy: partner(contract.declarer), turn: next(contract.declarer),
           trick: [], tricks: { NS: 0, EW: 0 }, history: [], dummyVisible: false, done: false };
}
export const trumpOf = st => (st.contract.strain === 'N' ? null : st.contract.strain);
export const controller = st => (st.turn === st.dummy ? st.contract.declarer : st.turn);
export const declarerTricks = st => st.tricks[side(st.contract.declarer)];

export function trickWinner(trick, trump) {
  let best = trick[0];
  for (const t of trick.slice(1)) {
    const a = t.card, b = best.card;
    if (a.s === b.s ? a.r > b.r : a.s === trump) best = t;
  }
  return best.seat;
}

export function legalPlays(st) {
  const h = st.hands[st.turn];
  if (!st.trick.length) return h.slice();
  const f = h.filter(c => c.s === st.trick[0].card.s);
  return f.length ? f : h.slice();
}

export function playCard(st, card) {
  if (st.done || !legalPlays(st).some(c => same(c, card))) throw new Error('illegal play');
  const h = st.hands[st.turn];
  h.splice(h.findIndex(c => same(c, card)), 1);
  st.trick.push({ seat: st.turn, card });
  st.dummyVisible = true;
  if (st.trick.length < 4) { st.turn = next(st.turn); return null; }
  const winner = trickWinner(st.trick, trumpOf(st));
  const completed = { trick: st.trick, winner };
  st.history.push(completed);
  st.tricks[side(winner)]++;
  st.trick = [];
  st.turn = winner;
  if (st.history.length === 13) st.done = true;
  return completed;
}
