const { computeChart, RASHI, NAKSHATRA, PLANET_ML } = require('../lib/astro');
const { send, body } = require('./_util');

// Free birth-chart data for the South Indian rasi chart shown on the page.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.dob) || !/^\d{2}:\d{2}$/.test(b.tob)) return send(res, 400, { error: 'bad_birth' });
    const c = computeChart({ dob: b.dob, tob: b.tob, lat: Number(b.lat), lon: Number(b.lon), tz: b.tz });
    const SHORT = { Sun: 'സൂ', Moon: 'ച', Mars: 'കു', Mercury: 'ബു', Jupiter: 'ഗു', Venus: 'ശു', Saturn: 'മ', Rahu: 'രാ', Ketu: 'കേ' };
    const signs = Array.from({ length: 12 }, () => []);
    for (const [p, l] of Object.entries(c.planets)) signs[Math.floor(l / 30)].push(SHORT[p]);
    signs[c.lagna].unshift('ല');
    const now = new Date();
    const cur = c.dashas.find((d) => d.start <= now && d.end > now);
    send(res, 200, {
      signs,
      rashiNames: RASHI,
      lagna: RASHI[c.lagna],
      moonSign: RASHI[c.moonSign],
      nakshatra: NAKSHATRA[c.moonNak],
      dasha: cur ? `${PLANET_ML[cur.md]} ദശ – ${PLANET_ML[cur.ad]} അപഹാരം` : '',
    });
  } catch (e) {
    send(res, 400, { error: 'bad_birth' });
  }
};
