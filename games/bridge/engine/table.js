// Orchestrates one board at a time. Robots are injected, so swapping in a better
// bidder / play AI / contract provider never touches the rules or the UI.
//   mode 'declare': contractProvider(hands, human) sets the contract; you declare (Just Declare style)
//   mode 'full'   : the auction is run seat by seat; the human bids via humanCall()
import { deal, dealer, isVul, side } from './cards.js';
import { newAuction, addCall, turn, isComplete, contractOf } from './auction.js';
import { startPlay, playCard, controller, declarerTricks, legalPlays } from './play.js';
import { score } from './scoring.js';
import { same } from './cards.js';

export class Table {
  constructor(opts) {
    Object.assign(this, { mode: 'declare', human: 'S', rand: Math.random }, opts);
    this.board = 0;
    if (!this.defer) this.nextBoard();          // defer: true => the caller awaits nextBoardAsync() (async robots)
  }
  nextBoard() {
    this.board++;
    this.vul = { NS: isVul(this.board, 'NS'), EW: isVul(this.board, 'EW') };
    this.result = null; this.play = null; this.auction = null; this.dealer = dealer(this.board);
    if (this.mode === 'declare') {
      // the provider bids the deal and may rotate it so the human declares; null = passed out, so redeal
      for (let tries = 0; ; tries++) {
        this.hands = deal(this.rand);
        const r = this.contractProvider(this.hands, this.human, this.dealer);
        if (r) { this.hands = r.hands; this.declareAuction = r.auction; this.beginPlay(r.contract); break; }
        if (tries > 50) throw new Error('no playable deal found');
      }
    } else {
      this.hands = deal(this.rand);
      this.auction = newAuction(this.dealer); this.phase = 'auction';
    }
  }
  // Same as nextBoard() but the contract provider / bidder / player may be async (e.g. an MCP robot server).
  async nextBoardAsync() {
    this.board++;
    this.vul = { NS: isVul(this.board, 'NS'), EW: isVul(this.board, 'EW') };
    this.result = null; this.play = null; this.auction = null; this.dealer = dealer(this.board);
    this.hands = null;
    if (this.mode === 'declare') {
      for (let tries = 0; ; tries++) {
        const hands = deal(this.rand);
        // a robot source that keeps passing every hand out must not stall the game: switch to the built-in provider
        const useFallback = tries >= 8 && this.fallbackProvider;
        const r = useFallback ? this.fallbackProvider(hands, this.human, this.dealer)
          : await this.contractProvider(hands, this.human, this.dealer, this.bidder);
        if (r) { this.hands = r.hands; this.declareAuction = r.auction; this.beginPlay(r.contract); break; }
        if (tries > 50) throw new Error('no playable deal found');
      }
    } else {
      this.hands = deal(this.rand);
      this.auction = newAuction(this.dealer); this.phase = 'auction';
    }
  }
  async robotStepAsync() {
    if (this.phase === 'auction') {
      const seat = turn(this.auction);
      return this.doCall(await this.bidder(this.hands[seat], this.auction, seat, { vul: this.vul, board: this.board }));
    }
    return this.doPlay(await this.player(this.play, { vul: this.vul, board: this.board }));
  }
  beginPlay(contract) { this.play = startPlay(contract, this.hands); this.phase = 'play'; }
  actor() { return this.phase === 'auction' ? turn(this.auction) : controller(this.play); }
  isHumanTurn() { return this.phase !== 'done' && this.actor() === this.human; }

  humanCall(call) {
    if (this.phase !== 'auction' || turn(this.auction) !== this.human) throw new Error('not your call');
    return this.doCall(call);
  }
  humanPlay(card) {
    if (this.phase !== 'play' || controller(this.play) !== this.human) throw new Error('not your play');
    return this.doPlay(this.play.hands[this.play.turn].find(c => same(c, card)));
  }
  robotStep() {                                   // act for whoever is on turn (used by the UI loop and tests)
    if (this.phase === 'auction') {
      const seat = turn(this.auction);
      return this.doCall(this.bidder(this.hands[seat], this.auction, seat));
    }
    return this.doPlay(this.player(this.play));
  }
  doCall(call) {
    const seat = turn(this.auction);
    addCall(this.auction, call);
    if (isComplete(this.auction)) {
      const c = contractOf(this.auction);
      if (c) this.beginPlay(c); else { this.result = { passedOut: true, ns: 0 }; this.phase = 'done'; }
    }
    return { type: 'call', seat, call };
  }
  doPlay(card) {
    const seat = this.play.turn;
    const completed = playCard(this.play, card);
    if (this.play.done) this.finish();
    return { type: 'play', seat, card, completed };
  }
  finish() {
    const c = this.play.contract, tricks = declarerTricks(this.play);
    const pts = score(c, tricks, this.vul[side(c.declarer)]);
    this.result = { contract: c, tricks, score: pts, ns: side(c.declarer) === 'NS' ? pts : -pts };
    this.phase = 'done';
  }
}
export { legalPlays };
