// Detailed Malayalam relationship readings computed from the birth chart.
const { computeChart, transitStays, RASHI, NAKSHATRA, PLANET_ML, SIGN_LORD } = require('./astro');
const T = require('./texts');

const TOPICS = {
  spouse_nature: { title: 'ജീവിതപങ്കാളിയുടെ സ്വഭാവം', desc: 'പങ്കാളിയുടെ വ്യക്തിത്വം, മനസ്സ്, ദാമ്പത്യത്തിലെ പെരുമാറ്റം', free: true, icon: 'heart' },
  marriage_overview: { title: 'വിവാഹയോഗം – പൊതുഫലം', desc: 'നിങ്ങളുടെ ജാതകത്തിലെ ദാമ്പത്യസൂചനകൾ', free: true, icon: 'rings' },
  love_or_arranged: { title: 'പ്രണയവിവാഹമോ നിശ്ചയിച്ച വിവാഹമോ?', desc: 'എങ്ങനെ, എവിടെ വെച്ച് പരിചയപ്പെടും', free: false, icon: 'spark' },
  spouse_job: { title: 'പങ്കാളിയുടെ ജോലിയും സാമ്പത്തികനിലയും', desc: 'തൊഴിൽമേഖല, ജോലിയുടെ സ്വഭാവം, വരുമാനം', free: false, icon: 'case' },
  spouse_place: { title: 'പങ്കാളി ഏത് നാട്ടിൽ നിന്ന്?', desc: 'ദിക്ക്, ദൂരം, വിദേശബന്ധം, കുടുംബപശ്ചാത്തലം', free: false, icon: 'pin' },
  marriage_time: { title: 'വിവാഹം എപ്പോൾ നടക്കും?', desc: 'ദശാകാലവും വ്യാഴത്തിന്റെ ഗോചരവും', free: false, icon: 'clock' },
  spouse_looks: { title: 'പങ്കാളിയുടെ രൂപവും ശരീരപ്രകൃതിയും', desc: 'ഉയരം, മുഖഭാവം, വ്യക്തിപ്രഭാവം', free: false, icon: 'eye' },
  chovva_dosham: { title: 'ചൊവ്വാദോഷം ഉണ്ടോ?', desc: 'ദോഷത്തിന്റെ തീവ്രത, ദോഷഭംഗം, പരിഹാരം', free: false, icon: 'mars' },
  porutham: { title: 'വിവാഹപ്പൊരുത്തം', desc: 'പത്ത് പൊരുത്തങ്ങളും പാപസാമ്യവും', free: false, icon: 'link' },
  custom: { title: 'നിങ്ങളുടെ സ്വന്തം ചോദ്യം', desc: 'ബന്ധങ്ങളെക്കുറിച്ച് എന്തും ചോദിക്കാം', free: false, icon: 'chat' },
};

const EXALT = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6 };
const OWN = { Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10] };

const pl = (p) => PLANET_ML[p];
const GEN = { Sun: 'സൂര്യന്റെ', Moon: 'ചന്ദ്രന്റെ', Mars: 'ചൊവ്വയുടെ', Mercury: 'ബുധന്റെ', Jupiter: 'വ്യാഴത്തിന്റെ', Venus: 'ശുക്രന്റെ', Saturn: 'ശനിയുടെ', Rahu: 'രാഹുവിന്റെ', Ketu: 'കേതുവിന്റെ' };
const ORD = ['', 'ഒന്നാം', 'രണ്ടാം', 'മൂന്നാം', 'നാലാം', 'അഞ്ചാം', 'ആറാം', 'ഏഴാം', 'എട്ടാം', 'ഒമ്പതാം', 'പത്താം', 'പതിനൊന്നാം', 'പന്ത്രണ്ടാം'];
const ord = (n) => ORD[n];
const listPlanets = (arr) => (arr.length === 1 ? pl(arr[0]) : arr.slice(0, -1).map(pl).join(', ') + ' എന്നിവയും ' + pl(arr[arr.length - 1]));
const fmtMonth = (d) => `${d.getUTCFullYear()} ${T.MONTHS[d.getUTCMonth()]}`;
const sec = (h, ...p) => ({ h, p: p.flat().filter(Boolean) });

function dignity(planet, sign) {
  if (EXALT[planet] === undefined) return 'neutral';
  if (EXALT[planet] === sign) return 'exalted';
  if ((EXALT[planet] + 6) % 12 === sign) return 'debilitated';
  if (OWN[planet].includes(sign)) return 'own';
  return 'neutral';
}

// Houses aspected by a planet sitting in house h (Vedic special aspects included).
function aspects(planet, h) {
  const extra = { Jupiter: [5, 9], Saturn: [3, 10], Mars: [4, 8] }[planet] || [];
  return [7, ...extra].map((n) => ((h + n - 2) % 12) + 1);
}

function context(self) {
  const c = self.chart;
  const seventh = (c.lagna + 6) % 12;
  const l7 = c.lordOf(7);
  const h = (p) => c.houseOf(c.planets[p]);
  const s = (p) => c.signOf(c.planets[p]);
  const aspectors = ['Jupiter', 'Saturn', 'Mars'].filter((p) => h(p) !== 7 && aspects(p, h(p)).includes(7));
  const karaka = self.gender === 'female' ? 'Jupiter' : 'Venus';
  const seven = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const dk = seven.reduce((a, b) => ((c.planets[a] % 30) <= (c.planets[b] % 30) ? a : b));
  const d9Lagna = c.navamsaSign(c.asc);
  const d9Seventh = (d9Lagna + 6) % 12;
  return { c, seventh, l7, h, s, aspectors, karaka, dk, d9Seventh, name: self.name || '' };
}

const hello = (x) => (x.name ? `${x.name}, ` : '');

