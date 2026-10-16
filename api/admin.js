const pay = require('../lib/pay');
const store = require('../lib/store');
const { getSettings, saveSettings } = require('../lib/settings');
const telegram = require('../lib/telegram');
const { send, body } = require('./_util');

// Owner admin panel API. Every call needs the ADMIN_KEY.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  let input;
  try { input = await body(req); } catch { return send(res, 400, { error: 'bad json' }); }
  const admin = process.env.ADMIN_KEY;
  if (!admin || !pay.safeEq(String(input.key || ''), admin)) return send(res, 401, { error: 'unauthorized' });

  try {
    switch (input.action || 'dashboard') {
      case 'dashboard': {
        const [orders, credits, settings] = await Promise.all([store.list('order/', 150), store.list('utr/', 150), getSettings()]);
        orders.sort((a, b) => b.created - a.created);
        credits.sort((a, b) => b.at - a.at);
        const paid = orders.filter((o) => o.status === 'paid');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const sum = (list) => list.reduce((s, o) => s + o.paise, 0);
        const host = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
        const key = process.env.WEBHOOK_SECRET || '';
        return send(res, 200, {
          stats: {
            revenueToday: pay.rupees(sum(paid.filter((o) => (o.paidAt || 0) >= today.getTime()))),
            revenueTotal: pay.rupees(sum(paid)),
            paidCount: paid.length,
            pendingCount: orders.filter((o) => o.status !== 'paid' && o.exp > Date.now()).length,
            unmatchedCredits: credits.filter((c) => !c.orderId).length,
          },
          orders: orders.map((o) => ({ ...o, amount: pay.rupees(o.paise), expired: o.status !== 'paid' && o.exp < Date.now() })),
          credits: credits.map((c) => ({ ...c, amount: pay.rupees(c.paise) })),
          settings,
          persistent: store.persistent,
          webhooks: {
            sms: key && `${host}/api/webhook?key=${key}&source=sms`,
            notification: key && `${host}/api/webhook?key=${key}&source=notification`,
            email: key && `${host}/api/webhook?key=${key}&source=email`,
            api: key && `${host}/api/webhook?key=${key}&source=api`,
            razorpay: `${host}/api/webhook?source=razorpay`,
            razorpayConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
          },
        });
      }
      case 'mark_paid': {
        const id = String(input.orderId || '').toUpperCase();
        const rec = await pay.markPaid(id, String(input.utr || '').replace(/\D/g, ''), 'admin');
        return rec ? send(res, 200, { ok: true, order: rec }) : send(res, 404, { error: 'order not found' });
      }
      case 'code': {
        const id = String(input.orderId || '').toUpperCase();
        if (!/^JP[A-Z0-9]+$/.test(id)) return send(res, 400, { error: 'invalid order id' });
        return send(res, 200, { orderId: id, code: pay.unlockCode(id) });
      }
      case 'add_credit': {
        const paise = Math.round(Number(input.amount) * 100);
        const utr = String(input.utr || '').replace(/\D/g, '');
        if (!paise || paise < 100) return send(res, 400, { error: 'invalid amount' });
        if (utr && utr.length !== 12) return send(res, 400, { error: 'UTR must be 12 digits' });
        const r = await pay.recordCredit({ paise, utr, raw: `manual: ${String(input.note || '').slice(0, 200)}`, source: 'manual' });
        return send(res, 200, { ok: true, ...r });
      }
      case 'parse': {
        return send(res, 200, { parsed: pay.parseCredit(String(input.text || '')) });
      }
      case 'tg_status':
        return send(res, 200, await telegram.status());
      case 'tg_connect': {
        const host = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
        await telegram.connect(input.token, host);
        return send(res, 200, await telegram.status());
      }
      case 'tg_disconnect':
        await telegram.disconnect();
        return send(res, 200, await telegram.status());
      case 'tg_allow':
        await telegram.setAllowed(input.chatId, input.allow !== false);
        return send(res, 200, await telegram.status());
      case 'settings': {
        const s = await saveSettings(input.settings || {});
        return send(res, 200, { ok: true, settings: s });
      }
      default:
        return send(res, 400, { error: 'unknown action' });
    }
  } catch (e) {
    console.error('[admin]', e);
    send(res, String(input.action || '').startsWith('tg_') ? 400 : 500, { error: String(input.action || '').startsWith('tg_') ? e.message : 'server_error' });
  }
};
