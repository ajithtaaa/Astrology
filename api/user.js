const pay = require('../lib/pay');
const accounts = require('../lib/accounts');
const { send, body } = require('./_util');

// Phone-number sign-in (no OTP) and the signed-in user's status.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const input = await body(req);
    if (input.action === 'login') {
      const phone = pay.normalizePhone(input.phone);
      const name = String(input.name || '').trim();
      if (!phone) return send(res, 400, { error: 'bad_phone' });
      if (name.length < 2) return send(res, 400, { error: 'bad_name' });
      const u = await accounts.login(phone, name);
      return send(res, 200, { session: pay.sessionFor(phone), user: { phone, name: u.name } });
    }
    const phone = pay.phoneFromSession(input.session);
    if (!phone) return send(res, 401, { error: 'signin_required' });
    const u = await accounts.getUser(phone);
    if (!u) return send(res, 401, { error: 'signin_required' });
    const requests = (await accounts.userRequests(phone)).map(({ id, topic, status, amount, payerName, question, created, decidedAt }) => ({ id, topic, status, amount, payerName, question, created, decidedAt }));
    send(res, 200, { user: { phone, name: u.name }, unlocked: Object.keys(u.unlocked || {}), requests });
  } catch (e) {
    console.error('[user]', e);
    send(res, 400, { error: e.message });
  }
};
