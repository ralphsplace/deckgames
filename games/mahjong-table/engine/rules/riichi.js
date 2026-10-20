// Riichi (Japanese) Mahjong ruleset. 136 tiles, riichi, dora/ura, furiten, han/fu scoring, honba, tenpai payments.
// Simplifications: no red fives, no double riichi, no tenhou/chiihou, no chankan, no pao, no abortive draws.
import { decompositions, isThirteenOrphans, isSevenPairs, shanten } from '../hand.js';
import { isSuited, isHonor, isTerminal, DRAGONS, WINDS, suitOf, rankOf } from '../tiles.js';

const yaochu = t => isHonor(t) || isTerminal(t);
const ceil100 = x => Math.ceil(x / 100) * 100;
const GREEN = new Set(['b2', 'b3', 'b4', 'b6', 'b8', 'G']);

export function basicPoints(han, fu, yakuman = 0) {
  if (yakuman) return 8000 * yakuman;
  if (han >= 13) return 8000;
  if (han >= 11) return 6000;
  if (han >= 8) return 4000;
  if (han >= 6) return 3000;
  if (han >= 5) return 2000;
  return Math.min(2000, fu * 2 ** (2 + han));
}

export const riichi = {
  id: 'riichi',
  name: 'Riichi (Japanese)',
  unit: 'han',
  bonusTiles: false,
  minScore: 1,           // one yaku (checked inside evaluate)
  sevenPairs: true,
  riichiBet: true,
  dora: true,
  furiten: true,
  limit: 13,

  // ctx: { concealed (incl. win tile), melds, wind, round, selfDraw, winTile, lastTile, replacement, riichi, ippatsu, dora[], ura[] }
  evaluate(ctx) {
    const { concealed, melds } = ctx;
    const all = [...concealed, ...melds.flatMap(m => m.tiles)];
    let best = null;
    const consider = r => { if (r && (!best || r.basic > best.basic || (r.basic === best.basic && r.faan > best.faan))) best = r; };

    if (!melds.length && isThirteenOrphans(concealed)) return finish(ctx, all, [], 1, ['Thirteen orphans'], 0);
    if (!melds.length && isSevenPairs(concealed)) consider(scorePairs(ctx, all));
    for (const d of decompositions(concealed, 4 - melds.length)) {
      for (const wait of waitKinds(d, ctx)) consider(scoreSets(ctx, all, d, wait));
    }
    return best;
  },

  settle(round, winner, discarder, r) {
    const base = r.basic ?? basicPoints(r.faan, r.fu, r.yakuman), h = round.honba, dealerWins = winner === round.dealer;
    const delta = [0, 0, 0, 0];
    if (discarder == null) {
      for (let i = 0; i < 4; i++) {
        if (i === winner) continue;
        const pay = ceil100(base * (dealerWins || i === round.dealer ? 2 : 1)) + 100 * h;
        delta[i] -= pay; delta[winner] += pay;
      }
    } else {
      const pay = ceil100(base * (dealerWins ? 6 : 4)) + 300 * h;
      delta[discarder] -= pay; delta[winner] += pay;
    }
    return { points: delta[winner], delta };
  },

  settleDraw(round) {
    const ready = round.players.map((p, i) => shanten(p.hand, p.melds.length, true) === 0);
    const n = ready.filter(Boolean).length, delta = [0, 0, 0, 0];
    if (n > 0 && n < 4) ready.forEach((t, i) => { delta[i] = t ? 3000 / n : -3000 / (4 - n); });
    return { delta, tenpai: ready, dealerKeeps: ready[round.dealer] };
  },
};

// Ways the winning tile could sit in the decomposition: {kind, set} (set = index into d.sets or -1 for pair)
function waitKinds(d, ctx) {
  const t = ctx.winTile, out = [];
  if (d.pair === t) out.push({ kind: 'tanki', set: -1 });
  const seen = new Set();
  d.sets.forEach((s, i) => {
    if (!s.tiles.includes(t)) return;
    const key = s.type + s.tiles.join('');
    if (seen.has(key)) return; seen.add(key);
    if (s.type === 'pung') { out.push({ kind: 'shanpon', set: i }); return; }
    const pos = s.tiles.indexOf(t), r = rankOf(s.tiles[0]);
    if (pos === 1) out.push({ kind: 'kanchan', set: i });
    else if ((pos === 0 && r === 7) || (pos === 2 && r === 1)) out.push({ kind: 'penchan', set: i });
    else out.push({ kind: 'ryanmen', set: i });
  });
  return out;
}

