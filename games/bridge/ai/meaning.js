// What a call promises. Robot calls carry .meaning (also used for the "alert" text in the UI).
// Human calls have none, so interpretHuman() reads them naturally.
import { side, partner } from '../engine/cards.js';
import { isBid } from './ctx.js';

export const M = (text, o = {}) => ({ text, hcp: [0, 40], len: {}, bal: false, forcing: false, gf: false, ...o });
const SUITS_ = ['S', 'H', 'D', 'C'];

export function interpretHuman(a, entry) {
  const c = entry.call;
  if (c.type !== 'bid') return M(c.type === 'x' ? 'double' : c.type === 'xx' ? 'redouble' : 'pass');
  const prior = a.calls.slice(0, a.calls.indexOf(entry));
  const ours = prior.filter(e => isBid(e) && side(e.seat) === side(entry.seat));
  const theirs = prior.filter(e => isBid(e) && side(e.seat) !== side(entry.seat));
  const L = c.level, s = c.strain;
  if (!ours.length && !theirs.length) {                      // opening
    if (s === 'N') return M('natural NT', { hcp: L === 1 ? [15, 17] : [20, 21], bal: true });
    if (s === 'C' && L === 2) return M('strong', { hcp: [22, 40], forcing: true, gf: true });
    if (L === 2) return M('weak two', { hcp: [5, 10], len: { [s]: 6 } });
    if (L >= 3) return M('preempt', { hcp: [4, 10], len: { [s]: 6 + (L - 3) } });
    return M('opening', { hcp: [12, 21], len: { [s]: s === 'S' || s === 'H' ? 5 : 3 } });
  }
  if (!ours.length) {                                        // overcall
    if (s === 'N') return M('NT overcall', { hcp: [15, 18], bal: true });
    return M('overcall', { hcp: L === 1 ? [8, 17] : [10, 17], len: { [s]: 5 } });
  }
  const lo = L <= 1 ? 6 : L === 2 ? 10 : 13;                 // later natural bids: strength rises with level
  if (s === 'N') return M('natural NT', { hcp: [lo, lo + 4], bal: true });
  const was = ours.some(e => e.call.strain === s);
  return M(was ? 'raise/rebid' : 'natural suit', { hcp: [lo, 40], len: { [s]: was ? 3 : 4 }, forcing: !was && L >= 2 });
}

// Combined picture of what `seat`'s partner has shown so far.
export function estimate(a, seat) {
  const p = partner(seat), mine = a.calls.filter(e => e.seat === p);
  const out = { hcp: [0, 40], len: { S: 0, H: 0, D: 0, C: 0 }, bal: false, gf: false, forcing: false, last: null, bidAny: false };
  const anyBid = a.calls.some(isBid);
  for (const e of mine) {
    if (!isBid(e)) {
      const before = a.calls.slice(0, a.calls.indexOf(e));
      if (!before.some(isBid)) out.hcp = [0, 11];                                     // passed in opening position
      else if (e.call.type === 'pass' && !out.bidAny && before.some(x => isBid(x) && side(x.seat) === side(e.seat))) {
        const opp = before.some(x => isBid(x) && side(x.seat) !== side(e.seat));     // passed over our side's bid
        out.hcp = [0, opp ? 9 : 5];
      }
      continue;
    }
    const m = e.call.meaning || interpretHuman(a, e);
    out.bidAny = true;
    out.hcp = [Math.max(out.hcp[0], m.hcp[0]), m.hcp[1] < 40 ? m.hcp[1] : out.hcp[1]];
    if (out.hcp[1] < out.hcp[0]) out.hcp[1] = Math.min(40, out.hcp[0] + 3);
    for (const s of SUITS_) if (m.len[s]) out.len[s] = Math.max(out.len[s], m.len[s]);
    out.bal = m.bal; out.gf = out.gf || m.gf; out.forcing = m.forcing || m.gf; out.last = m;
  }
  return out;
}
