// One hand of mahjong. Ruleset-agnostic: all variant behaviour comes from `rules`.
import { buildWall, isBonus, isSuited, sortTiles, rankOf, suitOf, TYPES, IDX, WINDS } from './tiles.js';
import { shanten } from './hand.js';

const cnt = (a, t) => a.reduce((n, x) => n + (x === t), 0);
function removeN(a, t, n) { for (let i = 0; i < n; i++) a.splice(a.indexOf(t), 1); }

// Dora: the tile that follows an indicator.
export function nextTile(t) {
  if (isSuited(t)) return t[0] + (t[1] === '9' ? 1 : +t[1] + 1);
  const w = WINDS.indexOf(t);
  if (w >= 0) return WINDS[(w + 1) % 4];
  return { P: 'G', G: 'R', R: 'P' }[t];
}

export class Round {
  // honba / carryPot: Riichi counters carried from earlier hands (ignored by rulesets that do not use them)
  constructor(rules, { rand = Math.random, dealer = 0, round = 0, honba = 0, carryPot = 0 } = {}) {
    this.rules = rules; this.dealer = dealer; this.round = round; this.honba = honba; this.carryPot = carryPot;
    const full = buildWall(rules.bonusTiles, rand);
    // 14-tile dead wall: 4 replacement tiles, 5 dora indicators, 5 ura-dora indicators
    this.dead = { repl: full.splice(-4), ind: full.splice(-5), ura: full.splice(-5) };
    this.wall = full;
    this.kans = 0; this.sticks = 0;
    this.players = [0, 1, 2, 3].map(() => ({ hand: [], melds: [], bonus: [], discards: [], river: [],
      riichi: false, pendingRiichi: false, ippatsu: false, furiten: false, tempFuriten: false }));
    this.turn = dealer; this.phase = 'draw'; this.last = null; this.drawn = null;
    this.replacement = false; this.result = null;
    for (let r = 0; r < 13; r++) for (let k = 0; k < 4; k++) this.players[(dealer + k) % 4].hand.push(this.wall.shift());
    for (let k = 0; k < 4; k++) this._settleBonus((dealer + k) % 4);
  }
  wind(seat) { return (seat - this.dealer + 4) % 4; }
  get liveLeft() { return this.wall.length; }
  get tilesInPlay() { return this.wall.length + this.dead.repl.length + this.dead.ind.length + this.dead.ura.length; }

  _replTile() {
    if (!this.wall.length) return null;
    const t = this.dead.repl.shift();
    this.dead.repl.push(this.wall.pop());
    return t;
  }
  _settleBonus(seat) {
    const p = this.players[seat];
    for (;;) {
      const b = p.hand.find(isBonus);
      if (!b) return;
      removeN(p.hand, b, 1); p.bonus.push(b);
      const t = this._replTile();
      if (t == null) return;
      p.hand.push(t);
    }
  }
  doraTiles(ura = false) {
    if (!this.rules.dora) return [];
    const n = 1 + this.kans;
    return (ura ? this.dead.ura : this.dead.ind).slice(0, n).map(nextTile);
  }
  get indicators() { return this.rules.dora ? this.dead.ind.slice(0, 1 + this.kans) : []; }