function addDora(ctx, all, items) {
  const n = ts => ts.reduce((a, d) => a + all.filter(t => t === d).length, 0);
  const dora = n(ctx.dora || []), ura = n(ctx.ura || []);
  if (dora) items.push({ name: 'Dora', faan: dora });
  if (ura) items.push({ name: 'Ura dora', faan: ura });
}

function finish(ctx, all, items, yakumanCount, yakumanNames, fu) {
  if (yakumanCount) {
    return { faan: 13 * yakumanCount, fu, yakuman: yakumanCount, basic: 8000 * yakumanCount,
      items: yakumanNames.map(name => ({ name, faan: 13 })) };
  }
  return null;
}

// Yaku common to every hand shape
function commonYaku(ctx, all, closed, items) {
  const { selfDraw } = ctx;
  if (ctx.riichi) items.push({ name: 'Riichi', faan: 1 });
  if (ctx.riichi && ctx.ippatsu) items.push({ name: 'Ippatsu', faan: 1 });
  if (closed && selfDraw) items.push({ name: 'Menzen tsumo', faan: 1 });
  if (ctx.lastTile) items.push({ name: selfDraw ? 'Haitei (last tile)' : 'Houtei (last discard)', faan: 1 });
  if (selfDraw && ctx.replacement) items.push({ name: 'Rinshan kaihou', faan: 1 });
  if (all.every(t => !yaochu(t))) items.push({ name: 'Tanyao', faan: 1 });
  const suits = new Set(all.filter(isSuited).map(suitOf)), honors = all.some(isHonor);
  if (suits.size === 1 && !honors) items.push({ name: 'Chinitsu', faan: closed ? 6 : 5 });
  else if (suits.size === 1) items.push({ name: 'Honitsu', faan: closed ? 3 : 2 });
  if (all.every(yaochu) && !items.some(i => i.name === 'Honroutou')) items.push({ name: 'Honroutou', faan: 2 });
}

function yakumanCommon(all) {
  const names = [];
  if (all.every(isHonor)) names.push('Tsuuiisou');
  if (all.every(t => isTerminal(t))) names.push('Chinroutou');
  if (all.every(t => GREEN.has(t))) names.push('Ryuuiisou');
  return names;
}

function scorePairs(ctx, all) {
  const ym = yakumanCommon(all);
  if (ym.length) return finish(ctx, all, [], ym.length, ym, 25);
  const items = [{ name: 'Chiitoitsu', faan: 2 }];
  commonYaku(ctx, all, true, items);
  const han = items.reduce((a, i) => a + i.faan, 0);
  addDora(ctx, all, items);
  const total = items.reduce((a, i) => a + i.faan, 0);
  return { faan: total, fu: 25, items, yakuman: 0, basic: basicPoints(total, 25) };
}

