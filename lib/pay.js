// Signing helpers, phone sessions, and parsing of forwarded payment notifications (shown to the admin).
const crypto = require('crypto');
const store = require('./store');

const SECRET = process.env.PAYMENT_SECRET || 'change-me-set-PAYMENT_SECRET';
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const safeEq = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const rupees = (paise) => (paise / 100).toFixed(2).replace(/\.00$/, '');

function normalizePhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return d.length >= 11 && d.length <= 15 ? d : null;
}
const sessionFor = (phone) => `${phone}.${sign('sess:' + phone)}`;
function phoneFromSession(session) {
  const [phone, sig] = String(session || '').split('.');
  return phone && sig && safeEq(sig, sign('sess:' + phone)) ? phone : null;
}

// `loose` accepts app notifications whose text is just an amount, e.g. "₹49".
function parseCredit(text, { loose = false } = {}) {
  const t = String(text || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#8377;/g, ' ').replace(/\s+/g, ' ');
  const credit = /credited|received|deposited|\bcredit\b|paid you|payment of|has paid|sent you|collected|money in|added to/i;
  if (!credit.test(t) && !(loose && /₹|Rs\.?\s*\d|INR\s*\d/i.test(t))) return null;
  if (/debited|\bsent to\b|paid to|spent|withdrawn|\bdebit\b/i.test(t) && !/credited|received|paid you|has paid|sent you/i.test(t)) return null;
  const amt = t.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || t.match(/([\d,]+\.\d{2})\s*(?:Rs|INR|rupees)/i);
  if (!amt) return null;
  const ref = t.match(/(?:UPI|UTR|RRN|Ref(?:erence)?|Txn|Transaction)[^0-9]{0,24}(\d{12})/i) || t.match(/\b(\d{12})\b/);
  const paise = Math.round(parseFloat(amt[1].replace(/,/g, '')) * 100);
  return paise ? { paise, utr: ref ? ref[1] : '', text: t.slice(0, 400) } : null;
}

// Store a forwarded payment notification so the admin can compare it with payment requests.
async function recordPayment({ paise, utr, raw, source }) {
  const key = utr || 'N' + crypto.createHash('sha1').update(`${paise}|${String(raw || '').slice(0, 300)}`).digest('hex').slice(0, 15);
  if (await store.get(`pay/${key}`)) return { duplicate: true, key };
  await store.set(`pay/${key}`, { key, paise, amount: rupees(paise), utr: utr || '', at: Date.now(), source: source || 'webhook', raw: String(raw || '').slice(0, 400) });
  return { duplicate: false, key };
}

module.exports = { sign, safeEq, rupees, normalizePhone, sessionFor, phoneFromSession, parseCredit, recordPayment };