  _ctx(seat, concealed, extra) {
    const p = this.players[seat];
    return { concealed, melds: p.melds, bonus: p.bonus, wind: this.wind(seat), round: this.round, dealer: this.dealer === seat,
      lastTile: this.liveLeft <= 0, replacement: this.replacement,
      riichi: p.riichi, ippatsu: p.ippatsu, dora: this.doraTiles(false), ura: p.riichi ? this.doraTiles(true) : [], ...extra };
  }
  _eval(seat, concealed, extra) {
    const r = this.rules.evaluate(this._ctx(seat, concealed, extra));
    return r && r.faan >= this.rules.minScore ? r : null;
  }
  // Tiles that would complete this seat's 13-tile hand (shape only)
  waits(seat) {
    const p = this.players[seat], out = [];
    for (const t of TYPES) if (shanten([...p.hand, t], p.melds.length, !!this.rules.sevenPairs) === -1) out.push(t);
    return out;
  }
  isFuriten(seat) {
    const p = this.players[seat];
    if (!this.rules.furiten) return false;
    if (p.furiten || p.tempFuriten) return true;
    return this.waits(seat).some(t => p.river.includes(t));
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
      t = this._replTile();
      if (t == null) return this._exhaust();
      this.replacement = true;
    }
    p.hand.push(t); this.drawn = t; this.phase = 'discard';
    return t;
  }
  _deposits(delta) {
    if (!this.rules.riichiBet) return 0;
    let n = 0;
    this.players.forEach((p, i) => { if (p.riichi) { delta[i] -= 1000; n++; } });
    return n;
  }
  _exhaust() {
    this.phase = 'over';
    const r = this.rules.settleDraw ? this.rules.settleDraw(this) : { delta: [0, 0, 0, 0], dealerKeeps: true };
    const delta = r.delta.slice();
    const n = this._deposits(delta);
    this.result = { ...r, type: 'draw', delta, pot: this.carryPot + n };
    return null;
  }

  selfOptions() {
    const seat = this.turn, p = this.players[seat];
    const win = this._eval(seat, p.hand, { selfDraw: true, winTile: this.drawn });
    const canKong = this.liveLeft > 0 && !p.riichi;
    const concealedKongs = canKong ? [...new Set(p.hand)].filter(t => cnt(p.hand, t) === 4) : [];
    const addKongs = canKong ? [...new Set(p.hand)].filter(t => p.melds.some(m => m.type === 'pung' && m.tiles[0] === t)) : [];
    return { win, concealedKongs, addKongs, riichi: this.riichiOptions(seat) };
  }
  // Discards that declare riichi (closed hand, ready after the discard)
  riichiOptions(seat = this.turn) {
    const p = this.players[seat];
    if (!this.rules.riichiBet || this.phase !== 'discard' || this.turn !== seat || p.riichi || p.melds.some(m => m.open)) return [];
    if (this.liveLeft < 4) return [];
    const k = p.melds.length, out = [];
    for (const t of new Set(p.hand)) {
      const rest = p.hand.slice(); rest.splice(rest.indexOf(t), 1);
      if (shanten(rest, k, !!this.rules.sevenPairs) === 0) out.push(t);
    }
    return out;
  }
  selfWin() {
    const seat = this.turn, r = this._eval(seat, this.players[seat].hand, { selfDraw: true, winTile: this.drawn });
    if (!r) throw new Error('not a winning hand');
    return this._win(seat, null, r);
  }
  kong(tile) {
    const seat = this.turn, p = this.players[seat];
    const meld = p.melds.find(m => m.type === 'pung' && m.tiles[0] === tile);
    if (meld && cnt(p.hand, tile) >= 1) { removeN(p.hand, tile, 1); meld.type = 'kong'; meld.tiles.push(tile); }
    else if (cnt(p.hand, tile) === 4) { removeN(p.hand, tile, 4); p.melds.push({ type: 'kong', tiles: [tile, tile, tile, tile], open: false }); }
    else throw new Error('cannot kong');
    this.kans++;
    this.players.forEach(q => { q.ippatsu = false; });
    return this._replacement();
  }
  _replacement() {
    const p = this.players[this.turn];
    this.replacement = true;
    for (;;) {
      const t = this._replTile();
      if (t == null) return this._exhaust();
      if (isBonus(t)) { p.bonus.push(t); continue; }
      p.hand.push(t); this.drawn = t; this.phase = 'discard';
      return t;
    }
  }

  // opts.riichi: declare riichi with this discard
  discard(tile, opts = {}) {
    if (this.phase !== 'discard') throw new Error('not discard phase');
    const seat = this.turn, p = this.players[seat];
    if (!p.hand.includes(tile)) throw new Error('tile not in hand');
    if (p.riichi && tile !== this.drawn) throw new Error('hand is locked after riichi');
    if (opts.riichi) {
      if (!this.riichiOptions(seat).includes(tile)) throw new Error('cannot declare riichi with that discard');
      p.pendingRiichi = true;
    }
    removeN(p.hand, tile, 1); p.discards.push(tile); p.river.push(tile);
    p.ippatsu = false; p.tempFuriten = false;
    this.last = { tile, from: seat }; this.phase = 'claim'; this.drawn = null; this.replacement = false;
    return this.claimOptions();
  }
  // Options for every other seat that has any: { seat: {win, pung, kong, chows} }
  claimOptions() {
    const { tile, from } = this.last, out = {};
    for (let k = 1; k < 4; k++) {
      const seat = (from + k) % 4, p = this.players[seat];
      const win = !this.isFuriten(seat) && this._eval(seat, [...p.hand, tile], { selfDraw: false, winTile: tile });
      const locked = p.riichi;
      const n = cnt(p.hand, tile);
      const chows = [];
      if (!locked && k === 1 && isSuited(tile)) {
        const r = rankOf(tile), s = suitOf(tile), has = x => x >= 1 && x <= 9 && p.hand.includes(s + x);
        for (const [a, b] of [[r - 2, r - 1], [r - 1, r + 1], [r + 1, r + 2]]) if (has(a) && has(b)) chows.push([s + a, s + b]);
      }
      const pung = !locked && n >= 2;
      const kongOk = !locked && n >= 3 && this.liveLeft > 0;
      if (win || pung || chows.length) out[seat] = { win: !!win, pung, kong: kongOk, chows };
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
      const r = this._eval(w, [...p.hand, tile], { selfDraw: false, winTile: tile });
      if (!r || this.isFuriten(w)) throw new Error('not a winning hand');
      this.players[from].discards.pop(); p.hand.push(tile);
      this.players[from].pendingRiichi = false;     // riichi is void if the declaring tile is ronned
      return this._win(w, from, r);
    }
    // anyone who could have won and did not is furiten
    const missed = this.claimOptions();
    for (const [s, o] of Object.entries(missed)) {
      if (o.win && this.rules.furiten) { const q = this.players[s]; if (q.riichi) q.furiten = true; else q.tempFuriten = true; }
    }
    const dp = this.players[from];
    if (dp.pendingRiichi) { dp.pendingRiichi = false; dp.riichi = true; dp.ippatsu = true; this.sticks++; }
    const take = (seat, type, use) => {
      const p = this.players[seat];
      this.players[from].discards.pop();
      for (const u of use) removeN(p.hand, u, 1);
      p.melds.push({ type, tiles: sortTiles([...use, tile]), open: true, from });
      this.turn = seat; this.last = null;
      this.players.forEach(q => { q.ippatsu = false; });
    };
    const k = pick('kong'), pg = pick('pung'), c = pick('chow');
    if (k != null) { take(k, 'kong', [tile, tile, tile]); this.kans++; return { type: 'kong', seat: k, tile, next: this._replacement() }; }
    if (pg != null) { take(pg, 'pung', [tile, tile]); this.phase = 'discard'; return { type: 'pung', seat: pg, tile }; }
    if (c != null) { take(c, 'chow', decisions[c].use); this.phase = 'discard'; return { type: 'chow', seat: c, tile }; }
    this.turn = (from + 1) % 4; this.phase = 'draw'; this.last = null;
    return { type: 'none' };
  }

  _win(winner, discarder, r) {
    const s = this.rules.settle ? this.rules.settle(this, winner, discarder, r)
      : { points: this.rules.points(r.faan), delta: this.rules.payments(winner, discarder, this.rules.points(r.faan)) };
    const delta = s.delta.slice();
    const n = this._deposits(delta);
    if (this.rules.riichiBet) delta[winner] += (this.carryPot + n) * 1000;
    this.phase = 'over';
    this.result = { type: 'win', winner, discarder, selfDraw: discarder == null, faan: r.faan, fu: r.fu, items: r.items,
      points: s.points, delta, dealerKeeps: winner === this.dealer, pot: 0, yakuman: r.yakuman || 0 };
    return this.result;
  }
}
