// End-to-end smoke test against the API handlers using the local dev server.
process.env.PORT = process.env.PORT || '3456';
process.env.ADMIN_KEY = 'test-admin';
require('../dev-server');
const base = `http://localhost:${process.env.PORT}`;
const post = (p, d) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('ok -', m); };

(async () => {
  await new Promise((r) => setTimeout(r, 200));
  const self = { name: 'Test', gender: 'male', dob: '1996-05-14', tob: '08:30', lat: 10.8505, lon: 76.2711, tz: 'Asia/Kolkata' };
  const partner = { name: 'P', dob: '1998-11-02', tob: '17:45', lat: 9.9312, lon: 76.2673, tz: 'Asia/Kolkata' };
  const topics = (await fetch(base + '/api/topics').then((r) => r.json())).topics;
  for (const [id, t] of Object.entries(topics)) {
    const r = await post('/api/reading', { topic: id, self, partner, question: 'എന്റെ പങ്കാളിയുടെ ജോലി എന്തായിരിക്കും?' });
    assert(t.free ? r.status === 200 && r.paragraphs.length : r.status === 402, `${id} ${t.free ? 'free reading' : 'requires payment'}`);
  }
  const o = await post('/api/order', { plan: 'full' });
  assert(o.status === 200 && o.upi.includes('pa=ajithta855%40oksbi') && o.qr.includes('<svg'), 'order creates UPI link + QR');
  assert((await post('/api/verify', { order: o.order, utr: '123' })).status === 400, 'rejects bad UTR');
  const forged = o.order.split('.')[0] + '.xxx';
  assert((await post('/api/verify', { order: forged, utr: '412345678901' })).status === 400, 'rejects forged order');
  const v = await post('/api/verify', { order: o.order, utr: '412345678901' });
  assert(v.status === 200 && v.token, 'valid UTR unlocks (auto mode)');
  for (const id of Object.keys(topics).filter((k) => !topics[k].free)) {
    const r = await post('/api/reading', { topic: id, self, partner, question: 'എന്റെ വിവാഹം എപ്പോൾ നടക്കും?', token: v.token });
    assert(r.status === 200 && r.paragraphs.length, `${id} unlocked`);
    if (process.env.SHOW) console.log(r.paragraphs.join('\n') + '\n');
  }
  const s = await post('/api/order', { plan: 'single', topic: 'spouse_job' });
  const sv = await post('/api/verify', { order: s.order, utr: '412345678902' });
  assert((await post('/api/reading', { topic: 'spouse_place', self, token: sv.token })).status === 402, 'single token limited to its topic');
  const code = await post('/api/admin', { key: 'test-admin', orderId: s.id });
  assert(code.status === 200 && (await post('/api/verify', { order: s.order, code: code.code })).token, 'admin unlock code works');
  assert((await post('/api/admin', { key: 'nope', orderId: s.id })).status === 401, 'admin requires key');
  console.log('all passed');
  process.exit(0);
})();
