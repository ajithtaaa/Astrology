const telegram = require('../lib/telegram');
const pay = require('../lib/pay');
const { send, body } = require('./_util');

// Telegram webhook (set automatically from the admin panel). Verified with Telegram's secret-token header.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 200, { ok: true });
  if (!pay.safeEq(String(req.headers['x-telegram-bot-api-secret-token'] || ''), telegram.secretToken())) {
    return send(res, 401, { error: 'unauthorized' });
  }
  try {
    const update = await body(req);
    const result = await telegram.handleUpdate(update);
    console.log('[telegram]', result);
  } catch (e) {
    console.error('[telegram]', e.message);
  }
  // Always 200 so Telegram doesn't retry forever.
  send(res, 200, { ok: true });
};
