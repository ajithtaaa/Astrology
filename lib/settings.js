// Owner-editable settings (UPI ID, per-question prices, QR code…) stored in the KV store.
const store = require('./store');
const { TOPICS } = require('./reading');

const PAID = Object.keys(TOPICS).filter((t) => !TOPICS[t].free);
const DEFAULTS = () => ({
  upiId: process.env.UPI_ID || 'BHARATPE2R0F0X6K4D61686@unitype',
  payee: process.env.UPI_PAYEE_NAME || 'Jeevithapankali Jyothisham',
  whatsapp: process.env.OWNER_WHATSAPP || '',
  prices: Object.fromEntries(PAID.map((t) => [t, Number(process.env.PRICE_SINGLE || 49)])),
  qrUpdatedAt: 0,
});

let cache = null;
let cachedAt = 0;

async function getSettings() {
  if (cache && Date.now() - cachedAt < 15000) return cache;
  const saved = (await store.get('config/settings').catch(() => null)) || {};
  const d = DEFAULTS();
  cache = { ...d, ...saved, prices: { ...d.prices, ...(saved.prices || {}) } };
  cachedAt = Date.now();
  return cache;
}

async function saveSettings(patch) {
  const next = { ...(await getSettings()) };
  if (typeof patch.upiId === 'string' && /^[\w.\-]{2,256}@[a-zA-Z][\w.]{1,64}$/.test(patch.upiId.trim())) next.upiId = patch.upiId.trim();
  if (typeof patch.payee === 'string' && patch.payee.trim()) next.payee = patch.payee.trim().slice(0, 60);
  if (typeof patch.whatsapp === 'string') next.whatsapp = patch.whatsapp.replace(/\D/g, '').slice(0, 15);
  if (patch.prices && typeof patch.prices === 'object') {
    next.prices = { ...next.prices };
    for (const t of PAID) {
      const n = Math.round(Number(patch.prices[t]));
      if (Number.isFinite(n) && n >= 1 && n <= 100000) next.prices[t] = n;
    }
  }
  if (patch.qrUpdatedAt) next.qrUpdatedAt = patch.qrUpdatedAt;
  await store.set('config/settings', next);
  cache = next;
  cachedAt = Date.now();
  return next;
}

module.exports = { getSettings, saveSettings, PAID };
