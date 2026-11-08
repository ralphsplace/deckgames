// Cards for Frustration: {id, s:'S'|'H'|'D'|'C', r:2..14} plus jokers {id, joker:true, s:'X', r:0}.
// Every card carries an id because two decks hold duplicates. No DOM, randomness only via an injected rand().
export const SUITS = ['S', 'H', 'D', 'C'];
export const SYM = { S: '\u2660', H: '\u2665', D: '\u2666', C: '\u2663' };
export const RANK_NAME = r => (r <= 10 ? String(r) : 'JQKA'[r - 11]);
export const label = c => (c.joker ? 'Joker' : RANK_NAME(c.r) + SYM[c.s]);
// how a card is drawn (shared/cardview.js)
export const face = c => c && (c.joker ? { rank: '\u2605', suit: '\u2605', red: false, cls: 'joker' }
  : { rank: RANK_NAME(c.r), suit: SYM[c.s], red: c.s === 'H' || c.s === 'D' });
export const isWild = (c, rules) => !!c.joker || rules.wildRanks.includes(c.r);

export function makeDeck(rules) {
  const deck = [];
  let id = 0;
  for (let d = 0; d < rules.decks; d++) {
    for (const s of SUITS) for (let r = 2; r <= 14; r++) deck.push({ id: id++, s, r });
    for (let j = 0; j < rules.jokersPerDeck; j++) deck.push({ id: id++, joker: true, s: 'X', r: 0 });
  }
  return deck;
}

export function shuffle(a, rand = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const handPoints = (hand, rules) => hand.reduce((n, c) => n + rules.points(c), 0);

// wilds last; otherwise by rank (books together) or by suit (runs together)
export function sortCards(cards, rules, by = 'rank') {
  const key = c => {
    if (isWild(c, rules)) return [9, c.joker ? 1 : 0, 0];
    const s = SUITS.indexOf(c.s);
    return by === 'suit' ? [s, c.r, 0] : [c.r, s, 0];
  };
  return [...cards].sort((a, b) => {
    const ka = key(a), kb = key(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || a.id - b.id;
  });
}
