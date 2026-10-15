// Sidereal (Lahiri) Vedic chart calculation built on astronomy-engine.
const A = require('astronomy-engine');

const RASHI = ['മേടം', 'ഇടവം', 'മിഥുനം', 'കർക്കടകം', 'ചിങ്ങം', 'കന്നി', 'തുലാം', 'വൃശ്ചികം', 'ധനു', 'മകരം', 'കുംഭം', 'മീനം'];
const NAKSHATRA = ['അശ്വതി', 'ഭരണി', 'കാർത്തിക', 'രോഹിണി', 'മകയിരം', 'തിരുവാതിര', 'പുണർതം', 'പൂയം', 'ആയില്യം', 'മകം', 'പൂരം', 'ഉത്രം', 'അത്തം', 'ചിത്തിര', 'ചോതി', 'വിശാഖം', 'അനിഴം', 'തൃക്കേട്ട', 'മൂലം', 'പൂരാടം', 'ഉത്രാടം', 'തിരുവോണം', 'അവിട്ടം', 'ചതയം', 'പൂരുരുട്ടാതി', 'ഉത്രട്ടാതി', 'രേവതി'];
const PLANET_ML = { Sun: 'സൂര്യൻ', Moon: 'ചന്ദ്രൻ', Mars: 'ചൊവ്വ', Mercury: 'ബുധൻ', Jupiter: 'വ്യാഴം', Venus: 'ശുക്രൻ', Saturn: 'ശനി', Rahu: 'രാഹു', Ketu: 'കേതു' };
// Lord of each sign, Aries..Pisces
const SIGN_LORD = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
// Vimshottari order starting from Ashwini's lord (Ketu)
const DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
const DASHA_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };

const norm = (x) => ((x % 360) + 360) % 360;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// Lahiri ayanamsa against the mean equinox of date (good to a few arc-minutes).
function lahiri(yearFrac) {
  return 23.853 + 0.0139694 * (yearFrac - 2000);
}

// Convert local birth date/time in an IANA zone to a UTC Date.
function localToUtc(dob, tob, tz) {
  const [y, m, d] = dob.split('-').map(Number);
  const [hh, mm] = tob.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = (ts) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ts));
    const g = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour, +g.minute, +g.second) - ts;
  };
  let ts = guess - offset(guess);
  ts = guess - offset(ts);
  return new Date(ts);
}

function computeChart({ dob, tob, lat, lon, tz }) {
  const date = localToUtc(dob, tob, tz || 'Asia/Kolkata');
  const t = A.MakeTime(date);
  const yearFrac = 2000 + t.tt / 365.25;
  const ayDate = lahiri(yearFrac);
  const ayJ2000 = 23.853; // sidereal frame expressed against the fixed J2000 equinox

  const planets = {};
  for (const body of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']) {
    const vec = body === 'Moon' ? A.GeoMoon(t) : A.GeoVector(body, t, true);
    planets[body] = norm(A.Ecliptic(vec).elon - ayJ2000);
  }
  const T = t.tt / 36525;
  const rahuTropical = 125.0445479 - 1934.1362891 * T;
  planets.Rahu = norm(rahuTropical - ayDate);
  planets.Ketu = norm(planets.Rahu + 180);

  // Ascendant (tropical, of date) from local sidereal time and obliquity.
  const eps = rad(23.4392911 - 0.0130042 * T);
  const ramc = rad(norm(A.SiderealTime(t) * 15 + lon));
  const phi = rad(lat);
  const ascTrop = norm(deg(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)))));
  const asc = norm(ascTrop - ayDate);

  const lagna = Math.floor(asc / 30);
  const signOf = (l) => Math.floor(l / 30);
  const houseOf = (l) => ((signOf(l) - lagna + 12) % 12) + 1;
  const planetsIn = (house) => Object.keys(planets).filter((p) => houseOf(planets[p]) === house);
  const lordOf = (house) => SIGN_LORD[(lagna + house - 1) % 12];
  const navamsaSign = (l) => Math.floor(norm(l) / (30 / 9)) % 12;

  const moonNak = Math.floor(planets.Moon / (360 / 27));
  const dashas = vimshottari(planets.Moon, date);

  return {
    birthUtc: date.toISOString(),
    asc, lagna, planets, signOf, houseOf, planetsIn, lordOf, navamsaSign,
    moonSign: signOf(planets.Moon),
    moonNak,
    dashas,
  };
}

// Mahadasha + antardasha list from birth.
function vimshottari(moonLon, birthDate) {
  const span = 360 / 27;
  const nak = Math.floor(moonLon / span);
  const frac = (moonLon % span) / span;
  const startIdx = nak % 9;
  const YEAR_MS = 365.2425 * 86400000;
  const out = [];
  let cursor = birthDate.getTime() - frac * DASHA_YEARS[DASHA_ORDER[startIdx]] * YEAR_MS;
  for (let i = 0; i < 18; i++) {
    const md = DASHA_ORDER[(startIdx + i) % 9];
    const mdLen = DASHA_YEARS[md] * YEAR_MS;
    let sub = cursor;
    for (let j = 0; j < 9; j++) {
      const ad = DASHA_ORDER[(startIdx + i + j) % 9];
      const adLen = (mdLen * DASHA_YEARS[ad]) / 120;
      out.push({ md, ad, start: new Date(sub), end: new Date(sub + adLen) });
      sub += adLen;
    }
    cursor += mdLen;
  }
  return out;
}

module.exports = { computeChart, RASHI, NAKSHATRA, PLANET_ML, SIGN_LORD, localToUtc };
