// Responder's first call after partner opened and the opponents passed.
import { bid, PASS } from '../engine/auction.js';
import { analyze } from './hand.js';
import { M } from './meaning.js';
import { cheapest, legalOr } from './ctx.js';

const mk = (level, strain, meaning) => ({ ...bid(level, strain), meaning });
const NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };

export function respond(hand, a, open) {
  const h = analyze(hand), L = open.level, s = open.strain;
  let call = PASS;
  if (s === 'N') call = overNT(h, L);
  else if (s === 'C' && L === 2) call = overStrong(h, a);
  else if (L === 2) call = overWeakTwo(h, s);
  else if (L >= 3) call = overPreempt(h, s, L);
  else call = overOneSuit(h, a, s);
  return legalOr(a, call);
}

function overNT(h, L) {
  const base = L === 1 ? 2 : 3, need = L === 1 ? 10 : 5, inviteLo = L === 1 ? 8 : 99;
  if (h.hcp >= (L === 1 ? 17 : 13)) return mk(6, 'N', M('slam values, 6NT', { hcp: [17, 40] }));
  const game = h.hcp >= need, invite = h.hcp >= inviteLo && !game;
  const five = h.len.S >= 5 && h.len.S >= h.len.H ? 'S' : h.len.H >= 5 ? 'H' : null;
  if (five) {                                                   // Jacoby transfer: bid the suit below
    const t = five === 'S' ? 'H' : 'D';
    return mk(base, t, M(`transfer to ${NAME[five]} (5+)`, { len: { [five]: 5 }, forcing: true }));
  }
  if ((game || invite) && (h.len.S === 4 || h.len.H === 4))
    return mk(base, 'C', M('Stayman: asks for a 4-card major', { forcing: true, hcp: [need === 10 ? 8 : 5, 40] }));
  if (game) return mk(3, 'N', M('to play, game values', { hcp: [need, 16], bal: true }));
  if (invite) return mk(2, 'N', M('invitational 8-9', { hcp: [8, 9], bal: true }));
  return PASS;
}

function overStrong(h, a) {
  const five = ['S', 'H', 'D', 'C'].filter(x => h.len[x] >= 5).sort((x, y) => h.len[y] - h.len[x])[0];
  if (h.hcp >= 8 && five) return mk(five === 'C' || five === 'D' ? 3 : 2, five, M(`positive, 5+ ${NAME[five]}`, { hcp: [8, 40], len: { [five]: 5 }, gf: true, forcing: true }));
  if (h.hcp >= 8 && h.balanced) return mk(2, 'N', M('positive, balanced 8+', { hcp: [8, 40], bal: true, gf: true, forcing: true }));
  return mk(2, 'D', M('waiting / negative', { hcp: [0, 7], gf: true, forcing: true }));
}

function overWeakTwo(h, s) {
  if (h.len[s] >= 3 && h.hcp >= 14 && (s === 'H' || s === 'S')) return mk(4, s, M('to play', { len: { [s]: 3 } }));
  if (h.len[s] >= 4 && h.hcp <= 9 && (s === 'H' || s === 'S')) return mk(3, s, M('competitive raise', { len: { [s]: 4 }, hcp: [0, 9] }));
  if (h.hcp >= 17 && h.stopper('S') && !(s === 'S')) return mk(3, 'N', M('to play', { hcp: [17, 40] }));
  return PASS;
}

function overPreempt(h, s, L) {
  const maj = s === 'S' || s === 'H';
  if (maj && L === 3 && h.len[s] >= 2 && h.hcp >= 10) return mk(4, s, M('to play', { len: { [s]: 2 } }));
  if (s === 'N') return PASS;
  if (L === 3 && !maj && h.hcp >= 16 && h.stopper(s)) return mk(3, 'N', M('to play', { hcp: [16, 40] }));
  return PASS;
}

function overOneSuit(h, a, s) {
  const maj = s === 'S' || s === 'H', sup = h.len[s];
  if (maj && sup >= 3) {
    if (sup >= 4 && h.tp >= 13) return mk(2, 'N', M('Jacoby 2NT: game force, 4+ trumps', { hcp: [10, 40], len: { [s]: 4 }, gf: true, forcing: true }));
    if (h.tp >= 11 && h.tp <= 12) return mk(3, s, M('limit raise', { hcp: [8, 12], len: { [s]: 3 } }));
    if (h.tp >= 6 && h.tp <= 10) return mk(2, s, M('raise, 7-10 points', { hcp: [5, 10], len: { [s]: 3 } }));
  }
  if (h.hcp < 6) return PASS;
  // a major we can show at the one level (4+ cards), unless that is partner's suit
  const oneLevel = ['H', 'S'].filter(x => x !== s && h.len[x] >= 4 && cheapest(a, x).level === 1);
  const pick = oneLevel.sort((x, y) => h.len[y] - h.len[x] || (x === 'H' ? -1 : 1))[0];
  if (pick) return mk(1, pick, M(`4+ ${NAME[pick]}, 6+ HCP, forcing`, { hcp: [6, 40], len: { [pick]: 4 }, forcing: true }));
  if (!maj && sup >= 5 && h.hcp <= 9) return mk(3, s, M('weak raise, 5+ trumps', { hcp: [4, 9], len: { [s]: 5 } }));
  if (!maj && sup >= 4 && h.hcp >= 10 && h.hcp <= 12) return mk(2, s, M('inverted raise, forcing', { hcp: [10, 12], len: { [s]: 4 }, forcing: true }));
  if (h.hcp >= 12) {                                            // 2/1 game force in our longest side suit
    const own = ['S', 'H', 'D', 'C'].filter(x => x !== s && h.len[x] >= 4 && cheapest(a, x).level === 2)
      .sort((x, y) => h.len[y] - h.len[x])[0];
    if (own && (h.len[own] >= 5 || !h.balanced)) return mk(2, own, M(`2/1 game force, ${h.len[own]}+ ${NAME[own]}`, { hcp: [12, 40], len: { [own]: 4 }, gf: true, forcing: true }));
  }
  if (h.balanced || h.len[s] <= 2) {
    if (h.hcp <= 10) return mk(1, 'N', M('6-10, no fit, no 1-level suit', { hcp: [6, 10], bal: h.balanced, forcing: maj }));
    if (h.hcp <= (maj ? 15 : 12)) return mk(2, 'N', M(maj ? '13-15 balanced' : '11-12 balanced', { hcp: maj ? [13, 15] : [11, 12], bal: true, forcing: true }));
    return mk(3, 'N', M('16+ balanced, to play', { hcp: [16, 40], bal: true }));
  }
  return h.hcp <= 10 ? mk(1, 'N', M('6-10, no fit', { hcp: [6, 10], forcing: maj })) : PASS;
}
