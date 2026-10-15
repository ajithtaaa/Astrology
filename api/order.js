const QRCode = require('qrcode');
const { createOrder } = require('../lib/pay');
const { TOPICS } = require('../lib/reading');
const { send, body } = require('./_util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const { plan, topic } = await body(req);
    if (plan === 'single' && (!TOPICS[topic] || TOPICS[topic].free)) return send(res, 400, { error: 'invalid topic' });
    const order = await createOrder(plan, topic);
    const qr = await QRCode.toString(order.upi, { type: 'svg', margin: 1, width: 240, color: { dark: '#2b1b17', light: '#ffffff' } });
    send(res, 200, { ...order, qr });
  } catch (e) {
    console.error('[order]', e);
    send(res, e.message === 'busy' ? 503 : 400, { error: e.message });
  }
};
