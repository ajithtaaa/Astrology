// End-to-end API smoke test against the local dev server (in-memory store).
process.env.PORT = process.env.PORT || '3456';
process.env.ADMIN_KEY = 'test-admin';
process.env.WEBHOOK_SECRET = 'hooksecret';
require('../dev-server');
const base = `http://localhost:${process.env.PORT}`;
const post = (p, d, raw) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': raw ? 'text/plain' : 'application/json' }, body: raw ? d : JSON.stringify(d) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('ok -', m); };

(async () => {
  await new Promise((r) => setTimeout(r, 200));
  const self = { name: 'അജിത്', gender: 'male', dob: '1996-05-14', tob: '08:30', lat: 10.8505, lon: 76.2711, tz: 'Asia/Kolkata' };
  const partner = { name: 'മീര', dob: '1998-11-02', tob: '17:45', lat: 9.9312, lon: 76.2673, tz: 'Asia/Kolkata' };
  const cfg = await fetch(base + '/api/topics').then((r) => r.json());
  assert(cfg.upiId === 'BHARATPE2R0F0X6K4D61686@unitype' && cfg.webhook, 'config: BharatPe UPI + webhook mode');
  const chart = await post('/api/chart', self);
  assert(chart.signs && chart.signs.length === 12 && chart.lagna, 'chart endpoint');
  for (const [id, t] of Object.entries(cfg.topics)) {
    const r = await post('/api/reading', { topic: id, self, partner, question: 'എന്റെ പങ്കാളിയുടെ ജോലി എന്തായിരിക്കും?' });
    assert(t.free ? r.status === 200 && r.sections.length >= 3 : r.status === 402, `${id} ${t.free ? 'free, ' + (r.sections || []).length + ' sections' : 'requires payment'}`);
  }

  // 1) Webhook auto-match by unique amount
  const o = await post('/api/order', { plan: 'full' });
  assert(o.status === 200 && /^199\.\d\d$/.test(o.amount) && o.amount !== '199.00' && o.upi.includes('pa=BHARATPE2R0F0X6K4D61686%40unitype'), `order has unique amount ₹${o.amount}`);
  assert((await post('/api/verify', { order: o.order })).status === 202, 'pending before payment');
  assert((await post('/api/webhook', { text: 'hi' })).status === 401, 'webhook requires key');
  const sms = `Money Received - INR ${o.amount} credited to HDFC Bank A/c XX1234 on 15-10-26 from VPA someone@okaxis (UPI Ref No 412345678901)`;
  const w = await post('/api/webhook?key=hooksecret', { from: 'AD-HDFCBK', text: sms });
  assert(w.matched && w.orderId === o.id, 'webhook SMS matched to order');
  const v = await post('/api/verify', { order: o.order });
  assert(v.status === 200 && v.token, 'polling now unlocks');
  assert((await post('/api/webhook?key=hooksecret', { text: sms })).duplicate, 'duplicate SMS ignored');
  for (const id of Object.keys(cfg.topics).filter((k) => !cfg.topics[k].free)) {
    const r = await post('/api/reading', { topic: id, self, partner, question: 'എന്റെ വിവാഹം എപ്പോൾ നടക്കും?', token: v.token });
    assert(r.status === 200 && r.sections.length >= 2, `${id} unlocked (${r.sections.length} sections)`);
  }

  // 2) Customer pays a round amount; UTR entered matches the recorded credit
  const s = await post('/api/order', { plan: 'single', topic: 'spouse_job' });
  await post('/api/webhook?key=hooksecret', 'Rs. 49.00 credited to a/c **1234 by VPA x@ybl UPI Ref No. 512345678902', true);
  assert((await post('/api/verify', { order: s.order, utr: '000000000000' })).status === 202, 'unknown UTR stays pending');
  const sv = await post('/api/verify', { order: s.order, utr: '512345678902' });
  assert(sv.status === 200 && sv.token, 'UTR matched against webhook credit');
  const s2 = await post('/api/order', { plan: 'single', topic: 'spouse_job' });
  assert((await post('/api/verify', { order: s2.order, utr: '512345678902' })).status === 409, 'UTR cannot be reused');
  assert((await post('/api/reading', { topic: 'spouse_place', self, token: sv.token })).status === 402, 'single token limited to its topic');

  // 2b) BharatPe app notification without UTR, matched by unique amount
  const n = await post('/api/order', { plan: 'single', topic: 'spouse_looks' });
  const note = { app: 'com.bharatpe.app', title: 'Payment Received', text: `₹${n.amount} received from Rahul via UPI` };
  const nw = await post('/api/webhook?key=hooksecret&source=notification', note);
  assert(nw.matched && nw.orderId === n.id, 'BharatPe notification (no UTR) matched by amount');
  assert((await post('/api/webhook?key=hooksecret&source=notification', note)).duplicate, 'same notification twice is ignored');
  assert((await post('/api/verify', { order: n.order })).token, 'notification-paid order unlocks');

  // 2b2) "Notification to Webhook" app format (notificationTitle / notificationBody, amount only)
  const nw2o = await post('/api/order', { plan: 'single', topic: 'spouse_looks' });
  const nw2 = await post('/api/webhook?key=hooksecret&source=notification', { notificationPackageName: 'com.bharatpe.app', notificationTitle: 'Payment Received', notificationBody: `₹${nw2o.amount}`, notificationCategory: 'OTHER', notificationPostTime: '2026-10-16T09:48:00' });
  assert(nw2.matched && nw2.orderId === nw2o.id, 'notificationTitle/notificationBody payload with bare "₹amount" matched');
  const wa = await post('/api/webhook?key=hooksecret', { notificationPackageName: 'com.whatsapp', notificationTitle: '+91 99958 42503', notificationBody: '₹1.65' });
  assert(wa.amount === '1.65', 'WhatsApp test payload is read (₹1.65)');

  // 2c) E-mail alert, form-encoded
  const em = await post('/api/order', { plan: 'single', topic: 'spouse_looks' });
  const form = new URLSearchParams({ subject: 'You have received a payment', 'body-plain': `Dear merchant, Rs. ${em.amount} has been credited. RRN: 612345678903` }).toString();
  const ew = await fetch(base + '/api/webhook?key=hooksecret&source=email', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form }).then((r) => r.json());
  assert(ew.matched && ew.utr === '612345678903', 'e-mail (form data) matched with RRN');

  // 2d) Structured API credit
  const ap = await post('/api/order', { plan: 'full' });
  assert((await post('/api/webhook?key=hooksecret&source=api', { amount: Number(ap.amount), utr: '712345678904' })).matched, 'structured {amount, utr} credit matched');

  // 2e) Debit messages are ignored
  assert((await post('/api/webhook?key=hooksecret', { text: 'Rs.49.00 debited from a/c XX12 to VPA abc@ybl UPI Ref 812345678905' })).ignored, 'debit SMS ignored');

  // 2f) Razorpay (signed)
  process.env.RAZORPAY_WEBHOOK_SECRET = 'rzpsecret';
  const rz = await post('/api/order', { plan: 'single', topic: 'chovva_dosham' });
  const rzBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', amount: Math.round(Number(rz.amount) * 100), method: 'upi', vpa: 'a@b', acquirer_data: { rrn: '912345678906' } } } } });
  const sig = require('crypto').createHmac('sha256', 'rzpsecret').update(rzBody).digest('hex');
  const bad = await fetch(base + '/api/webhook?source=razorpay', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'nope' }, body: rzBody });
  assert(bad.status === 401, 'razorpay bad signature rejected');
  const good = await fetch(base + '/api/webhook?source=razorpay', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig }, body: rzBody }).then((r) => r.json());
  assert(good.matched && good.orderId === rz.id, 'razorpay payment.captured matched');

  // 3) Admin panel API
  const dash = await post('/api/admin', { key: 'test-admin', action: 'dashboard' });
  assert(dash.status === 200 && dash.orders.length >= 5 && dash.credits.length >= 5 && dash.webhooks.notification.includes('source=notification'), `admin dashboard (${dash.orders.length} orders, ₹${dash.stats.revenueTotal})`);
  const mp = await post('/api/order', { plan: 'single', topic: 'spouse_job' });
  await post('/api/admin', { key: 'test-admin', action: 'mark_paid', orderId: mp.id });
  assert((await post('/api/verify', { order: mp.order })).token, 'admin "mark paid" unlocks the customer');
  const mc = await post('/api/order', { plan: 'single', topic: 'spouse_job' });
  assert((await post('/api/admin', { key: 'test-admin', action: 'add_credit', amount: mc.amount })).orderId === mc.id, 'manual credit matched');
  const pr = await post('/api/admin', { key: 'test-admin', action: 'parse', text: 'Rs.49.37 received from xyz@okaxis. UTR 412345678901 - BharatPe' });
  assert(pr.parsed && pr.parsed.paise === 4937 && pr.parsed.utr === '412345678901', 'parse tester');
  const st = await post('/api/admin', { key: 'test-admin', action: 'settings', settings: { priceSingle: 59, upiId: 'new@ybl' } });
  assert(st.settings.priceSingle === 59 && st.settings.upiId === 'new@ybl', 'settings saved');
  const cfg2 = await fetch(base + '/api/topics').then((r) => r.json());
  assert(cfg2.plans.single.amount === 59 && cfg2.upiId === 'new@ybl', 'site uses new settings');
  const o59 = await post('/api/order', { plan: 'single', topic: 'spouse_job' });
  assert(o59.amount.startsWith('59.') && o59.upi.includes('pa=new%40ybl'), 'new orders use new price + UPI');

  // 3b) Telegram bot (Telegram API mocked)
  const realFetch = globalThis.fetch;
  const tgCalls = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith('https://api.telegram.org/')) {
      const method = String(url).split('/').pop();
      tgCalls.push({ method, params: JSON.parse(opts.body || '{}') });
      const result = method === 'getMe' ? { id: 1, username: 'JeevithaPayBot', first_name: 'Pay' } : method === 'getWebhookInfo' ? { url: 'x', pending_update_count: 0 } : true;
      return new Response(JSON.stringify({ ok: true, result }));
    }
    return realFetch(url, opts);
  };
  const conn = await post('/api/admin', { key: 'test-admin', action: 'tg_connect', token: '123456789:AAHabcdefghijklmnopqrstuvwxyz012345' });
  const hook = tgCalls.find((c) => c.method === 'setWebhook');
  assert(conn.connected && hook && hook.params.url.endsWith('/api/telegram') && hook.params.secret_token, 'telegram connect sets webhook');
  const tgPost = (update, secret) => realFetch(base + '/api/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(update) });
  assert((await tgPost({ update_id: 1 }, 'wrong')).status === 401, 'telegram webhook rejects bad secret');
  const tor = await post('/api/order', { plan: 'single', topic: 'spouse_place' });
  const upd = (id, text) => ({ update_id: id, channel_post: { message_id: id, chat: { id: -1001234567890, type: 'channel', title: 'Payments' }, text } });
  await tgPost(upd(2, `BharatPe: ₹${tor.amount} received from Rahul`), hook.params.secret_token);
  assert((await post('/api/verify', { order: tor.order })).status === 202, 'unapproved channel cannot confirm payments');
  const stt = await post('/api/admin', { key: 'test-admin', action: 'tg_status' });
  assert(stt.seen.some((c) => c.id === '-1001234567890'), 'unapproved channel listed for approval');
  await post('/api/admin', { key: 'test-admin', action: 'tg_allow', chatId: '-1001234567890' });
  await tgPost(upd(3, `BharatPe: ₹${tor.amount} received from Rahul`), hook.params.secret_token);
  assert((await post('/api/verify', { order: tor.order })).token, 'approved Telegram channel post unlocks order');
  globalThis.fetch = realFetch;

  // 4) Owner unlock code
  const code = await post('/api/admin', { key: 'test-admin', action: 'code', orderId: s2.id });
  assert(code.status === 200 && (await post('/api/verify', { order: s2.order, code: code.code })).token, 'admin unlock code works');
  assert((await post('/api/admin', { key: 'nope', orderId: s2.id })).status === 401, 'admin requires key');
  console.log('all passed');
  process.exit(0);
})();
