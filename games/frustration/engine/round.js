// One round (one contract). Turn: draw (stock or top discard) -> optionally lay down the contract, lay off onto
// melds -> discard. Going out (empty hand) ends the round; everyone else scores the cards left in hand.
// Pure state + rules; robots and the page drive it. Illegal actions throw a RuleError with a readable message.
import { makeDeck, shuffle, handPoints, isWild } from './cards.js';
import { parseContract, meetsContract } from './contracts.js';
import { makeMeld, extendMeld } from './melds.js';

export class RuleError extends Error {}
const fail = msg => { throw new RuleError(msg); };

export class Round {
  constructor(rules, { contract, players = 4, dealer = 0, rand = Math.random } = {}) {
    this.rules = rules; this.rand = rand; this.n = players; this.dealer = dealer;
    this.contractText = contract; this.reqs = parseContract(contract);
    this.stock = shuffle(makeDeck(rules), rand);
    this.players = Array.from({ length: players }, () => ({ hand: [], down: false }));
    for (let i = 0; i < rules.handSize; i++) for (let k = 1; k <= players; k++) this.players[(dealer + k) % players].hand.push(this.stock.pop());
    this.discards = [this.stock.pop()];
    this.melds = []; this.nextMeldId = 1;
    this.turn = (dealer + 1) % players; this.phase = 'draw';
    this.reshuffles = 0; this.turns = 0; this.result = null;
    this.log = [];
  }
  get top() { return this.discards[this.discards.length - 1] || null; }
  hand(seat) { return this.players[seat].hand; }

  _mine(seat, ids) {
    const h = this.hand(seat), out = [];
    for (const id of ids) { const c = h.find(x => x.id === id); if (!c) fail('That card is not in your hand.'); if (out.includes(c)) fail('A card was picked twice.'); out.push(c); }
    return out;
  }
  _take(seat, cards) { const h = this.hand(seat); for (const c of cards) h.splice(h.indexOf(c), 1); }
  _need(seat, phase) {
    if (this.phase === 'over') fail('The round is over.');
    if (seat !== this.turn) fail('It is not your turn.');
    if (this.phase !== phase) fail(phase === 'draw' ? 'You have already drawn this turn.' : 'Draw a card first.');
  }

  draw(seat, from = 'stock') {
    this._need(seat, 'draw');
    let c;
    if (from === 'discard') { if (!this.top) fail('The discard pile is empty.'); c = this.discards.pop(); }
    else {
      if (!this.stock.length) this._restock();
      if (this.phase === 'over') return null;
      c = this.stock.pop();
    }
    this.hand(seat).push(c); this.phase = 'play';
    this.log.push({ seat, act: 'draw', from, card: from === 'discard' ? c : null });
    return c;
  }
  _restock() {
    if (this.discards.length < 2 || this.reshuffles >= this.rules.maxReshuffles) return this._end(null);
    const keep = this.discards.pop();
    this.stock = shuffle(this.discards, this.rand); this.discards = [keep]; this.reshuffles++;
  }

  // groups: [{type:'book'|'run', ids:[...]}], together meeting this round's contract
  layDown(seat, groups) {
    this._need(seat, 'play');
    const p = this.players[seat];
    if (p.down) fail('Your contract is already down.');
    const all = groups.flatMap(g => g.ids);
    const cards = this._mine(seat, all);
    const melds = groups.map(g => {
      const m = makeMeld(g.type, this._mine(seat, g.ids), this.rules);
      if (!m) fail(`Those cards don't make a ${g.type}: ${g.type === 'book' ? 'a book is 3+ cards of one rank' : 'a run is 3+ cards in a row, all one suit'}, with at least ${this.rules.minNaturals} natural card.`);
      return m;
    });
    if (!meetsContract(melds.map(m => ({ type: m.type, size: m.cells.length })), this.reqs)) fail(`That isn't the contract for this round (${this.contractText}).`);
    this._take(seat, cards);
    for (const m of melds) this.melds.push({ ...m, id: this.nextMeldId++, owner: seat });
    p.down = true;
    this.log.push({ seat, act: 'down', melds: melds.length });
    this._checkOut(seat);
  }

  layOff(seat, cardId, meldId, end) {
    this._need(seat, 'play');
    if (this.rules.layOffAfterDown && !this.players[seat].down) fail('Lay down your own contract before adding to the table.');
    const [c] = this._mine(seat, [cardId]);
    const i = this.melds.findIndex(m => m.id === meldId);
    if (i < 0) fail('No such meld.');
    const m = extendMeld(this.melds[i], c, this.rules, end);
    if (!m) fail(`That card doesn't fit there.`);
    this.melds[i] = m; this._take(seat, [c]);
    this.log.push({ seat, act: 'layoff', card: c });
    this._checkOut(seat);
  }
  // melds a card could go on (for hints / robots)
  fits(card) { return this.melds.filter(m => extendMeld(m, card, this.rules)); }

  discard(seat, cardId) {
    this._need(seat, 'play');
    const [c] = this._mine(seat, [cardId]);
    this._take(seat, [c]); this.discards.push(c);
    this.log.push({ seat, act: 'discard', card: c });
    if (this._checkOut(seat)) return;
    this.turn = (this.turn + 1) % this.n; this.phase = 'draw'; this.turns++;
  }
  _checkOut(seat) {
    if (this.hand(seat).length) return false;
    if (!this.rules.goOutWithoutDiscard && this.log[this.log.length - 1].act !== 'discard') return false;
    this._end(seat); return true;
  }
  _end(outBy) {
    this.phase = 'over';
    this.result = { outBy, points: this.players.map((p, s) => (s === outBy ? 0 : handPoints(p.hand, this.rules))) };
  }
}

export { isWild };
