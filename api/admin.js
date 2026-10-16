const pay = require('../lib/pay');
const store = require('../lib/store');
const accounts = require('../lib/accounts');
const { getSettings, saveSettings } = require('../lib/settings');
const { decodeQr } = require('../lib/qrdecode');
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
        const [requests, users, payments, settings] = await Promise.all([
          store.list('req/', 300), store.list('user/', 500), store.list('pay/', 100), getSettings(),
        ]);
        requests.sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.created - a.created);
        users.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
        payments.sort((a, b) => b.at - a.at);
        const approved = requests.filter((r) => r.status === 'approved');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const host = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
        return send(res, 200, {
          stats: {
            pending: requests.filter((r) => r.status === 'pending').length,
            revenueToday: approved.filter((r) => (r.decidedAt || 0) >= today.getTime()).reduce((s, r) => s + (r.amount || 0), 0),
            revenueTotal: approved.reduce((s, r) => s + (r.amount || 0), 0),
            users: users.length,
            newToday: users.filter((u) => (u.created || 0) >= today.getTime()).length,
            activeToday: users.filter((u) => (u.lastSeen || 0) >= today.getTime()).length,
            active7d: users.filter((u) => (u.lastSeen || 0) >= Date.now() - 7 * 86400000).length,
            visits: users.reduce((n, u) => n + (u.visits || 1), 0),
          },
          requests,
          users: users.map((u) => ({ phone: u.phone, name: u.name, created: u.created, lastSeen: u.lastSeen, visits: u.visits || 1, hasChart: Boolean(u.profile && u.profile.dob), unlocked: Object.keys(u.unlocked || {}), requests: (u.requests || []).length })),
          payments,
          settings,
          persistent: store.persistent,
          webhook: process.env.WEBHOOK_SECRET ? `${host}/api/webhook?key=${process.env.WEBHOOK_SECRET}&source=notification` : null,
        });
      }
      case 'approve':
      case 'reject':
        return send(res, 200, { ok: true, request: await accounts.decide(String(input.id || ''), input.action === 'approve', input.note) });
      case 'settings':
        return send(res, 200, { ok: true, settings: await saveSettings(input.settings || {}) });
      case 'qr_upload': {
        const m = String(input.dataUrl || '').match(/^data:(image\/(png|jpe?g|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/);
        if (!m) return send(res, 400, { error: 'Upload a PNG, JPG, WEBP or SVG image' });
        if (m[3].length > 2.8e6) return send(res, 400, { error: 'Image is too large (max 2 MB)' });
        await store.set('config/qr', { dataUrl: input.dataUrl, at: Date.now() });
        // Use the exact link inside the official QR for the "open UPI app" button: apps trust it.
        const text = decodeQr(input.dataUrl);
        const link = text && /^upi:\/\/pay\?/i.test(text) ? text : '';
        const patch = { qrUpdatedAt: Date.now() };
        if (link) patch.upiLink = link;
        return send(res, 200, { ok: true, decoded: link || null, settings: await saveSettings(patch) });
      }
      case 'qr_reset':
        await store.set('config/qr', { dataUrl: '', at: Date.now() });
        return send(res, 200, { ok: true, settings: await saveSettings({ qrUpdatedAt: Date.now(), upiLink: '' }) });
      default:
        return send(res, 400, { error: 'unknown action' });
    }
  } catch (e) {
    console.error('[admin]', e);
    send(res, 400, { error: e.message });
  }
};
