import { TYPES, IDX, isTerminal, isHonor } from './tiles.js';

export const toCounts = tiles => { const c = new Array(34).fill(0); for (const t of tiles) c[IDX[t]]++; return c; };

// All ways to split `tiles` (2 + 3n of them) into n sets and a pair.
export function* decompositions(tiles, nSets) {
  const c = toCounts(tiles);
  for (let p = 0; p < 34; p++) {
    if (c[p] < 2) continue;
    c[p] -= 2;
    yield* setsOf(c, nSets, [], 0, p);
    c[p] += 2;
  }
}
function* setsOf(c, n, acc, start, pair) {
  if (n === 0) { if (c.every(x => x === 0)) yield { pair: TYPES[pair], sets: acc.slice() }; return; }
  let i = start;
  while (i < 34 && c[i] === 0) i++;
  if (i >= 34) return;
  const T = TYPES[i];
  if (c[i] >= 3) {
    c[i] -= 3; acc.push({ type: 'pung', tiles: [T, T, T] });
    yield* setsOf(c, n - 1, acc, i, pair);
    acc.pop(); c[i] += 3;
  }
  if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--; c[i + 1]--; c[i + 2]--; acc.push({ type: 'chow', tiles: [T, TYPES[i + 1], TYPES[i + 2]] });
    yield* setsOf(c, n - 1, acc, i, pair);
    acc.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
  }
}

export function isThirteenOrphans(tiles) {
  if (tiles.length !== 14) return false;
  const c = toCounts(tiles);
  let pairs = 0;
  for (let i = 0; i < 34; i++) {
    const orphan = isTerminal(TYPES[i]) || isHonor(TYPES[i]);
    if (orphan) { if (c[i] === 0 || c[i] > 2) return false; if (c[i] === 2) pairs++; }
    else if (c[i]) return false;
  }
  return pairs === 1;
}

// Shanten = tiles away from ready (0 = ready, -1 = complete). k = melds already made.
const memo = new Map();
export function shanten(tiles, k = 0) {
  const key = tiles.slice().sort().join('') + '|' + k;
  let v = memo.get(key);
  if (v === undefined) {
    v = Math.min(shantenRegular(toCounts(tiles), k), k === 0 ? shantenOrphans(toCounts(tiles)) : 9);
    if (memo.size > 200000) memo.clear();
    memo.set(key, v);
  }
  return v;
}
function shantenOrphans(c) {
  let kinds = 0, pair = 0;
  for (let i = 0; i < 34; i++) if (isTerminal(TYPES[i]) || isHonor(TYPES[i])) { if (c[i]) kinds++; if (c[i] >= 2) pair = 1; }
  return 13 - kinds - pair;
}
function shantenRegular(c, k) {
  let best = 8;
  const dfs = (i, m, t, pair) => {
    while (i < 34 && c[i] === 0) i++;
    if (i >= 34) {
      const mm = m + k;
      const tt = Math.min(t, 4 - mm);
      const s = 8 - 2 * mm - tt - (pair ? 1 : 0);
      if (s < best) best = s;
      return;
    }
    if (c[i] >= 3) { c[i] -= 3; dfs(i, m + 1, t, pair); c[i] += 3; }
    if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) {
      c[i]--; c[i + 1]--; c[i + 2]--; dfs(i, m + 1, t, pair); c[i]++; c[i + 1]++; c[i + 2]++;
    }
    if (c[i] >= 2) {
      if (!pair) { c[i] -= 2; dfs(i, m, t, true); c[i] += 2; }
      c[i] -= 2; dfs(i, m, t + 1, pair); c[i] += 2;
    }
    if (i < 27) {
      if (i % 9 <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; dfs(i, m, t + 1, pair); c[i]++; c[i + 1]++; }
      if (i % 9 <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; dfs(i, m, t + 1, pair); c[i]++; c[i + 2]++; }
    }
    c[i]--; dfs(i, m, t, pair); c[i]++;
  };
  dfs(0, 0, 0, false);
  return best;
}
export const isComplete = (tiles, k = 0) => shanten(tiles, k) === -1;
