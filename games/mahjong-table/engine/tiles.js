// Tile codes (strings): c1-c9 characters, d1-d9 dots, b1-b9 bamboo,
// winds E S W N, dragons R G P (red, green, white), bonus F1-F4 flowers, T1-T4 seasons.
export const WINDS = ['E', 'S', 'W', 'N'];
export const DRAGONS = ['R', 'G', 'P'];
export const TYPES = [];
for (const s of 'cdb') for (let n = 1; n <= 9; n++) TYPES.push(s + n);
TYPES.push(...WINDS, ...DRAGONS);
export const IDX = Object.fromEntries(TYPES.map((t, i) => [t, i]));

export const isBonus = t => t[0] === 'F' || t[0] === 'T';
export const isSuited = t => t.length === 2 && 'cdb'.includes(t[0]);
export const isHonor = t => WINDS.includes(t) || DRAGONS.includes(t);
export const isTerminal = t => isSuited(t) && (t[1] === '1' || t[1] === '9');
export const suitOf = t => t[0];
export const rankOf = t => +t[1];

// bonus: include the 8 flower/season tiles (Hong Kong: 144 tiles; Riichi would pass false: 136).
export function buildWall(bonus, rand = Math.random) {
  const w = [];
  for (const t of TYPES) for (let i = 0; i < 4; i++) w.push(t);
  if (bonus) for (let i = 1; i <= 4; i++) w.push('F' + i, 'T' + i);
  for (let i = w.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [w[i], w[j]] = [w[j], w[i]];
  }
  return w;
}

const order = t => (isBonus(t) ? 100 + (t[0] === 'F' ? 0 : 10) + +t[1] : IDX[t]);
export const sortTiles = a => a.slice().sort((x, y) => order(x) - order(y));

// Face for the shared SVG renderer (games/mahjong/faces.js)
export function toFace(t) {
  if (isSuited(t)) return { kind: { c: 'char', d: 'dots', b: 'bamboo' }[t[0]], n: +t[1] };
  if (WINDS.includes(t)) return { kind: 'wind', n: t };
  if (DRAGONS.includes(t)) return { kind: 'dragon', n: { R: 'red', G: 'green', P: 'white' }[t] };
  return { kind: t[0] === 'F' ? 'flower' : 'season', n: +t[1] };
}
export const NAMES = {
  E: 'East', S: 'South', W: 'West', N: 'North', R: 'Red dragon', G: 'Green dragon', P: 'White dragon',
};
export function tileName(t) {
  if (NAMES[t]) return NAMES[t];
  if (isSuited(t)) return `${t[1]} ${{ c: 'Characters', d: 'Dots', b: 'Bamboo' }[t[0]]}`;
  return (t[0] === 'F' ? 'Flower ' : 'Season ') + t[1];
}
