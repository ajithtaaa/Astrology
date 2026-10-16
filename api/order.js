const pay = require('../lib/pay');
const accounts = require('../lib/accounts');
const { send, body } = require('./_util');

// Customer says "I paid": records a payment request for the admin to verify.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const { session, topic, payerName, question } = await body(req);
    const phone = pay.phoneFromSession(session);
    if (!phone) return send(res, 401, { error: 'signin_required' });
    if (!String(payerName || '').trim()) return send(res, 400, { error: 'payer_name_required' });
    if (topic === 'custom' && String(question || '').trim().length < 4) return send(res, 400, { error: 'question_required' });
    const r = await accounts.createRequest(phone, { topic, payerName, question });
    console.log(`[request] ${r.id} ${phone} ${topic} ₹${r.amount} payer="${r.payerName}"`);
    send(res, 200, { request: { id: r.id, topic: r.topic, status: r.status, amount: r.amount } });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
};
