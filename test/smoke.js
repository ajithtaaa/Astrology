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
  assert(cfg.upiId === 'ajithta855@okhdfcbank' && cfg.webhook, 'config: HDFC UPI + webhook mode');
  const chart = await post('/api/chart', self);
  assert(chart.signs && chart.signs.length === 12 && chart.lagna, 'chart endpoint');
  for (const [id, t] of Object.entries(cfg.topics)) {
    const r = await post('/api/reading', { topic: id, self, partner, question: 'എന്റെ പങ്കാളിയുടെ ജോലി എന്തായിരിക്കും?' });
    assert(t.free ? r.status === 200 && r.sections.length >= 3 : r.status === 402, `${id} ${t.free ? 'free, ' + (r.sections || []).length + ' sections' : 'requires payment'}`);
  }

  // 1) Webhook auto-match by unique amount
  const o = await post('/api/order', { plan: 'full' });
  assert(o.status === 200 && /^199\.\d\d$/.test(o.amount) && o.amount !== '199.00' && o.upi.includes('pa=ajithta855%40okhdfcbank'), `order has unique amount ₹${o.amount}`);
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

  // 3) Owner unlock code
  const code = await post('/api/admin', { key: 'test-admin', orderId: s2.id });
  assert(code.status === 200 && (await post('/api/verify', { order: s2.order, code: code.code })).token, 'admin unlock code works');
  assert((await post('/api/admin', { key: 'nope', orderId: s2.id })).status === 401, 'admin requires key');
  console.log('all passed');
  process.exit(0);
})();
