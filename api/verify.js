const { readOrder, unlockCode, issueToken, AUTO_UNLOCK } = require('../lib/pay');
const { send, body } = require('./_util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const { order, utr, code } = await body(req);
    const o = readOrder(order);
    const cleanUtr = String(utr || '').replace(/\s/g, '');
    if (code) {
      if (String(code).trim().toUpperCase() !== unlockCode(o.id)) return send(res, 400, { error: 'bad_code' });
      return send(res, 200, issueToken(o, cleanUtr));
    }
    if (!/^\d{12}$/.test(cleanUtr)) return send(res, 400, { error: 'bad_utr' });
    console.log(`[payment] order=${o.id} plan=${o.plan} topic=${o.topic} amount=${o.amount} utr=${cleanUtr}`);
    if (AUTO_UNLOCK) return send(res, 200, issueToken(o, cleanUtr));
    send(res, 202, { pending: true, orderId: o.id, whatsapp: process.env.OWNER_WHATSAPP || null });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
};
