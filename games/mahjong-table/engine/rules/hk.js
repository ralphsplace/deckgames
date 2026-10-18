// Hong Kong Mahjong ruleset (simplified "new style": 3-faan minimum, 10-faan limit, 144 tiles).
import { decompositions, isThirteenOrphans } from '../hand.js';
import { isSuited, isHonor, DRAGONS, WINDS, suitOf } from '../tiles.js';

const TABLE = { 3: 8, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, 9: 96, 10: 128 };

export const hk = {
  id: 'hk',
  name: 'Hong Kong',
  bonusTiles: true,
  minScore: 3,        // minimum faan to declare a win
  limit: 10,
  reserve: 14,        // dead wall left untouched
  points: faan => TABLE[Math.min(faan, 10)] || 0,

  // ctx: { concealed (incl. winning tile), melds, bonus, wind, round, selfDraw, lastTile, replacement }
  evaluate(ctx) {
    const { concealed, melds, bonus, wind, round } = ctx;
    if (!melds.length && isThirteenOrphans(concealed)) {
      return { faan: hk.limit, limit: true, items: [{ name: 'Thirteen orphans', faan: hk.limit }] };
    }
    let best = null;
    for (const d of decompositions(concealed, 4 - melds.length)) {
      const r = score(d, ctx);
      if (!best || r.faan > best.faan) best = r;
    }
    return best;
  },

  // Winner by discard: discarder pays the full value. Self-draw: all three pay it.
  payments(winner, discarder, points) {
    const delta = [0, 0, 0, 0];
    if (discarder == null) for (let i = 0; i < 4; i++) { if (i !== winner) { delta[i] -= points; delta[winner] += points; } }
    else { delta[discarder] -= points; delta[winner] += points; }
    return delta;
  },
};

function score(d, ctx) {
  const { melds, bonus, wind, round } = ctx;
  const sets = [...melds.map(m => ({ type: m.type === 'chow' ? 'chow' : 'pung', tiles: m.tiles })), ...d.sets];
  const pungs = sets.filter(s => s.type === 'pung'), chows = sets.filter(s => s.type === 'chow');
  const tiles = [...sets.flatMap(s => s.tiles), d.pair, d.pair];
  const items = [];
  const add = (name, faan) => items.push({ name, faan });
  let limit = false;
  const addLimit = name => { limit = true; add(name, hk.limit); };

  const suited = tiles.filter(isSuited), honors = tiles.some(isHonor);
  const suits = new Set(suited.map(suitOf));
  if (suits.size === 0) addLimit('All honors');
  else if (suits.size === 1 && !honors) add('Pure one suit', 7);
  else if (suits.size === 1) add('Mixed one suit', 3);

  if (pungs.length === 4) add('All pungs', 3);
  const dragonPungs = pungs.filter(s => DRAGONS.includes(s.tiles[0]));
  for (const s of dragonPungs) add(`Dragon pung`, 1);
  if (dragonPungs.length === 2 && DRAGONS.includes(d.pair)) add('Small three dragons', 3);
  if (dragonPungs.length === 3) add('Big three dragons', 5);
  const windPungs = pungs.filter(s => WINDS.includes(s.tiles[0]));
  if (windPungs.length === 4) addLimit('Big four winds');
  else if (windPungs.length === 3 && WINDS.includes(d.pair)) addLimit('Small four winds');
  for (const s of windPungs) {
    if (s.tiles[0] === WINDS[wind]) add('Seat wind pung', 1);
    if (s.tiles[0] === WINDS[round]) add('Round wind pung', 1);
  }
  const scoringPair = DRAGONS.includes(d.pair) || d.pair === WINDS[wind] || d.pair === WINDS[round];
  if (chows.length === 4 && !scoringPair) add('Common hand', 1);

  for (const b of bonus) if (+b[1] === wind + 1) add(b[0] === 'F' ? 'Seat flower' : 'Seat season', 1);
  const nF = bonus.filter(b => b[0] === 'F').length, nT = bonus.filter(b => b[0] === 'T').length;
  if (nF === 4) add('All four flowers', 2);
  if (nT === 4) add('All four seasons', 2);
  if (!bonus.length) add('No flowers', 1);

  if (!melds.some(m => m.open)) add('Concealed hand', 1);
  if (ctx.selfDraw) add('Self-drawn', 1);
  if (ctx.lastTile) add(ctx.selfDraw ? 'Last tile from the wall' : 'Last discard', 1);
  if (ctx.replacement && ctx.selfDraw) add('Win on replacement tile', 1);

  const faan = limit ? hk.limit : Math.min(hk.limit, items.reduce((a, i) => a + i.faan, 0));
  return { faan, limit, items };
}
