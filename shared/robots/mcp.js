// Minimal MCP client over Streamable HTTP (JSON-RPC 2.0 via POST). Works in browsers and Node 18+.
// Only what the robots need: initialize, tools/list, tools/call. No dependencies.
export class McpClient {
  constructor(url, { timeoutMs = 2000, fetchImpl = (...a) => fetch(...a) } = {}) {
    this.url = url; this.timeoutMs = timeoutMs; this.fetch = fetchImpl;
    this.sessionId = null; this.ready = null; this.nextId = 1;
  }

  async _post(body, expectReply = true) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
      if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
      const res = await this.fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
      const sid = res.headers && res.headers.get && res.headers.get('Mcp-Session-Id');
      if (sid) this.sessionId = sid;
      if (!res.ok) throw new Error(`MCP server answered HTTP ${res.status}`);
      if (!expectReply) return null;
      const text = await res.text();
      const type = (res.headers.get('Content-Type') || '').toLowerCase();
      const msg = type.includes('text/event-stream') ? parseSse(text, body.id) : JSON.parse(text);
      if (!msg) throw new Error('MCP server sent no reply');
      if (msg.error) throw new Error(`MCP error ${msg.error.code}: ${msg.error.message}`);
      return msg.result;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(`MCP server timed out after ${this.timeoutMs} ms`);
      throw e;
    } finally { clearTimeout(timer); }
  }

  // Handshake once; later calls reuse it. A failed handshake is retried on the next call.
  connect() {
    if (!this.ready) {
      this.ready = (async () => {
        const info = await this._post({ jsonrpc: '2.0', id: this.nextId++, method: 'initialize',
          params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'deckgames', version: '1' } } });
        await this._post({ jsonrpc: '2.0', method: 'notifications/initialized' }, false).catch(() => {});
        return info;
      })().catch(e => { this.ready = null; throw e; });
    }
    return this.ready;
  }

  async listTools() { await this.connect(); const r = await this._post({ jsonrpc: '2.0', id: this.nextId++, method: 'tools/list' }); return r.tools || []; }

  // Returns the tool's JSON result (structuredContent, else the first text block parsed as JSON).
  async callTool(name, args) {
    await this.connect();
    const r = await this._post({ jsonrpc: '2.0', id: this.nextId++, method: 'tools/call', params: { name, arguments: args } });
    if (r.isError) throw new Error(`tool ${name} failed: ${(r.content && r.content[0] && r.content[0].text) || 'unknown'}`);
    if (r.structuredContent) return r.structuredContent;
    const block = (r.content || []).find(c => c.type === 'text');
    if (!block) throw new Error(`tool ${name} returned no content`);
    return JSON.parse(block.text);
  }
}

function parseSse(text, id) {
  let found = null;
  for (const ev of text.split(/\r?\n\r?\n/)) {
    const data = ev.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n');
    if (!data) continue;
    try { const m = JSON.parse(data); if (m.id === id || found === null) found = m; } catch { /* ignore */ }
  }
  return found;
}