// ---------------------------------------------------------------- topics
function spouseNature(self) {
  const x = context(self);
  const { c, seventh, l7, h, s } = x;
  const in7 = c.planetsIn(7);
  const kSign = s(x.karaka);
  const kDig = dignity(x.karaka, kSign);
  const l7d9 = c.navamsaSign(c.planets[l7]);
  return [
    sec('ഏഴാം ഭാവം പറയുന്നത്',
      `${hello(x)}ജാതകത്തിൽ ജീവിതപങ്കാളിയെക്കുറിച്ച് ആദ്യം നോക്കുന്നത് ലഗ്നത്തിൽ നിന്നുള്ള ഏഴാം ഭാവമാണ്. നിങ്ങളുടെ ഏഴാം ഭാവം ${RASHI[seventh]} രാശിയാണ്, അതിന്റെ അധിപൻ ${pl(l7)}.`,
      T.SIGN_NATURE[seventh]),
    sec('ഏഴിലെ ഗ്രഹങ്ങളും ദൃഷ്ടികളും',
      in7.length ? in7.map((p) => T.PLANET_IN_7[p]) : 'ഏഴാം ഭാവത്തിൽ ഗ്രഹങ്ങളൊന്നും ഇല്ല. അതിനാൽ ഭാവാധിപന്റെ സ്ഥിതിയും ദൃഷ്ടികളുമാണ് പങ്കാളിയുടെ സ്വഭാവത്തിന് നിറം നൽകുന്നത്.',
      x.aspectors.map((p) => T.ASPECT_ON_7[p]),
      T.LORD_IN_HOUSE[h(l7)]),
    sec(`കളത്രകാരകൻ – ${pl(x.karaka)}`,
      `${self.gender === 'female' ? 'സ്ത്രീജാതകത്തിൽ ഭർത്താവിന്റെ കാരകനായി വ്യാഴത്തെയാണ് പരമ്പരാഗതമായി നോക്കുന്നത്' : 'പുരുഷജാതകത്തിൽ ഭാര്യയുടെ കാരകൻ ശുക്രനാണ്'}. നിങ്ങളുടെ ജാതകത്തിൽ ${pl(x.karaka)} ${RASHI[kSign]} രാശിയിൽ ${ord(h(x.karaka))} ഭാവത്തിൽ നിൽക്കുന്നു; ${T.DIGNITY_NOTE[kDig]}.`,
      kDig === 'exalted' || kDig === 'own' ? 'കാരകന് ബലമുള്ളതിനാൽ ഗുണങ്ങൾ ഏറെയുള്ള, നിങ്ങളെ മനസ്സിലാക്കുന്ന ഒരു പങ്കാളിയെ ലഭിക്കാനുള്ള യോഗം ശക്തമാണ്.'
        : kDig === 'debilitated' ? 'കാരകന് ബലം കുറവായതിനാൽ പങ്കാളിയെ തിരഞ്ഞെടുക്കുമ്പോൾ തിടുക്കം ഒഴിവാക്കണം; സ്വഭാവം നന്നായി മനസ്സിലാക്കിയ ശേഷം മാത്രം തീരുമാനമെടുക്കുക. ശുക്രപ്രീതിക്കായി വെള്ളിയാഴ്ചകളിൽ ദേവീക്ഷേത്രദർശനം ഗുണം ചെയ്യും.'
          : `${T.SIGN_SHORT[kSign]} ഉള്ള ഒരു വ്യക്തിയോടായിരിക്കും നിങ്ങൾക്ക് സ്വാഭാവികമായ ആകർഷണം തോന്നുക.`),
    sec('ദാരകാരകൻ (ജൈമിനി പദ്ധതി)',
      'ജൈമിനി മഹർഷിയുടെ പദ്ധതിയിൽ, രാശിയിലെ ഡിഗ്രി ഏറ്റവും കുറഞ്ഞ ഗ്രഹത്തെയാണ് ജീവിതപങ്കാളിയുടെ കാരകനായി (ദാരകാരകൻ) കണക്കാക്കുന്നത്.',
      T.DARAKARAKA[x.dk]),
    sec('നവാംശകത്തിലെ സൂചന',
      `വിവാഹത്തിന്റെ സൂക്ഷ്മഫലം അറിയാൻ നവാംശക ചക്രം (D9) കൂടി നോക്കണം. നവാംശകത്തിലെ ഏഴാം ഭാവം ${RASHI[x.d9Seventh]} ആണ് – ${T.SIGN_SHORT[x.d9Seventh]} ആയിരിക്കും വിവാഹശേഷം പങ്കാളിയിൽ കൂടുതൽ തെളിഞ്ഞുവരുന്ന ഗുണങ്ങൾ.`,
      `ഏഴാം ഭാവാധിപനായ ${pl(l7)} നവാംശകത്തിൽ ${RASHI[l7d9]} രാശിയിലാണ്${dignity(l7, l7d9) === 'exalted' || dignity(l7, l7d9) === 'own' ? ' – ഇത് വർഗ്ഗോത്തമത്തിന് സമാനമായ ബലം നൽകുന്ന ശുഭസ്ഥിതിയാണ്.' : dignity(l7, l7d9) === 'debilitated' ? '; ഇവിടെ ബലം കുറവായതിനാൽ ദാമ്പത്യത്തിന്റെ ആദ്യവർഷങ്ങളിൽ കൂടുതൽ ക്ഷമയും പരസ്പരധാരണയും വേണ്ടിവരും.' : ' – സാധാരണ ബലമുള്ള, ദോഷമില്ലാത്ത സ്ഥിതിയാണിത്.'}`),
    sec('ചുരുക്കത്തിൽ',
      `നിങ്ങളുടെ പങ്കാളിയിൽ പ്രധാനമായും കാണുന്നത് ${T.SIGN_SHORT[seventh]} ആണ്; ${T.SIGN_SHORT[s(x.dk)]} എന്ന ഗുണങ്ങളും ഒപ്പമുണ്ടാകും.`,
      T.ELEMENT_ADVICE[seventh % 4]),
  ];
}

function marriageOverview(self) {
  const x = context(self);
  const { c, l7, h } = x;
  const in7 = c.planetsIn(7);
  const benefic = ['Jupiter', 'Venus', 'Mercury', 'Moon'];
  let score = 0;
  in7.forEach((p) => (score += benefic.includes(p) ? 1 : -1));
  if ([1, 4, 5, 7, 9, 10, 11].includes(h(l7))) score += 1;
  if ([6, 8, 12].includes(h(l7))) score -= 1;
  if (x.aspectors.includes('Jupiter') || in7.includes('Jupiter')) score += 1;
  const kd = dignity(x.karaka, x.s(x.karaka));
  if (kd === 'exalted' || kd === 'own') score += 1;
  if (kd === 'debilitated') score -= 1;
  const verdict = score >= 2
    ? 'നിങ്ങളുടെ ജാതകത്തിൽ വിവാഹയോഗം വളരെ ശക്തമാണ്. ഗുണമുള്ള പങ്കാളിയും സന്തോഷവും ഐശ്വര്യവും നിറഞ്ഞ ദാമ്പത്യവുമാണ് ഗ്രഹനില സൂചിപ്പിക്കുന്നത്.'
    : score >= 0
      ? 'നിങ്ങളുടെ ജാതകത്തിൽ നല്ല വിവാഹയോഗമുണ്ട്. ചില ചെറിയ വെല്ലുവിളികളുണ്ടെങ്കിലും പരസ്പരധാരണയോടെ മുന്നോട്ടുപോയാൽ ദാമ്പത്യം സന്തോഷകരമായിരിക്കും.'
      : 'നിങ്ങളുടെ ജാതകത്തിൽ വിവാഹകാര്യത്തിൽ ചില തടസ്സങ്ങളോ കാലതാമസമോ കാണുന്നുണ്ട്. പേടിക്കേണ്ടതില്ല – അനുയോജ്യമായ സമയവും ശരിയായ പൊരുത്തവും നോക്കി വിവാഹം നടത്തിയാൽ ഈ ദോഷങ്ങൾ വലിയ തോതിൽ കുറയും.';
  return [
    sec('പൊതുവായ ഫലം', `${hello(x)}${verdict}`),
    sec('ഏഴാം ഭാവാധിപന്റെ സ്ഥിതി',
      `ഏഴാം ഭാവാധിപനായ ${pl(l7)} ${RASHI[x.s(l7)]} രാശിയിൽ ${ord(h(l7))} ഭാവത്തിലാണ് (${T.DIGNITY_NOTE[dignity(l7, x.s(l7))]}).`,
      T.LORD_IN_HOUSE[h(l7)]),
    sec('ഏഴാം ഭാവത്തിലെ സ്വാധീനങ്ങൾ',
      in7.length ? `ഏഴാം ഭാവത്തിൽ ${listPlanets(in7)} നിൽക്കുന്നു. ഇത് പങ്കാളിയുടെ സ്വഭാവത്തെയും വിവാഹസമയത്തെയും നേരിട്ട് സ്വാധീനിക്കും.` : 'ഏഴാം ഭാവത്തിൽ ഗ്രഹങ്ങളില്ല – പുറമേ നിന്നുള്ള തടസ്സങ്ങൾ കുറഞ്ഞ, ശാന്തമായ ഒരു കളത്രസ്ഥാനമാണിത്.',
      x.aspectors.map((p) => T.ASPECT_ON_7[p])),
    sec('കൂടുതൽ അറിയാൻ',
      'പങ്കാളിയുടെ ജോലി, നാട്, രൂപം, പ്രണയവിവാഹമാണോ എന്നത്, വിവാഹം നടക്കാൻ സാധ്യതയുള്ള വർഷങ്ങൾ എന്നിവ താഴെയുള്ള വിശദ ചോദ്യങ്ങളിൽ ജാതകം ആധാരമാക്കി വിശദമായി പറഞ്ഞുതരാം.'),
  ];
}

