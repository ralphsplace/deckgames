// 144 tiles: 3 suits x 9 x 4, 4 winds x 4, 3 dragons x 4, 4 flowers, 4 seasons.
// A face is {kind, n}. Flowers match any flower, seasons match any season; everything else must be identical.
export const SUITS = ['dots', 'bamboo', 'char'];
export const WINDS = ['E', 'S', 'W', 'N'];
export const DRAGONS = ['red', 'green', 'white'];

export function faceKey(f) {
  return f.kind === 'flower' || f.kind === 'season' ? f.kind : `${f.kind}${f.n}`;
}
export const matches = (a, b) => faceKey(a) === faceKey(b);

// 72 matching pairs, in a fixed order
export function allPairs() {
  const pairs = [];
  const twice = f => { pairs.push([f, { ...f }]); pairs.push([{ ...f }, { ...f }]); };
  for (const s of SUITS) for (let n = 1; n <= 9; n++) twice({ kind: s, n });
  WINDS.forEach(w => twice({ kind: 'wind', n: w }));
  DRAGONS.forEach(d => twice({ kind: 'dragon', n: d }));
  pairs.push([{ kind: 'flower', n: 1 }, { kind: 'flower', n: 2 }], [{ kind: 'flower', n: 3 }, { kind: 'flower', n: 4 }]);
  pairs.push([{ kind: 'season', n: 1 }, { kind: 'season', n: 2 }], [{ kind: 'season', n: 3 }, { kind: 'season', n: 4 }]);
  return pairs;
}
