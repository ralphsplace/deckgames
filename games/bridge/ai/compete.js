// Competitive bidding: overcalls, takeout doubles, advancing, and responding over an overcall.
import { bid, PASS, X, isLegal } from '../engine/auction.js';
import { partner, SUITS, STRAINS } from '../engine/cards.js';
import { analyze, goodSuit } from './hand.js';
import { M } from './meaning.js';
import { ctx, cheapest, legalOr } from './ctx.js';

const NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const withM = (call, meaning) => ({ ...call, meaning });
const dbl = (text, o) => ({ ...X, meaning: M(text, { takeout: true, ...o }) });
const rank = x => STRAINS.indexOf(x);
const unbidSuits = c => SUITS.filter(s => !c.theirBids.some(e => e.call.strain === s));

export function overcall(hand, a, seat) {
  const h = analyze(hand), c = ctx(a, seat), their = c.last.call, ts = their.strain;
  if (their.level >= 3) return PASS;
  const un = unbidSuits(c);
  if (ts !== 'N' && h.tp >= 12 && h.len[ts] <= 2 && un.every(s => h.len[s] >= 3) && isLegal(a, X)) return dbl('takeout double: short in their suit, support for the rest', { hcp: [11, 40] });
  if (h.balanced && h.hcp >= 15 && h.hcp <= 18 && their.level === 1 && ts !== 'N' && h.stopper(ts) && cheapest(a, 'N')?.level === 1)
    return withM(bid(1, 'N'), M('notrump overcall 15-18, stopper', { hcp: [15, 18], bal: true }));
  const cand = SUITS.filter(s => h.len[s] >= 5 && !c.theirBids.some(e => e.call.strain === s)).sort((x, y) => h.len[y] - h.len[x] || rank(y) - rank(x));
  for (const s of cand) {
    const cb = cheapest(a, s);
    if (!cb) continue;
    if (cb.level === 1 && h.hcp >= 8 && h.hcp <= 17 && (h.hcp >= 10 || goodSuit(hand, s))) return withM(cb, M(`overcall, 5+ ${NAME[s]}`, { hcp: [8, 17], len: { [s]: 5 } }));
    if (cb.level === 2 && h.hcp >= 10 && h.hcp <= 17 && goodSuit(hand, s)) return withM(cb, M(`overcall, good 5+ ${NAME[s]}`, { hcp: [10, 17], len: { [s]: 5 } }));
    if (h.len[s] >= 6 && h.hcp >= 5 && h.hcp <= 9 && goodSuit(hand, s) && cb.level <= 2) {
      const j = cheapest(a, s, 1);
      if (j && j.level <= 3) return withM(j, M(`weak jump overcall, 6+ ${NAME[s]}`, { hcp: [3, 9], len: { [s]: 6 } }));
    }
  }
  return PASS;
}

export function advance(hand, a, seat) {
  const h = analyze(hand), c = ctx(a, seat), pe = [...a.calls].reverse().find(e => e.seat === partner(seat) && e.call.type !== 'pass');
  const last = c.last.call;
  if (pe.call.type === 'x') {
    const un = unbidSuits(c).filter(s => !c.theirBids.some(e => e.call.strain === s));
    if (last.strain !== 'N' && h.len[last.strain] >= 5 && h.top3(last.strain) >= 2 && last.level <= 2 && h.hcp >= 8) return PASS;   // sit for penalty
    const stop = last.strain !== 'N' && h.stopper(last.strain);
    const best = un.slice().sort((x, y) => h.len[y] - h.len[x] || (x === 'S' || x === 'H' ? -1 : 1))[0];
    if (stop && h.balanced && h.hcp >= 6 && h.hcp <= 10 && cheapest(a, 'N')?.level <= 2 && h.len[best] < 5) return withM(cheapest(a, 'N'), M('notrump with a stopper', { hcp: [6, 10], bal: true }));
    if (!best) return PASS;
    const jump = h.hcp >= 10 && h.len[best] >= 4, cb = cheapest(a, best, jump ? 1 : 0) || cheapest(a, best);
    return cb ? withM(cb, M(`${jump ? 'jump ' : ''}advance in ${NAME[best]}${jump ? ', 10+' : ''}`, { len: { [best]: 4 }, hcp: jump ? [10, 40] : [0, 9], forcing: jump })) : PASS;
  }
  const ps = pe.call.strain;
  if (ps === 'N') return PASS;
  const sup = h.len[ps], cb = cheapest(a, ps);
  if (sup >= 3 && cb) {
    if (h.tp >= 13 && (ps === 'S' || ps === 'H')) return legalOr(a, withM(bid(4, ps), M('to play, game')));
    const lv = h.tp >= 10 ? Math.max(cb.level, 3) : cb.level;
    if (h.tp >= 6 && lv <= 3 + (sup >= 4 ? 1 : 0)) return legalOr(a, withM(bid(lv, ps), M(h.tp >= 10 ? 'invitational raise' : 'raise', { len: { [ps]: 3 } })));
    if (sup >= 4 && cb.level <= 2) return withM(cb, M('competitive raise', { len: { [ps]: 4 } }));
  }
  const own = SUITS.filter(s => s !== ps && h.len[s] >= 5 && !c.theirBids.some(e => e.call.strain === s)).sort((x, y) => h.len[y] - h.len[x])[0];
  if (own && h.hcp >= 10 && cheapest(a, own)?.level <= 2) return withM(cheapest(a, own), M(`new suit, ${NAME[own]}`, { len: { [own]: 5 }, forcing: true }));
  const l = c.last.call;
  if (h.balanced && h.hcp >= 10 && h.hcp <= 12 && l.strain !== 'N' && h.stopper(l.strain) && cheapest(a, 'N')?.level <= 2) return withM(cheapest(a, 'N'), M('notrump with a stopper', { hcp: [10, 12], bal: true }));
  return PASS;
}

