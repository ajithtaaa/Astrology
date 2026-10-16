// UPI payments: unique-amount orders, payment-notification matching, signed access tokens.
const crypto = require('crypto');
const store = require('./store');
const { getSettings, plans } = require('./settings');

const SECRET = process.env.PAYMENT_SECRET || 'change-me-set-PAYMENT_SECRET';
const ORDER_TTL = 30 * 60 * 1000;
// Without any confirmation channel there is nothing to check against, so AUTO_UNLOCK can be used as a fallback.
const AUTO_UNLOCK = process.env.AUTO_UNLOCK === 'true';

const b64 = (s) => Buffer.from(s).toString('base64url');
const unb64 = (s) => Buffer.from(s, 'base64url').toString();
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const safeEq = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const rupees = (paise) => (paise / 100).toFixed(2);

function upiLink(s, amount, note) {
  return `upi://pay?pa=${encodeURIComponent(s.upiId)}&pn=${encodeURIComponent(s.payee)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
}

async function createOrder(plan, topic) {
  const P = await plans();
  if (!P[plan]) throw new Error('invalid plan');
  const s = await getSettings();
  const id = `JP${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const now = Date.now();
  // Give every open order a unique amount (₹49.01 … ₹49.99) so an incoming credit can be matched to it.
  const base = P[plan].amount * 100;
  let paise = null;
  const offsets = [...Array(99).keys()].map((i) => i + 1).sort(() => Math.random() - 0.5);
  for (const off of offsets) {
    if (await store.claim(`slot/${base + off}`, { id, exp: now + ORDER_TTL }, (v) => v.exp < Date.now())) { paise = base + off; break; }
  }
  if (!paise) throw new Error('busy');
  const payload = { id, plan, topic: plan === 'single' ? topic : '*', paise, days: P[plan].days, base: P[plan].amount, exp: now + ORDER_TTL };
  await store.set(`order/${id}`, { ...payload, status: 'pending', created: now });
  const json = JSON.stringify(payload);
  const amount = rupees(paise);
  return {
    id, plan, topic: payload.topic, amount,
    order: `${b64(json)}.${sign('order:' + json)}`,
    upi: upiLink(s, amount, 'Astro ' + id),
    upiId: s.upiId, payee: s.payee, expires: payload.exp,
  };
}

function readOrder(order) {
  const [body, sig] = String(order || '').split('.');
  if (!body || !sig) throw new Error('invalid order');
  const json = unb64(body);
  if (!safeEq(sig, sign('order:' + json))) throw new Error('invalid order');
  return JSON.parse(json);
}

function issueToken(o, utr) {
  const days = o.days || (o.plan === 'full' ? 30 : 1);
  const payload = { o: o.id, p: o.plan, t: o.topic, u: utr || '', e: Date.now() + days * 86400000 };
  const json = JSON.stringify(payload);
  return { token: `${b64(json)}.${sign('tok:' + json)}`, expires: payload.e, plan: o.plan, topic: o.topic };
}

function checkToken(token, topic) {
  try {
    const [body, sig] = String(token || '').split('.');
    const json = unb64(body);
    if (!safeEq(sig, sign('tok:' + json))) return false;
    const t = JSON.parse(json);
    return t.e > Date.now() && (t.t === '*' || t.t === topic);
  } catch {
    return false;
  }
}

function unlockCode(orderId) {
  return sign('code:' + orderId).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
}

async function markPaid(orderId, utr, via) {
  const rec = await store.get(`order/${orderId}`);
  if (!rec) return null;
  if (rec.status !== 'paid') {
    Object.assign(rec, { status: 'paid', utr: utr || rec.utr || '', via, paidAt: Date.now() });
    await store.set(`order/${orderId}`, rec);
  }
  return rec;
}

// ---------- parsing payment notifications (bank SMS, BharatPe/PhonePe/GPay app notifications, e-mails) ----------
// `loose` is used for app notifications from a payment app (e.g. BharatPe), whose alerts may be just "₹49.37".
function parseCredit(text, { loose = false } = {}) {
  const t = String(text || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#8377;/g, ' ').replace(/\s+/g, ' ');
  const credit = /credited|received|deposited|\bcredit\b|paid you|payment of|has paid|sent you|collected|money in|added to/i;
  if (!credit.test(t) && !(loose && /₹|Rs\.?\s*\d|INR\s*\d/i.test(t))) return null;
  if (/debited|\bsent to\b|paid to|spent|withdrawn|\bdebit\b/i.test(t) && !/credited|received|paid you|has paid|sent you/i.test(t)) return null;
  const amt = t.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || t.match(/([\d,]+\.\d{2})\s*(?:Rs|INR|rupees)/i);
  if (!amt) return null;
  const ref = t.match(/(?:UPI|UTR|RRN|Ref(?:erence)?|Txn|Transaction)[^0-9]{0,24}(\d{12})/i) || t.match(/\b(\d{12})\b/);
  const paise = Math.round(parseFloat(amt[1].replace(/,/g, '')) * 100);
  if (!paise) return null;
  return { paise, utr: ref ? ref[1] : '', text: t.slice(0, 400) };
}

// Record a confirmed credit and settle the matching open order (by its unique amount) if there is one.
// Notifications without a UTR (e.g. BharatPe push alerts) are de-duplicated by a hash of their text.
async function recordCredit({ paise, utr, raw, source }) {
  const key = utr || 'N' + crypto.createHash('sha1').update(`${paise}|${String(raw || '').slice(0, 300)}`).digest('hex').slice(0, 15);
  const existing = await store.get(`utr/${key}`);
  if (existing) return { duplicate: true, orderId: existing.orderId || null, key };
  const credit = { key, paise, utr: utr || '', at: Date.now(), source: source || 'webhook', raw: String(raw || '').slice(0, 400), orderId: null };
  const slot = await store.get(`slot/${paise}`);
  if (slot && slot.exp > Date.now() - 10 * 60 * 1000) {
    const rec = await store.get(`order/${slot.id}`);
    if (rec && rec.status !== 'paid') {
      await markPaid(slot.id, utr, source || 'webhook');
      credit.orderId = slot.id;
    }
  }
  await store.set(`utr/${key}`, credit);
  return { duplicate: false, orderId: credit.orderId, key };
}

// Customer typed their UTR: match against credits that have already been recorded.
async function claimByUtr(o, utr) {
  const credit = await store.get(`utr/${utr}`);
  if (!credit) return { found: false };
  if (credit.orderId && credit.orderId !== o.id) return { found: true, ok: false, reason: 'used' };
  const base = (o.base || (await plans())[o.plan].amount) * 100;
  if (credit.paise < base) return { found: true, ok: false, reason: 'amount' };
  credit.orderId = o.id;
  await store.set(`utr/${utr}`, credit);
  await markPaid(o.id, utr, 'utr');
  return { found: true, ok: true };
}

async function orderStatus(o) {
  const rec = await store.get(`order/${o.id}`);
  return rec ? rec.status : 'unknown';
}

const webhookMode = () => Boolean(process.env.WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET);

module.exports = {
  AUTO_UNLOCK, webhookMode, rupees, sign, safeEq,
  createOrder, readOrder, issueToken, checkToken, unlockCode, markPaid, parseCredit, recordCredit, claimByUtr, orderStatus,
};