function scoreSets(ctx, all, d, wait) {
  const { melds, selfDraw } = ctx;
  const closed = !melds.some(m => m.open);
  const sets = [
    ...melds.map(m => ({ type: m.type === 'chow' ? 'chow' : m.type, tiles: m.tiles, open: !!m.open, concealedMeld: !m.open })),
    ...d.sets.map((s, i) => ({ ...s, open: s.type === 'pung' && !selfDraw && wait.set === i, fromHand: true })),
  ];
  const pungs = sets.filter(s => s.type !== 'chow'), chows = sets.filter(s => s.type === 'chow');
  const seatW = WINDS[ctx.wind], roundW = WINDS[ctx.round];
  const concealedPungs = pungs.filter(s => !s.open).length;

  // yakuman
  const ym = yakumanCommon(all);
  if (concealedPungs === 4 && closed) ym.push('Suuankou');
  const dragonP = pungs.filter(s => DRAGONS.includes(s.tiles[0])), windP = pungs.filter(s => WINDS.includes(s.tiles[0]));
  if (dragonP.length === 3) ym.push('Daisangen');
  if (windP.length === 4) ym.push('Daisuushii'); else if (windP.length === 3 && WINDS.includes(d.pair)) ym.push('Shousuushii');
  if (ym.length) return finish(ctx, all, [], ym.length, ym, 30);

  const items = [];
  commonYaku(ctx, all, closed, items);
  // yakuhai
  for (const s of pungs) {
    const t = s.tiles[0];
    if (DRAGONS.includes(t)) items.push({ name: 'Yakuhai (dragon)', faan: 1 });
    if (t === seatW) items.push({ name: 'Yakuhai (seat wind)', faan: 1 });
    if (t === roundW) items.push({ name: 'Yakuhai (round wind)', faan: 1 });
  }
  const pairIsYaku = DRAGONS.includes(d.pair) || d.pair === seatW || d.pair === roundW;
  const pinfu = closed && chows.length === 4 && !pairIsYaku && wait.kind === 'ryanmen';
  if (pinfu) items.push({ name: 'Pinfu', faan: 1 });
  // chow patterns
  const chowKeys = chows.map(c => c.tiles.join(''));
  const dup = chowKeys.filter((k, i) => chowKeys.indexOf(k) !== i);
  if (closed) {
    const pairsOfChows = new Set(dup).size;
    if (pairsOfChows >= 2) items.push({ name: 'Ryanpeikou', faan: 3 });
    else if (pairsOfChows === 1 && chowKeys.length - new Set(chowKeys).size >= 1) items.push({ name: 'Iipeikou', faan: 1 });
  }
  const starts = chows.map(c => [suitOf(c.tiles[0]), rankOf(c.tiles[0])]);
  for (let r = 1; r <= 7; r++) if (['c', 'd', 'b'].every(s => starts.some(([ss, rr]) => ss === s && rr === r))) { items.push({ name: 'Sanshoku doujun', faan: closed ? 2 : 1 }); break; }
  for (const s of 'cdb') if ([1, 4, 7].every(r => starts.some(([ss, rr]) => ss === s && rr === r))) { items.push({ name: 'Ittsu', faan: closed ? 2 : 1 }); break; }
  for (let r = 1; r <= 9; r++) if (['c', 'd', 'b'].every(s => pungs.some(p => p.tiles[0] === s + r))) { items.push({ name: 'Sanshoku doukou', faan: 2 }); break; }
  if (pungs.length === 4) items.push({ name: 'Toitoi', faan: 2 });
  if (concealedPungs === 3) items.push({ name: 'Sanankou', faan: 2 });
  if (pungs.filter(s => s.type === 'kong').length === 3) items.push({ name: 'Sankantsu', faan: 2 });
  if (dragonP.length === 2 && DRAGONS.includes(d.pair)) items.push({ name: 'Shousangen', faan: 2 });
  // chanta / junchan
  const groups = [...sets.map(s => s.tiles), [d.pair, d.pair]];
  if (chows.length && groups.every(g => g.some(yaochu))) {
    const honors = all.some(isHonor);
    items.push(honors ? { name: 'Chanta', faan: closed ? 2 : 1 } : { name: 'Junchan', faan: closed ? 3 : 2 });
  }
  if (!items.some(i => !['Dora'].includes(i.name))) return null;     // no yaku

  // fu
  let fu;
  if (pinfu) fu = selfDraw ? 20 : 30;
  else {
    fu = 20 + (closed && !selfDraw ? 10 : 0) + (selfDraw ? 2 : 0);
    for (const s of pungs) {
      let f = yaochu(s.tiles[0]) ? 4 : 2;
      if (!s.open) f *= 2;
      if (s.type === 'kong') f *= 4;
      fu += f;
    }
    if (DRAGONS.includes(d.pair)) fu += 2;
    if (d.pair === seatW) fu += 2;
    if (d.pair === roundW) fu += 2;
    if (['kanchan', 'penchan', 'tanki'].includes(wait.kind)) fu += 2;
    if (fu === 20) fu = 30;      // open pinfu-shape hand
    fu = Math.ceil(fu / 10) * 10;
  }
  addDora(ctx, all, items);
  const han = items.reduce((a, i) => a + i.faan, 0);
  return { faan: han, fu, items, yakuman: 0, basic: basicPoints(han, fu) };
}
