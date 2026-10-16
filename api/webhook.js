const pay = require('../lib/pay');
const { send } = require('./_util');

// Optional payment-notification feed. A forwarder app (e.g. "Notification to Webhook" for BharatPe) can POST here:
//   POST /api/webhook?key=WEBHOOK_SECRET
// Received payments are listed in the admin panel next to the customers' payment requests to make verification easy.
async function readRaw(req) {
  const chunks = [];
  try { for await (const c of req) chunks.push(c); } catch { /* already consumed */ }
  const raw = Buffer.concat(chunks).toString();
  if (raw) return raw;
  if (typeof req.body === 'string') return req.body;
  return req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : '';
}

function textOf(d) {
  const parts = [];
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === 'string' && v.trim() && /title|text|body|message|msg|content|subject|sms|ticker|plain|notification|desc/i.test(k)
      && !/package|category|time|date|id$|icon|channel/i.test(k)) parts.push(v);
    else if (v && typeof v === 'object' && !Array.isArray(v)) parts.push(textOf(v));
  }
  return parts.filter(Boolean).join(' \n ');
}
const appOf = (d) => (d && (d.app || d.package || d.packageName || d.notificationPackageName || d.appName)) || '';

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const secret = process.env.WEBHOOK_SECRET;
  const key = String(req.headers['x-webhook-secret'] || url.searchParams.get('key') || '');
  if (!secret || !pay.safeEq(key, secret)) return send(res, 401, { error: 'unauthorized' });
  if (req.method !== 'POST') return send(res, 200, { ok: true, hint: 'Webhook is reachable.' });
  const raw = await readRaw(req);
  let data = null;
  try { data = JSON.parse(raw); } catch {
    if (/^[\w%.+-]+=/.test(raw)) data = Object.fromEntries(new URLSearchParams(raw));
  }
  const text = (data && textOf(data)) || raw;
  const app = appOf(data);
  const parsed = pay.parseCredit(text, { loose: Boolean(app) || url.searchParams.get('source') === 'notification' });
  if (!parsed) return send(res, 200, { ok: true, recorded: false });
  const r = await pay.recordPayment({ paise: parsed.paise, utr: parsed.utr, raw: [app, parsed.text].filter(Boolean).join(': '), source: url.searchParams.get('source') || (app ? 'notification' : 'sms') });
  console.log(`[webhook] ₹${pay.rupees(parsed.paise)}${r.duplicate ? ' (duplicate)' : ''}`);
  send(res, 200, { ok: true, recorded: !r.duplicate, amount: pay.rupees(parsed.paise), duplicate: r.duplicate });
};