function loveOrArranged(self) {
  const x = context(self);
  const { c, h, s } = x;
  const l5 = c.lordOf(5);
  const l7 = x.l7;
  let score = 0;
  const reasons = [];
  if (h(l5) === 7) { score += 2; reasons.push(`അഞ്ചാം ഭാവാധിപനായ ${pl(l5)} ഏഴാം ഭാവത്തിൽ – പ്രണയം വിവാഹത്തിലെത്തുന്നതിന്റെ ഏറ്റവും വ്യക്തമായ സൂചനകളിലൊന്ന്.`); }
  if (h(l7) === 5) { score += 2; reasons.push(`ഏഴാം ഭാവാധിപനായ ${pl(l7)} അഞ്ചാം ഭാവത്തിൽ (പ്രണയസ്ഥാനം).`); }
  if (l5 !== l7 && s(l5) === s(l7)) { score += 2; reasons.push('അഞ്ചാം ഭാവാധിപനും ഏഴാം ഭാവാധിപനും ഒരേ രാശിയിൽ യോഗം ചെയ്യുന്നു.'); }
  if (h(l5) === 1 || h(l7) === 1) { score += 1; reasons.push('പ്രണയ/കളത്ര ഭാവാധിപന്മാരിൽ ഒരാൾ ലഗ്നത്തിൽ – സ്വന്തം ഇഷ്ടത്തിന് പ്രാധാന്യം.'); }
  if (s('Venus') === s('Mars')) { score += 1; reasons.push('ശുക്രനും ചൊവ്വയും ഒരേ രാശിയിൽ – ശക്തമായ പരസ്പര ആകർഷണത്തിന്റെ സൂചന.'); }
  if (s('Venus') === s('Rahu')) { score += 1; reasons.push('ശുക്രനോടൊപ്പം രാഹു – പതിവുരീതികൾക്ക് പുറത്തുള്ള പ്രണയബന്ധത്തിന്റെ സൂചന.'); }
  if ([5, 7].includes(h('Rahu'))) { score += 1; reasons.push(`രാഹു ${ord(h('Rahu'))} ഭാവത്തിൽ – കുടുംബത്തിന്റെ പതിവുവഴികളിൽ നിന്ന് മാറിയുള്ള തിരഞ്ഞെടുപ്പ്.`); }
  if ([5, 7].includes(h('Venus'))) { score += 1; reasons.push(`ശുക്രൻ ${ord(h('Venus'))} ഭാവത്തിൽ – പ്രണയജീവിതം സജീവമായിരിക്കും.`); }
  if (s('Moon') === s('Venus')) { score += 1; reasons.push('ചന്ദ്രനും ശുക്രനും ഒരേ രാശിയിൽ – വൈകാരികമായ പ്രണയത്തിന്റെ സൂചന.'); }
  if (x.aspectors.includes('Jupiter') || c.planetsIn(7).includes('Jupiter')) { score -= 1; reasons.push('വ്യാഴത്തിന്റെ ദൃഷ്ടി/സാന്നിധ്യം ഏഴിൽ – മുതിർന്നവരുടെ അനുഗ്രഹത്തോടെയുള്ള വിവാഹത്തിന്റെ സൂചന.'); }
  if (h('Saturn') === 7 || x.aspectors.includes('Saturn')) { score -= 1; reasons.push('ശനിയുടെ സ്വാധീനം ഏഴിൽ – പരമ്പരാഗത രീതിയിലുള്ള, ആലോചിച്ചുറപ്പിക്കുന്ന വിവാഹം.'); }

  const verdict = score >= 3
    ? ['പ്രണയവിവാഹം', 'നിങ്ങളുടെ ജാതകത്തിൽ പ്രണയവിവാഹത്തിനുള്ള യോഗം ശക്തമാണ്. നിങ്ങൾ സ്വയം കണ്ടെത്തി മനസ്സുകൊണ്ട് ഇഷ്ടപ്പെടുന്ന ഒരാളെ ജീവിതപങ്കാളിയാക്കാനാണ് കൂടുതൽ സാധ്യത. തുടക്കത്തിൽ വീട്ടുകാരെ ബോധ്യപ്പെടുത്താൻ അൽപ്പം സമയമെടുത്തേക്കാമെങ്കിലും, ക്ഷമയോടെ കാത്തിരുന്നാൽ അനുഗ്രഹം ലഭിക്കും.']
    : score >= 1
      ? ['പ്രണയവും നിശ്ചയവും ചേർന്നത്', 'നിങ്ങളുടെ ജാതകം "ലവ്-കം-അറേഞ്ച്ഡ്" രീതിയിലുള്ള വിവാഹമാണ് കാണിക്കുന്നത്. പരിചയപ്പെട്ട് ഇഷ്ടം തോന്നുന്ന ഒരാളുമായി, ഇരു കുടുംബങ്ങളുടെയും സമ്മതത്തോടെ, ആഘോഷമായി വിവാഹം നടക്കാനാണ് സാധ്യത. ചിലപ്പോൾ വീട്ടുകാർ കൊണ്ടുവരുന്ന ആലോചനയിലെ വ്യക്തിയോട് പിന്നീട് പ്രണയം വളരാനും ഇടയുണ്ട്.']
      : ['കുടുംബം നിശ്ചയിക്കുന്ന വിവാഹം', 'നിങ്ങളുടെ ജാതകം പ്രധാനമായും കുടുംബം ആലോചിച്ചുറപ്പിക്കുന്ന വിവാഹമാണ് സൂചിപ്പിക്കുന്നത്. മാതാപിതാക്കളുടെയും ബന്ധുക്കളുടെയും സഹായത്തോടെ, ജാതകപ്പൊരുത്തം നോക്കി, അനുയോജ്യമായ പങ്കാളിയെ കണ്ടെത്താനാണ് സാധ്യത. വിവാഹശേഷം ഈ ബന്ധത്തിൽ സ്നേഹം ആഴത്തിൽ വളരും.'];

  const meetHouse = h(l7);
  return [
    sec(`ഫലം: ${verdict[0]}`, `${hello(x)}${verdict[1]}`),
    sec('എന്തുകൊണ്ട് ഇങ്ങനെ പറയുന്നു?',
      'പ്രണയത്തിന്റെ ഭാവമായ അഞ്ചാം ഭാവവും വിവാഹത്തിന്റെ ഭാവമായ ഏഴാം ഭാവവും തമ്മിലുള്ള ബന്ധമാണ് ഇവിടെ പ്രധാനമായും നോക്കുന്നത്. നിങ്ങളുടെ ജാതകത്തിൽ കണ്ട സൂചനകൾ:',
      reasons.length ? '• ' + reasons.join('\n• ') : '• അഞ്ചാം ഭാവവും ഏഴാം ഭാവവും തമ്മിൽ നേരിട്ടുള്ള ബന്ധം കാണുന്നില്ല; അതിനാൽ പരമ്പരാഗത രീതിക്കാണ് മുൻതൂക്കം.'),
    sec('എങ്ങനെ പരിചയപ്പെടാനാണ് സാധ്യത?',
      `ഏഴാം ഭാവാധിപൻ ${ord(meetHouse)} ഭാവത്തിൽ നിൽക്കുന്നതിനാൽ, ${T.MEET_BY_HOUSE[meetHouse]} ആയിരിക്കും പങ്കാളിയുമായുള്ള ആദ്യ ബന്ധം രൂപപ്പെടുക.`),
    sec('ശ്രദ്ധിക്കാൻ',
      score >= 1 ? 'പ്രണയബന്ധത്തിൽ ആണെങ്കിൽ, വീട്ടുകാരോട് സത്യസന്ധമായി കാര്യം അവതരിപ്പിക്കുക. ജാതകപ്പൊരുത്തം കൂടി നോക്കുന്നത് കുടുംബത്തിന്റെ ആശങ്ക കുറയ്ക്കാനും സഹായിക്കും.'
        : 'വീട്ടുകാർ ആലോചന കൊണ്ടുവരുമ്പോൾ, പങ്കാളിയുമായി നേരിട്ട് സംസാരിച്ച് മനസ്സ് മനസ്സിലാക്കാൻ മടിക്കേണ്ടതില്ല. ഇരുവരുടെയും ഇഷ്ടം കൂടി ചേരുമ്പോഴാണ് ബന്ധം പൂർണ്ണമാകുന്നത്.'),
  ];
}

