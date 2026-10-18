// General-purpose decision for every auction state the rule tables do not cover:
// estimate combined strength and fit from what partner has shown, pick a target contract, bid toward it.
import { SUITS, side, STRAINS } from '../engine/cards.js';
import { bid, PASS, X, lastBid, isLegal } from '../engine/auction.js';
import { analyze } from './hand.js';
import { estimate, M } from './meaning.js';
import { ctx, cheapest } from './ctx.js';

const NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs', N: 'notrump' };
const rank = x => STRAINS.indexOf(x);

// Calls made here describe the hand loosely (HCP +/-2), so the partner can judge the next step.
const mm = (h, text, o = {}) => M(text, { hcp: [Math.max(0, h.hcp - 2), Math.min(40, h.hcp + 2)], bal: h.balanced, ...o });

export function partnerMid(p) {
  const [lo, hi] = p.hcp;
  return lo + Math.min(hi - lo, 6) * 0.4;
}

export function judge(hand, a, seat) {
  const h = analyze(hand), c = ctx(a, seat), p = estimate(a, seat), lb = lastBid(a);
  if (!lb) return PASS;
  const theirs = lb.seat !== seat && side(lb.seat) !== c.us;
  const pmid = partnerMid(p);

  // best fit: combined length >= 8, majors first, then longer
  const fits = SUITS.map(s => ({ s, n: h.len[s] + p.len[s] })).filter(f => f.n >= 8 && p.len[f.s] >= 3 && h.len[f.s] >= 3)
    .sort((x, y) => y.n - x.n || (x.s === 'S' || x.s === 'H' ? -1 : 1));
  const fit = fits.find(f => f.s === 'S' || f.s === 'H') || fits[0];
  const combined = (fit ? h.tp : h.hcp) + pmid;
  const major = fit && (fit.s === 'S' || fit.s === 'H');

  let goal;
  if (combined >= 34) goal = { strain: fit ? fit.s : 'N', level: 6 };
  else if (combined >= (major ? 25 : fit ? 30 : 25) || (p.gf && combined >= 22)) {
    goal = fit && (major || combined >= 30) ? { strain: fit.s, level: major ? 4 : 5 } : { strain: 'N', level: 3 };
  } else goal = fit ? { strain: fit.s, level: Math.max(2, fit.n - 6) } : { strain: 'N', level: combined >= 22 ? 2 : 1 };

  const game = goal.level >= (goal.strain === 'N' ? 3 : goal.strain === 'S' || goal.strain === 'H' ? 4 : 5);
  const towards = () => {
    const t = bid(goal.level, goal.strain);
    return isLegal(a, t) ? { ...t, meaning: mm(h, game ? 'to play, game' : `competes to ${goal.level}${goal.strain}`) } : null;
  };

  if (theirs) {                                                      // opponents have the last bid
    if (game || (fit && goal.level > lb.call.level)) { const t = towards(); if (t) return t; }
    // law of total tricks: compete to (fit - 6) while they are not already too high
    if (fit && lb.call.level < fit.n - 6) {
      const t = cheapest(a, fit.s);
      if (t && t.level <= fit.n - 6) return { ...t, meaning: mm(h, `competes, ${fit.n}-card fit`, { len: { [fit.s]: 3 } }) };
    }
    if (lb.call.level >= 4 && h.hcp >= 15 && !fit) return isLegal(a, X) ? { ...X, meaning: mm(h, 'penalty double') } : PASS;
    return PASS;
  }

  // our side has the last bid (partner or me)
  const mustBid = p.forcing && lb.seat !== seat;
  if (game || goal.level > lb.call.level) {
    const t = towards();
    if (t && (lb.call.level < goal.level || (lb.call.level === goal.level && goal.strain !== lb.call.strain))) return t;
  }
  if (!mustBid) return PASS;

  // forced to speak but nothing to show: NT with stoppers, else the fit, else longest suit
  if (fit && cheapest(a, fit.s)) return { ...cheapest(a, fit.s), meaning: mm(h, 'forced, supports') };
  const best = SUITS.filter(s => h.len[s] >= 5 && s !== lb.call.strain).sort((x, y) => h.len[y] - h.len[x])[0];
  const nt = cheapest(a, 'N');
  if (nt && nt.level <= 3 && (!best || h.balanced)) return { ...nt, meaning: mm(h, 'notrump, no fit', { bal: true }) };
  if (best && cheapest(a, best)) return { ...cheapest(a, best), meaning: mm(h, `own suit, ${NAME[best]}`, { len: { [best]: 5 } }) };
  return nt ? { ...nt, meaning: mm(h, 'notrump') } : PASS;
}
