const { send } = require('./_util');

// Live place search (GeoNames via Open-Meteo, includes timezone) and reverse lookup for GPS.
module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const q = (url.searchParams.get('q') || '').trim();
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  try {
    if (q) {
      if (q.length < 2) return send(res, 200, { results: [] });
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en&format=json`);
      const j = await r.json();
      const results = (j.results || []).map((p) => ({
        name: p.name,
        region: [p.admin3, p.admin2, p.admin1].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
        country: p.country || '',
        lat: Number(p.latitude.toFixed(4)),
        lon: Number(p.longitude.toFixed(4)),
        tz: p.timezone || 'Asia/Kolkata',
      }));
      res.setHeader('Cache-Control', 'public, s-maxage=86400');
      return send(res, 200, { results });
    }
    if (Number.isFinite(lat) && Number.isFinite(lon) && url.searchParams.has('lat')) {
      const [tzRes, nameRes] = await Promise.allSettled([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=1`).then((r) => r.json()),
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${lat}&lon=${lon}`, { headers: { 'User-Agent': 'jeevithapankali-jyothisham/1.0' } }).then((r) => r.json()),
      ]);
      const tz = (tzRes.status === 'fulfilled' && tzRes.value.timezone) || 'Asia/Kolkata';
      const a = nameRes.status === 'fulfilled' ? nameRes.value.address || {} : {};
      const name = a.city || a.town || a.village || a.county || a.state_district || 'നിലവിലെ സ്ഥലം';
      return send(res, 200, { result: { name, region: [a.state_district, a.state].filter(Boolean).join(', '), country: a.country || '', lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)), tz } });
    }
    send(res, 400, { error: 'q or lat/lon required' });
  } catch (e) {
    console.error('[places]', e.message);
    send(res, 502, { error: 'lookup_failed' });
  }
};