// partner opened, opponents bid, my first turn
export function contested(hand, a, seat) {
  const h = analyze(hand), c = ctx(a, seat), open = c.partnerBids[0].call, os = open.strain, theirs = c.last.call;
  const sup = os !== 'N' ? h.len[os] : 0;
  if (os !== 'N' && sup >= 3 && h.tp >= 6) {
    const cb = cheapest(a, os);
    if (h.tp >= 13 && (os === 'S' || os === 'H')) return legalOr(a, withM(bid(4, os), M('to play, game', { len: { [os]: 3 } })));
    const want = h.tp >= 10 ? 3 : sup >= 4 && h.tp >= 8 ? 3 : 2;
    if (cb && cb.level <= want) return withM(bid(Math.max(cb.level, want), os), M(`raise, ${want === 3 ? 'invitational' : 'competitive'}`, { len: { [os]: 3 } }));
  }
  if (h.hcp >= 6 && theirs.level <= 2 && theirs.strain !== 'N') {
    const unb = SUITS.filter(s => (s === 'S' || s === 'H') && !c.theirBids.some(e => e.call.strain === s) && s !== os);
    if (unb.length && unb.some(s => h.len[s] >= 4) && !unb.some(s => h.len[s] >= 5 && h.hcp >= 10) && isLegal(a, X))
      return dbl('negative double: 4+ in an unbid major', { hcp: [6, 40], takeout: false });
  }
  const own = SUITS.filter(s => s !== os && h.len[s] >= 5 && !c.theirBids.some(e => e.call.strain === s)).sort((x, y) => h.len[y] - h.len[x])[0];
  if (own) { const cb = cheapest(a, own); if (cb && ((cb.level === 1 && h.hcp >= 6) || (cb.level === 2 && h.hcp >= 10))) return withM(cb, M(`new suit, ${NAME[own]}`, { len: { [own]: 5 }, forcing: true })); }
  if (h.balanced && theirs.strain !== 'N' && h.stopper(theirs.strain)) {
    const nt = cheapest(a, 'N');
    if (nt && ((nt.level === 1 && h.hcp >= 8) || (nt.level === 2 && h.hcp >= 11 && h.hcp <= 12))) return withM(nt, M('notrump with a stopper', { bal: true, hcp: [8, 12] }));
    if (nt && h.hcp >= 13 && nt.level <= 3) return withM(bid(3, 'N'), M('to play, stopper', { bal: true, hcp: [13, 40] }));
  }
  return PASS;
}

// I opened, RHO overcalled, partner made a negative double (shows 4+ in the unbid major(s), 6+ HCP)
export function answerNegative(hand, a, seat) {
  const h = analyze(hand), c = ctx(a, seat), os = c.myBids[0].call.strain;
  const un = ['S', 'H'].filter(s => s !== os && !c.theirBids.some(e => e.call.strain === s));
  const fit = un.find(s => h.len[s] >= 4);
  if (fit) {
    const cb = cheapest(a, fit), strong = h.tp >= 16;
    if (cb) return withM(strong ? (cheapest(a, fit, 1) || cb) : cb, M(`${strong ? 'jump ' : ''}raise in ${NAME[fit]}, 4-card fit`, { len: { [fit]: 4 }, hcp: strong ? [16, 21] : [12, 15] }));
  }
  if (h.len[os] >= 6) { const cb = cheapest(a, os); if (cb) return withM(cb, M(`rebids 6+ ${NAME[os]}`, { len: { [os]: 6 } })); }
  const nt = cheapest(a, 'N'), t = c.last.call.strain;
  if (h.balanced && t !== 'N' && h.stopper(t) && nt && nt.level <= 2) return withM(nt, M('notrump with a stopper', { bal: true }));
  if (h.len[os] >= 5) { const cb = cheapest(a, os); if (cb && cb.level <= 2) return withM(cb, M(`rebids ${NAME[os]}`, { len: { [os]: 5 } })); }
  return PASS;
}
