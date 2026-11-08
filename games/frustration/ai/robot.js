// Robot players. Each decision is a small pure function of the round, so a stronger robot can replace any one.
import { plan, connections } from './planner.js';
import { isWild } from '../engine/cards.js';

// 'stock' or 'discard'
export function chooseDraw(round, seat) {
  const top = round.top, me = round.players[seat], hand = me.hand, rules = round.rules;
  if (!top) return 'stock';
  if (me.down) return round.fits(top).length ? 'discard' : 'stock';
  if (isWild(top, rules)) return 'discard';
  const before = plan(hand, round.reqs, rules).missing;
  const after = plan([...hand, top], round.reqs, rules).missing;
  return after < before ? 'discard' : 'stock';
}

// groups for Round.layDown, or null
export function chooseLayDown(round, seat) {
  const me = round.players[seat];
  if (me.down) return null;
  return plan(me.hand, round.reqs, round.rules).groups;
}

// next [cardId, meldId] to lay off, or null. Naturals first, so wilds stay flexible until they're the last cards.
export function chooseLayOff(round, seat) {
  const me = round.players[seat], rules = round.rules;
  if (!me.down) return null;
  if (!rules.goOutWithoutDiscard && me.hand.length === 1) return null;      // that last card is the discard
  const fitting = me.hand.filter(c => round.fits(c).length);
  if (!fitting.length) return null;
  const c = fitting.find(x => !isWild(x, rules)) || fitting[0];
  return [c.id, round.fits(c)[0].id];
}

export function chooseDiscard(round, seat) {
  const me = round.players[seat], hand = me.hand, rules = round.rules;
  const worst = cards => cards.reduce((a, b) => {
    const ka = [connections(a, hand, rules), -rules.points(a)], kb = [connections(b, hand, rules), -rules.points(b)];
    return kb[0] < ka[0] || (kb[0] === ka[0] && kb[1] < ka[1]) ? b : a;
  });
  if (me.down) {
    const stuck = hand.filter(c => !round.fits(c).length);
    const pool = stuck.length ? stuck : hand;
    return pool.reduce((a, b) => (rules.points(b) > rules.points(a) ? b : a)).id;
  }
  const p = plan(hand, round.reqs, rules);
  const spare = hand.filter(c => !p.uses.has(c.id) && !isWild(c, rules));
  if (spare.length) return worst(spare).id;
  // every natural is pulling weight: drop the one whose loss hurts the plan least
  let best = null;
  for (const c of hand) {
    if (isWild(c, rules)) continue;
    const m = plan(hand.filter(x => x !== c), round.reqs, rules).missing;
    if (!best || m < best.m || (m === best.m && rules.points(c) > rules.points(best.c))) best = { c, m };
  }
  return (best ? best.c : hand[0]).id;
}

// One whole robot turn, step by step, so the page can animate it: yields after each action.
export function* robotTurn(round, seat) {
  const from = chooseDraw(round, seat);
  const card = round.draw(seat, from);
  yield { act: 'draw', from, card };
  if (round.phase === 'over') return;
  const groups = chooseLayDown(round, seat);
  if (groups) { round.layDown(seat, groups); yield { act: 'down' }; if (round.phase === 'over') return; }
  for (let lo; (lo = chooseLayOff(round, seat)); ) {
    const c = round.hand(seat).find(x => x.id === lo[0]);
    round.layOff(seat, lo[0], lo[1]); yield { act: 'layoff', card: c };
    if (round.phase === 'over') return;
  }
  const id = chooseDiscard(round, seat);
  const c = round.hand(seat).find(x => x.id === id);
  round.discard(seat, id); yield { act: 'discard', card: c };
}
