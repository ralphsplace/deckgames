import test from 'node:test';
import assert from 'node:assert/strict';
import { turtle } from './engine/layout.js';
import { allPairs, matches, faceKey } from './engine/tiles.js';
import { isFree, freeTiles, deal, Game, findMove } from './engine/game.js';
import { rng } from '../../shared/rng.js';
import { faceSvg } from './faces.js';

const T = (x, y, z = 0) => ({ x, y, z, removed: false, face: { kind: 'dots', n: 1 } });

test('turtle layout: 144 distinct positions, 87/36/16/4/1 by layer', () => {
  const t = turtle();
  assert.equal(t.length, 144);
  assert.equal(new Set(t.map(p => `${p.x},${p.y},${p.z}`)).size, 144);
  assert.deepEqual([0, 1, 2, 3, 4].map(z => t.filter(p => p.z === z).length), [87, 36, 16, 4, 1]);
});

test('tile set: 72 matching pairs covering 144 tiles with the right counts', () => {
  const pairs = allPairs(), faces = pairs.flat();
  assert.equal(pairs.length, 72);
  assert.ok(pairs.every(([a, b]) => matches(a, b)));
  const count = {};
  faces.forEach(f => { const k = faceKey(f); count[k] = (count[k] || 0) + 1; });
  assert.equal(count.flower, 4); assert.equal(count.season, 4);
  assert.equal(Object.keys(count).length, 34 + 2);
  assert.ok(Object.entries(count).filter(([k]) => k !== 'flower' && k !== 'season').every(([, n]) => n === 4));
});

test('free-tile rule: open side, both sides blocked, covered, half-offset neighbours', () => {
  const row = [T(0, 0), T(2, 0), T(4, 0)];
  assert.deepEqual(freeTiles(row).map(t => t.x), [0, 4]);              // middle blocked left and right
  assert.equal(isFree([T(0, 0), T(0, 0, 1)], T(0, 0)), false);         // covered from above
  assert.equal(isFree([T(1, 1, 1), T(0, 0)], T(0, 0)), false);         // partly covered still blocks
  assert.equal(isFree([T(4, 0, 1), T(0, 0)], T(0, 0)), true);          // not overlapping
  const half = [T(0, 0), T(2, 1), T(4, 0)];
  assert.equal(isFree(half, half[1]), false);                          // half-row offset still touches both neighbours
  const apart = [T(0, 0), T(2, 2), T(4, 0)];
  assert.equal(isFree(apart, apart[1]), true);                         // a full row apart does not touch
});

test('every deal can be cleared by its own solution, for many seeds', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const g = new Game(rng(seed));
    assert.equal(g.tiles.length, 144);
    assert.ok(g.tiles.every(t => t.face));
    for (const [a, b] of g.solution) assert.ok(g.remove(g.tiles[a], g.tiles[b]), `seed ${seed}: solution step illegal`);
    assert.ok(g.won);
  }
});

test('rules: blocked or mismatched pairs cannot be removed; undo restores', () => {
  const g = new Game(rng(3));
  const [a, b] = g.solution[0].map(i => g.tiles[i]);
  const blocked = g.tiles.find(t => !g.free(t));
  assert.equal(g.remove(a, blocked), false);
  assert.equal(g.remove(a, a), false);
  assert.ok(g.remove(a, b));
  assert.equal(g.left, 142);
  assert.ok(g.undo());
  assert.equal(g.left, 144);
});

test('hint finds a legal move; shuffle keeps tile count and stays solvable', () => {
  const g = new Game(rng(11));
  for (const [a, b] of g.solution.slice(0, 40)) assert.ok(g.remove(g.tiles[a], g.tiles[b]));
  const m = g.hint();
  assert.ok(m && g.canRemove(m[0], m[1]));
  const before = g.left;
  g.shuffle();
  assert.equal(g.left, before);
  assert.equal(g.solution.length * 2, before);
  for (const [a, b] of g.solution) assert.ok(g.remove(g.tiles[a], g.tiles[b]), 'solution after shuffle must clear the board');
  assert.ok(g.won);
});

test('stuck detection', () => {
  const tiles = [T(0, 0), T(2, 0)];
  tiles[0].face = { kind: 'dots', n: 1 }; tiles[1].face = { kind: 'bamboo', n: 2 };
  assert.equal(findMove(tiles), null);
});

test('every tile face has a drawing', () => {
  for (const [a, b] of allPairs()) for (const f of [a, b]) {
    const svg = faceSvg(f);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.length > 80, faceKey(f));
  }
});
