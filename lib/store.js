// Tiny JSON key-value store: Vercel Blob (private) in production, memory locally.
const memory = new Map();
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const PREFIX = 'jp/';

async function blobApi() {
  return require('@vercel/blob');
}

async function get(key) {
  if (!useBlob) return memory.has(key) ? JSON.parse(memory.get(key)) : null;
  const { get: bget } = await blobApi();
  try {
    const r = await bget(PREFIX + key + '.json', { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await new Response(r.stream).text());
  } catch (e) {
    if (e && e.name === 'BlobNotFoundError') return null;
    throw e;
  }
}

async function set(key, value) {
  if (!useBlob) { memory.set(key, JSON.stringify(value)); return; }
  const { put } = await blobApi();
  await put(PREFIX + key + '.json', JSON.stringify(value), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60,
  });
}

// Create only if absent (or if the existing record is expired). Returns true when created.
async function claim(key, value, isExpired) {
  if (!useBlob) {
    if (memory.has(key) && !isExpired(JSON.parse(memory.get(key)))) return false;
    memory.set(key, JSON.stringify(value));
    return true;
  }
  const { put } = await blobApi();
  try {
    await put(PREFIX + key + '.json', JSON.stringify(value), {
      access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json', cacheControlMaxAge: 60,
    });
    return true;
  } catch {
    const existing = await get(key);
    if (existing && !isExpired(existing)) return false;
    await set(key, value);
    return true;
  }
}

module.exports = { get, set, claim, persistent: useBlob };
