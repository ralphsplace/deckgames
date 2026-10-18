// Contract provider for 'declare' mode (Just Declare style): the four robots bid the deal with the
// real bidding engine, then the deal is rotated so the declaring seat's hand lands in the human's chair.
// Returns { contract, hands, auction } or null when the hand is passed out (the table redeals).
import { SEATS } from '../engine/cards.js';
import { newAuction, addCall, turn, isComplete, contractOf } from '../engine/auction.js';
import { chooseCall } from './bidder.js';

export function pickContract(hands, human = 'S', dealerSeat = 'N', bidder = chooseCall) {
  const a = newAuction(dealerSeat);
  for (let g = 0; !isComplete(a); g++) {
    if (g > 80) return null;
    const s = turn(a);
    addCall(a, bidder(hands[s], a, s));
  }
  const c = contractOf(a);
  if (!c) return null;
  const shift = (SEATS.indexOf(human) - SEATS.indexOf(c.declarer) + 4) % 4;
  const rotated = {};
  SEATS.forEach((seat, i) => { rotated[SEATS[(i + shift) % 4]] = hands[seat]; });
  return { contract: { ...c, declarer: human }, hands: rotated, auction: a };
}
