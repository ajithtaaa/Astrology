// Users (phone + name, no OTP) and manual payment requests that the admin approves.
const crypto = require('crypto');
const store = require('./store');
const { TOPICS } = require('./reading');
const { getSettings } = require('./settings');

async function login(phone, name) {
  const now = Date.now();
  const u = (await store.get(`user/${phone}`)) || { phone, created: now, unlocked: {} };
  Object.assign(u, { name: String(name).trim().slice(0, 50), lastSeen: now, logins: (u.logins || 0) + 1, visits: (u.visits || 0) + 1 });
  await store.set(`user/${phone}`, u);
  return u;
}

const getUser = (phone) => store.get(`user/${phone}`);

// Count a visit when a signed-in user comes back after 30+ minutes away.
async function touch(u) {
  const now = Date.now();
  if (now - (u.lastSeen || 0) < 30 * 60 * 1000) return u;
  Object.assign(u, { lastSeen: now, visits: (u.visits || 0) + 1 });
  await store.set(`user/${u.phone}`, u);
  return u;
}

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

// Birth details, so the same phone number sees its chart on any device.
async function saveProfile(phone, p) {
  const u = await getUser(phone);
  if (!u) return null;
  const pick = (k, max = 80) => String(p[k] ?? '').slice(0, max);
  u.profile = {
    name: pick('name', 50), gender: p.gender === 'female' ? 'female' : 'male', dob: pick('dob', 10), tob: pick('tob', 5),
    lat: Number(p.lat), lon: Number(p.lon), tz: pick('tz', 60), placeName: pick('placeName'), region: pick('region'), country: pick('country'),
  };
  await store.set(`user/${phone}`, u);
  return u.profile;
}

// Every answer shown to a user is kept so it can be seen again later ("old chats").
async function saveHistory(phone, item) {
  const at = Date.now();
  const id = `${at.toString(36)}${crypto.randomBytes(2).toString('hex')}`;
  await store.set(`hist/${phone}/${id}`, { id, at, ...item });
  return id;
}
async function history(phone, limit = 60) {
  const items = await store.list(`hist/${phone}/`, limit);
  return items.sort((a, b) => a.at - b.at);
}

module.exports = { login, getUser, touch, userRequests, createRequest, decide, canRead, saveProfile, saveHistory, history };
