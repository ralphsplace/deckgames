// Tile face drawings as inline SVG strings (no fonts or images needed, so it works fully offline).
// Canvas is 40 x 52. Suit symbols are drawn with shapes; only digits and letters use text.
const GRID = {
  1: [[20, 26]], 2: [[20, 14], [20, 38]], 3: [[11, 12], [20, 26], [29, 40]],
  4: [[12, 15], [28, 15], [12, 37], [28, 37]],
  5: [[12, 14], [28, 14], [20, 26], [12, 38], [28, 38]],
  6: [[13, 11], [27, 11], [13, 26], [27, 26], [13, 41], [27, 41]],
  7: [[10, 10], [20, 10], [30, 10], [13, 28], [27, 28], [13, 43], [27, 43]],
  8: [[13, 9], [27, 9], [13, 21], [27, 21], [13, 33], [27, 33], [13, 45], [27, 45]],
  9: [[10, 11], [20, 11], [30, 11], [10, 26], [20, 26], [30, 26], [10, 41], [20, 41], [30, 41]],
};
const svg = body => `<svg viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
const DOT = ['#1f6fb2', '#c0392b', '#2e8b57'];

function dots(n) {
  return svg(GRID[n].map(([x, y], i) => {
    const r = n === 1 ? 10 : n >= 7 ? 3.9 : 4.6, c = n === 1 ? DOT[1] : DOT[(i + (n === 5 && i === 2 ? 1 : 0)) % 3];
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#222" stroke-width=".8"/><circle cx="${x}" cy="${y}" r="${r * .45}" fill="#f4efe0"/>`;
  }).join(''));
}
function bamboo(n) {
  if (n === 1) return svg('<ellipse cx="20" cy="30" rx="9" ry="12" fill="#2e8b57" stroke="#1d5c39"/><circle cx="20" cy="15" r="6" fill="#2e8b57" stroke="#1d5c39"/><path d="M14 40 L8 48 M26 40 L32 48" stroke="#c0392b" stroke-width="2.4"/><circle cx="22" cy="14" r="1.3" fill="#fff"/>');
  return svg(GRID[n].map(([x, y], i) => {
    const h = n >= 7 ? 9 : 12, c = (n === 5 && i === 2) || (n % 2 === 0 && i === 0 && n === 8) ? '#c0392b' : '#2e8b57';
    return `<rect x="${x - 2.6}" y="${y - h / 2}" width="5.2" height="${h}" rx="2" fill="${c}" stroke="#1d5c39" stroke-width=".7"/><rect x="${x - 2.6}" y="${y - 1}" width="5.2" height="1.6" fill="#f4efe0" opacity=".85"/>`;
  }).join(''));
}
function chars(n) {
  return svg(`<text x="20" y="24" text-anchor="middle" font-family="Georgia,serif" font-size="24" font-weight="bold" fill="#c0392b">${n}</text>` +
    `<text x="20" y="45" text-anchor="middle" font-family="'Noto Sans CJK SC','Microsoft YaHei','PingFang SC','SimSun',serif" font-size="17" fill="#1c1c1c">萬</text>`);
}
function wind(w) {
  return svg(`<circle cx="20" cy="26" r="15" fill="none" stroke="#1c1c1c" stroke-width="2"/><text x="20" y="35" text-anchor="middle" font-family="Georgia,serif" font-size="26" font-weight="bold" fill="#1c1c1c">${w}</text>`);
}
function dragon(d) {
  if (d === 'white') return svg('<rect x="7" y="8" width="26" height="36" rx="3" fill="none" stroke="#1f6fb2" stroke-width="2.4"/><rect x="12" y="13" width="16" height="26" rx="2" fill="none" stroke="#1f6fb2" stroke-width="1.2"/>');
  const c = d === 'red' ? '#c0392b' : '#2e8b57';
  return svg(`<path d="M20 6 L34 26 L20 46 L6 26 Z" fill="${c}" stroke="#222" stroke-width="1"/><path d="M20 16 L27 26 L20 36 L13 26 Z" fill="#f4efe0"/>`);
}
function flower(n) {
  const petals = [0, 72, 144, 216, 288].map(a => `<circle cx="${20 + 9 * Math.sin(a * Math.PI / 180)}" cy="${24 - 9 * Math.cos(a * Math.PI / 180)}" r="6.2" fill="#e85d9f" stroke="#a8326f" stroke-width=".8"/>`).join('');
  return svg(petals + `<circle cx="20" cy="24" r="4.5" fill="#f6d04d" stroke="#a8326f" stroke-width=".8"/><text x="20" y="49" text-anchor="middle" font-family="Georgia,serif" font-size="9" fill="#a8326f">${n}</text>`);
}
function season(n) {
  const rays = Array.from({ length: 8 }, (_, i) => { const a = i * 45 * Math.PI / 180; return `<line x1="${20 + 10 * Math.sin(a)}" y1="${24 - 10 * Math.cos(a)}" x2="${20 + 15 * Math.sin(a)}" y2="${24 - 15 * Math.cos(a)}" stroke="#e07b00" stroke-width="2.4" stroke-linecap="round"/>`; }).join('');
  return svg(rays + `<circle cx="20" cy="24" r="8" fill="#f6a623" stroke="#b35c00" stroke-width="1"/><text x="20" y="49" text-anchor="middle" font-family="Georgia,serif" font-size="9" fill="#b35c00">${n}</text>`);
}
export function faceSvg(f) {
  switch (f.kind) {
    case 'dots': return dots(f.n);
    case 'bamboo': return bamboo(f.n);
    case 'char': return chars(f.n);
    case 'wind': return wind(f.n);
    case 'dragon': return dragon(f.n);
    case 'flower': return flower(f.n);
    case 'season': return season(f.n);
    default: throw new Error('unknown face ' + f.kind);
  }
}
