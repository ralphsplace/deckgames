// Shared DOM helper for engine cards ({s:'S'|'H'|'D'|'C', r:2..14}). Pass null for a card back.
import { SYM, rankLabel } from '../games/bridge/engine/cards.js';
export function cardEl(c) {
  const d = document.createElement('div');
  if (!c) { d.className = 'card down'; return d; }
  d.className = 'card up' + (c.s === 'H' || c.s === 'D' ? ' red' : '');
  const corner = `${rankLabel(c.r)}<br>${SYM[c.s]}`;
  d.innerHTML = `<span class="c tl">${corner}</span><span class="mid">${SYM[c.s]}</span><span class="c br">${corner}</span>`;
  return d;
}
