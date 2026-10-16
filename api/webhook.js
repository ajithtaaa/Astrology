const crypto = require('crypto');
const pay = require('../lib/pay');
const { send } = require('./_util');

// Payment webhook. Accepts several sources so a payment can be confirmed however it is reported:
//   POST /api/webhook?key=WEBHOOK_SECRET[&source=sms|notification|email|shortcut]
//     - bank / BharatPe SMS forwarded by an Android app  ({"from","text"} JSON, form data or plain text)
//     - app push notifications (BharatPe, PhonePe Business, Paytm, GPay) via Notification Forwarder / MacroDroid / Tasker
//     - e-mail alerts via Gmail Apps Script, Mailgun, CloudMailin, Zapier, Make, Pabbly ({subject, body-plain|plain|html})
//     - structured credits from anything else: {"amount": 49.37, "utr": "412345678901"}
//   POST /api/webhook?source=razorpay   (Razorpay payment.captured, verified with RAZORPAY_WEBHOOK_SECRET)

async function readRaw(req) {
  const chunks = [];
  try { for await (const c of req) chunks.push(c); } catch { /* stream already consumed */ }
  const raw = Buffer.concat(chunks).toString();
  if (raw) return raw;
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return '';
}

function parseBody(raw, contentType) {
  try { return JSON.parse(raw); } catch { /* not JSON */ }
  if (/x-www-form-urlencoded/.test(contentType || '') || (/^[\w%.+-]+=/.test(raw) && !raw.includes(' '))) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return null;
}

// Collect the human-readable text from any notification/SMS/e-mail payload, whatever the field names
// (e.g. title/text, notificationTitle/notificationBody, subject/body-plain, message, bigText…).
function textOf(d) {
  const parts = [];
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === 'string' && v.trim() && /title|text|body|message|msg|content|subject|sms|ticker|plain|html|notification|desc/i.test(k)
      && !/package|category|time|date|id$|icon|channel/i.test(k)) parts.push(v);
    else if (v && typeof v === 'object' && !Array.isArray(v)) parts.push(textOf(v));
  }
  return parts.filter(Boolean).join(' \n ');
}

const appOf = (d) => (d && (d.app || d.package || d.packageName || d.notificationPackageName || d.appName || d.application)) || '';

function razorpay(raw, req) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const sig = req.headers['x-razorpay-signature'] || '';
  if (!secret) return { status: 501, error: 'RAZORPAY_WEBHOOK_SECRET not set' };
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  if (!pay.safeEq(sig, expected)) return { status: 401, error: 'bad signature' };
  const d = JSON.parse(raw);
  const p = d.payload && d.payload.payment && d.payload.payment.entity;
  if (!p || !['payment.captured', 'order.paid'].includes(d.event)) return { ignored: true };
  const rrn = (p.acquirer_data && (p.acquirer_data.rrn || p.acquirer_data.upi_transaction_id)) || '';
  return { credit: { paise: Number(p.amount), utr: /^\d{12}$/.test(rrn) ? rrn : '', raw: `razorpay ${p.id} ${p.vpa || p.method}`, source: 'razorpay' } };
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const source = (url.searchParams.get('source') || '').toLowerCase().slice(0, 20);
  const raw = await readRaw(req);

  let credit = null;
  if (source === 'razorpay') {
    const r = razorpay(raw, req);
    if (r.status) return send(res, r.status, { error: r.error });
    if (r.ignored) return send(res, 200, { ok: true, ignored: true });
    credit = r.credit;
  } else {
    const secret = process.env.WEBHOOK_SECRET;
    const key = String(req.headers['x-webhook-secret'] || url.searchParams.get('key') || '');
    if (!secret || !pay.safeEq(key, secret)) return send(res, 401, { error: 'unauthorized' });
    if (req.method !== 'POST') return send(res, 200, { ok: true, hint: 'Webhook is reachable. POST payment notifications here.' });

    const data = parseBody(raw, req.headers['content-type']);
    const filter = process.env.SMS_SENDER_FILTER;
    const from = data ? (data.from || data.sender || appOf(data)) : '';
    if (filter && from && !new RegExp(filter, 'i').test(from)) return send(res, 200, { ok: true, ignored: true, reason: 'sender' });

    if (data && (data.amount != null) && (data.utr || data.rrn || data.reference || data.txnId)) {
      const utr = String(data.utr || data.rrn || data.reference || data.txnId).replace(/\D/g, '');
      credit = { paise: Math.round(Number(data.amount) * 100), utr: utr.length === 12 ? utr : '', raw: JSON.stringify(data).slice(0, 300), source: source || 'api' };
    } else {
      const text = (data && textOf(data)) || raw;
      const isNotification = source === 'notification' || Boolean(appOf(data));
      const parsed = pay.parseCredit(text, { loose: isNotification });
      if (parsed) credit = { ...parsed, raw: [appOf(data), parsed.text].filter(Boolean).join(': '), source: source || (isNotification ? 'notification' : 'sms') };
    }
  }

  if (!credit || !credit.paise) {
    console.log(`[webhook:${source || 'default'}] not a credit:`, raw.slice(0, 200));
    return send(res, 200, { ok: true, matched: false, ignored: true });
  }
  const r = await pay.recordCredit(credit);
  console.log(`[webhook:${credit.source}] ₹${pay.rupees(credit.paise)} utr=${credit.utr || '-'} order=${r.orderId || '-'}${r.duplicate ? ' (duplicate)' : ''}`);
  send(res, 200, { ok: true, amount: pay.rupees(credit.paise), utr: credit.utr || null, matched: Boolean(r.orderId), orderId: r.orderId, duplicate: r.duplicate });
};
