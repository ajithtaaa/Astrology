const crypto = require('crypto');
const pay = require('../lib/pay');
const { send } = require('./_util');

// Payment webhook. Point an SMS-forwarding app (or any payment notifier) at
//   POST /api/webhook?key=WEBHOOK_SECRET
// Body may be the bank SMS (JSON {text|message|body|sms}, form data, or plain text),
// or a structured credit {utr, amount}.
async function rawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString();
}

function extract(raw) {
  let data = null;
  try { data = JSON.parse(raw); } catch {
    if (raw.includes('=') && !raw.includes(' ')) data = Object.fromEntries(new URLSearchParams(raw));
  }
  if (data && (data.utr || data.rrn) && data.amount) {
    return { utr: String(data.utr || data.rrn).replace(/\D/g, ''), paise: Math.round(Number(data.amount) * 100), from: data.from || '' };
  }
  const text = data ? (data.text || data.message || data.body || data.sms || data.content || data.msg || JSON.stringify(data)) : raw;
  const parsed = pay.parseCreditSms(text);
  return parsed && { ...parsed, from: (data && (data.from || data.sender)) || '', text };
}

module.exports = async (req, res) => {
  const secret = process.env.WEBHOOK_SECRET;
  const url = new URL(req.url, 'http://x');
  const key = req.headers['x-webhook-secret'] || url.searchParams.get('key') || '';
  if (!secret || key.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(secret))) {
    return send(res, 401, { error: 'unauthorized' });
  }
  if (req.method !== 'POST') return send(res, 200, { ok: true, hint: 'POST bank credit SMS here' });
  const raw = await rawBody(req);
  const credit = extract(raw);
  if (!credit || credit.utr.length !== 12 || !credit.paise) {
    console.log('[webhook] ignored message:', raw.slice(0, 200));
    return send(res, 200, { ok: true, matched: false, ignored: true });
  }
  const filter = process.env.SMS_SENDER_FILTER;
  if (filter && credit.from && !new RegExp(filter, 'i').test(credit.from)) {
    return send(res, 200, { ok: true, ignored: true, reason: 'sender' });
  }
  const r = await pay.recordCredit({ paise: credit.paise, utr: credit.utr, raw: credit.text || raw });
  console.log(`[webhook] credit ₹${(credit.paise / 100).toFixed(2)} utr=${credit.utr} order=${r.orderId || '-'}${r.duplicate ? ' (duplicate)' : ''}`);
  send(res, 200, { ok: true, matched: Boolean(r.orderId), orderId: r.orderId, duplicate: r.duplicate });
};
