// Board layouts. Positions are in half-tile units: a tile occupies a 2x2 cell, x/y/z are integers.
// "turtle" is the classic 144-tile layout.
export function turtle() {
  const t = [];
  const row = (z, y, c0, c1) => { for (let c = c0; c <= c1; c++) t.push({ x: c * 2, y: y * 2, z }); };
  // layer 0: 87 tiles
  row(0, 0, 1, 12); row(0, 1, 3, 10); row(0, 2, 2, 11); row(0, 3, 1, 12);
  row(0, 4, 1, 12); row(0, 5, 2, 11); row(0, 6, 3, 10); row(0, 7, 1, 12);
  t.push({ x: 0, y: 7, z: 0 }, { x: 26, y: 7, z: 0 }, { x: 28, y: 7, z: 0 });
  // layer 1: 6x6, layer 2: 4x4, layer 3: 2x2, layer 4: the cap
  for (let r = 1; r <= 6; r++) row(1, r, 4, 9);
  for (let r = 2; r <= 5; r++) row(2, r, 5, 8);
  for (let r = 3; r <= 4; r++) row(3, r, 6, 7);
  t.push({ x: 13, y: 7, z: 4 });
  return t;
}
export const LAYOUTS = { turtle };
