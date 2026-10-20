#!/usr/bin/env node
// Reference STUB of the Deck Games robot MCP server. Zero dependencies (Node 18+).
// It speaks MCP over Streamable HTTP (JSON-RPC 2.0 via POST) and exposes the five robot tools.
// Its "robots" are deliberately dumb but always LEGAL: copy this file into the real server repo and replace the five
// functions in `tools` with real logic. The contract is documented in docs/robot-mcp.md.
//
//   node tools/mcp-stub/server.mjs [--port 8787]
import http from 'node:http';
import { pathToFileURL } from 'node:url';

// ---- the part to replace ------------------------------------------------------------------------------------
export const tools = {
  // input: bridge call view (see docs). output: { call: "P"|"X"|"XX"|"1C".."7N", alert?: string }
  bridge_choose_call: () => ({ call: 'P' }),

  // input: bridge play view. output: { card: "SA" }  (must be one of input.legal)
  bridge_choose_play: v => ({ card: v.legal[v.legal.length - 1] }),

  // input: mahjong view. output: { tile, riichi?: boolean }  (tile must be in input.hand)
  mahjong_choose_discard: v => ({ tile: v.drawn && v.hand.includes(v.drawn) ? v.drawn : v.hand[v.hand.length - 1], riichi: false }),

  // input: mahjong view + options {win,pung,kong,chows}. output: { action: "win"|"pung"|"kong"|"chow"|"pass", use?: [t,t] }
  mahjong_choose_claim: v => ({ action: v.options.win ? 'win' : 'pass' }),

  // input: mahjong view + options {win,concealedKongs,addKongs}. output: { action: "win"|"kong"|"none", tile? }
  mahjong_choose_self: v => ({ action: v.options.win ? 'win' : 'none' }),
};
// -------------------------------------------------------------------------------------------------------------

const STR = { type: 'string' }, ARR = { type: 'array', items: STR };
export const toolList = [
  { name: 'bridge_choose_call', description: 'Choose a bid, double, redouble or pass in a bridge auction.',
    inputSchema: { type: 'object', properties: { seat: STR, hand: ARR, dealer: STR, auction: { type: 'array' }, vulnerability: { type: 'object' } }, required: ['seat', 'hand', 'auction'] },
    outputSchema: { type: 'object', properties: { call: STR, alert: STR }, required: ['call'] } },
  { name: 'bridge_choose_play', description: 'Choose a card to play. Must be one of "legal".',
    inputSchema: { type: 'object', properties: { actor: STR, seat: STR, hand: ARR, legal: ARR, visible: { type: 'object' }, contract: { type: 'object' }, trick: { type: 'array' }, history: { type: 'array' } }, required: ['legal'] },
    outputSchema: { type: 'object', properties: { card: STR }, required: ['card'] } },
  { name: 'mahjong_choose_discard', description: 'Choose the tile to discard (and whether to declare riichi with it).',
    inputSchema: { type: 'object', properties: { variant: STR, seat: { type: 'integer' }, hand: ARR, drawn: STR, players: { type: 'array' } }, required: ['hand'] },
    outputSchema: { type: 'object', properties: { tile: STR, riichi: { type: 'boolean' } }, required: ['tile'] } },
  { name: 'mahjong_choose_claim', description: 'Respond to another player\'s discard: win, pung, kong, chow or pass.',
    inputSchema: { type: 'object', properties: { options: { type: 'object' }, lastDiscard: { type: 'object' } }, required: ['options'] },
    outputSchema: { type: 'object', properties: { action: STR, use: ARR }, required: ['action'] } },
  { name: 'mahjong_choose_self', description: 'After drawing: declare a win, a kong, or nothing.',
    inputSchema: { type: 'object', properties: { options: { type: 'object' } }, required: ['options'] },
    outputSchema: { type: 'object', properties: { action: STR, tile: STR }, required: ['action'] } },
];

// opts.delayMs: artificial latency (tests). opts.corrupt: return illegal answers (tests). opts.log: console logger.
export function createStubServer(opts = {}) {
  const sessions = new Set();
  const handle = (msg, session) => {
    const reply = result => ({ jsonrpc: '2.0', id: msg.id, result });
    const err = (code, message) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } });
    switch (msg.method) {
      case 'initialize':
        return reply({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'deckgames-robots-stub', version: '0.1.0' } });
      case 'tools/list': return reply({ tools: toolList });
      case 'tools/call': {
        const fn = tools[msg.params && msg.params.name];
        if (!fn) return err(-32602, 'unknown tool ' + (msg.params && msg.params.name));
        try {
          const out = opts.corrupt ? { call: 'ZZ', card: 'XX', tile: 'nope', action: 'fly' } : fn(msg.params.arguments || {});
          return reply({ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out });
        } catch (e) { return reply({ isError: true, content: [{ type: 'text', text: String(e.message) }] }); }
      }
      default: return msg.id === undefined ? null : err(-32601, 'method not found: ' + msg.method);
    }
  };
  return http.createServer((req, res) => {
    // CORS: the games run in a browser on another origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      let msg;
      try { msg = JSON.parse(body); } catch { res.writeHead(400); return res.end(); }
      const go = () => {
        if (opts.log) opts.log(msg.method, msg.params && msg.params.name || '');
        const out = handle(msg);
        if (out === null) { res.writeHead(202); return res.end(); }
        const headers = { 'Content-Type': 'application/json' };
        if (msg.method === 'initialize') { const sid = 'stub-' + Math.random().toString(36).slice(2); sessions.add(sid); headers['Mcp-Session-Id'] = sid; }
        res.writeHead(200, headers); res.end(JSON.stringify(out));
      };
      opts.delayMs && msg.method === 'tools/call' ? setTimeout(go, opts.delayMs) : go();
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--port'), port = i > 0 ? +process.argv[i + 1] : 8787;
  createStubServer({ log: (m, t) => console.log(new Date().toISOString().slice(11, 19), m, t) }).listen(port, () =>
    console.log(`Deck Games robot MCP stub on http://localhost:${port}/  (Streamable HTTP, POST)`));
}
