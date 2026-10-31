// Klondike solitaire rules. Pure logic, no DOM: the page (../index.html) draws the state and turns clicks into
// these calls.
//
// State: { stock, waste, found: [4 piles], tab: [7 piles], moves }, a card is { s, r, up } (suit 0-3 in the order
// spades, hearts, diamonds, clubs; rank 1-13). A pile is named as the page names it: 'stock', 'waste', 'f0'-'f3',
// 't0'-'t6'. A selection is { pile, idx }: the card at idx, and every card on top of it in a tableau pile.
export const isRed = c => c.s === 1 || c.s === 2;

// a new deal: 28 cards to the tableau (the top of each pile face up), the rest in the stock; `random` returns [0, 1)
export function deal(random = Math.random) {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r, up: false });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const G = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []], moves: 0 };
  for (let c = 0; c < 7; c++) {
    for (let k = 0; k <= c; k++) G.tab[c].push(deck.pop());
    G.tab[c][c].up = true;
  }
  G.stock = deck;
  return G;
}

// the pile array a name refers to
export function pileOf(G, name) {
  if (name === 'stock' || name === 'waste') return G[name];
  return (name[0] === 'f' ? G.found : G.tab)[+name.slice(1)];
}

const top = p => p[p.length - 1];

// can `card` go on this foundation / this tableau pile?
export function foundOK(card, f) {
  if (!f.length) return card.r === 1;
  return top(f).s === card.s && card.r === top(f).r + 1;
}
export function tabOK(card, col) {
  if (!col.length) return card.r === 13;
  const t = top(col);
  return t.up && isRed(t) !== isRed(card) && t.r === card.r + 1;
}

// the cards a selection picks up: the top card of the waste or a foundation, or a run from a tableau pile
export function selected(G, sel) {
  if (!sel) return [];
  const p = pileOf(G, sel.pile);
  return sel.pile[0] === 't' ? p.slice(sel.idx) : p.slice(-1);
}

// whether the selection may move to the target pile, by the rules (no change)
export function canMove(G, sel, target) {
  const cards = selected(G, sel);
  if (!cards.length || target === sel.pile) return false;
  if (target[0] === 't') return tabOK(cards[0], pileOf(G, target));
  if (target[0] === 'f') return cards.length === 1 && foundOK(cards[0], pileOf(G, target));
  return false;
}

const flipTop = p => { if (p.length) top(p).up = true; };

// move the selection to the target if the rules allow it; the card under a tableau run is turned over
export function move(G, sel, target) {
  if (!canMove(G, sel, target)) return false;
  const src = pileOf(G, sel.pile);
  const cards = sel.pile[0] === 't' ? src.splice(sel.idx) : [src.pop()];
  if (sel.pile[0] === 't') flipTop(src);
  pileOf(G, target).push(...cards);
  G.moves++;
  return true;
}

// turn over the face-down top card of a tableau pile
export function flip(G, pile) {
  const c = top(pileOf(G, pile));
  if (!c || c.up || pile[0] !== 't') return false;
  c.up = true;
  G.moves++;
  return true;
}

// draw n cards from the stock to the waste, or turn the waste back over when the stock is empty
export function draw(G, n) {
  if (G.stock.length) {
    for (let i = 0; i < n && G.stock.length; i++) { const c = G.stock.pop(); c.up = true; G.waste.push(c); }
  } else if (G.waste.length) {
    while (G.waste.length) { const c = G.waste.pop(); c.up = false; G.stock.push(c); }
  } else return false;
  G.moves++;
  return true;
}

// the next card that can go to a foundation by itself: the lowest rank among the waste's top card and the tableau's
// face-up top cards; { pile, f } or null
export function nextToCollect(G) {
  const tops = [];
  if (G.waste.length) tops.push({ pile: 'waste', card: top(G.waste) });
  G.tab.forEach((col, i) => { const c = top(col); if (c && c.up) tops.push({ pile: 't' + i, card: c }); });
  tops.sort((a, b) => a.card.r - b.card.r);
  for (const t of tops) {
    const f = G.found.findIndex(fd => foundOK(t.card, fd));
    if (f >= 0) return { pile: t.pile, f };
  }
  return null;
}

// collection starts once the stock and waste are empty and a card can go up
export const canCollect = G => !G.stock.length && !G.waste.length && !!nextToCollect(G);

// one step of collection, the move nextToCollect found
export function collect(G, m) {
  const src = pileOf(G, m.pile);
  G.found[m.f].push(src.pop());
  flipTop(src);
  G.moves++;
}

export const won = G => G.found.every(f => f.length === 13);