function spouseJob(self) {
  const x = context(self);
  const { c, h } = x;
  const l4 = c.lordOf(4); // 10th from the 7th
  const in4 = c.planetsIn(4);
  const signifiers = [...new Set([...in4, l4, x.l7])];
  const l4h = h(l4);
  const sign4 = (c.lagna + 3) % 12;
  const l8 = c.lordOf(8); // 2nd from the 7th: spouse's wealth
  const l8d = dignity(l8, x.s(l8));
  const nature = [0, 3, 6, 9].includes(sign4) ? 'മാറ്റങ്ങളും യാത്രകളും ഉള്ള, ചലനാത്മകമായ ജോലി' : [1, 4, 7, 10].includes(sign4) ? 'ഒരിടത്ത് സ്ഥിരമായി ഇരുന്നു ചെയ്യുന്ന, ദീർഘകാല സ്ഥിരതയുള്ള ജോലി' : 'രണ്ടു മേഖലകൾ ഒരുമിച്ച് കൈകാര്യം ചെയ്യുന്നതോ, ജോലിയോടൊപ്പം മറ്റൊരു വരുമാനമാർഗ്ഗമുള്ളതോ ആയ തൊഴിൽ';
  return [
    sec('എങ്ങനെയാണ് നോക്കുന്നത്',
      `${hello(x)}പങ്കാളിയുടെ തൊഴിൽ അറിയാൻ ഏഴാം ഭാവത്തിൽ നിന്നുള്ള പത്താം ഭാവമാണ് നോക്കുന്നത് – അതായത് നിങ്ങളുടെ ജാതകത്തിലെ നാലാം ഭാവം. നിങ്ങൾക്ക് ഇത് ${RASHI[sign4]} രാശിയാണ്; അധിപൻ ${pl(l4)}.`),
    sec('ഏറ്റവും സാധ്യതയുള്ള തൊഴിൽമേഖലകൾ',
      `${T.PLANET_JOBS[signifiers[0]]}.`,
      signifiers[1] && `ഇതോടൊപ്പം ${GEN[signifiers[1]]} സ്വാധീനത്താൽ ഈ മേഖലകൾക്കും സാധ്യതയുണ്ട്: ${T.PLANET_JOBS[signifiers[1]]}.`,
      in4.length && `നാലാം ഭാവത്തിൽ ${listPlanets(in4)} ഉള്ളതിനാൽ ${in4.length > 1 ? 'ഈ ഗ്രഹങ്ങളുടെ' : 'ഈ ഗ്രഹത്തിന്റെ'} മേഖലകൾക്ക് പ്രത്യേക പ്രാധാന്യമുണ്ട്.`),
    sec('ജോലിയുടെ സ്വഭാവം',
      `പങ്കാളിക്ക് ${nature} ആകാനാണ് സാധ്യത.`,
      [1, 4, 7, 10].includes(l4h) ? 'നാലാം ഭാവാധിപൻ കേന്ദ്രത്തിൽ നിൽക്കുന്നതിനാൽ സ്ഥിരതയുള്ള, സമൂഹത്തിൽ അംഗീകാരമുള്ള ജോലി ലഭിക്കും – സർക്കാർ ജോലിക്കോ വലിയ സ്ഥാപനങ്ങളിലെ ഉദ്യോഗത്തിനോ നല്ല സാധ്യതയുണ്ട്.'
        : [3, 6, 11].includes(l4h) ? 'നാലാം ഭാവാധിപൻ ഉപചയസ്ഥാനത്ത് നിൽക്കുന്നതിനാൽ സ്വന്തം പരിശ്രമത്തിലൂടെ പടിപടിയായി ഉയരുന്ന പങ്കാളിയായിരിക്കും; സ്വന്തമായി ബിസിനസ് തുടങ്ങാനുള്ള കഴിവും ഉണ്ടാകും.'
          : [9, 12].includes(l4h) ? 'നാലാം ഭാവാധിപൻ ഒമ്പതിലോ പന്ത്രണ്ടിലോ നിൽക്കുന്നതിനാൽ പങ്കാളിയുടെ ജോലി ദൂരസ്ഥലത്തോ വിദേശത്തോ (ഗൾഫ് ഉൾപ്പെടെ) ആകാനുള്ള സാധ്യത ശക്തമാണ്.'
            : 'പങ്കാളിയുടെ തൊഴിൽജീവിതത്തിൽ തുടക്കത്തിൽ ചില മാറ്റങ്ങൾ ഉണ്ടാകാം; ഏകദേശം 30 വയസ്സിനോടടുത്ത് സ്ഥിരത കൈവരിക്കും.'),
    sec('പങ്കാളിയുടെ സാമ്പത്തികനില',
      `പങ്കാളിയുടെ ധനസ്ഥിതി ഏഴിൽ നിന്നുള്ള രണ്ടാം ഭാവത്തിൽ (നിങ്ങളുടെ എട്ടാം ഭാവം) നിന്നാണ് നോക്കുന്നത്. അതിന്റെ അധിപനായ ${pl(l8)} ${T.DIGNITY_NOTE[l8d]}.`,
      l8d === 'exalted' || l8d === 'own' ? 'നല്ല സാമ്പത്തികശേഷിയുള്ള കുടുംബത്തിൽ നിന്നുള്ള, സ്വന്തമായി നന്നായി സമ്പാദിക്കുന്ന പങ്കാളിയെയാണ് ഇത് കാണിക്കുന്നത്.'
        : l8d === 'debilitated' ? 'പങ്കാളിയുടെ സാമ്പത്തികനില വിവാഹസമയത്ത് ഇടത്തരമായിരിക്കാം; എന്നാൽ വിവാഹശേഷം ഒരുമിച്ചുള്ള പരിശ്രമത്തിലൂടെ മെച്ചപ്പെടും.'
          : 'ഇടത്തരം മുതൽ നല്ല നിലവരെയുള്ള സാമ്പത്തികസ്ഥിതിയുള്ള പങ്കാളിയായിരിക്കും; വിവാഹശേഷം വരുമാനം ക്രമേണ വർദ്ധിക്കും.'),
  ];
}

