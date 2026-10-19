/**
 * BotAutoTask — Local Web & Mobile Control Center UI.
 * Zero-dependency HTTP + Server-Sent Events (SSE) server for multi-agent real-time monitoring,
 * live transcript streaming, priority steering, core switching, and worktree inspection.
 */

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { getZeroKeyAuthStatus } from '../core/auth-bridge.js';
import { findLatestAntigravityTranscript } from '../core/log-reader.js';

export function renderDashboardHtml(sessionToken) {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>BotAutoTask — Live Control Center</title>
<style>
  :root{color-scheme:dark;--bg:#090d16;--card:#111827;--card-border:#1f293d;--fg:#e2e8f0;--muted:#94a3b8;--accent:#38bdf8;--ok:#22c55e;--warn:#f59e0b;--err:#ef4444}
  *{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif}
  body{background:var(--bg);color:var(--fg);display:flex;flex-direction:column;height:100vh;overflow:hidden}
  header{background:var(--card);border-bottom:1px solid var(--card-border);padding:10px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
  .brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:1.05rem}
  .badge{padding:2px 8px;border-radius:99px;font-size:.75rem;font-weight:600;background:#1e293b}
  .badge.LIVE{color:var(--ok);background:#14532d}
  .badge.STALE{color:var(--warn);background:#78350f}
  .badge.DISCONNECTED{color:var(--err);background:#450a0a}
  .layout{display:flex;flex:1;overflow:hidden}
  .panel{background:var(--card);border-right:1px solid var(--card-border);overflow-y:auto;padding:12px}
  .roster-panel{width:260px;min-width:220px}
  .feed-panel{flex:1;display:flex;flex-direction:column;padding:0}
  .info-panel{width:320px;min-width:260px;border-right:none;border-left:1px solid var(--card-border)}
  .agent-card{background:#0d131f;border:1px solid var(--card-border);border-radius:8px;padding:10px;margin-bottom:8px}
  .agent-card.running{border-color:var(--accent)}
  .agent-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
  .feed-list{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px}
  .event-card{background:#0d131f;border:1px solid var(--card-border);border-radius:8px;padding:10px;font-size:.88rem}
  .event-header{display:flex;justify-content:space-between;color:var(--muted);font-size:.78rem;margin-bottom:4px}
  .steer-bar{background:var(--card);border-top:1px solid var(--card-border);padding:10px 14px;display:flex;gap:8px;align-items:center}
  input,select,button{background:#0b0f19;color:var(--fg);border:1px solid var(--card-border);border-radius:6px;padding:8px 12px;font-size:.88rem}
  input{flex:1}
  button{cursor:pointer;background:var(--accent);color:#03111c;font-weight:600;border:none}
  button.danger{background:var(--err);color:#fff}
  button.sec{background:#1e293b;color:var(--fg);border:1px solid var(--card-border)}
  .mono{font-family:ui-monospace,Consolas,monospace;font-size:.8rem}
  @media(max-width:768px){
    .layout{flex-direction:column}
    .roster-panel,.info-panel{display:none}
    .feed-panel{height:100%}
  }
</style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🤖 BotAutoTask Live Control</span>
      <span id="connBadge" class="badge DISCONNECTED">Connecting...</span>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="sec" onclick="fetchState()">🔄 Refresh</button>
      <button class="danger" onclick="stopAllAgents()">🛑 Stop All</button>
    </div>
  </header>

  <div class="layout">
    <!-- Left: Roster -->
    <div class="panel roster-panel">
      <div style="font-weight:600;margin-bottom:10px;font-size:.9rem;color:var(--muted)">COWORKER MESH</div>
      <div id="rosterList">Loading agents...</div>
    </div>

    <!-- Center: Feed -->
    <div class="feed-panel">
      <div id="feedList" class="feed-list">
        <div class="event-card" style="color:var(--muted)">Connecting to local live SSE stream...</div>
      </div>
      <div class="steer-bar">
        <select id="steerTarget" style="max-width:140px"></select>
        <select id="steerDelivery" style="max-width:120px">
          <option value="send">Send (Turn)</option>
          <option value="interrupt">Interrupt ⚡</option>
          <option value="queue">Queue (Later)</option>
        </select>
        <input id="steerInput" placeholder="Send direction or interrupt command..." onkeydown="if(event.key==='Enter')sendSteer()"/>
        <button onclick="sendSteer()">Send</button>
      </div>
    </div>

    <!-- Right: Logs & Auth -->
    <div class="panel info-panel">
      <div style="font-weight:600;margin-bottom:10px;font-size:.9rem;color:var(--muted)">SYSTEM & IDE LOGS</div>
      <div id="ideLogCard" class="agent-card">
        <div style="font-weight:600;font-size:.85rem;margin-bottom:4px">Antigravity IDE Transcript</div>
        <div id="ideLogContent" class="mono" style="color:var(--muted);white-space:pre-wrap;max-height:160px;overflow-y:auto">Scanning...</div>
      </div>
      <div style="font-weight:600;margin:12px 0 6px;font-size:.9rem;color:var(--muted)">0-API-KEY AUTH STATUS</div>
      <div id="authStatusList" class="mono" style="font-size:.8rem;color:var(--muted)">Inspecting...</div>
    </div>
  </div>

<script>
  let token = window.location.hash.startsWith('#k=') ? window.location.hash.slice(3) : '${sessionToken}';
  if (window.location.hash.startsWith('#k=')) {
    history.replaceState(null, '', window.location.pathname);
  }

  function api(url, options = {}) {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        ...(options.headers || {})
      }
    });
  }

  function updateBadge(status) {
    const b = document.getElementById('connBadge');
    b.className = 'badge ' + status;
    b.innerText = status;
  }

  let eventSource = null;
  function connectSse() {
    eventSource = new EventSource('/api/events?token=' + encodeURIComponent(token));
    eventSource.onopen = () => updateBadge('LIVE');
    eventSource.onerror = () => updateBadge('DISCONNECTED');
    eventSource.addEventListener('frame', (e) => {
      try {
        const frame = JSON.parse(e.data);
        handleFrame(frame);
      } catch {}
    });
  }

  function handleFrame(frame) {
    if (frame.t === 'hello') {
      fetchState();
      return;
    }
    if (frame.family === 'agent_message' || frame.family === 'agent_steered') {
      appendFeed(frame.payload);
      fetchState();
    }
  }

  function appendFeed(item) {
    const list = document.getElementById('feedList');
    const div = document.createElement('div');
    div.className = 'event-card';
    const time = new Date().toLocaleTimeString();
    div.innerHTML = \`
      <div class="event-header">
        <span>\${item.fromId || item.from || 'System'} → \${item.targetId || item.agentId || 'All'} (\${item.delivery || 'steer'})</span>
        <span>\${time}</span>
      </div>
      <div>\${escapeHtml(item.message || '')}</div>
    \`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  async function fetchState() {
    try {
      const res = await api('/api/state');
      if (!res.ok) return;
      const data = await res.json();
      renderRoster(data.agents || []);
      renderAuth(data.auth || {});
      renderIdeLog(data.latestIdeLog);
    } catch {}
  }

  function renderRoster(agents) {
    const list = document.getElementById('rosterList');
    const select = document.getElementById('steerTarget');
    list.innerHTML = '';
    select.innerHTML = '<option value="all">Broadcast to All</option>';

    for (const a of agents) {
      const card = document.createElement('div');
      card.className = 'agent-card ' + (a.status === 'running' ? 'running' : '');
      card.innerHTML = \`
        <div class="agent-header">
          <b>\${a.name}</b>
          <span class="badge \${a.status === 'running' ? 'LIVE' : ''}">\${a.status}</span>
        </div>
        <div style="font-size:.78rem;color:var(--muted);margin-bottom:6px">role: \${a.role || 'writer'} | core: \${a.preferredCore}</div>
        <div style="display:flex;gap:4px">
          <button class="sec" style="padding:3px 6px;font-size:.75rem" onclick="steerPrompt('\${a.id}')">Steer</button>
          <button class="danger" style="padding:3px 6px;font-size:.75rem" onclick="stopAgent('\${a.id}')">Stop</button>
        </div>
      \`;
      list.appendChild(card);

      const opt = document.createElement('option');
      opt.value = a.id;
      opt.innerText = a.name + ' (' + a.id + ')';
      select.appendChild(opt);
    }
  }

  function renderAuth(auth) {
    const list = document.getElementById('authStatusList');
    list.innerHTML = Object.entries(auth)
      .map(([k, v]) => \`• \${k.toUpperCase()}: <span style="color:\${v.signedIn ? 'var(--ok)' : 'var(--muted)'}">\${v.signedIn ? 'SIGNED IN' : 'NOT SIGNED IN'}</span>\`)
      .join('<br/>');
  }

  function renderIdeLog(log) {
    const content = document.getElementById('ideLogContent');
    if (!log) {
      content.innerText = 'No active transcript found.';
      return;
    }
    content.innerText = \`Status: \${log.status || 'unknown'}\\nLast Agent: \${log.lastResponse || 'N/A'}\`;
  }

  async function sendSteer() {
    const target = document.getElementById('steerTarget').value;
    const delivery = document.getElementById('steerDelivery').value;
    const input = document.getElementById('steerInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    const nonce = 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    await api('/api/agents/' + encodeURIComponent(target) + '/message', {
      method: 'POST',
      body: JSON.stringify({ nonce, text, delivery })
    });
    fetchState();
  }

  function steerPrompt(agentId) {
    document.getElementById('steerTarget').value = agentId;
    document.getElementById('steerInput').focus();
  }

  async function stopAgent(agentId) {
    if (!confirm('Stop agent ' + agentId + '?')) return;
    const nonce = 'n-' + Date.now().toString(36);
    await api('/api/agents/' + encodeURIComponent(agentId) + '/stop', {
      method: 'POST',
      body: JSON.stringify({ nonce, confirm: true })
    });
    fetchState();
  }

  async function stopAllAgents() {
    if (!confirm('Stop ALL running agents?')) return;
    const nonce = 'n-' + Date.now().toString(36);
    await api('/api/agents/stop-all', {
      method: 'POST',
      body: JSON.stringify({ nonce, confirm: true })
    });
    fetchState();
  }

  connectSse();
</script>
</body>
</html>`;
}

export class LocalWebUiServer {
  constructor({ mesh, port = 8765, token = null } = {}) {
    this.mesh = mesh;
    this.port = port;
    this.token = token || randomBytes(16).toString('hex');
    this.server = null;
    this.sseClients = new Set();
    this.eventRingBuffer = [];
    this.currentSeq = 1000;
    this.seenNonces = new Map();

    // Hook into mesh events
    if (this.mesh) {
      const origEvent = this.mesh.onEvent || (() => {});
      this.mesh.onEvent = (evt) => {
        origEvent(evt);
        this.broadcastEvent('agent_message', evt);
      };
    }
  }

  broadcastEvent(family, payload) {
    this.currentSeq++;
    const frame = { t: 'event', family, seq: this.currentSeq, payload };
    this.eventRingBuffer.push(frame);
    if (this.eventRingBuffer.length > 500) {
      this.eventRingBuffer.shift();
    }

    const sseData = `id: ${this.currentSeq}\nevent: frame\ndata: ${JSON.stringify(frame)}\n\n`;
    for (const client of this.sseClients) {
      try { client.write(sseData); } catch {}
    }
  }

  _isAuthorized(req, url) {
    const authHeader = req.headers.authorization || '';
    if (authHeader === `Bearer ${this.token}`) return true;
    const qToken = url.searchParams.get('token');
    return qToken === this.token;
  }

  _checkOrigin(req) {
    const host = req.headers.host || '';
    const origin = req.headers.origin || '';
    const isLocalHost = host.startsWith('127.0.0.1') || host.startsWith('localhost');
    if (!isLocalHost) return false;
    if (origin) {
      return origin.includes('127.0.0.1') || origin.includes('localhost');
    }
    return true;
  }

  async start() {
    this.server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

      // Security check: DNS rebinding prevention
      if (!this._checkOrigin(req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden: Invalid Host or Origin');
        return;
      }

      // 1. Serve Dashboard HTML
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderDashboardHtml(this.token));
        return;
      }

      // 2. SSE Event Stream
      if (req.method === 'GET' && url.pathname === '/api/events') {
        if (!this._isAuthorized(req, url)) {
          res.writeHead(401, { 'Content-Type': 'text/plain' }).end('Unauthorized');
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        this.sseClients.add(res);

        // Send initial hello
        res.write(`id: ${this.currentSeq}\nevent: frame\ndata: ${JSON.stringify({ t: 'hello', protocolVersion: 1, seq: this.currentSeq })}\n\n`);

        // Replay from Last-Event-ID if requested
        const lastId = parseInt(req.headers['last-event-id'], 10);
        if (!isNaN(lastId)) {
          for (const f of this.eventRingBuffer) {
            if (f.seq > lastId) {
              res.write(`id: ${f.seq}\nevent: frame\ndata: ${JSON.stringify(f)}\n\n`);
            }
          }
        }

        req.on('close', () => {
          this.sseClients.delete(res);
        });
        return;
      }

      // Authenticate API routes
      if (!this._isAuthorized(req, url)) {
        res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      // Helper to read JSON body
      const readJson = async () => {
        let body = '';
        for await (const chunk of req) {
          body += String(chunk);
          if (body.length > 1_048_576) throw new Error('Body too large');
        }
        return JSON.parse(body || '{}');
      };

      // 3. GET /api/state
      if (req.method === 'GET' && url.pathname === '/api/state') {
        const agents = this.mesh ? this.mesh.listAgents() : [];
        const auth = getZeroKeyAuthStatus();
        let latestIdeLog = null;
        try {
          const info = findLatestAntigravityTranscript();
          if (info) {
            latestIdeLog = {
              status: info.summary?.lastStatus,
              lastResponse: info.summary?.lastAgentResponse?.slice(0, 300)
            };
          }
        } catch {}

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ agents, auth, latestIdeLog }));
        return;
      }

      // 4. POST /api/agents/:id/message
      const msgMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/message$/);
      if (req.method === 'POST' && msgMatch) {
        const targetId = decodeURIComponent(msgMatch[1]);
        const body = await readJson().catch(() => ({}));
        if (body.nonce && this.seenNonces.has(body.nonce)) {
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ status: 'duplicate' }));
          return;
        }
        if (body.nonce) this.seenNonces.set(body.nonce, Date.now());

        if (this.mesh) {
          const out = await this.mesh.sendToAgent({
            fromId: 'commander',
            targetId,
            message: body.text || '',
            delivery: body.delivery || 'send',
            wait: false
          });
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ delivered: true }));
        }
        return;
      }

      // 5. POST /api/agents/:id/stop
      const stopMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/stop$/);
      if (req.method === 'POST' && stopMatch) {
        const agentId = decodeURIComponent(stopMatch[1]);
        const body = await readJson().catch(() => ({}));
        if (!body.confirm) {
          res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Missing confirm: true' }));
          return;
        }
        const out = this.mesh ? this.mesh.stopAgent(agentId) : { ok: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out));
        return;
      }

      // 6. POST /api/agents/stop-all
      if (req.method === 'POST' && url.pathname === '/api/agents/stop-all') {
        const body = await readJson().catch(() => ({}));
        if (!body.confirm) {
          res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Missing confirm: true' }));
          return;
        }
        const agents = this.mesh ? this.mesh.listAgents() : [];
        const results = await Promise.allSettled(
          agents.map((a) => (this.mesh ? this.mesh.stopAgent(a.id) : Promise.resolve()))
        );
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ stopped: results.length }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not Found');
    });

    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.port, '127.0.0.1', resolve);
    });

    const addr = this.server.address();
    this.port = addr.port;
    this.url = `http://127.0.0.1:${this.port}/#k=${this.token}`;
    return this;
  }

  async close() {
    for (const c of this.sseClients) {
      try { c.end(); } catch {}
    }
    this.sseClients.clear();
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
      this.server = null;
    }
  }
}
