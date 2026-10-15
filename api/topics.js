const { TOPICS } = require('../lib/reading');
const { webhookMode } = require('../lib/pay');
const { getSettings, plans } = require('../lib/settings');
const soma = require('../lib/soma');
const { send } = require('./_util');

module.exports = async (req, res) => {
  const [s, P] = await Promise.all([getSettings(), plans()]);
  send(res, 200, { topics: TOPICS, plans: P, upiId: s.upiId, whatsapp: s.whatsapp || null, webhook: webhookMode(), soma: soma.enabled() });
};
