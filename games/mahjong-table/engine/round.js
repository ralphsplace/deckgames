// One hand of mahjong. Ruleset-agnostic: all variant behaviour comes from `rules`.
import { buildWall, isBonus, isSuited, sortTiles, rankOf, suitOf } from './tiles.js';

const cnt = (a, t) => a.reduce((n, x) => n + (x === t), 0);
function removeN(a, t, n) { for (let i = 0; i < n; i++) a.splice(a.indexOf(t), 1); }

export class Round {
  constructor(rules, { rand = Math.random, dealer = 0, round = 0 } = {}) {
    this.rules = rules; this.dealer = dealer; this.round = round;
    this.wall = buildWall(rules.bonusTiles, rand);
    this.players = [0, 1, 2, 3].map(() => ({ hand: [], melds: [], bonus: [], discards: [] }));
    this.turn = dealer; this.phase = 'draw'; this.last = null; this.drawn = null;
    this.replacement = false; this.result = null;
    for (let r = 0; r < 13; r++) for (let k = 0; k < 4; k++) this.players[(dealer + k) % 4].hand.push(this.wall.shift());
    for (let k = 0; k < 4; k++) this._settleBonus((dealer + k) % 4);
    this.log = [];
  }
  wind(seat) { return (seat - this.dealer + 4) % 4; }
  get liveLeft() { return this.wall.length - this.rules.reserve; }

  _settleBonus(seat) {
    const p = this.players[seat];
    for (;;) {
      const b = p.hand.find(isBonus);
      if (!b) return;
      removeN(p.hand, b, 1); p.bonus.push(b);
      if (!this.wall.length) return;
      p.hand.push(this.wall.pop());
    }
  }
  _ctx(seat, concealed, extra) {
    const p = this.players[seat];
    return { concealed, melds: p.melds, bonus: p.bonus, wind: this.wind(seat), round: this.round,
      lastTile: this.liveLeft <= 0, replacement: this.replacement, ...extra };
  }
  _eval(seat, concealed, extra) {
    const r = this.rules.evaluate(this._ctx(seat, concealed, extra));
    return r && r.faan >= this.rules.minScore ? r : null;
  }

  // Current player draws. Returns the drawn tile, or null if the hand ended in an exhaustive draw.
  draw() {
    if (this.phase !== 'draw') throw new Error('not draw phase');
    if (this.liveLeft <= 0) return this._exhaust();
    const p = this.players[this.turn];
    this.replacement = false;
    let t = this.wall.shift();
    while (isBonus(t)) {
      p.bonus.push(t);
      if (!this.wall.length) return this._exhaust();
      t = this.wall.pop(); this.replacement = true;
    }
    p.hand.push(t); this.drawn = t; this.phase = 'discard';
    return t;
  }
  _exhaust() { this.phase = 'over'; this.result = { type: 'draw', delta: [0, 0, 0, 0] }; return null; }

  selfOptions() {
    const seat = this.turn, p = this.players[seat];
    const win = this._eval(seat, p.hand, { selfDraw: true });
    const concealedKongs = [...new Set(p.hand)].filter(t => cnt(p.hand, t) === 4);
    const addKongs = [...new Set(p.hand)].filter(t => p.melds.some(m => m.type === 'pung' && m.tiles[0] === t));
    const canKong = this.wall.length > 0 && this.liveLeft > 0;
    return { win, concealedKongs: canKong ? concealedKongs : [], addKongs: canKong ? addKongs : [] };
  }
  selfWin() {
    const seat = this.turn, r = this._eval(seat, this.players[seat].hand, { selfDraw: true });
    if (!r) throw new Error('not a winning hand');
    return this._win(seat, null, r);
  }
  kong(tile) {
    const seat = this.turn, p = this.players[seat];
    const meld = p.melds.find(m => m.type === 'pung' && m.tiles[0] === tile);
    if (meld && cnt(p.hand, tile) >= 1) { removeN(p.hand, tile, 1); meld.type = 'kong'; meld.tiles.push(tile); }
    else if (cnt(p.hand, tile) === 4) { removeN(p.hand, tile, 4); p.melds.push({ type: 'kong', tiles: [tile, tile, tile, tile], open: false }); }
    else throw new Error('cannot kong');
    return this._replacement();
  }
  _replacement() {
    const p = this.players[this.turn];
    this.replacement = true;
    for (;;) {
      if (!this.wall.length || this.liveLeft <= 0) return this._exhaust();
      const t = this.wall.pop();
      if (isBonus(t)) { p.bonus.push(t); continue; }
      p.hand.push(t); this.drawn = t; this.phase = 'discard';
      return t;
    }
  }

