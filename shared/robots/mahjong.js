// Mahjong adapter: Round state <-> MCP tool JSON. Tiles are strings: c1-c9 characters, d1-d9 dots, b1-b9 bamboo,
// E S W N winds, R G P dragons (red, green, white), F1-F4 flowers, T1-T4 seasons.
// Written to work with or without the Riichi extras (rivers, riichi flags, dora) so it survives merges.
import { chooseDiscard, chooseSelf, chooseClaim } from '../../games/mahjong-table/ai/robot.js';

const meldView = m => ({ type: m.type, tiles: m.tiles.slice(), open: !!m.open });

// What a player at `seat` is allowed to know.
export function mahjongView(round, seat, meta = {}) {
  const me = round.players[seat];
  return {
    variant: round.rules.id, seat, dealer: round.dealer, roundWind: round.round, seatWind: round.wind(seat),
    hand: me.hand.slice(), drawn: round.drawn ?? null, melds: me.melds.map(meldView), bonus: me.bonus.slice(),
    players: round.players.map((p, i) => ({
      seat: i, seatWind: round.wind(i), handCount: p.hand.length, melds: p.melds.map(meldView), bonus: p.bonus.slice(),
      discards: p.discards.slice(), river: (p.river || p.discards).slice(), riichi: !!p.riichi,
    })),
    lastDiscard: round.last ? { tile: round.last.tile, from: round.last.from } : null,
    wallLeft: round.liveLeft, doraIndicators: round.indicators ? round.indicators.slice() : [],
    honba: round.honba ?? 0, riichiSticks: (round.carryPot ?? 0) + (round.sticks ?? 0),
    scores: meta.scores ? meta.scores.slice() : null,
  };
}

const has = (a, t) => Array.isArray(a) && a.includes(t);

export function mahjongRobots(robots) {
  return {
    // => { tile, riichi }
    discard(round, seat, meta) {
      const p = round.players[seat];
      const fb = () => { const d = chooseDiscard(round, seat); return typeof d === 'string' ? { tile: d, riichi: false } : { tile: d.tile, riichi: !!d.riichi }; };
      const riichiTiles = round.riichiOptions ? round.riichiOptions(seat) : [];
      return robots.decide('mahjong_choose_discard', { ...mahjongView(round, seat, meta), riichiOptions: riichiTiles }, raw => {
        if (!has(p.hand, raw.tile)) throw new Error(`tile ${raw.tile} is not in the hand`);
        if (p.riichi && raw.tile !== round.drawn) throw new Error('hand is locked after riichi');
        if (raw.riichi && !has(riichiTiles, raw.tile)) throw new Error('riichi not allowed with that discard');
        return { tile: raw.tile, riichi: !!raw.riichi };
      }, fb);
    },
    // options as returned by round.claimOptions()[seat] => { action: 'win'|'pung'|'kong'|'chow'|'pass', use? }
    claim(round, seat, opt, meta) {
      return robots.decide('mahjong_choose_claim', { ...mahjongView(round, seat, meta), options: opt }, raw => {
        const a = raw.action;
        if (a === 'pass') return { action: 'pass' };
        if (a === 'win' && opt.win) return { action: 'win' };
        if (a === 'pung' && opt.pung) return { action: 'pung' };
        if (a === 'kong' && opt.kong) return { action: 'kong' };
        if (a === 'chow') {
          const use = raw.use;
          if (Array.isArray(use) && opt.chows.some(c => c[0] === use[0] && c[1] === use[1])) return { action: 'chow', use: use.slice() };
        }
        throw new Error(`claim ${JSON.stringify(raw)} is not allowed`);
      }, () => chooseClaim(round, seat, opt));
    },
    // before discarding: => null | { action: 'win' } | { action: 'kong', tile }
    self(round, seat, meta) {
      const o = round.selfOptions();
      const options = { win: !!o.win, concealedKongs: o.concealedKongs, addKongs: o.addKongs };
      return robots.decide('mahjong_choose_self', { ...mahjongView(round, seat, meta), options }, raw => {
        if (raw.action === 'none') return null;
        if (raw.action === 'win' && o.win) return { action: 'win' };
        if (raw.action === 'kong' && (has(o.concealedKongs, raw.tile) || has(o.addKongs, raw.tile))) return { action: 'kong', tile: raw.tile };
        throw new Error(`self action ${JSON.stringify(raw)} is not allowed`);
      }, () => chooseSelf(round, seat));
    },
  };
}
