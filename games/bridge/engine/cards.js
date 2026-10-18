// Pure data + helpers. No DOM, no randomness except via an injected rand().
export const SEATS = ['N', 'E', 'S', 'W'];
export const SUITS = ['S', 'H', 'D', 'C'];          // display order
export const STRAINS = ['C', 'D', 'H', 'S', 'N'];   // bidding order, low to high
export const SYM = { S: '\u2660', H: '\u2665', D: '\u2666', C: '\u2663', N: 'NT' };
export const SEAT_NAME = { N: 'North', E: 'East', S: 'South', W: 'West' };
export const next = s => SEATS[(SEATS.indexOf(s) + 1) % 4];
export const partner = s => SEATS[(SEATS.indexOf(s) + 2) % 4];
export const side = s => (s === 'N' || s === 'S' ? 'NS' : 'EW');
export const same = (a, b) => a.s === b.s && a.r === b.r;
export const rankLabel = r => (r <= 10 ? String(r) : 'JQKA'[r - 11]);
export const hcp = hand => hand.reduce((n, c) => n + Math.max(0, c.r - 10), 0);
export const sortHand = h => h.sort((a, b) => SUITS.indexOf(a.s) - SUITS.indexOf(b.s) || b.r - a.r);

export { rng } from '../../../shared/rng.js';   // seedable, for tests/replays

export function deal(rand = Math.random) {
  const deck = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) deck.push({ s, r });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hands = {};
  SEATS.forEach((seat, i) => { hands[seat] = sortHand(deck.slice(i * 13, i * 13 + 13)); });
  return hands;
}

const VUL = ['-', 'NS', 'EW', 'B', 'NS', 'EW', 'B', '-', 'EW', 'B', '-', 'NS', 'B', '-', 'NS', 'EW'];
export const dealer = board => SEATS[(board - 1) % 4];
export const isVul = (board, sd) => { const v = VUL[(board - 1) % 16]; return v === 'B' || v === sd; };