  discard(tile) {
    if (this.phase !== 'discard') throw new Error('not discard phase');
    const seat = this.turn, p = this.players[seat];
    if (!p.hand.includes(tile)) throw new Error('tile not in hand');
    removeN(p.hand, tile, 1); p.discards.push(tile);
    this.last = { tile, from: seat }; this.phase = 'claim'; this.drawn = null; this.replacement = false;
    return this.claimOptions();
  }
  // Options for every other seat that has any: { seat: {win, pung, kong, chows} }
  claimOptions() {
    const { tile, from } = this.last, out = {};
    for (let k = 1; k < 4; k++) {
      const seat = (from + k) % 4, p = this.players[seat];
      const win = this._eval(seat, [...p.hand, tile], { selfDraw: false });
      const n = cnt(p.hand, tile);
      const chows = [];
      if (k === 1 && isSuited(tile)) {
        const r = rankOf(tile), s = suitOf(tile), has = x => x >= 1 && x <= 9 && p.hand.includes(s + x);
        for (const [a, b] of [[r - 2, r - 1], [r - 1, r + 1], [r + 1, r + 2]]) if (has(a) && has(b)) chows.push([s + a, s + b]);
      }
      const kongOk = n >= 3 && this.liveLeft > 0;
      if (win || n >= 2 || chows.length) out[seat] = { win: !!win, pung: n >= 2, kong: kongOk, chows };
    }
    return out;
  }
  // decisions: { seat: {action:'win'|'pung'|'kong'|'chow'|'pass', use?:[tile,tile]} }
  resolve(decisions = {}) {
    const { tile, from } = this.last;
    const order = [1, 2, 3].map(k => (from + k) % 4);
    const pick = a => order.find(s => decisions[s] && decisions[s].action === a);
    const w = pick('win');
    if (w != null) {
      const p = this.players[w];
      const r = this._eval(w, [...p.hand, tile], { selfDraw: false });
      if (!r) throw new Error('not a winning hand');
      this.players[from].discards.pop(); p.hand.push(tile);
      return this._win(w, from, r);
    }
    const take = (seat, type, use) => {
      const p = this.players[seat];
      this.players[from].discards.pop();
      for (const u of use) removeN(p.hand, u, 1);
      p.melds.push({ type, tiles: sortTiles([...use, tile]), open: true, from });
      this.turn = seat; this.last = null;
    };
    const k = pick('kong'), pg = pick('pung'), c = pick('chow');
    if (k != null) { take(k, 'kong', [tile, tile, tile]); return { type: 'kong', seat: k, tile, next: this._replacement() }; }
    if (pg != null) { take(pg, 'pung', [tile, tile]); this.phase = 'discard'; return { type: 'pung', seat: pg, tile }; }
    if (c != null) { take(c, 'chow', decisions[c].use); this.phase = 'discard'; return { type: 'chow', seat: c, tile }; }
    this.turn = (from + 1) % 4; this.phase = 'draw'; this.last = null;
    return { type: 'none' };
  }

  _win(winner, discarder, r) {
    const points = this.rules.points(r.faan);
    const delta = this.rules.payments(winner, discarder, points);
    this.phase = 'over';
    this.result = { type: 'win', winner, discarder, selfDraw: discarder == null, faan: r.faan, items: r.items, points, delta };
    return this.result;
  }
}
