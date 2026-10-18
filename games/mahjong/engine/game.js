// Mahjong solitaire rules. Pure logic, no DOM. Deals are built by REVERSE play so they are always solvable.
import { turtle } from './layout.js';
import { allPairs, matches } from './tiles.js';

const overlap = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

export function isFree(tiles, t) {
  let left = false, right = false;
  for (const o of tiles) {
    if (o.removed || o === t) continue;
    if (o.z === t.z + 1 && overlap(o, t)) return false;                 // covered
    if (o.z === t.z && Math.abs(o.y - t.y) < 2) { if (o.x === t.x - 2) left = true; if (o.x === t.x + 2) right = true; }
  }
  return !(left && right);
}
export const freeTiles = tiles => tiles.filter(t => !t.removed && isFree(tiles, t));

export function findMove(tiles) {
  const free = freeTiles(tiles);
  for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++)
    if (matches(free[i].face, free[j].face)) return [free[i], free[j]];
  return null;
}
export const remaining = tiles => tiles.filter(t => !t.removed).length;

// Find an order in which abstract tiles can be removed two at a time (always two free tiles), by random play.
function removalOrder(tiles, rand) {
  const live = tiles.map((t, id) => ({ ...t, id, removed: false })), order = [];
  let left = live.length;
  while (left > 0) {
    const free = freeTiles(live);
    if (free.length < 2) return null;                                   // dead end, caller retries
    const i = Math.floor(rand() * free.length);
    let j = Math.floor(rand() * (free.length - 1)); if (j >= i) j++;
    free[i].removed = free[j].removed = true; left -= 2;
    order.push([free[i], free[j]]);
  }
  return order;
}
function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

// positions: [{x,y,z}], pairs: matching face pairs (length = positions/2). Returns tiles with faces, solvable.
// tiles.solution lists one full clearing order as [idA, idB] pairs (used by tests and shuffle).
export function deal(positions = turtle(), pairs = allPairs(), rand = Math.random) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const order = removalOrder(positions, rand);
    if (!order) continue;
    const ps = shuffle(pairs.map(p => shuffle([...p], rand)), rand);
    const tiles = positions.map((p, id) => ({ id, x: p.x, y: p.y, z: p.z, face: null, removed: false }));
    order.forEach(([a, b], k) => { tiles[a.id].face = { ...ps[k][0] }; tiles[b.id].face = { ...ps[k][1] }; });
    tiles.solution = order.map(([a, b]) => [a.id, b.id]);
    return tiles;
  }
  throw new Error('could not build a solvable deal');
}

export class Game {
  constructor(rand = Math.random, positions = turtle()) {
    this.rand = rand; this.positions = positions;
    this.tiles = deal(positions, allPairs(), rand);
    this.solution = this.tiles.solution;
    this.history = []; this.moves = 0; this.shuffles = 0;
  }
  free(t) { return !t.removed && isFree(this.tiles, t); }
  canRemove(a, b) { return a !== b && this.free(a) && this.free(b) && matches(a.face, b.face); }
  remove(a, b) {
    if (!this.canRemove(a, b)) return false;
    a.removed = b.removed = true; this.history.push([a, b]); this.moves++;
    return true;
  }
  undo() {
    const last = this.history.pop();
    if (!last) return false;
    last[0].removed = last[1].removed = false; this.moves = Math.max(0, this.moves - 1);
    return true;
  }
  hint() { return findMove(this.tiles); }
  get left() { return remaining(this.tiles); }
  get won() { return this.left === 0; }
  get stuck() { return this.left > 0 && !findMove(this.tiles); }
  // Re-deal the remaining faces onto the remaining positions; the result is always solvable.
  shuffle() {
    const live = this.tiles.filter(t => !t.removed);
    const faces = live.map(t => t.face);
    // pair faces up: flowers/seasons pair with any of their kind, others with an identical one
    const pool = [...faces], pairs = [];
    while (pool.length) {
      const f = pool.pop(), k = pool.findIndex(g => matches(f, g));
      pairs.push([f, pool.splice(k, 1)[0]]);
    }
    const dealt = deal(live.map(({ x, y, z }) => ({ x, y, z })), pairs, this.rand);
    live.forEach((t, i) => { t.face = dealt[i].face; });
    this.solution = dealt.solution.map(([a, b]) => [live[a].id, live[b].id]);
    this.history = []; this.shuffles++;
  }
}
