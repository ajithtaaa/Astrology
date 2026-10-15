// Owner-editable settings (UPI ID, prices…) stored in the KV store, falling back to env vars.
const store = require('./store');

const DEFAULTS = () => ({
  upiId: process.env.UPI_ID || 'BHARATPE2R0F0X6K4D61686@unitype',
  payee: process.env.UPI_PAYEE_NAME || 'Jeevithapankali Jyothisham',
  priceSingle: Number(process.env.PRICE_SINGLE || 49),
  priceFull: Number(process.env.PRICE_FULL || 199),
  daysSingle: 1,
  daysFull: 30,
  whatsapp: process.env.OWNER_WHATSAPP || '',
});

let cache = null;
let cachedAt = 0;

async function getSettings() {
  if (cache && Date.now() - cachedAt < 30000) return cache;
  const saved = await store.get('config/settings').catch(() => null);
  cache = { ...DEFAULTS(), ...(saved || {}) };
  cachedAt = Date.now();
  return cache;
}

async function saveSettings(patch) {
  const cur = await getSettings();
  const next = { ...cur };
  if (typeof patch.upiId === 'string' && /^[\w.\-]{2,256}@[a-zA-Z][\w.]{1,64}$/.test(patch.upiId.trim())) next.upiId = patch.upiId.trim();
  if (typeof patch.payee === 'string' && patch.payee.trim()) next.payee = patch.payee.trim().slice(0, 60);
  for (const k of ['priceSingle', 'priceFull']) {
    const n = Math.round(Number(patch[k]));
    if (Number.isFinite(n) && n >= 1 && n <= 100000) next[k] = n;
  }
  for (const k of ['daysSingle', 'daysFull']) {
    const n = Math.round(Number(patch[k]));
    if (Number.isFinite(n) && n >= 1 && n <= 365) next[k] = n;
  }
  if (typeof patch.whatsapp === 'string') next.whatsapp = patch.whatsapp.replace(/\D/g, '').slice(0, 15);
  await store.set('config/settings', next);
  cache = next;
  cachedAt = Date.now();
  return next;
}

async function plans() {
  const s = await getSettings();
  return {
    single: { amount: s.priceSingle, days: s.daysSingle, label: 'ഒരു ചോദ്യം' },
    full: { amount: s.priceFull, days: s.daysFull, label: 'എല്ലാ ചോദ്യങ്ങളും' },
  };
}

module.exports = { getSettings, saveSettings, plans };
