// Auction helpers shared by the bidding modules.
import { STRAINS, side, partner } from '../engine/cards.js';
import { bid, PASS, lastBid, isLegal } from '../engine/auction.js';

export const isBid = c => c.call.type === 'bid';

export function ctx(a, seat) {
  const us = side(seat), them = us === 'NS' ? 'EW' : 'NS';
  const bids = a.calls.filter(isBid);
  return {
    seat, us, them, calls: a.calls, first: bids[0] || null, last: lastBid(a),
    ourBids: bids.filter(c => side(c.seat) === us),
    theirBids: bids.filter(c => side(c.seat) === them),
    myBids: bids.filter(c => c.seat === seat),
    partnerBids: bids.filter(c => c.seat === partner(seat)),
  };
}

// cheapest legal bid in `strain`, optionally jumping `jumps` extra levels; null if it would pass 7
export function cheapest(a, strain, jumps = 0) {
  const lb = lastBid(a);
  let level = 1;
  if (lb) level = lb.call.level + (STRAINS.indexOf(strain) > STRAINS.indexOf(lb.call.strain) ? 0 : 1);
  level += jumps;
  return level <= 7 ? bid(level, strain) : null;
}
export const level = (a, strain, lv) => (lv >= 1 && lv <= 7 ? bid(lv, strain) : null);
export const legalOr = (a, call, fallback = PASS) => (call && isLegal(a, call) ? call : fallback);
export const suitName = s => ({ S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs', N: 'notrump' })[s];
