// One shared robot service for every game. Configuration: ?robots=<url> (remembered), or the chip in each game's header.
import { Robots } from './core.js';
import { bridgeRobots } from './bridge.js';
import { mahjongRobots } from './mahjong.js';

const KEY = 'deckgames.robots.url';
const store = { get() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } },
                set(v) { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* ignore */ } } };

export function createRobots(opts = {}) {
  let url = opts.url;
  if (url === undefined && typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search).get('robots');
    if (q !== null) { url = q === 'off' ? '' : q; store.set(url); }
    else url = store.get();
  }
  const core = new Robots({ ...opts, url });
  const api = { core, bridge: bridgeRobots(core), mahjong: mahjongRobots(core),
    setUrl(v) { store.set(v.trim()); core.setUrl(v); } };
  return api;
}
export { Robots } from './core.js';
export { McpClient } from './mcp.js';

// Small status chip for game headers: click to set or clear the MCP server URL.
export function mountRobotChip(el, robots) {
  const draw = () => {
    const c = robots.core;
    const txt = { js: 'Robots: built-in', mcp: 'Robots: MCP', paused: 'Robots: built-in (MCP down)' }[c.state];
    el.textContent = txt;
    el.title = c.url ? `MCP server: ${c.url}\nMCP answers: ${c.stats.mcp}, built-in answers: ${c.stats.fallback}${c.stats.lastError ? '\nLast error: ' + c.stats.lastError : ''}\nClick to change.`
      : 'Using the built-in JavaScript robots. Click to connect an MCP robot server.';
    el.dataset.state = c.state;
  };
  robots.core.onChange(draw); draw();
  el.onclick = async () => {
    const v = prompt('MCP robot server URL (leave blank to use the built-in robots):', robots.core.url);
    if (v === null) return;
    robots.setUrl(v);
    if (v.trim()) { const r = await robots.core.ping(); if (!r.ok) alert('Could not reach that server (' + r.error + '). The built-in robots will be used instead.'); }
  };
}
