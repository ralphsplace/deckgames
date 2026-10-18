// A match = a sequence of hands with dealer rotation and running scores.
import { Round } from './round.js';

export class Match {
  // length: number of round winds to play (1 = East round only)
  constructor(rules, { rand = Math.random, length = 1 } = {}) {
    this.rules = rules; this.rand = rand; this.length = length;
    this.scores = [0, 0, 0, 0]; this.dealer = 0; this.round = 0; this.hand = 0; this.dealerRotations = 0;
    this.over = false; this.round_ = null;
  }
  next() {
    if (this.over) return null;
    this.hand++;
    this.current = new Round(this.rules, { rand: this.rand, dealer: this.dealer, round: this.round });
    return this.current;
  }
  // call when the current hand has finished
  finish() {
    const r = this.current.result;
    r.delta.forEach((d, i) => { this.scores[i] += d; });
    const dealerKeeps = r.type === 'draw' || r.winner === this.dealer;
    if (!dealerKeeps) {
      this.dealer = (this.dealer + 1) % 4; this.dealerRotations++;
      if (this.dealerRotations % 4 === 0) { this.round++; if (this.round >= this.length) this.over = true; }
    }
    return this.over;
  }
}
