import test from 'node:test';
import assert from 'node:assert/strict';
import { createStubServer } from '../../tools/mcp-stub/server.mjs';
import { McpClient } from './mcp.js';
import { Robots } from './core.js';
import { bridgeRobots, encodeCard, decodeCard, encodeCall, decodeCall } from './bridge.js';
import { mahjongRobots, mahjongView } from './mahjong.js';
import { Table } from '../../games/bridge/engine/table.js';
import { pickContract, pickContractAsync } from '../../games/bridge/ai/contract.js';
import { Round } from '../../games/mahjong-table/engine/round.js';
import { hk } from '../../games/mahjong-table/engine/rules/hk.js';
import { rng } from '../rng.js';

const servers = [];
test.after(() => { for (const s of servers) { s.srv.closeAllConnections?.(); s.srv.close(); } });
const listen = async opts => {
  const srv = createStubServer(opts);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const handle = { srv, url: `http://127.0.0.1:${srv.address().port}/`, close: () => new Promise(r => { srv.closeAllConnections?.(); srv.close(r); }) };
  servers.push(handle); return handle;
};

async function playBridge(robots, mode, seed) {
  const br = bridgeRobots(robots);
  const t = new Table({ mode, human: 'S', defer: true, rand: rng(seed), contractProvider: pickContractAsync, fallbackProvider: pickContract,
    bidder: (h, a, s) => br.call(h, a, s, { vul: t.vul, board: t.board }), player: st => br.play(st, { vul: t.vul }) });
  await t.nextBoardAsync();
  for (let g = 0; t.phase !== 'done'; g++) { assert.ok(g < 200, 'board did not finish'); await t.robotStepAsync(); }
  return t;
}
async function playMahjong(robots, seed) {
  const mj = mahjongRobots(robots), r = new Round(hk, { rand: rng(seed) });
  for (let g = 0; g < 500 && r.phase !== 'over'; g++) {
    if (r.phase === 'draw' && r.draw() === null) break;
    const seat = r.turn;
    const s = await mj.self(r, seat);
    if (s && s.action === 'win') { r.selfWin(); break; }
    if (s && s.action === 'kong') { if (r.kong(s.tile) === null) break; }
    const d = await mj.discard(r, seat);
    const opts = r.discard(d.tile), dec = {};
    for (const [st, o] of Object.entries(opts)) dec[st] = await mj.claim(r, +st, o);
    const res = r.resolve(dec);
    if (res.type === 'win' || (res.type === 'kong' && res.next === null)) break;
  }
  return r;
}

test('encoding helpers round-trip', () => {
  for (const c of [{ s: 'S', r: 14 }, { s: 'H', r: 10 }, { s: 'C', r: 2 }, { s: 'D', r: 13 }]) assert.deepEqual(decodeCard(encodeCard(c)), c);
  for (const s of ['P', 'X', 'XX', '1C', '7N', '3H']) assert.equal(encodeCall(decodeCall(s)), s);
  assert.throws(() => decodeCard('ZZ')); assert.throws(() => decodeCall('8C'));
});

test('stub server speaks MCP: initialize, tools/list, tools/call', async () => {
  const s = await listen();
  const c = new McpClient(s.url);
  const names = (await c.listTools()).map(t => t.name).sort();
  assert.deepEqual(names, ['bridge_choose_call', 'bridge_choose_play', 'mahjong_choose_claim', 'mahjong_choose_discard', 'mahjong_choose_self']);
  assert.deepEqual(await c.callTool('bridge_choose_call', { hand: [], auction: [] }), { call: 'P' });
  await assert.rejects(() => c.callTool('nope', {}));
  await s.close();
});

test('no server configured: built-in robots, no network', async () => {
  const robots = new Robots({ fetchImpl: () => { throw new Error('must not fetch'); } });
  assert.equal(robots.state, 'js');
  const t = await playBridge(robots, 'full', 11);
  assert.equal(t.phase, 'done'); assert.equal(robots.stats.mcp, 0); assert.ok(robots.stats.fallback > 0);
});

