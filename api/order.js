const QRCode = require('qrcode');
const { createOrder } = require('../lib/pay');
const { TOPICS } = require('../lib/reading');
const { send, body } = require('./_util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const { plan, topic } = await body(req);
    if (plan === 'single' && (!TOPICS[topic] || TOPICS[topic].free)) return send(res, 400, { error: 'invalid topic' });
    const order = createOrder(plan, topic);
    const qr = await QRCode.toString(order.upi, { type: 'svg', margin: 1, width: 220 });
    send(res, 200, { ...order, qr });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
};
