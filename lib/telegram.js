// Telegram bot integration: payment notifications posted to an approved chat/channel unlock orders.
const store = require('./store');
const pay = require('./pay');

const API = 'https://api.telegram.org';
const secretToken = () => pay.sign('telegram-webhook').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);

async function getConfig() {
  return (await store.get('config/telegram').catch(() => null)) || { token: '', allowed: [], seen: {} };
}
const saveConfig = (c) => store.set('config/telegram', c);

async function tg(token, method, params) {
  const r = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params || {}),
  });
  const j = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
  if (!j.ok) throw new Error(j.description || 'Telegram error');
  return j.result;
}

async function connect(token, baseUrl) {
  token = String(token || '').trim();
  if (!/^\d{5,}:[\w-]{30,}$/.test(token)) throw new Error('That does not look like a bot token from @BotFather');
  const me = await tg(token, 'getMe');
  await tg(token, 'setWebhook', {
    url: `${baseUrl}/api/telegram`,
    secret_token: secretToken(),
    allowed_updates: ['message', 'edited_message', 'channel_post', 'edited_channel_post'],
    drop_pending_updates: false,
  });
  const cfg = await getConfig();
  Object.assign(cfg, { token, bot: { id: me.id, username: me.username, name: me.first_name } });
  await saveConfig(cfg);
  return cfg;
}

async function disconnect() {
  const cfg = await getConfig();
  if (cfg.token) await tg(cfg.token, 'deleteWebhook').catch(() => {});
  await saveConfig({ token: '', allowed: cfg.allowed || [], seen: cfg.seen || {} });
}

async function status() {
  const cfg = await getConfig();
  let webhook = null;
  if (cfg.token) webhook = await tg(cfg.token, 'getWebhookInfo').catch((e) => ({ error: e.message }));
  return {
    connected: Boolean(cfg.token), bot: cfg.bot || null, allowed: cfg.allowed || [],
    seen: Object.values(cfg.seen || {}).sort((a, b) => b.at - a.at).slice(0, 20),
    webhook: webhook && { url: webhook.url, pending: webhook.pending_update_count, lastError: webhook.last_error_message || webhook.error || null },
  };
}

async function setAllowed(chatId, allow) {
  const cfg = await getConfig();
  const id = String(chatId);
  const set = new Set((cfg.allowed || []).map(String));
  if (allow) set.add(id); else set.delete(id);
  cfg.allowed = [...set];
  await saveConfig(cfg);
  return cfg.allowed;
}

// Handle one Telegram update. Returns a short description for logging.
async function handleUpdate(update) {
  const msg = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
  if (!msg || !msg.chat) return 'no message';
  const text = [msg.text, msg.caption].filter(Boolean).join('\n');
  const chat = msg.chat;
  const chatId = String(chat.id);
  const cfg = await getConfig();
  const allowed = (cfg.allowed || []).map(String).includes(chatId);
  const isPrivate = chat.type === 'private';
  const reply = (t) => (isPrivate && cfg.token ? tg(cfg.token, 'sendMessage', { chat_id: chat.id, text: t, reply_to_message_id: msg.message_id }).catch(() => {}) : null);

  if (!allowed) {
    cfg.seen = cfg.seen || {};
    cfg.seen[chatId] = { id: chatId, type: chat.type, title: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || chatId, at: Date.now(), sample: text.slice(0, 160) };
    await saveConfig(cfg);
    await reply(`This chat (id ${chatId}) is not approved yet. Approve it in the website admin panel → Telegram.`);
    return 'chat not approved';
  }
  const parsed = pay.parseCredit(text, { loose: true }); // approved chats carry forwarded payment alerts
  if (!parsed) return 'not a payment';
  const r = await pay.recordCredit({ paise: parsed.paise, utr: parsed.utr, raw: parsed.text, source: 'telegram' });
  if (!r.duplicate) await reply(r.orderId ? `✅ ₹${pay.rupees(parsed.paise)} matched order ${r.orderId}` : `ℹ️ ₹${pay.rupees(parsed.paise)} recorded – no open order with that amount`);
  return `₹${pay.rupees(parsed.paise)} order=${r.orderId || '-'}${r.duplicate ? ' (duplicate)' : ''}`;
}

module.exports = { secretToken, connect, disconnect, status, setAllowed, handleUpdate };
