const pay = require('../lib/pay');
const { send, body } = require('./_util');

// Polled by the payment dialog. Unlocks when the webhook has seen the credit,
// when the customer's UTR matches a recorded credit, or with an owner-issued unlock code.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const { order, utr, code } = await body(req);
    const o = pay.readOrder(order);
    const cleanUtr = String(utr || '').replace(/\D/g, '');

    if (code) {
      if (String(code).trim().toUpperCase() !== pay.unlockCode(o.id)) return send(res, 400, { error: 'bad_code' });
      await pay.markPaid(o.id, cleanUtr, 'admin');
      return send(res, 200, pay.issueToken(o, cleanUtr));
    }
    if ((await pay.orderStatus(o)) === 'paid') return send(res, 200, pay.issueToken(o, cleanUtr));

    if (cleanUtr) {
      if (cleanUtr.length !== 12) return send(res, 400, { error: 'bad_utr' });
      const m = await pay.claimByUtr(o, cleanUtr);
      if (m.ok) return send(res, 200, pay.issueToken(o, cleanUtr));
      if (m.found) return send(res, 409, { error: m.reason === 'used' ? 'utr_used' : 'amount_low' });
      console.log(`[payment] waiting order=${o.id} amount=${pay.rupees(o.paise)} utr=${cleanUtr}`);
      if (pay.AUTO_UNLOCK || !pay.webhookMode()) {
        await pay.markPaid(o.id, cleanUtr, 'trust');
        return send(res, 200, pay.issueToken(o, cleanUtr));
      }
    }
    send(res, 202, { pending: true, orderId: o.id, expired: o.exp < Date.now(), whatsapp: (await require('../lib/settings').getSettings()).whatsapp || null });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
};
