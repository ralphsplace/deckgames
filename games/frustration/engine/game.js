// A game of Frustration: the 13 contracts in order, the deal moving one seat left each round, a running score
// sheet. Lowest total after the last contract wins.
import { Round } from './round.js';

export class Game {
  constructor(rules, { players = 4, rand = Math.random, firstDealer } = {}) {
    this.rules = rules; this.n = players; this.rand = rand;
    this.firstDealer = firstDealer ?? players - 1;         // so seat 0 (you) leads the first round
    this.index = -1; this.sheet = Array.from({ length: players }, () => []); this.current = null;
  }
  get contracts() { return this.rules.contracts; }
  get over() { return this.index >= this.contracts.length - 1 && (!this.current || this.current.phase === 'over') && this.sheet[0].length === this.contracts.length; }
  next() {
    if (this.index + 1 >= this.contracts.length) return null;
    this.index++;
    this.current = new Round(this.rules, { contract: this.contracts[this.index], players: this.n,
      dealer: (this.firstDealer + this.index) % this.n, rand: this.rand });
    return this.current;
  }
  finish() {
    const r = this.current.result;
    if (!r) throw new Error('round not finished');
    r.points.forEach((p, s) => this.sheet[s].push(p));
    return this.over;
  }
  total(seat, upTo = Infinity) { return this.sheet[seat].slice(0, upTo).reduce((a, b) => a + b, 0); }
  totals() { return this.sheet.map((_, s) => this.total(s)); }
  leaders() { const t = this.totals(), lo = Math.min(...t); return t.map((v, s) => (v === lo ? s : -1)).filter(s => s >= 0); }
}
