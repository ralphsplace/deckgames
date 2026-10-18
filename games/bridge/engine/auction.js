// Auction rules only. Which call to make is the bidder's job (ai/bidder.js).
import { SEATS, STRAINS, side } from './cards.js';
export const PASS = { type: 'pass' }, X = { type: 'x' }, XX = { type: 'xx' };
export const bid = (level, strain) => ({ type: 'bid', level, strain });
export const newAuction = dealer => ({ dealer, calls: [] });
export const turn = a => SEATS[(SEATS.indexOf(a.dealer) + a.calls.length) % 4];
const last = (a, f) => [...a.calls].reverse().find(f);
export const lastBid = a => last(a, c => c.call.type === 'bid');

export function isComplete(a) {
  const c = a.calls, pass = x => x.call.type === 'pass';
  if (c.length >= 4 && c.every(pass)) return true;
  return !!lastBid(a) && c.length >= 4 && c.slice(-3).every(pass);
}

export function isLegal(a, call) {
  if (isComplete(a)) return false;
  if (call.type === 'pass') return true;
  const seat = turn(a), lnp = last(a, c => c.call.type !== 'pass');
  if (call.type === 'bid') {
    if (call.level < 1 || call.level > 7 || !STRAINS.includes(call.strain)) return false;
    const lb = lastBid(a);
    if (!lb) return true;
    const L = lb.call;
    return call.level > L.level || (call.level === L.level && STRAINS.indexOf(call.strain) > STRAINS.indexOf(L.strain));
  }
  if (call.type === 'x') return !!lnp && lnp.call.type === 'bid' && side(lnp.seat) !== side(seat);
  if (call.type === 'xx') return !!lnp && lnp.call.type === 'x' && side(lnp.seat) !== side(seat);
  return false;
}

export function addCall(a, call) {
  if (!isLegal(a, call)) throw new Error('illegal call');
  a.calls.push({ seat: turn(a), call });
  return a;
}

export function contractOf(a) {
  const lb = lastBid(a);
  if (!lb) return null;
  const L = lb.call;
  const first = a.calls.find(c => c.call.type === 'bid' && c.call.strain === L.strain && side(c.seat) === side(lb.seat));
  const after = a.calls.slice(a.calls.indexOf(lb) + 1);
  const dbl = after.some(c => c.call.type === 'xx') ? 2 : after.some(c => c.call.type === 'x') ? 1 : 0;
  return { level: L.level, strain: L.strain, dbl, declarer: first.seat };
}
