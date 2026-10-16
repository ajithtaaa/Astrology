const QRCode = require('qrcode');
const store = require('../lib/store');
const { TOPICS } = require('../lib/reading');
const { getSettings } = require('../lib/settings');
const soma = require('../lib/soma');
const { send } = require('./_util');

// Site config (questions + prices), and GET /api/topics?qr=1[&download=1] for the payment QR image.
module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const s = await getSettings();
  if (url.searchParams.has('qr')) {
    const custom = await store.get('config/qr').catch(() => null);
    let buf; let type;
    if (custom && custom.dataUrl) {
      const m = custom.dataUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      type = m[1]; buf = Buffer.from(m[2], 'base64');
    } else {
      const upi = s.upiLink || `upi://pay?pa=${encodeURIComponent(s.upiId)}&pn=${encodeURIComponent(s.payee)}&cu=INR`;
      buf = await QRCode.toBuffer(upi, { type: 'png', width: 640, margin: 2 }); type = 'image/png';
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=60');
    if (url.searchParams.has('download')) res.setHeader('Content-Disposition', `attachment; filename="payment-qr.${type.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg')}"`);
    return res.end(buf);
  }
  const topics = Object.fromEntries(Object.entries(TOPICS).map(([id, t]) => [id, { ...t, price: t.free ? 0 : s.prices[id] }]));
  send(res, 200, { topics, upiId: s.upiId, payee: s.payee, upiButton: s.upiButton !== false, upiAmount: Boolean(s.upiAmount), upiLink: s.upiLink || '', whatsapp: s.whatsapp || null, qrVersion: s.qrUpdatedAt || 0, soma: soma.enabled() });
};