function spousePlace(self) {
  const x = context(self);
  const { c, seventh, l7, h, s } = x;
  const l7sign = s(l7);
  const mod = l7sign % 3;
  const foreign = [9, 12].includes(h(l7)) || h('Rahu') === 7 || c.planetsIn(12).includes(l7);
  const l10 = c.lordOf(10); // 4th from the 7th: spouse's home
  const l10d = dignity(l10, s(l10));
  return [
    sec('ദിക്ക്',
      `${hello(x)}ഏഴാം ഭാവം ${RASHI[seventh]} രാശിയായതിനാൽ, നിങ്ങൾ ജനിച്ച സ്ഥലത്തു നിന്ന് ${T.SIGN_DIRECTION[seventh % 4]} ദിക്കിൽ നിന്നായിരിക്കും പങ്കാളി വരാൻ കൂടുതൽ സാധ്യത.`,
      l7sign % 4 !== seventh % 4 && `ഏഴാം ഭാവാധിപനായ ${pl(l7)} ${RASHI[l7sign]} രാശിയിൽ ആയതിനാൽ ${T.SIGN_DIRECTION[l7sign % 4]} ദിക്കിനും രണ്ടാമത്തെ സാധ്യതയുണ്ട്.`),
    sec('എത്ര ദൂരെ നിന്ന്?',
      mod === 0 ? `ഏഴാം ഭാവാധിപൻ ചരരാശിയിൽ (${RASHI[l7sign]}) നിൽക്കുന്നത് ദൂരത്തെ സൂചിപ്പിക്കുന്നു. മറ്റൊരു ജില്ലയിൽ നിന്നോ മറ്റൊരു സംസ്ഥാനത്തു നിന്നോ ഉള്ള പങ്കാളിക്കാണ് സാധ്യത.`
        : mod === 1 ? `ഏഴാം ഭാവാധിപൻ സ്ഥിരരാശിയിൽ (${RASHI[l7sign]}) നിൽക്കുന്നത് അടുപ്പത്തെ സൂചിപ്പിക്കുന്നു. അടുത്ത നാട്ടിൽ നിന്നോ, ബന്ധുക്കൾക്കും പരിചയക്കാർക്കും അറിയാവുന്ന കുടുംബത്തിൽ നിന്നോ ആകാനാണ് സാധ്യത – ഏകദേശം 50 കിലോമീറ്ററിനുള്ളിൽ.`
          : `ഏഴാം ഭാവാധിപൻ ഉഭയരാശിയിൽ (${RASHI[l7sign]}) നിൽക്കുന്നത് ഇടത്തരം ദൂരത്തെ സൂചിപ്പിക്കുന്നു – ഒരേ ജില്ലയിലോ തൊട്ടടുത്ത ജില്ലയിലോ ഉള്ള പങ്കാളി.`,
      [1, 2, 4].includes(h(l7)) && 'ഭാവാധിപൻ ലഗ്നത്തോട് അടുത്ത ഭാവങ്ങളിൽ നിൽക്കുന്നതിനാൽ പങ്കാളിയുടെ കുടുംബം നിങ്ങളുടെ കുടുംബത്തിന് മുൻപരിചയമുള്ളവരാകാനും ഇടയുണ്ട്.'),
    sec('വിദേശബന്ധം',
      foreign ? 'നിങ്ങളുടെ ജാതകത്തിൽ വിദേശബന്ധമുള്ള പങ്കാളിക്കുള്ള സൂചനകൾ വ്യക്തമാണ്. വിദേശത്ത് (പ്രത്യേകിച്ച് ഗൾഫ്, യൂറോപ്പ്, അമേരിക്ക) ജോലി ചെയ്യുന്ന ആളോ, വിവാഹശേഷം നിങ്ങളെയും കൂട്ടി വിദേശത്തേക്ക് പോകുന്ന ആളോ ആകാൻ സാധ്യതയുണ്ട്.'
        : 'ജാതകത്തിൽ ശക്തമായ വിദേശയോഗം കാണുന്നില്ല. പങ്കാളി നാട്ടിൽ തന്നെയോ ഇന്ത്യയ്ക്കുള്ളിലോ ആയിരിക്കാനാണ് സാധ്യത; ജോലിസംബന്ധമായ ചെറിയ കാലയളവിലെ വിദേശവാസം ഒഴിവാക്കാനാവില്ലെങ്കിലും.'),
    sec('പങ്കാളിയുടെ നാടും വീടും',
      `ഏഴാം ഭാവത്തിന്റെ സ്വഭാവമനുസരിച്ച് പങ്കാളിയുടെ നാട് ${T.SIGN_PLACE_TYPE[seventh % 4]} ആകാനാണ് സാധ്യത.`,
      `പങ്കാളിയുടെ വീടും കുടുംബപശ്ചാത്തലവും ഏഴിൽ നിന്നുള്ള നാലാം ഭാവത്തിൽ (നിങ്ങളുടെ പത്താം ഭാവം) നിന്നാണ് നോക്കുന്നത്. അതിന്റെ അധിപനായ ${pl(l10)} ${T.DIGNITY_NOTE[l10d]}; ${l10d === 'exalted' || l10d === 'own' ? 'സമൂഹത്തിൽ മാന്യതയും നല്ല വീടും ഉള്ള കുടുംബമായിരിക്കും.' : l10d === 'debilitated' ? 'സാധാരണക്കാരായ, എന്നാൽ അധ്വാനശീലമുള്ള കുടുംബമായിരിക്കും.' : 'ഇടത്തരം, സംസ്കാരമുള്ള ഒരു കുടുംബമായിരിക്കും.'}`),
  ];
}

function marriageTime(self) {
  const x = context(self);
  const { c, l7, h } = x;
  const keys = new Set(['Venus', l7, x.dk, ...c.planetsIn(7)]);
  if (x.aspectors.includes('Jupiter')) keys.add('Jupiter');
  const birthDate = new Date(c.birthUtc);
  const now = new Date();
  const age = (d) => (d - birthDate) / (365.25 * 86400000);
  const inRange = c.dashas.filter((d) => d.end > now && age(d.start) < 42 && age(d.end) > 20);
  // Antardasha of a marriage significator is the sharper timer; fall back to the mahadasha.
  let windows = inRange.filter((d) => keys.has(d.ad) && d.ad !== d.md || (keys.has(d.ad) && keys.has(d.md)));
  if (!windows.length) windows = inRange.filter((d) => keys.has(d.md));
  const current = c.dashas.find((d) => d.start <= now && d.end > now);
  const why = (w) => {
    const r = [];
    for (const p of [w.md, w.ad]) {
      if (p === 'Venus') r.push('ശുക്രൻ – വിവാഹകാരകൻ');
      else if (p === l7) r.push(`${pl(p)} – ഏഴാം ഭാവാധിപൻ`);
      else if (p === x.dk) r.push(`${pl(p)} – ദാരകാരകൻ`);
      else if (c.planetsIn(7).includes(p)) r.push(`${pl(p)} – ഏഴിൽ നിൽക്കുന്ന ഗ്രഹം`);
      else if (p === 'Jupiter' && keys.has('Jupiter')) r.push('വ്യാഴം – ഏഴിലേക്ക് ദൃഷ്ടി');
    }
    return [...new Set(r)].join(', ');
  };
  // Jupiter's transit over the 7th from Lagna or from the Moon.
  const seventhFromLagna = (c.lagna + 6) % 12;
  const seventhFromMoon = (c.moonSign + 6) % 12;
  // Jupiter in the 7th, or in the 1st/3rd/11th from where it aspects the 7th.
  const aspecting = [c.lagna, (c.lagna + 2) % 12, (c.lagna + 10) % 12];
  const jup = transitStays('Jupiter', now, 84).filter((t) => [seventhFromLagna, seventhFromMoon, ...aspecting].includes(t.sign));
  const jupLines = jup.slice(0, 4).map((t) => {
    const what = t.sign === seventhFromLagna ? 'ഏഴാം ഭാവത്തിലൂടെ' : t.sign === seventhFromMoon ? 'ചന്ദ്രന്റെ ഏഴിലൂടെ' : 'ഏഴാം ഭാവത്തിലേക്ക് ദൃഷ്ടിയോടെ';
    return `${fmtMonth(t.start)} – ${fmtMonth(t.end)}: വ്യാഴം ${RASHI[t.sign]} രാശിയിൽ (${what})`;
  });
  const lateSigns = h('Saturn') === 7 || l7 === 'Saturn' || x.aspectors.includes('Saturn');
  return [
    sec('ഇപ്പോഴത്തെ ദശാകാലം',
      current ? `${hello(x)}ഇപ്പോൾ നിങ്ങൾക്ക് ${pl(current.md)} ദശയിൽ ${pl(current.ad)} അപഹാരമാണ് നടക്കുന്നത് (${fmtMonth(current.start)} മുതൽ ${fmtMonth(current.end)} വരെ).` : '',
      `വിംശോത്തരി ദശാപദ്ധതിയിൽ വിവാഹം നടക്കുന്നത് സാധാരണയായി ശുക്രൻ, ഏഴാം ഭാവാധിപൻ (${pl(l7)}), ദാരകാരകൻ (${pl(x.dk)}), ഏഴിൽ നിൽക്കുന്ന ഗ്രഹങ്ങൾ എന്നിവയുടെ ദശയിലോ അപഹാരത്തിലോ ആണ്.`),
    sec('വിവാഹത്തിന് അനുകൂലമായ കാലഘട്ടങ്ങൾ',
      windows.length ? '• ' + windows.slice(0, 5).map((w) => `${fmtMonth(w.start > now ? w.start : now)} – ${fmtMonth(w.end)}: ${pl(w.md)} ദശ, ${pl(w.ad)} അപഹാരം (${why(w)})`).join('\n• ')
        : 'അടുത്ത വർഷങ്ങളിൽ വിവാഹത്തെ നേരിട്ട് സൂചിപ്പിക്കുന്ന ദശാ-അപഹാരങ്ങൾ കുറവാണ്. അതിനാൽ ഗോചരഫലവും പൊരുത്തവും നോക്കി, മുഹൂർത്തം നിശ്ചയിക്കുന്നതാണ് ഉചിതം.',
      windows.length && `ഇവയിൽ ആദ്യത്തെ രണ്ട് കാലഘട്ടങ്ങൾക്കാണ് കൂടുതൽ പ്രാധാന്യം; ആലോചനകൾ സജീവമാക്കാൻ ഏറ്റവും നല്ല സമയവും അതുതന്നെ.`),
    sec('വ്യാഴത്തിന്റെ ഗോചരം',
      'ദശ അനുകൂലമായാലും, വ്യാഴം ഏഴാം ഭാവത്തിലൂടെയോ ചന്ദ്രന്റെ ഏഴിലൂടെയോ സഞ്ചരിക്കുന്ന സമയത്താണ് വിവാഹം യാഥാർത്ഥ്യമാകാൻ ഏറ്റവും സാധ്യത.',
      jupLines.length ? '• ' + jupLines.join('\n• ') : 'അടുത്ത ഏഴു വർഷത്തിനുള്ളിൽ വ്യാഴം ഏഴാം ഭാവത്തിലൂടെ കടന്നുപോകുന്നില്ല; ദശാകാലത്തിനാണ് ഇവിടെ കൂടുതൽ പ്രാധാന്യം.',
      'ദശാകാലവും വ്യാഴഗോചരവും ഒരുമിച്ച് വരുന്ന മാസങ്ങളാണ് ഏറ്റവും ശക്തമായ വിവാഹസമയം.'),
    sec('കാലതാമസത്തിന്റെ സൂചനകൾ',
      lateSigns ? 'ശനിയുടെ സ്വാധീനം ഏഴാം ഭാവത്തിൽ ഉള്ളതിനാൽ വിവാഹം അൽപ്പം വൈകി (സാധാരണയായി 28 വയസ്സിന് ശേഷം) നടക്കാനാണ് സാധ്യത. ഇത് ദോഷമല്ല – വൈകി നടക്കുന്ന ഈ വിവാഹം കൂടുതൽ സ്ഥിരതയുള്ളതായിരിക്കും. ശനിയാഴ്ചകളിൽ ശാസ്താക്ഷേത്രദർശനം ഗുണം ചെയ്യും.'
        : 'ശക്തമായ കാലതാമസയോഗങ്ങൾ ജാതകത്തിൽ കാണുന്നില്ല. മുകളിൽ പറഞ്ഞ കാലഘട്ടങ്ങളിൽ ആത്മാർത്ഥമായി ശ്രമിച്ചാൽ വിവാഹം തടസ്സമില്ലാതെ നടക്കും.'),
  ];
}

