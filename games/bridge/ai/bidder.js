// Robot bidder entry point. Interface: (hand, auction, seat) => call   (call may carry .meaning for alerts)
import { PASS, isLegal } from '../engine/auction.js';
import { partner } from '../engine/cards.js';
import { ctx } from './ctx.js';
import { openBid } from './open.js';
import { respond } from './respond.js';
import { rebid } from './rebid.js';
import { judge } from './judge.js';
import { overcall, advance, contested, answerNegative } from './compete.js';

export function chooseCallRaw(hand, a, seat) {
  const c = ctx(a, seat);
  if (!c.first) return openBid(hand);

  // partner's most recent non-pass call, and whether I have already answered it
  const p = partner(seat);
  let lastP = -1;
  a.calls.forEach((e, i) => { if (e.seat === p && e.call.type !== 'pass') lastP = i; });
  const fresh = lastP >= 0 && !a.calls.slice(lastP + 1).some(e => e.seat === seat);

  if (!fresh) {
    const myAfterFirst = a.calls.slice(a.calls.indexOf(c.first) + 1).some(e => e.seat === seat);
    if (c.ourBids.length === 0 && !myAfterFirst && c.first.seat !== seat) return overcall(hand, a, seat);
    return judge(hand, a, seat);
  }

  const pc = a.calls[lastP];
  const weBidBefore = c.ourBids.some(e => a.calls.indexOf(e) < lastP);
  if (pc.call.type === 'x') {
    if (!weBidBefore) return advance(hand, a, seat);                          // partner doubled for takeout
    if (c.myBids.length === 1 && pc.call.meaning?.takeout === false) return answerNegative(hand, a, seat);
    return judge(hand, a, seat);
  }
  if (pc === c.first) return c.theirBids.length === 0 ? respond(hand, a, pc.call) : contested(hand, a, seat);
  if (!weBidBefore) return advance(hand, a, seat);                            // partner overcalled
  if (c.first.seat === seat && c.myBids.length === 1 && pc === c.partnerBids[0] && c.theirBids.length === 0 &&
      a.calls.indexOf(pc) === a.calls.length - 2) return rebid(hand, a, c.myBids[0].call, pc.call);
  return judge(hand, a, seat);
}

// Safe wrapper: an illegal suggestion (a bug in a rule) becomes a pass instead of crashing the game.
export function chooseCall(hand, a, seat) {
  const call = chooseCallRaw(hand, a, seat);
  return call && isLegal(a, call) ? call : PASS;
}
