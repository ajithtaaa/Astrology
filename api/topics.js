const { TOPICS } = require('../lib/reading');
const { PLANS, UPI_ID, webhookMode } = require('../lib/pay');
const soma = require('../lib/soma');
const { send } = require('./_util');

module.exports = (req, res) => send(res, 200, { topics: TOPICS, plans: PLANS, upiId: UPI_ID, webhook: webhookMode, soma: soma.enabled() });
