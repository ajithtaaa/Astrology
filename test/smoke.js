// End-to-end API smoke test against the local dev server (in-memory store).
process.env.PORT = process.env.PORT || '3456';
process.env.ADMIN_KEY = 'test-admin';
process.env.WEBHOOK_SECRET = 'hooksecret';
require('../dev-server');
const base = `http://localhost:${process.env.PORT}`;
const post = (p, d) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }));
const admin = (action, extra = {}) => post('/api/admin', { key: 'test-admin', action, ...extra });
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('ok -', m); };

(async () => {
  await new Promise((r) => setTimeout(r, 200));
  const self = { name: 'അജിത്', gender: 'male', dob: '1996-05-14', tob: '08:30', lat: 10.8505, lon: 76.2711, tz: 'Asia/Kolkata' };
  const partner = { name: 'മീര', dob: '1998-11-02', tob: '17:45', lat: 9.9312, lon: 76.2673, tz: 'Asia/Kolkata' };

  const cfg = await fetch(base + '/api/topics').then((r) => r.json());
  assert(cfg.upiId === 'BHARATPE2R0F0X6K4D61686@unitype' && cfg.topics.spouse_job.price === 49 && cfg.topics.spouse_nature.price === 0, 'config: BharatPe UPI, ₹49 per paid question');
  const qr = await fetch(base + '/api/topics?qr=1&download=1');
  assert(qr.status === 200 && qr.headers.get('content-type') === 'image/png' && /attachment/.test(qr.headers.get('content-disposition')), 'auto-generated QR downloadable as PNG');
  assert((await post('/api/chart', self)).signs, 'chart endpoint');

  // Sign-in
  assert((await post('/api/user', { action: 'login', name: 'A', phone: '123' })).status === 400, 'rejects bad phone');
  const login = await post('/api/user', { action: 'login', name: 'അജിത്', phone: '98765 43210' });
  assert(login.status === 200 && login.user.phone === '919876543210' && login.session, 'phone sign-in (no OTP)');
  const session = login.session;
  assert((await post('/api/user', { session: 'x.y' })).status === 401, 'forged session rejected');

  // Free + paid gating
  assert((await post('/api/reading', { topic: 'spouse_nature', self })).status === 401, 'readings need sign-in');
  const free = await post('/api/reading', { topic: 'spouse_nature', self, session });
  assert(free.status === 200 && free.sections.length >= 3 && !('disclaimer' in free), 'free reading, no disclaimer');
  assert((await post('/api/reading', { topic: 'spouse_job', self, session })).status === 402, 'paid question locked');

  // Manual payment request -> admin approves -> unlocked
  assert((await post('/api/order', { session, topic: 'spouse_job' })).status === 400, 'payer name required');
  const rq = await post('/api/order', { session, topic: 'spouse_job', payerName: 'AJITH T A' });
  assert(rq.status === 200 && rq.request.status === 'pending' && rq.request.amount === 49, 'payment request created (pending)');
  const again = await post('/api/order', { session, topic: 'spouse_job', payerName: 'AJITH TA' });
  assert(again.request.id === rq.request.id, '"already paid – name only" updates the same request');
  let dash = await admin('dashboard');
  assert(dash.stats.pending === 1 && dash.requests[0].payerName === 'AJITH TA' && dash.users[0].phone === '919876543210', 'admin sees pending request and user');
  await admin('approve', { id: rq.request.id });
  const me = await post('/api/user', { session });
  assert(me.unlocked.includes('spouse_job') && me.requests[0].status === 'approved', 'user status shows approval');
  assert((await post('/api/reading', { topic: 'spouse_job', self, session })).status === 200, 'approved question opens');
  assert((await post('/api/reading', { topic: 'spouse_place', self, session })).status === 402, 'other questions still locked');

  // Custom question
  assert((await post('/api/order', { session, topic: 'custom', payerName: 'AJITH' })).status === 400, 'custom needs a question');
  const cq = await post('/api/order', { session, topic: 'custom', payerName: 'AJITH', question: 'എന്റെ വിവാഹം എപ്പോൾ നടക്കും?' });
  assert((await post('/api/reading', { topic: 'custom', self, session, requestId: cq.request.id })).status === 402, 'custom locked until approved');
  await admin('approve', { id: cq.request.id });
  const cr = await post('/api/reading', { topic: 'custom', self, session, requestId: cq.request.id });
  assert(cr.status === 200 && cr.sections.length >= 2, 'approved custom question answered');
  const other = (await post('/api/user', { action: 'login', name: 'Xavier', phone: '9000000001' })).session;
  assert((await post('/api/reading', { topic: 'custom', self, session: other, requestId: cq.request.id })).status === 402, "another user can't read someone's custom answer");
  dash = await admin('dashboard');
  assert(dash.requests.some((r) => r.question === 'എന്റെ വിവാഹം എപ്പോൾ നടക്കും?'), 'admin sees custom questions');

  // Reject
  const rj = await post('/api/order', { session, topic: 'chovva_dosham', payerName: 'Nobody' });
  await admin('reject', { id: rj.request.id });
  assert((await post('/api/user', { session })).requests.find((r) => r.id === rj.request.id).status === 'rejected', 'rejected request visible to user');

  // Porutham after approval
  const pr = await post('/api/order', { session, topic: 'porutham', payerName: 'AJITH' });
  await admin('approve', { id: pr.request.id });
  assert((await post('/api/reading', { topic: 'porutham', self, partner, session })).status === 200, 'porutham after approval');

  // Old chats + birth details follow the phone number to any device
  await post('/api/user', { session, action: 'profile', profile: self });
  const relog = await post('/api/user', { action: 'login', name: 'അജിത്', phone: '+91 98765-43210' });
  const meAgain = await post('/api/user', { session: relog.session });
  assert(meAgain.profile && meAgain.profile.dob === self.dob && meAgain.profile.placeName === undefined || meAgain.profile.dob === self.dob, 'birth details restored for same phone');
  const hist = await post('/api/user', { session: relog.session, action: 'history' });
  assert(hist.history.length >= 4 && hist.history.some((h) => h.topic === 'custom' && h.question) && hist.history.every((h) => h.sections && h.title), `old answers available after re-login (${hist.history.length})`);
  const otherHist = await post('/api/user', { session: other, action: 'history' });
  assert(otherHist.history.length === 0, "other users don't see someone else's history");

  // Settings: per-question price + QR upload
  await admin('settings', { settings: { prices: { spouse_looks: 99 }, upiId: 'new@ybl' } });
  const cfg2 = await fetch(base + '/api/topics').then((r) => r.json());
  assert(cfg2.topics.spouse_looks.price === 99 && cfg2.topics.spouse_job.price === 49 && cfg2.upiId === 'new@ybl', 'per-question price + UPI ID change');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert((await admin('qr_upload', { dataUrl: 'data:text/html;base64,PGI+' })).status === 400, 'QR upload rejects non-images');
  await admin('qr_upload', { dataUrl: png });
  const q2 = await fetch(base + '/api/topics?qr=1');
  assert(Buffer.from(await q2.arrayBuffer()).length === 70, 'uploaded QR is served');
  // Official link is read from an uploaded QR image and used for the "open UPI app" button
  const official = 'upi://pay?pa=BHARATPE2R0F0X6K4D61686@unitype&pn=BharatPe%20Merchant&cu=INR&mc=5411&mode=02';
  const qrPng = await require('qrcode').toDataURL(official, { width: 400 });
  const up = await admin('qr_upload', { dataUrl: qrPng });
  assert(up.decoded === official, 'official UPI link decoded from uploaded PNG QR');
  const cfg3 = await fetch(base + '/api/topics').then((r) => r.json());
  assert(cfg3.upiLink === official && cfg3.upiButton === true && cfg3.upiAmount === false, 'site uses official link, button on, amount off by default');
  await admin('settings', { settings: { upiButton: false, upiAmount: true } });
  const cfg4 = await fetch(base + '/api/topics').then((r) => r.json());
  assert(cfg4.upiButton === false && cfg4.upiAmount === true, 'admin can toggle the UPI app button and amount');
  assert((await admin('settings', { settings: { upiLink: 'https://evil.example' } })).settings.upiLink === official, 'non-UPI links are rejected');
  await admin('qr_reset');
  assert((await fetch(base + '/api/topics?qr=1').then((r) => r.arrayBuffer())).byteLength > 1000, 'QR reset to auto-generated');

  // Notification feed
  const w = await post('/api/webhook?key=hooksecret', { notificationPackageName: 'com.bharatpe.app', notificationTitle: 'Payment received', notificationBody: '₹49 from AJITH' });
  assert(w.recorded && w.amount === '49', 'notification recorded in feed');
  assert((await admin('dashboard')).payments.length === 1, 'admin sees received payment');
  assert((await post('/api/webhook?key=nope', { text: 'x' })).status === 401, 'webhook needs key');
  assert((await admin('dashboard', { key: 'nope' })).status === 401, 'admin needs key');
  console.log('all passed');
  process.exit(0);
})();
