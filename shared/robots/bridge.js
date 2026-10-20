// Bridge adapter: engine state <-> MCP tool JSON. Cards are "SA", "HT", "C2" (suit + rank, T = ten).
// Calls are "P", "X", "XX", "1C".."7N".
import { SEATS, side, partner, rankLabel } from '../../games/bridge/engine/cards.js';
import { PASS, X, XX, bid, isLegal, turn, contractOf } from '../../games/bridge/engine/auction.js';
import { controller, legalPlays, trumpOf } from '../../games/bridge/engine/play.js';
import { chooseCall } from '../../games/bridge/ai/bidder.js';
import { choosePlay } from '../../games/bridge/ai/player.js';

export const encodeCard = c => c.s + (c.r === 10 ? 'T' : rankLabel(c.r));
export function decodeCard(s) {
  if (typeof s !== 'string' || s.length !== 2) throw new Error('bad card ' + s);
  const r = 'A23456789TJQK'.indexOf(s[1]);
  if (!'SHDC'.includes(s[0]) || r < 0) throw new Error('bad card ' + s);
  return { s: s[0], r: s[1] === 'A' ? 14 : s[1] === 'T' ? 10 : s[1] === 'J' ? 11 : s[1] === 'Q' ? 12 : s[1] === 'K' ? 13 : +s[1] };
}
export function encodeCall(c) { return c.type === 'pass' ? 'P' : c.type === 'x' ? 'X' : c.type === 'xx' ? 'XX' : `${c.level}${c.strain}`; }
export function decodeCall(s) {
  if (s === 'P') return PASS; if (s === 'X') return X; if (s === 'XX') return XX;
  const m = /^([1-7])([CDHSN])$/.exec(s || '');
  if (!m) throw new Error('bad call ' + s);
  return bid(+m[1], m[2]);
}

export function callView(hand, auction, seat, table = {}) {
  return {
    seat, hand: hand.map(encodeCard), dealer: auction.dealer,
    auction: auction.calls.map(e => ({ seat: e.seat, call: encodeCall(e.call), alert: e.call.meaning?.text || null })),
    vulnerability: table.vul || null, board: table.board ?? null, system: '2/1 game force, 5-card majors, 15-17 NT',
  };
}

export function playView(st, table = {}) {
  const actor = controller(st), seat = st.turn;                  // actor chooses a card from seat's hand
  const visible = { [actor]: st.hands[actor].map(encodeCard) };
  if (st.dummyVisible || actor === st.contract.declarer) visible[st.dummy] = st.hands[st.dummy].map(encodeCard);
  visible[seat] = st.hands[seat].map(encodeCard);
  return {
    actor, seat, hand: st.hands[seat].map(encodeCard), visible,
    legal: legalPlays(st).map(encodeCard),
    contract: { ...st.contract }, trump: trumpOf(st), dummy: st.dummy,
    trick: st.trick.map(t => ({ seat: t.seat, card: encodeCard(t.card) })),
    history: st.history.map(h => ({ winner: h.winner, trick: h.trick.map(t => ({ seat: t.seat, card: encodeCard(t.card) })) })),
    tricks: { ...st.tricks }, vulnerability: table.vul || null,
  };
}

export function bridgeRobots(robots) {
  return {
    // (hand, auction, seat, table?) => call object (may carry .meaning.text for the alert line)
    call(hand, auction, seat, table) {
      return robots.decide('bridge_choose_call', callView(hand, auction, seat, table), raw => {
        const call = decodeCall(raw.call);
        if (!isLegal(auction, call)) throw new Error(`illegal call ${raw.call} from MCP server`);
        if (raw.alert) call.meaning = { text: String(raw.alert) };
        return call;
      }, () => chooseCall(hand, auction, seat));
    },
    // (playState, table?) => card (one of legalPlays)
    play(st, table) {
      const legal = legalPlays(st);
      return robots.decide('bridge_choose_play', playView(st, table), raw => {
        const card = decodeCard(raw.card);
        const hit = legal.find(c => c.s === card.s && c.r === card.r);
        if (!hit) throw new Error(`illegal card ${raw.card} from MCP server`);
        return hit;
      }, () => choosePlay(st));
    },
  };
}
export { turn, contractOf, side, partner, SEATS };
