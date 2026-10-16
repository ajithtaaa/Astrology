// Users (phone + name, no OTP) and manual payment requests that the admin approves.
const crypto = require('crypto');
const store = require('./store');
const { TOPICS } = require('./reading');
const { getSettings } = require('./settings');

async function login(phone, name) {
  const now = Date.now();
  const u = (await store.get(`user/${phone}`)) || { phone, created: now, unlocked: {} };
  Object.assign(u, { name: String(name).trim().slice(0, 50), lastSeen: now });
  await store.set(`user/${phone}`, u);
  return u;
}

const getUser = (phone) => store.get(`user/${phone}`);

async function userRequests(phone) {
  const u = await getUser(phone);
  const ids = (u && u.requests) || [];
  return (await Promise.all(ids.slice(-30).map((id) => store.get(`req/${id}`)))).filter(Boolean);
}

async function createRequest(phone, { topic, payerName, question }) {
  if (!TOPICS[topic] || TOPICS[topic].free) throw new Error('invalid topic');
  const u = await getUser(phone);
  if (!u) throw new Error('not signed in');
  const s = await getSettings();
  // Re-use an open request for the same question instead of creating duplicates.
  const open = (await userRequests(phone)).find((r) => r.topic === topic && r.status === 'pending' && topic !== 'custom');
  const req = open || { id: `RQ${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`, phone, topic, created: Date.now(), status: 'pending' };
  Object.assign(req, {
    userName: u.name,
    payerName: String(payerName || '').trim().slice(0, 80),
    amount: s.prices[topic],
    question: topic === 'custom' ? String(question || '').trim().slice(0, 600) : undefined,
    updated: Date.now(),
  });
  await store.set(`req/${req.id}`, req);
  if (!open) {
    u.requests = [...(u.requests || []), req.id];
    await store.set(`user/${phone}`, u);
  }
  return req;
}

async function decide(id, approve, note) {
  const req = await store.get(`req/${id}`);
  if (!req) throw new Error('request not found');
  Object.assign(req, { status: approve ? 'approved' : 'rejected', decidedAt: Date.now(), note: String(note || '').slice(0, 200) });
  await store.set(`req/${id}`, req);
  if (approve && req.topic !== 'custom') {
    const u = await getUser(req.phone);
    if (u) { u.unlocked = { ...(u.unlocked || {}), [req.topic]: Date.now() }; await store.set(`user/${u.phone}`, u); }
  }
  return req;
}

// Can this user see this paid topic (or this approved custom question)?
async function canRead(phone, topic, requestId) {
  if (TOPICS[topic] && TOPICS[topic].free) return { ok: true };
  if (topic === 'custom') {
    const req = requestId && (await store.get(`req/${requestId}`));
    return req && req.phone === phone && req.status === 'approved' ? { ok: true, question: req.question } : { ok: false };
  }
  const u = await getUser(phone);
  return { ok: Boolean(u && u.unlocked && u.unlocked[topic]) };
}

module.exports = { login, getUser, userRequests, createRequest, decide, canRead };
