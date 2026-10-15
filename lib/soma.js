// Ask Soma (AstroSoma) client over MCP streamable HTTP.
// Configure ASKSOMA_MCP_URL (and ASKSOMA_API_KEY if your endpoint needs one).

const URL_ = process.env.ASKSOMA_MCP_URL;
const KEY = process.env.ASKSOMA_API_KEY;

function enabled() {
  return Boolean(URL_);
}

async function rpc(body, sessionId, signal) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (KEY) headers.Authorization = `Bearer ${KEY}`;
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const res = await fetch(URL_, { method: 'POST', headers, body: JSON.stringify(body), signal });
  if (!res.ok && res.status !== 202) throw new Error(`Ask Soma HTTP ${res.status}`);
  const sid = res.headers.get('mcp-session-id') || sessionId;
  const text = await res.text();
  if (!text) return { sid, msg: null };
  let msg;
  if ((res.headers.get('content-type') || '').includes('text/event-stream')) {
    const datas = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim());
    for (const d of datas) {
      try {
        const m = JSON.parse(d);
        if (m.id === body.id) msg = m;
      } catch { /* ignore keep-alives */ }
    }
  } else {
    msg = JSON.parse(text);
  }
  if (msg && msg.error) throw new Error(msg.error.message || 'Ask Soma error');
  return { sid, msg };
}

async function callTool(name, args) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const init = await rpc({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'jeevithapankali', version: '1.0.0' } },
    }, null, ctrl.signal);
    await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, init.sid, ctrl.signal);
    const { msg } = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } }, init.sid, ctrl.signal);
    const result = msg && msg.result;
    if (!result || result.isError) throw new Error('Ask Soma tool failed');
    return (result.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  } finally {
    clearTimeout(timer);
  }
}

function birthArg(b) {
  return { dob: b.dob, tob: b.tob, lat: Number(b.lat), lon: Number(b.lon), tz: b.tz || 'Asia/Kolkata' };
}

async function askSoma(question, birth) {
  return callTool('ask_soma', { question, birth: birthArg(birth), language: 'Malayalam' });
}

async function compatibility(p1, p2) {
  return callTool('check_compatibility', { person1: birthArg(p1), person2: birthArg(p2) });
}

module.exports = { enabled, askSoma, compatibility };
