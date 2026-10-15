// UPI payments: unique-amount orders, bank-SMS webhook matching, signed access tokens.
const crypto = require('crypto');
const store = require('./store');

const SECRET = process.env.PAYMENT_SECRET || 'change-me-set-PAYMENT_SECRET';
const UPI_ID = process.env.UPI_ID || 'ajithta855@okhdfcbank';
const PAYEE = process.env.UPI_PAYEE_NAME || 'Jeevithapankali Jyothisham';
const ORDER_TTL = 30 * 60 * 1000;
// Without a webhook there is nothing to confirm against, so AUTO_UNLOCK can be enabled as a fallback.
const AUTO_UNLOCK = process.env.AUTO_UNLOCK === 'true';
const PLANS = {
  single: { amount: Number(process.env.PRICE_SINGLE || 49), days: 1, label: 'ഒരു ചോദ്യം' },
  full: { amount: Number(process.env.PRICE_FULL || 199), days: 30, label: 'എല്ലാ ചോദ്യങ്ങളും (30 ദിവസം)' },
};

const b64 = (s) => Buffer.from(s).toString('base64url');
const unb64 = (s) => Buffer.from(s, 'base64url').toString();
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const safeEq = (a, b) => typeof a === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const rupees = (paise) => (paise / 100).toFixed(2);

async function createOrder(plan, topic) {
  if (!PLANS[plan]) throw new Error('invalid plan');
  const id = `JP${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const now = Date.now();
  // Give every open order a unique amount (₹49.01 … ₹49.99) so a bank credit can be matched to it.
  const base = PLANS[plan].amount * 100;
  let paise = null;
  const offsets = [...Array(99).keys()].map((i) => i + 1).sort(() => Math.random() - 0.5);
  for (const off of offsets) {
    if (await store.claim(`slot/${base + off}`, { id, exp: now + ORDER_TTL }, (v) => v.exp < Date.now())) { paise = base + off; break; }
  }
  if (!paise) throw new Error('busy');
  const payload = { id, plan, topic: plan === 'single' ? topic : '*', paise, exp: now + ORDER_TTL };
  await store.set(`order/${id}`, { ...payload, status: 'pending', created: now });
  const json = JSON.stringify(payload);
  const order = `${b64(json)}.${sign('order:' + json)}`;
  const amount = rupees(paise);
  const upi = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Astro ' + id)}`;
  return { id, plan, topic: payload.topic, amount, order, upi, upiId: UPI_ID, payee: PAYEE, expires: payload.exp };
}

function readOrder(order) {
  const [body, sig] = String(order || '').split('.');
  if (!body || !sig) throw new Error('invalid order');
  const json = unb64(body);
  if (!safeEq(sig, sign('order:' + json))) throw new Error('invalid order');
  return JSON.parse(json);
}

function issueToken(o, utr) {
  const days = PLANS[o.plan].days;
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
    Object.assign(rec, { status: 'paid', utr, via, paidAt: Date.now() });
    await store.set(`order/${orderId}`, rec);
  }
  return rec;
}

// ---------- bank SMS parsing ----------
function parseCreditSms(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  if (!/credited|received|deposited|credit/i.test(t)) return null;
  if (/debited/i.test(t) && !/credited/i.test(t)) return null;
  const amt = t.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const ref = t.match(/(?:UPI|Ref(?:erence)?|RRN|UTR)[^0-9]{0,20}(\d{12})/i) || t.match(/\b(\d{12})\b/);
  if (!amt || !ref) return null;
  return { paise: Math.round(parseFloat(amt[1].replace(/,/g, '')) * 100), utr: ref[1] };
}

// Record a confirmed credit (from the webhook) and settle the matching order if there is one.
async function recordCredit({ paise, utr, raw }) {
  const existing = await store.get(`utr/${utr}`);
  if (existing) return { duplicate: true, orderId: existing.orderId || null };
  const credit = { paise, utr, at: Date.now(), raw: String(raw || '').slice(0, 400), orderId: null };
  const slot = await store.get(`slot/${paise}`);
  if (slot && slot.exp > Date.now() - 10 * 60 * 1000) {
    const rec = await store.get(`order/${slot.id}`);
    if (rec && rec.status !== 'paid') {
      await markPaid(slot.id, utr, 'webhook');
      credit.orderId = slot.id;
    }
  }
  await store.set(`utr/${utr}`, credit);
  return { duplicate: false, orderId: credit.orderId };
}

// Called when the customer types their UTR: match against credits the webhook has already seen.
async function claimByUtr(o, utr) {
  const credit = await store.get(`utr/${utr}`);
  if (!credit) return { found: false };
  if (credit.orderId && credit.orderId !== o.id) return { found: true, ok: false, reason: 'used' };
  if (credit.paise < PLANS[o.plan].amount * 100) return { found: true, ok: false, reason: 'amount' };
  credit.orderId = o.id;
  await store.set(`utr/${utr}`, credit);
  await markPaid(o.id, utr, 'utr');
  return { found: true, ok: true };
}

async function orderStatus(o) {
  const rec = await store.get(`order/${o.id}`);
  return rec ? rec.status : 'unknown';
}

module.exports = {
  PLANS, UPI_ID, AUTO_UNLOCK, webhookMode: Boolean(process.env.WEBHOOK_SECRET),
  createOrder, readOrder, issueToken, checkToken, unlockCode, markPaid, parseCreditSms, recordCredit, claimByUtr, orderStatus,
};
