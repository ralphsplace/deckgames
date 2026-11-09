// Hand analysis shared by the robots and the page's "Find my contract" hint.
// plan(hand, reqs, rules) picks, for each requirement, the natural cards to build it from so that the fewest cards
// are still missing once the wilds are shared out. missing === 0 means the contract can go down now; groups then
// lists the cards for each book/run (wilds assigned), ready for Round.layDown.
import { isWild, SUITS } from '../engine/cards.js';

function candidates(req, nat, rules) {
  const out = [], seen = new Set();
  if (req.type === 'book') {
    const by = new Map();
    for (const c of nat) (by.get(c.r) || by.set(c.r, []).get(c.r)).push(c);
    for (const cs of by.values()) out.push(cs.slice(0, req.n));
  } else {
    const low = rules.aceLow ? 1 : 2;
    for (const s of SUITS) {
      const suited = nat.filter(c => c.s === s);
      if (!suited.length) continue;
      for (let lo = low; lo + req.n - 1 <= 14; lo++) {
        const pick = [];
        for (let r = lo; r < lo + req.n; r++) { const c = suited.find(x => x.r === r); if (c) pick.push(c); }
        if (!pick.length) continue;
        const key = pick.map(c => c.r).join(',') + s;
        if (seen.has(key)) continue; seen.add(key); out.push(pick);
      }
    }
  }
  return out.filter(p => p.length >= rules.minNaturals).sort((a, b) => b.length - a.length);
}

export function plan(hand, reqs, rules) {
  const nat = hand.filter(c => !isWild(c, rules)), wild = hand.filter(c => isWild(c, rules));
  const order = reqs.map((q, i) => ({ ...q, i })).sort((a, b) => b.n - a.n);
  const cands = order.map(q => candidates(q, nat, rules));
  let best = null;
  const chosen = [], used = new Set();
  const go = (k, deficit) => {
    if (best && best.missing === 0 && deficit >= best.deficit) return;          // can't beat a complete, leaner plan
    if (k === order.length) {
      const missing = Math.max(0, deficit - wild.length);
      if (!best || missing < best.missing || (missing === best.missing && deficit < best.deficit)) best = { missing, deficit, picks: [...chosen] };
      return;
    }
    let any = false;
    for (const p of cands[k]) {
      if (p.some(c => used.has(c.id))) continue;
      any = true;
      p.forEach(c => used.add(c.id)); chosen.push(p);
      go(k + 1, deficit + order[k].n - p.length);
      chosen.pop(); p.forEach(c => used.delete(c.id));
    }
    if (!any) { chosen.push([]); go(k + 1, deficit + order[k].n); chosen.pop(); }   // nothing to start this one with yet
  };
  go(0, 0);
  const used2 = new Set(best.picks.flat().map(c => c.id));
  const result = { missing: best.missing, deficit: best.deficit, uses: used2, groups: null };
  if (best.missing === 0) {
    const pool = [...wild];
    result.groups = order.map((q, k) => {
      const cards = [...best.picks[k]];
      while (cards.length < q.n) cards.push(pool.shift());
      return { type: q.type, ids: cards.map(c => c.id) };
    });
  }
  return result;
}

// How much a spare card is worth keeping: partners of the same rank, and same-suit neighbours within two ranks.
export function connections(card, hand, rules) {
  if (isWild(card, rules)) return 99;
  let n = 0;
  for (const c of hand) {
    if (c === card || isWild(c, rules)) continue;
    if (c.r === card.r) n += 2;
    else if (c.s === card.s && Math.abs(c.r - card.r) <= 2) n += 1;
  }
  return n;
}
