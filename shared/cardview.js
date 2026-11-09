// Draws a playing card (styles in shared/cards.css). A game says how one of its cards looks as a face:
// { rank: "A" | "2" … "10" | "J" | "Q" | "K", suit: "♠" | "♥" | "♦" | "♣", red: true | false, cls?: extra class }; null
// draws the back. A card outside the 52 (a joker) is just another face, e.g. { rank: "★", suit: "★", cls: "joker" }.
// The card's place, size and state (selected, playable) are the game's to set.
export function cardEl(face) {
  const d = document.createElement('div');
  if (!face) { d.className = 'card down'; return d; }
  d.className = 'card up' + (face.red ? ' red' : '') + (face.cls ? ' ' + face.cls : '');
  const corner = face.rank === face.suit ? face.rank : `${face.rank}<br>${face.suit}`;
  d.innerHTML = `<span class="c tl">${corner}</span><span class="mid">${face.suit}</span><span class="c br">${corner}</span>`;
  return d;
}
