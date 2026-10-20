// Robots: try an MCP server first, fall back to the built-in JS robots on ANY problem
// (not configured, unreachable, slow, error reply, or an answer that is not a legal move).
import { McpClient } from './mcp.js';

export class Robots {
  // opts: { url, timeoutMs, failuresBeforePause, pauseMs, fetchImpl, now }
  constructor(opts = {}) {
    this.timeoutMs = opts.timeoutMs ?? 2000;
    this.failuresBeforePause = opts.failuresBeforePause ?? 2;
    this.pauseMs = opts.pauseMs ?? 30000;
    this.fetchImpl = opts.fetchImpl; this.now = opts.now || (() => Date.now());
    this.listeners = new Set();
    this.stats = { mcp: 0, fallback: 0, lastError: null };
    this.failures = 0; this.pausedUntil = 0;
    this.setUrl(opts.url || '');
  }
  setUrl(url) {
    this.url = (url || '').trim();
    this.client = this.url ? new McpClient(this.url, { timeoutMs: this.timeoutMs, fetchImpl: this.fetchImpl }) : null;
    this.failures = 0; this.pausedUntil = 0; this.stats = { mcp: 0, fallback: 0, lastError: null };
    this._emit();
  }
  // 'js' (no server configured) | 'mcp' (using it) | 'paused' (server failing, JS robots in charge for now)
  get state() {
    if (!this.client) return 'js';
    return this.now() < this.pausedUntil ? 'paused' : 'mcp';
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) { try { fn(this); } catch { /* ignore */ } } }

  async ping() {
    if (!this.client) return { ok: false, error: 'no server configured' };
    try { const tools = await this.client.listTools(); this._ok(); this._emit(); return { ok: true, tools: tools.map(t => t.name) }; }
    catch (e) { this._fail(e); this._emit(); return { ok: false, error: e.message }; }
  }
  _ok() { this.failures = 0; this.pausedUntil = 0; this.stats.lastError = null; }
  _fail(e) {
    this.stats.lastError = e.message || String(e);
    if (++this.failures >= this.failuresBeforePause) { this.pausedUntil = this.now() + this.pauseMs; this.failures = 0; }
  }

  // tool: MCP tool name; args: JSON-able object; check(result) -> normalized value, or throws if not usable;
  // fallback(): the built-in JS answer (same normalized shape).
  async decide(tool, args, check, fallback) {
    if (this.state === 'mcp') {
      try {
        const raw = await this.client.callTool(tool, args);
        const v = check(raw);
        this._ok(); this.stats.mcp++; this._emit();
        return v;
      } catch (e) { this._fail(e); }
    }
    this.stats.fallback++; this._emit();
    return fallback();
  }
}
