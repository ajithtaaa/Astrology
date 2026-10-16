// Read the payment link (upi://pay?...) out of an uploaded QR image (PNG or JPEG).
const jsQR = require('jsqr');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

function decodeQr(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/(png|jpe?g);base64,(.+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  let img;
  try {
    img = m[1] === 'png' ? PNG.sync.read(buf) : jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 256 });
  } catch {
    return null;
  }
  const code = jsQR(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.length), img.width, img.height, { inversionAttempts: 'attemptBoth' });
  return code && code.data ? code.data.trim() : null;
}

module.exports = { decodeQr };