function spouseLooks(self) {
  const x = context(self);
  const { c, seventh, l7, s } = x;
  const l7sign = s(l7);
  const in7 = c.planetsIn(7);
  const build = [0, 4, 8].includes(seventh % 12) || [0, 4, 8].includes(l7sign) ? 'ഊർജ്ജസ്വലവും ആത്മവിശ്വാസം നിറഞ്ഞതുമായ' : [1, 5, 9].includes(seventh) ? 'ഒതുക്കമുള്ളതും ദൃഢവുമായ' : [2, 6, 10].includes(seventh) ? 'ഉയരവും ചടുലതയുമുള്ള' : 'മൃദുവും ആകർഷകവുമായ';
  return [
    sec('ഏഴാം ഭാവം സൂചിപ്പിക്കുന്ന രൂപം',
      `${hello(x)}ഏഴാം ഭാവം ${RASHI[seventh]} ആയതിനാൽ പങ്കാളിക്ക് ഉണ്ടാകാവുന്ന ശാരീരിക സവിശേഷതകൾ ഇങ്ങനെയാണ്: ${T.SIGN_LOOKS[seventh]}`),
    sec('ഭാവാധിപന്റെ സ്വാധീനം',
      l7sign !== seventh ? `ഏഴാം ഭാവാധിപനായ ${pl(l7)} ${RASHI[l7sign]} രാശിയിൽ ആയതിനാൽ ഈ സവിശേഷതകളും കലർന്നുകാണാം: ${T.SIGN_LOOKS[l7sign]}` : `ഏഴാം ഭാവാധിപൻ സ്വന്തം രാശിയിൽ തന്നെ ആയതിനാൽ മുകളിൽ പറഞ്ഞ സവിശേഷതകൾ കൂടുതൽ വ്യക്തമായി പങ്കാളിയിൽ കാണാം.`),
    sec('ഗ്രഹങ്ങൾ നൽകുന്ന പ്രത്യേകതകൾ',
      in7.includes('Venus') || in7.includes('Moon') ? 'ഏഴാം ഭാവത്തിലെ ശുഭഗ്രഹങ്ങൾ കാരണം പങ്കാളി ആദ്യകാഴ്ചയിൽ തന്നെ ആകർഷിക്കുന്ന രൂപഭംഗിയുള്ള ആളായിരിക്കും.' : '',
      in7.includes('Jupiter') ? 'വ്യാഴത്തിന്റെ സാന്നിധ്യം കാരണം ഐശ്വര്യവും പ്രസന്നതയും നിറഞ്ഞ മുഖമായിരിക്കും.' : '',
      in7.includes('Saturn') ? 'ശനിയുടെ സ്വാധീനം കാരണം പങ്കാളി പ്രായത്തിൽ മുതിർന്നതായോ ഗൗരവഭാവമുള്ളതായോ തോന്നാം.' : '',
      in7.includes('Mars') ? 'ചൊവ്വയുടെ സ്വാധീനം കാരണം കായികക്ഷമതയുള്ള, ഉറച്ച ശരീരപ്രകൃതി പ്രതീക്ഷിക്കാം.' : '',
      in7.includes('Rahu') ? 'രാഹുവിന്റെ സ്വാധീനം കാരണം ഫാഷനിലും സ്റ്റൈലിലും വ്യത്യസ്തത പുലർത്തുന്ന ആളായിരിക്കും.' : '',
      `മൊത്തത്തിൽ, ${build} ഒരു വ്യക്തിപ്രഭാവമാണ് നിങ്ങളുടെ പങ്കാളിക്ക് ഉണ്ടാകുക.`),
    sec('ഓർക്കുക', 'രൂപം ജനിതകവും കുടുംബപരവുമായ ഘടകങ്ങളെക്കൂടി ആശ്രയിച്ചിരിക്കുന്നതിനാൽ, ഇവ പൊതുവായ സൂചനകൾ മാത്രമാണ്. സ്വഭാവവും പൊരുത്തവുമാണ് ദാമ്പത്യത്തിൽ കൂടുതൽ പ്രധാനം.'),
  ];
}

function chovvaFrom(c, refSign) {
  const h = ((c.signOf(c.planets.Mars) - refSign + 12) % 12) + 1;
  return [2, 4, 7, 8, 12].includes(h) ? h : 0;
}

