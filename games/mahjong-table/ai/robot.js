// Robot decisions. Uses only information a player could see: own hand, all melds, bonus tiles and discards.
import { shanten, toCounts } from '../engine/hand.js';
import { TYPES, IDX, isHonor, isSuited, suitOf, DRAGONS, WINDS, isTerminal } from '../engine/tiles.js';

function seenCounts(round, seat) {
  const c = toCounts(round.players[seat].hand);
  round.players.forEach(p => {
    for (const d of p.discards) c[IDX[d]]++;
    for (const m of p.melds) for (const t of m.tiles) c[IDX[t]]++;
  });
  if (round.last && !round.players[round.last.from].discards.includes(round.last.tile)) { /* claimed tile counted via meld */ }
  return c;
}
const without = (a, t) => { const b = a.slice(); b.splice(b.indexOf(t), 1); return b; };

function dominantSuit(round, seat) {
  const p = round.players[seat];
  const all = [...p.hand, ...p.melds.flatMap(m => m.tiles)];
  const n = { c: 0, d: 0, b: 0 };
  for (const t of all) if (isSuited(t)) n[suitOf(t)]++;
  const [s, v] = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  const total = n.c + n.d + n.b;
  return { suit: s, share: total ? v / total : 0, total };
}
const scoringHonor = (round, seat, t) => DRAGONS.includes(t) || t === WINDS[round.wind(seat)] || t === WINDS[round.round];

// How much do we like keeping this tile (tie-breaks only)?
function keepBias(round, seat, t, counts) {
  let v = 0;
  const dom = dominantSuit(round, seat);
  if (isSuited(t)) {
    if (dom.share >= 0.6 && dom.total >= 8) v += suitOf(t) === dom.suit ? 2 : -3;
    if (isTerminal(t)) v -= 0.5;
  } else if (scoringHonor(round, seat, t)) v += counts[IDX[t]] >= 2 ? 3 : 0.5;
  else v += counts[IDX[t]] >= 2 ? 1 : -1;
  return v;
}

// Tiles an opponent in riichi is known not to be waiting on (their own river)
function safeTiles(round, seat) {
  const safe = new Set();
  round.players.forEach((q, i) => { if (i !== seat && q.riichi) q.river.forEach(t => safe.add(t)); });
  return { active: round.players.some((q, i) => i !== seat && q.riichi), safe };
}

// Returns { tile, riichi } : which tile to throw and whether to declare riichi with it
export function chooseDiscard(round, seat) {
  const p = round.players[seat];
  if (p.riichi) return { tile: round.drawn, riichi: false };
  const k = p.melds.length, seen = seenCounts(round, seat), pairs = !!round.rules.sevenPairs;
  const danger = safeTiles(round, seat);
  const riichiOk = new Set(round.riichiOptions(seat));
  const own = toCounts(p.hand);
  let best = null;
  for (const t of new Set(p.hand)) {
    const rest = without(p.hand, t);
    const sh = shanten(rest, k, pairs);
    let score;
    if (sh === 0) {
      // ready: count waits that would actually score enough to win
      let good = 0;
      for (let i = 0; i < 34; i++) {
        const left = 4 - seen[i] + (TYPES[i] === t ? 0 : 0);
        if (left <= 0) continue;
        const hand = [...rest, TYPES[i]];
        if (shanten(hand, k, pairs) === -1 && round._eval(seat, hand, { selfDraw: false, winTile: TYPES[i] })) good += left;
      }
      score = good > 0 ? 1000 + good * 10 : 380;
    } else {
      let ukeire = 0;
      for (let i = 0; i < 34; i++) {
        const left = 4 - seen[i];
        if (left > 0 && shanten([...rest, TYPES[i]], k, pairs) < sh) ukeire += left;
      }
      score = (6 - sh) * 100 + ukeire * 2;
    }
    score += keepBias(round, seat, t, own);
    if (danger.active && sh > 0) {
      if (danger.safe.has(t)) score += 150;
      else if (isSuited(t) && t[1] >= '3' && t[1] <= '7') score -= 60;
      else if (seen[IDX[t]] >= 3) score += 30;
    }
    if (!best || score > best.score) best = { t, score, sh };
  }
  // declare riichi when the best discard leaves a ready hand
  return { tile: best.t, riichi: best.sh === 0 && best.score >= 1000 && riichiOk.has(best.t) };
}

// Decide what to do with a drawn tile before discarding: 'win' | {kong: tile} | null
export function chooseSelf(round, seat) {
  const o = round.selfOptions();
  if (o.win) return { action: 'win' };
  const p = round.players[seat], k = p.melds.length;
  for (const t of o.addKongs) return { action: 'kong', tile: t };
  for (const t of o.concealedKongs) {
    // only kong if it doesn't wreck the hand
    const rest = p.hand.filter(x => x !== t);
    if (shanten(rest, k + 1) <= shanten(p.hand, k, !!round.rules.sevenPairs)) return { action: 'kong', tile: t };
  }
  return null;
}

export function chooseClaim(round, seat, opt) {
  if (opt.win) return { action: 'win' };
  if (round.rules.id !== 'hk') {
    // Riichi: an open hand needs a yaku, so robots only call yakuhai pungs (and never when someone is in riichi)
    const t = round.last.tile;
    if (safeTiles(round, seat).active || !opt.pung) return { action: 'pass' };
    if (scoringHonor(round, seat, t)) return { action: opt.kong ? 'kong' : 'pung' };
    return { action: 'pass' };
  }
  const p = round.players[seat], k = p.melds.length, t = round.last.tile;
  const before = shanten(p.hand, k);   // Hong Kong only (no seven pairs)
  const dom = dominantSuit(round, seat);
  const good = scoringHonor(round, seat, t);
  if (opt.kong && good) return { action: 'kong' };
  if (opt.pung) {
    const rest = without(without(p.hand, t), t);
    const after = shanten(rest, k + 1);
    const fits = good || (isSuited(t) && dom.share >= 0.6 && suitOf(t) === dom.suit) || before <= 1;
    // after the claim we must discard, so compare against shanten of the best 13-tile result
    if (fits && after <= before) return { action: 'pung' };
  }
  if (opt.chows.length && dom.share >= 0.7 && dom.total >= 8 && suitOf(t) === dom.suit) {
    for (const use of opt.chows) {
      const rest = without(without(p.hand, use[0]), use[1]);
      if (shanten(rest, k + 1) <= before) return { action: 'chow', use };
    }
  }
  return { action: 'pass' };
}
