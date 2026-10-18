// Opener's rebid after partner's response (opponents passing).
import { STRAINS } from '../engine/cards.js';
import { bid, PASS } from '../engine/auction.js';
import { analyze } from './hand.js';
import { M } from './meaning.js';
import { cheapest, legalOr } from './ctx.js';

const mk = (level, strain, meaning) => ({ ...bid(level, strain), meaning });
const NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const rank = x => STRAINS.indexOf(x);

export function rebid(hand, a, open, resp) {
  const h = analyze(hand);
  if (open.strain === 'N') return legalOr(a, afterNT(h, open, resp));
  if (open.level >= 2) return PASS;                                  // weak twos/preempts and 2C go to judge()
  return legalOr(a, afterSuit(h, a, open, resp));
}

function afterNT(h, open, r) {
  const base = open.level === 1 ? 2 : 3;
  if (r.level === base && r.strain === 'C') {                        // Stayman
    if (h.len.H >= 4) return mk(base, 'H', M('4+ hearts', { len: { H: 4 } }));
    if (h.len.S >= 4) return mk(base, 'S', M('4 spades, denies 4 hearts', { len: { S: 4 } }));
    return mk(base, 'D', M('no 4-card major'));
  }
  if (r.level === base && r.strain === 'D') return mk(base, 'H', M('completes transfer: 2+ hearts'));
  if (r.level === base && r.strain === 'H') return mk(base, 'S', M('completes transfer: 2+ spades'));
  if (open.level === 1 && r.level === 2 && r.strain === 'N') return h.hcp >= 16 ? mk(3, 'N', M('accepts the invitation', { hcp: [16, 17] })) : PASS;
  return PASS;
}

function afterSuit(h, a, open, r) {
  const s = open.strain, maj = s === 'S' || s === 'H', rs = r.strain, rl = r.level;
  const support = rs !== 'N' && rs !== s ? h.len[rs] : 0;
  const ownRaise = rs === s;

  if (ownRaise && maj) {                                             // partner raised my major
    if (rl === 2 && r.meaning?.text?.startsWith('Jacoby')) return mk(4, s, M('to play, no extras to show'));
    if (rl === 3) return h.tp >= 14 ? mk(4, s, M('accepts the limit raise')) : PASS;
    if (h.tp >= 19) return mk(4, s, M('game', { hcp: [17, 21] }));
    if (h.tp >= 17) return mk(3, s, M('game try, about 17 points', { hcp: [15, 18] }));
    return PASS;
  }
  if (rs === 'N' && rl === 2 && maj) return h.len[s] >= 6 ? mk(4, s, M('to play', { len: { [s]: 6 } })) : mk(3, 'N', M('to play'));
  if (rs === 'N' && rl === 3) return PASS;

  if (support >= 4 && (rs === 'S' || rs === 'H')) {                  // fit for partner's major
    if (h.tp >= 19 || (rl === 2 && h.tp >= 17)) return mk(4, rs, M(`game, ${support}+ ${NAME[rs]}`, { len: { [rs]: 4 }, hcp: [15, 21] }));
    if (h.tp >= 16) return mk(rl === 2 ? 3 : 3, rs, M('raise showing extras', { len: { [rs]: 4 }, hcp: [15, 18] }));
    return mk(rl === 2 ? 3 : 2, rs, M(`minimum raise, ${support}+ ${NAME[rs]}`, { len: { [rs]: 4 }, hcp: [12, 14] }));
  }
  const gfResp = rl === 2 && r.meaning?.gf;
  const nt = (lv, t, hc) => mk(lv, 'N', M(t, { hcp: hc, bal: true }));
  if (h.balanced) {
    if (h.hcp >= 18 && h.hcp <= 19) return cheapest(a, 'N', 1).level <= 3 ? nt(rl === 2 ? 3 : 2, 'balanced 18-19', [18, 19]) : PASS;
    if (h.hcp <= 14) return rl === 1 ? (rs === 'N' ? PASS : nt(1, 'balanced 12-14', [12, 14])) : nt(2, 'balanced 12-14', [12, 14]);
  }
  if (h.len[s] >= 6) {
    const jump = h.hcp >= 17 && !gfResp;
    return mk(cheapest(a, s).level + (jump ? 1 : 0), s, M(`rebids ${jump ? '17-20' : 'minimum'}, 6+ ${NAME[s]}`, { len: { [s]: 6 }, hcp: jump ? [17, 20] : [12, 16] }));
  }
  const side = ['S', 'H', 'D', 'C'].filter(x => x !== s && x !== rs && h.len[x] >= 4)
    .sort((x, y) => h.len[y] - h.len[x] || rank(y) - rank(x))[0];
  if (side) {
    const c = cheapest(a, side), reverse = c.level === 2 && rank(side) > rank(s);
    if (!reverse || h.hcp >= 16 || gfResp) return mk(c.level, side, M(`second suit, ${NAME[side]}${reverse ? ', reverse 16+' : ''}`, { len: { [side]: 4 }, forcing: reverse, hcp: reverse ? [16, 21] : [12, 21] }));
  }
  if (h.len[s] >= 5) return mk(cheapest(a, s).level, s, M(`rebids 5+ ${NAME[s]}`, { len: { [s]: 5 } }));
  if (rs === 'N') return PASS;
  const lowest = ['C', 'D', 'H', 'S'].filter(x => x !== rs && h.len[x] >= 3).map(x => cheapest(a, x)).filter(Boolean).sort((x, y) => x.level - y.level || rank(x.strain) - rank(y.strain))[0];
  return lowest ? { ...lowest, meaning: M(`waiting bid in ${NAME[lowest.strain]}`, { forcing: true }) } : nt(Math.max(1, cheapest(a, 'N').level), 'balanced minimum', [12, 14]);
}
