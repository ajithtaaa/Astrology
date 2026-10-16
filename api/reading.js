const { TOPICS, computeChart, chartSummary, localReading } = require('../lib/reading');
const { phoneFromSession } = require('../lib/pay');
const accounts = require('../lib/accounts');
const soma = require('../lib/soma');
const { send, body } = require('./_util');

const SOMA_QUESTIONS = {
  spouse_nature: 'എന്റെ ഭാവി ജീവിതപങ്കാളിയുടെ സ്വഭാവവും വ്യക്തിത്വവും എങ്ങനെയായിരിക്കും?',
  marriage_overview: 'എന്റെ ജാതകത്തിലെ വിവാഹയോഗവും ദാമ്പത്യജീവിതവും എങ്ങനെയായിരിക്കും?',
  love_or_arranged: 'എനിക്ക് പ്രണയവിവാഹമാണോ അതോ വീട്ടുകാർ നിശ്ചയിക്കുന്ന വിവാഹമാണോ നടക്കാൻ സാധ്യത? കാരണങ്ങൾ സഹിതം പറയുക.',
  spouse_job: 'എന്റെ ഭാവി ജീവിതപങ്കാളിയുടെ ജോലി അല്ലെങ്കിൽ തൊഴിൽമേഖല എന്തായിരിക്കും?',
  spouse_place: 'എന്റെ ഭാവി ജീവിതപങ്കാളി ഏത് ദിക്കിൽ നിന്ന്, എത്ര ദൂരെ നിന്നായിരിക്കും? വിദേശബന്ധം ഉണ്ടോ?',
  marriage_time: 'എന്റെ വിവാഹം ഏത് കാലഘട്ടത്തിൽ നടക്കാനാണ് സാധ്യത? ദശാകാലങ്ങൾ അനുസരിച്ച് വിശദീകരിക്കുക.',
  spouse_looks: 'എന്റെ ഭാവി ജീവിതപങ്കാളിയുടെ രൂപവും ശരീരപ്രകൃതിയും എങ്ങനെയായിരിക്കും?',
  chovva_dosham: 'എന്റെ ജാതകത്തിൽ ചൊവ്വാദോഷം ഉണ്ടോ? ഉണ്ടെങ്കിൽ അതിന്റെ ഫലവും പരിഹാരവും എന്താണ്?',
};

function validBirth(b) {
  return b && /^\d{4}-\d{2}-\d{2}$/.test(b.dob) && /^\d{2}:\d{2}$/.test(b.tob)
    && Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lon)) && typeof b.tz === 'string';
}

function person(p) {
  const birth = { dob: p.dob, tob: p.tob, lat: Number(p.lat), lon: Number(p.lon), tz: p.tz };
  return { ...p, birth, chart: computeChart(birth) };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  let input;
  try {
    input = await body(req);
  } catch {
    return send(res, 400, { error: 'bad json' });
  }
  const { topic, self, partner, session, requestId } = input;
  let { question } = input;
  const meta = TOPICS[topic];
  if (!meta) return send(res, 400, { error: 'unknown topic' });
  if (!validBirth(self)) return send(res, 400, { error: 'bad_birth' });
  if (topic === 'porutham' && !validBirth(partner)) return send(res, 400, { error: 'bad_partner' });
  const phone = phoneFromSession(session);
  if (!phone) return send(res, 401, { error: 'signin_required' });
  const access = await accounts.canRead(phone, topic, requestId);
  if (!access.ok) return send(res, 402, { error: 'payment_required' });
  if (topic === 'custom') question = access.question;

  try {
    const me = person(self);
    const other = topic === 'porutham' ? person({ ...partner, gender: me.gender === 'female' ? 'male' : 'female' }) : null;
    let sections = localReading(topic, me, other, question);
    let source = 'local';

    if (soma.enabled()) {
      try {
        let answer;
        if (topic === 'porutham') {
          answer = await soma.compatibility(me.birth, other.birth);
          answer = await soma.askSoma(`ഈ പൊരുത്തപരിശോധനാഫലം ലളിതമായ മലയാളത്തിൽ വിശദീകരിക്കുക:\n${answer}`, me.birth).catch(() => answer);
        } else {
          const q = topic === 'custom' ? String(question).slice(0, 500) : SOMA_QUESTIONS[topic];
          answer = await soma.askSoma(q, me.birth);
        }
        if (answer) {
          const soma = { h: 'വിശദ വിശകലനം', p: answer.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean) };
          sections = topic === 'custom' ? [soma, ...sections] : [...sections, soma];
          source = 'soma';
        }
      } catch (e) {
        console.warn('[soma] falling back to local engine:', e.message);
      }
    }

    const result = { topic, title: meta.title, summary: chartSummary(me.chart), sections, partnerName: other ? other.name || '' : undefined, question: topic === 'custom' ? question : undefined };
    await accounts.saveHistory(phone, result).catch((e) => console.error('[history]', e.message));
    send(res, 200, {
      topic,
      title: meta.title,
      summary: chartSummary(me.chart),
      name: me.name || '',
      sections,
      source,
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'server_error' });
  }
};
