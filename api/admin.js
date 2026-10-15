const crypto = require('crypto');
const pay = require('../lib/pay');
const { send, body } = require('./_util');

// Owner-only: generate the unlock code for an order after checking the UPI app.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const { key, orderId } = await body(req);
  const admin = process.env.ADMIN_KEY;
  if (!admin || !key || key.length !== admin.length || !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(admin))) {
    return send(res, 401, { error: 'unauthorized' });
  }
  if (!/^JP[A-Z0-9]+$/.test(orderId || '')) return send(res, 400, { error: 'invalid order id' });
  send(res, 200, { orderId, code: pay.unlockCode(orderId) });
};