function chovvaDosham(self) {
  const x = context(self);
  const c = x.c;
  const marsSign = c.signOf(c.planets.Mars);
  const fromLagna = chovvaFrom(c, c.lagna);
  const fromMoon = chovvaFrom(c, c.moonSign);
  const fromVenus = chovvaFrom(c, c.signOf(c.planets.Venus));
  const count = [fromLagna, fromMoon, fromVenus].filter(Boolean).length;
  const cancels = [];
  if ([0, 7, 9].includes(marsSign)) cancels.push('ചൊവ്വ സ്വക്ഷേത്രത്തിലോ ഉച്ചത്തിലോ നിൽക്കുന്നു.');
  if (x.s('Jupiter') === marsSign) cancels.push('വ്യാഴം ചൊവ്വയോടൊപ്പം നിൽക്കുന്നു.');
  else if (aspects('Jupiter', x.h('Jupiter')).includes(x.h('Mars'))) cancels.push('ചൊവ്വയുടെ മേൽ വ്യാഴത്തിന്റെ ദൃഷ്ടിയുണ്ട്.');
  const hm = fromLagna;
  if ((hm === 2 && [2, 5].includes(marsSign)) || (hm === 4 && [0, 7].includes(marsSign)) || (hm === 7 && [3, 9].includes(marsSign))
    || (hm === 8 && [8, 11].includes(marsSign)) || (hm === 12 && [1, 6].includes(marsSign))) {
    cancels.push(`${ord(hm)} ഭാവത്തിൽ ${RASHI[marsSign]} രാശിയിലെ ചൊവ്വയ്ക്ക് ശാസ്ത്രം പ്രത്യേക ഇളവ് നൽകുന്നു.`);
  }
  const verdict = !count ? 'നിങ്ങളുടെ ജാതകത്തിൽ ചൊവ്വാദോഷം ഇല്ല. ഇതുമായി ബന്ധപ്പെട്ട് യാതൊരു ആശങ്കയും വേണ്ട.'
    : cancels.length ? 'ചൊവ്വാദോഷം കാണുന്നുണ്ടെങ്കിലും, താഴെ പറയുന്ന കാരണങ്ങളാൽ അതിന് വലിയ തോതിൽ ദോഷഭംഗം (പരിഹാരം) ഉണ്ട്. അതിനാൽ അമിതമായി ആശങ്കപ്പെടേണ്ടതില്ല.'
      : count === 1 ? 'നേരിയ ചൊവ്വാദോഷം കാണുന്നു. ഇത് ഗൗരവമുള്ളതല്ല; സമാനമായ ദോഷമുള്ള ജാതകവുമായി ചേർത്താൽ (പാപസാമ്യം) പൂർണ്ണമായും പരിഹരിക്കപ്പെടും.'
        : 'ചൊവ്വാദോഷം വ്യക്തമായി കാണുന്നു. പൊരുത്തം നോക്കുമ്പോൾ പങ്കാളിയുടെ ജാതകത്തിലും സമാനമായ ദോഷം (പാപസാമ്യം) ഉണ്ടോ എന്ന് നിർബന്ധമായും പരിശോധിക്കണം.';
  return [
    sec('ചൊവ്വയുടെ സ്ഥാനം',
      `${hello(x)}ചൊവ്വ നിങ്ങളുടെ ജാതകത്തിൽ ${RASHI[marsSign]} രാശിയിലാണ്. കേരളീയ സമ്പ്രദായത്തിൽ ലഗ്നം, ചന്ദ്രൻ, ശുക്രൻ എന്നീ മൂന്നിടങ്ങളിൽ നിന്നും 2, 4, 7, 8, 12 ഭാവങ്ങളിൽ ചൊവ്വ നിൽക്കുന്നുണ്ടോ എന്നാണ് നോക്കുന്നത്.`,
      '• ' + [
        fromLagna ? `ലഗ്നത്തിൽ നിന്ന് ${ord(fromLagna)} ഭാവം – ദോഷമുണ്ട്` : 'ലഗ്നത്തിൽ നിന്ന് – ദോഷമില്ല',
        fromMoon ? `ചന്ദ്രനിൽ നിന്ന് ${ord(fromMoon)} ഭാവം – ദോഷമുണ്ട്` : 'ചന്ദ്രനിൽ നിന്ന് – ദോഷമില്ല',
        fromVenus ? `ശുക്രനിൽ നിന്ന് ${ord(fromVenus)} ഭാവം – ദോഷമുണ്ട്` : 'ശുക്രനിൽ നിന്ന് – ദോഷമില്ല',
      ].join('\n• ')),
    sec('ഫലം', verdict),
    count && cancels.length ? sec('ദോഷഭംഗത്തിന്റെ കാരണങ്ങൾ', '• ' + cancels.join('\n• ')) : null,
    count ? sec('പരിഹാരങ്ങൾ',
      'പാപസാമ്യമുള്ള ജാതകവുമായി വിവാഹം നിശ്ചയിക്കുന്നതാണ് ഏറ്റവും നല്ല പരിഹാരം.',
      'ചൊവ്വാഴ്ച വ്രതം, സുബ്രഹ്മണ്യസ്വാമി ക്ഷേത്രദർശനം, "ഓം ശരവണഭവായ നമഃ" ജപം എന്നിവ പരമ്പരാഗതമായി നിർദ്ദേശിക്കപ്പെടുന്നു.',
      'വിവാഹത്തിനു മുമ്പ് ഒരു ജ്യോതിഷിയുടെ സഹായത്തോടെ ഇരുജാതകങ്ങളും വിശദമായി പരിശോധിക്കുക.') : null,
  ].filter(Boolean);
}

// ---------------------------------------------------------------- porutham
const GANA = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0];
const GANA_ML = ['ദേവഗണം', 'മനുഷ്യഗണം', 'അസുരഗണം'];
const YONI = ['horse', 'elephant', 'sheep', 'serpent', 'serpent', 'dog', 'cat', 'sheep', 'cat', 'rat', 'rat', 'cow', 'buffalo', 'tiger', 'buffalo', 'tiger', 'deer', 'deer', 'dog', 'monkey', 'mongoose', 'monkey', 'lion', 'horse', 'lion', 'cow', 'elephant'];
const YONI_ENEMY = [['horse', 'buffalo'], ['elephant', 'lion'], ['sheep', 'monkey'], ['serpent', 'mongoose'], ['dog', 'deer'], ['cat', 'rat'], ['cow', 'tiger']];
const RAJJU = [0, 1, 2, 3, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0];
const RAJJU_ML = ['പാദരജ്ജു', 'ഊരുരജ്ജു', 'നാഭിരജ്ജു', 'കണ്ഠരജ്ജു', 'ശിരോരജ്ജു'];
const VEDHA = [[0, 17], [1, 16], [2, 15], [3, 14], [5, 21], [6, 20], [7, 19], [8, 18], [9, 26], [10, 25], [11, 24], [12, 23], [4, 13], [13, 22], [4, 22]];
const VASHYA = { 0: [4, 7], 1: [3, 6], 2: [5], 3: [7, 8], 4: [6], 5: [2, 11], 6: [5, 9], 7: [3], 8: [11], 9: [0, 10], 10: [0], 11: [9] };
const ENEMIES = { Sun: ['Venus', 'Saturn'], Moon: [], Mars: ['Mercury'], Mercury: ['Moon'], Jupiter: ['Mercury', 'Venus'], Venus: ['Sun', 'Moon'], Saturn: ['Sun', 'Moon', 'Mars'] };

