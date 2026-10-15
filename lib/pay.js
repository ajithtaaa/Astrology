// Stateless UPI payment flow: orders, unlock codes and access tokens are HMAC-signed.
const crypto = require('crypto');

const SECRET = process.env.PAYMENT_SECRET || 'change-me-set-PAYMENT_SECRET';
const UPI_ID = process.env.UPI_ID || 'ajithta855@oksbi';
const PAYEE = process.env.UPI_PAYEE_NAME || 'Jeevithapankali Jyothisham';
// AUTO_UNLOCK=true unlocks as soon as a valid-looking UTR is submitted.
// Set it to "false" to require the owner to approve each payment from /admin.html.
const AUTO_UNLOCK = process.env.AUTO_UNLOCK !== 'false';
const PLANS = {
  single: { amount: Number(process.env.PRICE_SINGLE || 49), days: 1, label: 'ഒരു ചോദ്യം' },
  full: { amount: Number(process.env.PRICE_FULL || 199), days: 30, label: 'എല്ലാ ചോദ്യങ്ങളും (30 ദിവസം)' },
};

const b64 = (s) => Buffer.from(s).toString('base64url');
const unb64 = (s) => Buffer.from(s, 'base64url').toString();
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function createOrder(plan, topic) {
  if (!PLANS[plan]) throw new Error('invalid plan');
  const id = `JP${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const payload = { id, plan, topic: plan === 'single' ? topic : '*', amount: PLANS[plan].amount };
  const order = `${b64(JSON.stringify(payload))}.${sign('order:' + JSON.stringify(payload))}`;
  const note = `Astro ${id}`;
  const upi = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE)}&am=${payload.amount}.00&cu=INR&tn=${encodeURIComponent(note)}`;
  return { ...payload, order, upi, upiId: UPI_ID, payee: PAYEE, autoUnlock: AUTO_UNLOCK };
}

function readOrder(order) {
  const [body, sig] = String(order || '').split('.');
  if (!body || !sig) throw new Error('invalid order');
  const json = unb64(body);
  if (!safeEq(sig, sign('order:' + json))) throw new Error('invalid order');
  return JSON.parse(json);
}

function unlockCode(orderId) {
  return sign('code:' + orderId).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
}

function issueToken(o, utr) {
  const payload = { o: o.id, p: o.plan, t: o.topic, u: utr || '', e: Date.now() + PLANS[o.plan].days * 86400000 };
  const json = JSON.stringify(payload);
  return { token: `${b64(json)}.${sign('tok:' + json)}`, expires: payload.e, plan: o.plan, topic: o.topic };
}

function checkToken(token, topic) {
  try {
    const [body, sig] = String(token || '').split('.');
    const json = unb64(body);
    if (!safeEq(sig, sign('tok:' + json))) return false;
    const t = JSON.parse(json);
    if (t.e < Date.now()) return false;
    return t.t === '*' || t.t === topic;
  } catch {
    return false;
  }
}

module.exports = { PLANS, UPI_ID, AUTO_UNLOCK, createOrder, readOrder, unlockCode, issueToken, checkToken };