test('bridge: full board and declare board played through the MCP server', async () => {
  const s = await listen();
  const robots = new Robots({ url: s.url });
  for (const mode of ['full', 'declare']) {
    const t = await playBridge(robots, mode, 21);
    assert.equal(t.phase, 'done');
  }
  assert.ok(robots.stats.mcp > 50); assert.equal(robots.stats.fallback, 0); assert.equal(robots.state, 'mcp');
  await s.close();
});

test('mahjong: a hand played through the MCP server', async () => {
  const s = await listen();
  const robots = new Robots({ url: s.url });
  const r = await playMahjong(robots, 5);
  assert.equal(r.phase, 'over'); assert.ok(robots.stats.mcp > 20); assert.equal(robots.stats.fallback, 0);
  await s.close();
});

test('server down: everything still plays with the built-in robots', async () => {
  const robots = new Robots({ url: 'http://127.0.0.1:1/', timeoutMs: 300 });
  assert.equal(robots.state, 'mcp');                       // optimistic until it fails
  const t = await playBridge(robots, 'full', 31);
  assert.equal(t.phase, 'done');
  assert.equal(robots.state, 'paused'); assert.equal(robots.stats.mcp, 0); assert.ok(robots.stats.fallback > 50);
  assert.ok(robots.stats.lastError);
  const r = await playMahjong(robots, 6);
  assert.equal(r.phase, 'over');
});

test('illegal answers from the server are rejected and replaced by built-in moves', async () => {
  const s = await listen({ corrupt: true });
  const robots = new Robots({ url: s.url, failuresBeforePause: 1000 });
  const t = await playBridge(robots, 'full', 41);
  assert.equal(t.phase, 'done');
  assert.equal(robots.stats.mcp, 0); assert.ok(robots.stats.fallback > 50);
  assert.match(robots.stats.lastError, /illegal|bad|not allowed|not in/i);
  const r = await playMahjong(robots, 7);
  assert.equal(r.phase, 'over');
  await s.close();
});

test('slow server: timeout falls back; after the pause the server is retried', async () => {
  const s = await listen({ delayMs: 400 });
  let t = 0;
  const robots = new Robots({ url: s.url, timeoutMs: 60, failuresBeforePause: 2, pauseMs: 1000, now: () => t });
  const br = bridgeRobots(robots);
  const table = new Table({ mode: 'full', defer: true, rand: rng(3), contractProvider: pickContractAsync });
  await table.nextBoardAsync();
  const hand = table.hands.N, a = table.auction;
  const call = await br.call(hand, a, 'N');
  assert.ok(call.type);                                       // got a legal built-in call
  await br.call(hand, a, 'N');
  assert.equal(robots.state, 'paused');                       // two failures => paused
  t += 1500; assert.equal(robots.state, 'mcp');               // pause over => tries the server again
  await s.close();
});

test('views only contain what the seat may know', () => {
  const r = new Round(hk, { rand: rng(9) });
  const v = mahjongView(r, 1);
  assert.equal(v.hand.length, r.players[1].hand.length);
  assert.ok(v.players.every(p => p.handCount !== undefined && p.hand === undefined));
  assert.equal(JSON.stringify(v).includes(JSON.stringify(r.players[2].hand)), false);
});

test('createRobots (the browser entry point) loads and honours an explicit url', async () => {
  const { createRobots } = await import('./index.js');
  const none = createRobots({ url: '' });
  assert.equal(none.core.state, 'js');
  const s = await listen();
  const api = createRobots({ url: s.url });
  assert.equal(api.core.state, 'mcp');
  assert.deepEqual((await api.core.ping()).ok, true);
  assert.equal(typeof api.bridge.call, 'function'); assert.equal(typeof api.mahjong.discard, 'function');
});