function porutham(self, partner) {
  const girl = self.gender === 'female' ? self : partner;
  const boy = self.gender === 'female' ? partner : self;
  const gN = girl.chart.moonNak, bN = boy.chart.moonNak, gR = girl.chart.moonSign, bR = boy.chart.moonSign;
  const cnt = ((bN - gN + 27) % 27) + 1;
  const rcnt = ((bR - gR + 12) % 12) + 1;
  const res = [];
  const add = (name, ok, note, detail) => res.push({ name, ok, note, detail });

  add('ദിനപ്പൊരുത്തം', [0, 2, 4, 6, 8].includes(cnt % 9), 'ആരോഗ്യവും ദീർഘായുസ്സും', `വധുവിന്റെ നക്ഷത്രം മുതൽ വരന്റെ നക്ഷത്രം വരെ ${cnt} എണ്ണം.`);
  const ga = GANA[gN], gb = GANA[bN];
  add('ഗണപ്പൊരുത്തം', ga === gb || (ga !== 2 && gb !== 2), 'സ്വഭാവചേർച്ച', `വധു ${GANA_ML[ga]}, വരൻ ${GANA_ML[gb]}.`);
  const ya = YONI[gN], yb = YONI[bN];
  add('യോനിപ്പൊരുത്തം', !YONI_ENEMY.some(([a, b]) => (a === ya && b === yb) || (a === yb && b === ya)), 'ശാരീരികവും മാനസികവുമായ ഐക്യം', '');
  add('രാശിപ്പൊരുത്തം', ![2, 6, 8, 12].includes(rcnt), 'വംശവൃദ്ധിയും സന്തോഷവും', `വധുവിന്റെ കൂറ് മുതൽ വരന്റെ കൂറ് വരെ ${rcnt}.`);
  const la = SIGN_LORD[gR], lb = SIGN_LORD[bR];
  add('രാശ്യാധിപപ്പൊരുത്തം', la === lb || (!ENEMIES[la].includes(lb) && !ENEMIES[lb].includes(la)), 'സന്താനഭാഗ്യവും ഐശ്വര്യവും', `${pl(la)} – ${pl(lb)}.`);
  add('വശ്യപ്പൊരുത്തം', gR === bR || VASHYA[gR].includes(bR) || VASHYA[bR].includes(gR), 'പരസ്പര ആകർഷണം', '');
  add('മാഹേന്ദ്രപ്പൊരുത്തം', [4, 7, 10, 13, 16, 19, 22, 25].includes(cnt), 'സമ്പത്തും സന്താനങ്ങളും', '');
  add('സ്ത്രീദീർഘപ്പൊരുത്തം', cnt > 13, 'ഐശ്വര്യവും സൗഭാഗ്യവും', '');
  add('രജ്ജുപ്പൊരുത്തം', RAJJU[gN] !== RAJJU[bN], 'ദാമ്പത്യത്തിന്റെ ദീർഘായുസ്സ് (പ്രധാനം)', `വധു ${RAJJU_ML[RAJJU[gN]]}, വരൻ ${RAJJU_ML[RAJJU[bN]]}.`);
  add('വേധപ്പൊരുത്തം', !VEDHA.some(([a, b]) => (a === gN && b === bN) || (a === bN && b === gN)), 'ദുരിതങ്ങളിൽ നിന്നുള്ള സംരക്ഷണം (പ്രധാനം)', '');

  const good = res.filter((r) => r.ok).length;
  const essentialOk = res[8].ok && res[9].ok;
  const d1 = [chovvaFrom(self.chart, self.chart.lagna), chovvaFrom(self.chart, self.chart.moonSign)].filter(Boolean).length;
  const d2 = [chovvaFrom(partner.chart, partner.chart.lagna), chovvaFrom(partner.chart, partner.chart.moonSign)].filter(Boolean).length;
  const verdict = !essentialOk ? 'രജ്ജു അല്ലെങ്കിൽ വേധ പൊരുത്തം ഇല്ല. കേരളീയ സമ്പ്രദായത്തിൽ ഇവ രണ്ടും ഏറ്റവും പ്രധാനമായി കണക്കാക്കുന്നതിനാൽ, ഈ ആലോചനയുമായി മുന്നോട്ടു പോകും മുമ്പ് ഒരു ജ്യോതിഷിയെക്കൊണ്ട് ഇരുജാതകങ്ങളും വിശദമായി പരിശോധിപ്പിക്കുന്നത് ഉചിതമാണ്.'
    : good >= 7 ? 'ഉത്തമമായ പൊരുത്തമാണ്. പ്രധാന പൊരുത്തങ്ങളെല്ലാം ഉള്ള ഈ ബന്ധം സന്തോഷകരവും ഐശ്വര്യപൂർണ്ണവുമായ ദാമ്പത്യത്തിന് വളരെ അനുകൂലമാണ്.'
      : good >= 5 ? 'മധ്യമമായ പൊരുത്തമാണ്. അനിവാര്യമായ രജ്ജുവും വേധവും ഉള്ളതിനാൽ ഈ വിവാഹം ധൈര്യമായി ആലോചിക്കാവുന്നതാണ്.'
        : 'പൊരുത്തം കുറവാണ്. പ്രധാന പൊരുത്തങ്ങൾ ഉണ്ടെങ്കിലും, ഗ്രഹനില കൂടി ചേർത്ത് വിശദമായി പരിശോധിച്ച ശേഷം മാത്രം തീരുമാനമെടുക്കുക.';
  return [
    sec('നക്ഷത്രങ്ങൾ',
      `വധു (${girl.name || 'വധു'}): ${NAKSHATRA[gN]} നക്ഷത്രം, ${RASHI[gR]} കൂറ്\nവരൻ (${boy.name || 'വരൻ'}): ${NAKSHATRA[bN]} നക്ഷത്രം, ${RASHI[bR]} കൂറ്`),
    { h: 'പത്ത് പൊരുത്തങ്ങൾ', table: res.map((r) => ({ ok: r.ok, name: r.name, note: r.note, detail: r.detail })), p: [`ആകെ പൊരുത്തം: 10-ൽ ${good}`] },
    sec('വിലയിരുത്തൽ', verdict),
    sec('പാപസാമ്യം (ചൊവ്വാദോഷം)',
      d1 && d2 ? 'രണ്ട് ജാതകങ്ങളിലും ചൊവ്വാദോഷം ഉള്ളതിനാൽ പാപസാമ്യം ഉണ്ട് – ഇത് അനുകൂലമാണ്.'
        : d1 || d2 ? 'ഒരു ജാതകത്തിൽ മാത്രം ചൊവ്വാദോഷം കാണുന്നു. മറ്റ് പാപഗ്രഹങ്ങളുടെ സ്ഥിതി കൂടി ചേർത്ത് പാപസാമ്യം വിശദമായി പരിശോധിക്കേണ്ടതാണ്.'
          : 'രണ്ട് ജാതകങ്ങളിലും ചൊവ്വാദോഷം ഇല്ല – ഈ വിഷയത്തിൽ ആശങ്കയ്ക്ക് വകയില്ല.'),
  ];
}

function customFallback(self, question) {
  const q = question || '';
  const map = [
    [/ജോലി|തൊഴിൽ|ഉദ്യോഗ|ശമ്പള|വരുമാന|job|career|salary/i, spouseJob],
    [/എപ്പോൾ|സമയം|വയസ്സ്|വർഷ|when|time|age/i, marriageTime],
    [/പ്രണയ|ലവ്|love|arrange|നിശ്ചയ|ഇഷ്ട/i, loveOrArranged],
    [/സ്ഥലം|ദിക്ക്|നാട്|ദൂര|വിദേശ|ഗൾഫ്|place|abroad|foreign/i, spousePlace],
    [/രൂപ|സൗന്ദര്യ|ഉയരം|കാണാൻ|look|appearance/i, spouseLooks],
    [/ചൊവ്വ|ദോഷ|dosh/i, chovvaDosham],
  ];
  for (const [re, fn] of map) if (re.test(q)) return fn(self);
  return [...spouseNature(self).slice(0, 2), ...marriageOverview(self).slice(0, 2)];
}

function localReading(topic, self, partner, question) {
  switch (topic) {
    case 'spouse_nature': return spouseNature(self);
    case 'marriage_overview': return marriageOverview(self);
    case 'love_or_arranged': return loveOrArranged(self);
    case 'spouse_job': return spouseJob(self);
    case 'spouse_place': return spousePlace(self);
    case 'marriage_time': return marriageTime(self);
    case 'spouse_looks': return spouseLooks(self);
    case 'chovva_dosham': return chovvaDosham(self);
    case 'porutham': return porutham(self, partner);
    case 'custom': return customFallback(self, question);
    default: throw new Error('unknown topic');
  }
}

function chartSummary(c) {
  return [
    `ലഗ്നം: ${RASHI[c.lagna]}`,
    `കൂറ്: ${RASHI[c.moonSign]}`,
    `നക്ഷത്രം: ${NAKSHATRA[c.moonNak]}`,
    `ഏഴാം ഭാവം: ${RASHI[(c.lagna + 6) % 12]}`,
  ];
}

module.exports = { TOPICS, computeChart, chartSummary, localReading };
