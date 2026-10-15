// Built-in Malayalam relationship readings computed from the birth chart.
const { computeChart, RASHI, NAKSHATRA, PLANET_ML, SIGN_LORD } = require('./astro');
const T = require('./texts');

const TOPICS = {
  spouse_nature: { title: 'ജീവിതപങ്കാളിയുടെ സ്വഭാവം', free: true },
  marriage_overview: { title: 'വിവാഹയോഗം – പൊതുഫലം', free: true },
  love_or_arranged: { title: 'പ്രണയവിവാഹമോ നിശ്ചയിച്ച വിവാഹമോ?', free: false },
  spouse_job: { title: 'പങ്കാളിയുടെ ജോലി / തൊഴിൽമേഖല', free: false },
  spouse_place: { title: 'പങ്കാളി ഏത് ദിക്കിൽ നിന്ന്, എത്ര ദൂരെ നിന്ന്?', free: false },
  marriage_time: { title: 'വിവാഹം എപ്പോൾ നടക്കും?', free: false },
  spouse_looks: { title: 'പങ്കാളിയുടെ രൂപവും ശരീരപ്രകൃതിയും', free: false },
  chovva_dosham: { title: 'ചൊവ്വാദോഷം ഉണ്ടോ?', free: false },
  porutham: { title: 'വിവാഹപ്പൊരുത്തം (നക്ഷത്രപ്പൊരുത്തം)', free: false },
  custom: { title: 'നിങ്ങളുടെ സ്വന്തം ചോദ്യം', free: false },
};

const pl = (p) => PLANET_ML[p];
const listPlanets = (arr) => (arr.length === 1 ? pl(arr[0]) : arr.slice(0, -1).map(pl).join(', ') + ', ' + pl(arr[arr.length - 1]));
const fmtMonth = (d) => `${d.getUTCFullYear()} ${T.MONTHS[d.getUTCMonth()]}`;

function chartSummary(c) {
  const sevenSign = (c.lagna + 6) % 12;
  return [
    `ലഗ്നം: ${RASHI[c.lagna]}`,
    `ചന്ദ്രരാശി (കൂറ്): ${RASHI[c.moonSign]}`,
    `ജന്മനക്ഷത്രം: ${NAKSHATRA[c.moonNak]}`,
    `ഏഴാം ഭാവം (കളത്രസ്ഥാനം): ${RASHI[sevenSign]}`,
    `ഏഴാം ഭാവാധിപൻ: ${pl(c.lordOf(7))}`,
  ];
}

function spouseNature(c) {
  const seventh = (c.lagna + 6) % 12;
  const lord = c.lordOf(7);
  const in7 = c.planetsIn(7);
  const out = [`നിങ്ങളുടെ ഏഴാം ഭാവം ${RASHI[seventh]} രാശിയാണ്. അതിനാൽ നിങ്ങളുടെ ജീവിതപങ്കാളി ${T.SIGN_NATURE[seventh]}`];
  for (const p of in7) out.push(T.PLANET_IN_7[p]);
  const lordHouse = c.houseOf(c.planets[lord]);
  out.push(`ഏഴാം ഭാവാധിപനായ ${pl(lord)} ${lordHouse}-ാം ഭാവത്തിൽ നിൽക്കുന്നു. ${lordHouseNote(lordHouse)}`);
  const venusSign = c.signOf(c.planets.Venus);
  out.push(`പ്രണയത്തിന്റെ കാരകനായ ശുക്രൻ ${RASHI[venusSign]} രാശിയിലാണ്; അതിനാൽ ബന്ധങ്ങളിൽ നിങ്ങൾ ${venusNote(venusSign)}`);
  return out;
}

function lordHouseNote(h) {
  const notes = {
    1: 'പങ്കാളിയുമായി ശക്തമായ ആത്മബന്ധം ഉണ്ടാകും; പങ്കാളി നിങ്ങളോട് ഏറെ അടുപ്പം പുലർത്തും.',
    2: 'വിവാഹശേഷം കുടുംബത്തിന്റെ സാമ്പത്തികനില മെച്ചപ്പെടാൻ സാധ്യതയുണ്ട്.',
    3: 'പങ്കാളി ധൈര്യശാലിയും ആശയവിനിമയത്തിൽ മിടുക്കുള്ളതുമായ വ്യക്തിയായിരിക്കും.',
    4: 'പങ്കാളി കുടുംബസ്നേഹമുള്ളതും വീടിന് പ്രാധാന്യം നൽകുന്നതുമായ വ്യക്തിയായിരിക്കും.',
    5: 'പ്രണയത്തിനും പരസ്പര ആകർഷണത്തിനും ബന്ധത്തിൽ വലിയ പങ്കുണ്ടാകും.',
    6: 'ദാമ്പത്യത്തിൽ ചെറിയ അഭിപ്രായഭിന്നതകൾ ഉണ്ടാകാം; ക്ഷമയും പരസ്പരധാരണയും ആവശ്യമാണ്.',
    7: 'ഇത് ശുഭകരമായ സ്ഥിതിയാണ്; പങ്കാളി ആത്മവിശ്വാസവും വ്യക്തിത്വവും ഉള്ള ആളായിരിക്കും.',
    8: 'പങ്കാളിയുടെ കുടുംബത്തിൽ നിന്ന് സഹായങ്ങൾ ലഭിക്കാം; എന്നാൽ ബന്ധത്തിൽ സുതാര്യത നിലനിർത്തണം.',
    9: 'പങ്കാളി ഭാഗ്യവും ധർമ്മബോധവും ഉള്ള വ്യക്തിയായിരിക്കും; വിവാഹശേഷം ഭാഗ്യം വർദ്ധിക്കും.',
    10: 'പങ്കാളി തൊഴിലിൽ ശ്രദ്ധയും ഉയർച്ചയും ഉള്ള വ്യക്തിയായിരിക്കും.',
    11: 'പങ്കാളിയിലൂടെ നേട്ടങ്ങളും ആഗ്രഹസാഫല്യവും ഉണ്ടാകും; സുഹൃദ്‌വലയത്തിലൂടെ പരിചയപ്പെടാനും സാധ്യതയുണ്ട്.',
    12: 'പങ്കാളി ദൂരദേശവുമായോ വിദേശവുമായോ ബന്ധമുള്ള വ്യക്തിയാകാൻ സാധ്യതയുണ്ട്.',
  };
  return notes[h];
}

function venusNote(sign) {
  const fire = 'ആവേശവും തുറന്ന സ്നേഹപ്രകടനവും ഇഷ്ടപ്പെടുന്നു.';
  const earth = 'സ്ഥിരതയും വിശ്വസ്തതയും പ്രായോഗികമായ കരുതലും ആഗ്രഹിക്കുന്നു.';
  const air = 'സൗഹൃദവും നല്ല സംഭാഷണങ്ങളും ബൗദ്ധികമായ അടുപ്പവും ആഗ്രഹിക്കുന്നു.';
  const water = 'ആഴത്തിലുള്ള വൈകാരിക അടുപ്പവും സുരക്ഷിതത്വബോധവും ആഗ്രഹിക്കുന്നു.';
  return [fire, earth, air, water][sign % 4];
}

function marriageOverview(c) {
  const in7 = c.planetsIn(7);
  const lord = c.lordOf(7);
  const lordHouse = c.houseOf(c.planets[lord]);
  const benefic = ['Jupiter', 'Venus', 'Mercury', 'Moon'];
  let score = 0;
  in7.forEach((p) => (score += benefic.includes(p) ? 1 : -1));
  if ([1, 4, 5, 7, 9, 10, 11].includes(lordHouse)) score += 1;
  if ([6, 8, 12].includes(lordHouse)) score -= 1;
  const jupHouse = c.houseOf(c.planets.Jupiter);
  if ([1, 3, 7, 11].includes(jupHouse)) score += 1; // Jupiter in or aspecting the 7th
  const out = [];
  if (score >= 2) out.push('നിങ്ങളുടെ ജാതകത്തിൽ വിവാഹയോഗം വളരെ ശക്തമാണ്. സന്തോഷകരവും ഐശ്വര്യപൂർണ്ണവുമായ ദാമ്പത്യജീവിതത്തിനുള്ള നല്ല സൂചനകളുണ്ട്.');
  else if (score >= 0) out.push('നിങ്ങളുടെ ജാതകത്തിൽ നല്ല വിവാഹയോഗമുണ്ട്. പരസ്പരധാരണയോടെ മുന്നോട്ടുപോയാൽ ദാമ്പത്യം സന്തോഷകരമായിരിക്കും.');
  else out.push('നിങ്ങളുടെ ജാതകത്തിൽ വിവാഹത്തിന് ചില തടസ്സങ്ങളോ കാലതാമസമോ കാണുന്നു. എന്നാൽ ശരിയായ സമയത്തും ശരിയായ പൊരുത്തത്തോടെയും വിവാഹം നടന്നാൽ ദാമ്പത്യം സുഗമമാകും.');
  if ([1, 3, 7, 11].includes(jupHouse)) out.push('വ്യാഴത്തിന്റെ ദൃഷ്ടി ഏഴാം ഭാവത്തിൽ ഉള്ളത് ദാമ്പത്യത്തിന് സംരക്ഷണവും അനുഗ്രഹവും നൽകുന്നു.');
  if (in7.length) out.push(`ഏഴാം ഭാവത്തിൽ ${listPlanets(in7)} സ്ഥിതി ചെയ്യുന്നു; ഇത് പങ്കാളിയുടെ സ്വഭാവത്തെയും വിവാഹസമയത്തെയും നേരിട്ട് സ്വാധീനിക്കും.`);
  else out.push('ഏഴാം ഭാവത്തിൽ ഗ്രഹങ്ങളൊന്നുമില്ല; അതിനാൽ ഏഴാം ഭാവാധിപന്റെ സ്ഥിതിയാണ് ദാമ്പത്യഫലം പ്രധാനമായും നിശ്ചയിക്കുന്നത്.');
  out.push('പങ്കാളിയുടെ ജോലി, സ്ഥലം, വിവാഹസമയം, പ്രണയവിവാഹമോ എന്നിവ വിശദമായി അറിയാൻ താഴെയുള്ള പ്രീമിയം ചോദ്യങ്ങൾ തിരഞ്ഞെടുക്കുക.');
  return out;
}

function loveOrArranged(c) {
  const l5 = c.lordOf(5);
  const l7 = c.lordOf(7);
  const h = (p) => c.houseOf(c.planets[p]);
  const s = (p) => c.signOf(c.planets[p]);
  let score = 0;
  const reasons = [];
  if (h(l5) === 7) { score += 2; reasons.push(`അഞ്ചാം ഭാവാധിപനായ ${pl(l5)} ഏഴാം ഭാവത്തിൽ നിൽക്കുന്നു (പ്രണയം വിവാഹത്തിലേക്ക് നയിക്കുന്ന യോഗം).`); }
  if (h(l7) === 5) { score += 2; reasons.push(`ഏഴാം ഭാവാധിപനായ ${pl(l7)} അഞ്ചാം ഭാവത്തിൽ (പ്രണയസ്ഥാനത്ത്) നിൽക്കുന്നു.`); }
  if (l5 !== l7 && s(l5) === s(l7)) { score += 2; reasons.push(`അഞ്ചാം ഭാവാധിപനും ഏഴാം ഭാവാധിപനും ഒരേ രാശിയിൽ യോഗം ചെയ്യുന്നു.`); }
  if (s('Venus') === s('Mars')) { score += 1; reasons.push('ശുക്രനും ചൊവ്വയും ഒരേ രാശിയിൽ – ശക്തമായ ആകർഷണത്തിന്റെ സൂചന.'); }
  if (s('Venus') === s('Rahu')) { score += 1; reasons.push('ശുക്രനോടൊപ്പം രാഹു – പാരമ്പര്യേതരമായ പ്രണയബന്ധത്തിന്റെ സൂചന.'); }
  if ([5, 7].includes(h('Rahu'))) { score += 1; reasons.push(`രാഹു ${h('Rahu')}-ാം ഭാവത്തിൽ നിൽക്കുന്നു.`); }
  if ([5, 7].includes(h('Venus'))) { score += 1; reasons.push(`ശുക്രൻ ${h('Venus')}-ാം ഭാവത്തിൽ നിൽക്കുന്നു.`); }
  if (s('Moon') === s('Venus')) { score += 1; reasons.push('ചന്ദ്രനും ശുക്രനും ഒരേ രാശിയിൽ – വൈകാരികമായ പ്രണയത്തിന്റെ സൂചന.'); }
  if ([1, 3, 7, 11].includes(h('Jupiter'))) { score -= 1; reasons.push('വ്യാഴത്തിന്റെ ദൃഷ്ടി ഏഴാം ഭാവത്തിൽ – കുടുംബത്തിന്റെ അനുഗ്രഹത്തോടെയുള്ള വിവാഹത്തിന്റെ സൂചന.'); }
  if (h('Saturn') === 7) { score -= 1; reasons.push('ശനി ഏഴാം ഭാവത്തിൽ – പരമ്പരാഗത രീതിയിലുള്ള വിവാഹത്തിന്റെ സൂചന.'); }

  const out = [];
  if (score >= 3) out.push('നിങ്ങളുടെ ജാതകത്തിൽ പ്രണയവിവാഹത്തിനുള്ള യോഗം ശക്തമാണ്. നിങ്ങൾ സ്വയം കണ്ടെത്തി സ്നേഹിക്കുന്ന വ്യക്തിയെ വിവാഹം ചെയ്യാനാണ് കൂടുതൽ സാധ്യത.');
  else if (score >= 1) out.push('നിങ്ങളുടെ ജാതകം "പ്രണയവും നിശ്ചയവും ചേർന്ന" (love-cum-arranged) വിവാഹമാണ് സൂചിപ്പിക്കുന്നത്. പരിചയപ്പെട്ട് ഇഷ്ടപ്പെടുന്ന വ്യക്തിയുമായി, കുടുംബങ്ങളുടെ സമ്മതത്തോടെ വിവാഹം നടക്കാനാണ് സാധ്യത.');
  else out.push('നിങ്ങളുടെ ജാതകം പ്രധാനമായും കുടുംബം നിശ്ചയിക്കുന്ന (arranged) വിവാഹമാണ് സൂചിപ്പിക്കുന്നത്. മാതാപിതാക്കളുടെയും ബന്ധുക്കളുടെയും സഹായത്തോടെ അനുയോജ്യമായ പങ്കാളിയെ കണ്ടെത്താനാണ് സാധ്യത.');
  if (reasons.length) out.push('ജ്യോതിഷപരമായ കാരണങ്ങൾ:\n• ' + reasons.join('\n• '));
  return out;
}

function spouseJob(c) {
  // 10th from the 7th is the 4th house of the native.
  const l4 = c.lordOf(4);
  const in4 = c.planetsIn(4);
  const l7 = c.lordOf(7);
  const signifiers = [...new Set([...in4, l4, l7])].slice(0, 3);
  const out = [`പങ്കാളിയുടെ തൊഴിൽ നിങ്ങളുടെ ജാതകത്തിലെ ഏഴാം ഭാവത്തിൽ നിന്നുള്ള പത്താം ഭാവം (അതായത് നാലാം ഭാവം) നോക്കിയാണ് പ്രവചിക്കുന്നത്. ഈ ഭാവത്തിന്റെ അധിപൻ ${pl(l4)} ആണ്.`];
  out.push(`പങ്കാളിക്ക് ഏറ്റവും സാധ്യതയുള്ള തൊഴിൽമേഖലകൾ: ${T.PLANET_JOBS[signifiers[0]]}.`);
  if (signifiers[1]) out.push(`മറ്റ് സാധ്യതകൾ: ${T.PLANET_JOBS[signifiers[1]]}.`);
  const l4h = c.houseOf(c.planets[l4]);
  if ([1, 4, 7, 10].includes(l4h)) out.push('പങ്കാളിക്ക് സ്ഥിരതയുള്ളതും സമൂഹത്തിൽ അംഗീകാരമുള്ളതുമായ ജോലി ലഭിക്കും.');
  else if ([3, 6, 10, 11].includes(l4h)) out.push('പങ്കാളി സ്വന്തം പരിശ്രമത്തിലൂടെ തൊഴിലിൽ ഉയർച്ച നേടും; സ്വന്തമായി ബിസിനസ് ചെയ്യാനുള്ള സാധ്യതയുമുണ്ട്.');
  else if ([9, 12].includes(l4h)) out.push('പങ്കാളിയുടെ ജോലി ദൂരസ്ഥലത്തോ വിദേശത്തോ ആകാൻ സാധ്യതയുണ്ട്.');
  else out.push('പങ്കാളിയുടെ തൊഴിൽജീവിതത്തിൽ തുടക്കത്തിൽ ചില മാറ്റങ്ങൾ ഉണ്ടാകാം; പിന്നീട് സ്ഥിരത കൈവരിക്കും.');
  if (in4.length) out.push(`നാലാം ഭാവത്തിൽ ${listPlanets(in4)} ഉള്ളതിനാൽ ${in4.length > 1 ? 'ഈ ഗ്രഹങ്ങളുടെ' : 'ഈ ഗ്രഹത്തിന്റെ'} മേഖലകൾക്ക് പ്രത്യേക പ്രാധാന്യമുണ്ട്.`);
  return out;
}

function spousePlace(c) {
  const seventh = (c.lagna + 6) % 12;
  const l7 = c.lordOf(7);
  const l7sign = c.signOf(c.planets[l7]);
  const l7h = c.houseOf(c.planets[l7]);
  const out = [`ഏഴാം ഭാവം ${RASHI[seventh]} രാശിയായതിനാൽ പങ്കാളി നിങ്ങളുടെ ജന്മസ്ഥലത്തു നിന്ന് ${T.SIGN_DIRECTION[seventh % 4]} ദിക്കിൽ നിന്നാകാനാണ് കൂടുതൽ സാധ്യത.`];
  const mod = l7sign % 3; // 0 movable, 1 fixed, 2 dual
  if (mod === 0) out.push(`ഏഴാം ഭാവാധിപനായ ${pl(l7)} ചരരാശിയിൽ (${RASHI[l7sign]}) നിൽക്കുന്നതിനാൽ പങ്കാളി താരതമ്യേന ദൂരെയുള്ള സ്ഥലത്തു നിന്നാകാം (മറ്റൊരു ജില്ലയോ സംസ്ഥാനമോ).`);
  else if (mod === 1) out.push(`ഏഴാം ഭാവാധിപനായ ${pl(l7)} സ്ഥിരരാശിയിൽ (${RASHI[l7sign]}) നിൽക്കുന്നതിനാൽ പങ്കാളി അടുത്തുള്ള സ്ഥലത്തു നിന്നോ പരിചയമുള്ള കുടുംബത്തിൽ നിന്നോ ആകാൻ സാധ്യതയുണ്ട്.`);
  else out.push(`ഏഴാം ഭാവാധിപനായ ${pl(l7)} ഉഭയരാശിയിൽ (${RASHI[l7sign]}) നിൽക്കുന്നതിനാൽ പങ്കാളി ഇടത്തരം ദൂരത്തു നിന്നാകാം – ഒരേ ജില്ലയിലോ അടുത്ത ജില്ലയിലോ.`);
  if ([9, 12].includes(l7h) || c.houseOf(c.planets.Rahu) === 7) out.push('നിങ്ങളുടെ ജാതകത്തിൽ വിദേശബന്ധമുള്ള പങ്കാളിക്കുള്ള സൂചനകളുണ്ട് – വിദേശത്ത് ജോലിചെയ്യുന്ന ആളോ വിവാഹശേഷം വിദേശത്തേക്ക് പോകാനുള്ള സാധ്യതയോ ഉണ്ട്.');
  if ([1, 2, 4].includes(l7h)) out.push('പങ്കാളിയുടെ കുടുംബം നിങ്ങളുടെ കുടുംബവുമായോ നാട്ടുകാരുമായോ മുൻപരിചയമുള്ളവരാകാം.');
  if (seventh % 4 === 3) out.push('ജലരാശിയുടെ സ്വാധീനം ഉള്ളതിനാൽ പങ്കാളിയുടെ നാട് പുഴയോ കടലോ കായലോ സമീപമുള്ള പ്രദേശമാകാൻ സാധ്യതയുണ്ട്.');
  return out;
}

function marriageTime(c) {
  const l7 = c.lordOf(7);
  const keys = new Set(['Venus', l7, ...c.planetsIn(7)]);
  if ([1, 3, 7, 11].includes(c.houseOf(c.planets.Jupiter))) keys.add('Jupiter');
  const birthDate = new Date(c.birthUtc);
  const now = new Date();
  const ageAt = (d) => (d - birthDate) / (365.25 * 86400000);
  const windows = c.dashas.filter((d) => d.end > now && ageAt(d.start) < 40 && ageAt(d.end) > 20 && (keys.has(d.md) || keys.has(d.ad)));
  const current = c.dashas.find((d) => d.start <= now && d.end > now);
  const out = [];
  if (current) out.push(`നിലവിൽ നിങ്ങൾക്ക് ${pl(current.md)} ദശയിൽ ${pl(current.ad)} അപഹാരമാണ് (${fmtMonth(current.start)} മുതൽ ${fmtMonth(current.end)} വരെ).`);
  out.push(`വിവാഹം നടക്കാൻ സാധ്യത കൂടുതലുള്ളത് ശുക്രൻ, ഏഴാം ഭാവാധിപനായ ${pl(l7)}, ഏഴാം ഭാവവുമായി ബന്ധപ്പെട്ട ഗ്രഹങ്ങൾ എന്നിവയുടെ ദശാ-അപഹാര കാലങ്ങളിലാണ്.`);
  if (windows.length) {
    out.push('വിവാഹത്തിന് അനുകൂലമായ കാലഘട്ടങ്ങൾ:\n• ' + windows.slice(0, 4).map((w) => `${fmtMonth(w.start > now ? w.start : now)} – ${fmtMonth(w.end)} (${pl(w.md)} ദശ – ${pl(w.ad)} അപഹാരം)`).join('\n• '));
    out.push('ഈ കാലഘട്ടങ്ങളിൽ വ്യാഴം ഏഴാം ഭാവത്തിലൂടെയോ ചന്ദ്രരാശിയുടെ ഏഴിലൂടെയോ സഞ്ചരിക്കുന്ന സമയം ഏറ്റവും ശുഭകരമായിരിക്കും.');
  } else {
    out.push('അടുത്ത വർഷങ്ങളിൽ പ്രത്യേകമായ ദശാസൂചനകൾ കുറവാണ്; ഗോചരഫലവും പൊരുത്തവും നോക്കി സമയം നിശ്ചയിക്കുന്നതാണ് ഉചിതം.');
  }
  if (c.houseOf(c.planets.Saturn) === 7 || c.lordOf(7) === 'Saturn') out.push('ശനിയുടെ സ്വാധീനം ഉള്ളതിനാൽ വിവാഹം അൽപ്പം വൈകി (ഏകദേശം 28 വയസ്സിന് ശേഷം) നടക്കാൻ സാധ്യതയുണ്ട്; എന്നാൽ അത് സ്ഥിരതയുള്ള ബന്ധമായിരിക്കും.');
  return out;
}

function spouseLooks(c) {
  const seventh = (c.lagna + 6) % 12;
  const out = [`ഏഴാം ഭാവം ${RASHI[seventh]} ആയതിനാൽ പങ്കാളിക്ക് ഉണ്ടാകാവുന്ന ശാരീരിക സവിശേഷതകൾ: ${T.SIGN_LOOKS[seventh]}`];
  const l7sign = c.signOf(c.planets[c.lordOf(7)]);
  if (l7sign !== seventh) out.push(`ഏഴാം ഭാവാധിപൻ ${RASHI[l7sign]} രാശിയിൽ ആയതിനാൽ ഈ സവിശേഷതകളും കാണാം: ${T.SIGN_LOOKS[l7sign]}`);
  const in7 = c.planetsIn(7);
  if (in7.includes('Venus') || in7.includes('Moon')) out.push('ഏഴിലെ ശുഭഗ്രഹങ്ങൾ കാരണം പങ്കാളി ഏറെ ആകർഷകമായ രൂപഭംഗിയുള്ള ആളായിരിക്കും.');
  if (in7.includes('Saturn')) out.push('ശനിയുടെ സ്വാധീനം കാരണം പങ്കാളി പ്രായത്തിൽ മുതിർന്നതായോ ഗൗരവഭാവമുള്ളതായോ തോന്നാം.');
  if (in7.includes('Mars')) out.push('ചൊവ്വയുടെ സ്വാധീനം കാരണം കായികക്ഷമതയുള്ള ഉറച്ച ശരീരപ്രകൃതി പ്രതീക്ഷിക്കാം.');
  return out;
}

function chovvaFrom(c, refSign) {
  const h = ((c.signOf(c.planets.Mars) - refSign + 12) % 12) + 1;
  return [2, 4, 7, 8, 12].includes(h) ? h : 0;
}

function chovvaDosham(c) {
  const fromLagna = chovvaFrom(c, c.lagna);
  const fromMoon = chovvaFrom(c, c.moonSign);
  const fromVenus = chovvaFrom(c, c.signOf(c.planets.Venus));
  const marsSign = c.signOf(c.planets.Mars);
  const out = [`ചൊവ്വ നിങ്ങളുടെ ജാതകത്തിൽ ${RASHI[marsSign]} രാശിയിലാണ്.`];
  const lines = [];
  lines.push(fromLagna ? `ലഗ്നത്തിൽ നിന്ന് ${fromLagna}-ാം ഭാവത്തിൽ – ദോഷമുണ്ട്` : 'ലഗ്നത്തിൽ നിന്ന് – ദോഷമില്ല');
  lines.push(fromMoon ? `ചന്ദ്രനിൽ നിന്ന് ${fromMoon}-ാം ഭാവത്തിൽ – ദോഷമുണ്ട്` : 'ചന്ദ്രനിൽ നിന്ന് – ദോഷമില്ല');
  lines.push(fromVenus ? `ശുക്രനിൽ നിന്ന് ${fromVenus}-ാം ഭാവത്തിൽ – ദോഷമുണ്ട്` : 'ശുക്രനിൽ നിന്ന് – ദോഷമില്ല');
  out.push('• ' + lines.join('\n• '));
  const count = [fromLagna, fromMoon, fromVenus].filter(Boolean).length;
  const cancelled = [0, 7, 9].includes(marsSign); // own sign or exalted
  if (!count) out.push('നിങ്ങളുടെ ജാതകത്തിൽ ചൊവ്വാദോഷം ഇല്ല. ഇത് ദാമ്പത്യത്തിന് അനുകൂലമായ സ്ഥിതിയാണ്.');
  else if (cancelled) out.push('ചൊവ്വ സ്വക്ഷേത്രത്തിലോ ഉച്ചത്തിലോ നിൽക്കുന്നതിനാൽ ചൊവ്വാദോഷത്തിന് വലിയ തോതിൽ പരിഹാരമുണ്ട് (ദോഷഭംഗം). അതിനാൽ ഇതിനെക്കുറിച്ച് അമിതമായി ആശങ്കപ്പെടേണ്ടതില്ല.');
  else if (count === 1) out.push('നേരിയ ചൊവ്വാദോഷം കാണുന്നു. സമാനമായ ദോഷമുള്ള ജാതകവുമായി ചേർത്താൽ (പാപസാമ്യം) ദോഷം പരിഹരിക്കപ്പെടും.');
  else out.push('ചൊവ്വാദോഷം വ്യക്തമായി കാണുന്നു. സമാനമായ ദോഷമുള്ള ജാതകവുമായി പാപസാമ്യം നോക്കി വിവാഹം നിശ്ചയിക്കുന്നതാണ് ഉചിതം. ചൊവ്വാഴ്ച വ്രതവും സുബ്രഹ്മണ്യസ്വാമി ക്ഷേത്രദർശനവും പരമ്പരാഗതമായി നിർദ്ദേശിക്കപ്പെടുന്ന പരിഹാരങ്ങളാണ്.');
  return out;
}

// ---------- Porutham (Kerala nakshatra matching) ----------
const GANA = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0]; // 0 deva, 1 manushya, 2 rakshasa
const YONI = ['horse', 'elephant', 'sheep', 'serpent', 'serpent', 'dog', 'cat', 'sheep', 'cat', 'rat', 'rat', 'cow', 'buffalo', 'tiger', 'buffalo', 'tiger', 'deer', 'deer', 'dog', 'monkey', 'mongoose', 'monkey', 'lion', 'horse', 'lion', 'cow', 'elephant'];
const YONI_ENEMY = [['horse', 'buffalo'], ['elephant', 'lion'], ['sheep', 'monkey'], ['serpent', 'mongoose'], ['dog', 'deer'], ['cat', 'rat'], ['cow', 'tiger']];
const RAJJU = [0, 1, 2, 3, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0];
const VEDHA = [[0, 17], [1, 16], [2, 15], [3, 14], [5, 21], [6, 20], [7, 19], [8, 18], [9, 26], [10, 25], [11, 24], [12, 23], [4, 13], [13, 22], [4, 22]];
const VASHYA = { 0: [4, 7], 1: [3, 6], 2: [5], 3: [7, 8], 4: [6], 5: [2, 11], 6: [5, 9], 7: [3], 8: [11], 9: [0, 10], 10: [0], 11: [9] };
const FRIENDS = {
  Sun: { f: ['Moon', 'Mars', 'Jupiter'], e: ['Venus', 'Saturn'] },
  Moon: { f: ['Sun', 'Mercury'], e: [] },
  Mars: { f: ['Sun', 'Moon', 'Jupiter'], e: ['Mercury'] },
  Mercury: { f: ['Sun', 'Venus'], e: ['Moon'] },
  Jupiter: { f: ['Sun', 'Moon', 'Mars'], e: ['Mercury', 'Venus'] },
  Venus: { f: ['Mercury', 'Saturn'], e: ['Sun', 'Moon'] },
  Saturn: { f: ['Mercury', 'Venus'], e: ['Sun', 'Moon', 'Mars'] },
};

function porutham(self, partner) {
  const girl = self.gender === 'female' ? self.chart : partner.chart;
  const boy = self.gender === 'female' ? partner.chart : self.chart;
  const gN = girl.moonNak, bN = boy.moonNak, gR = girl.moonSign, bR = boy.moonSign;
  const cnt = ((bN - gN + 27) % 27) + 1;
  const rcnt = ((bR - gR + 12) % 12) + 1;
  const res = [];
  const add = (name, ok, note) => res.push({ name, ok, note });

  add('ദിനപ്പൊരുത്തം', [0, 2, 4, 6, 8].includes(cnt % 9), 'ആരോഗ്യവും ദീർഘായുസ്സും');
  const ga = GANA[gN], gb = GANA[bN];
  add('ഗണപ്പൊരുത്തം', ga === gb || (ga !== 2 && gb !== 2), 'സ്വഭാവചേർച്ച');
  const ya = YONI[gN], yb = YONI[bN];
  add('യോനിപ്പൊരുത്തം', !YONI_ENEMY.some(([a, b]) => (a === ya && b === yb) || (a === yb && b === ya)), 'ശാരീരികവും മാനസികവുമായ ഐക്യം');
  add('രാശിപ്പൊരുത്തം', ![2, 6, 8, 12].includes(rcnt), 'വംശവൃദ്ധി');
  const la = SIGN_LORD[gR], lb = SIGN_LORD[bR];
  add('രാശ്യാധിപപ്പൊരുത്തം', la === lb || (!FRIENDS[la].e.includes(lb) && !FRIENDS[lb].e.includes(la)), 'സന്താനഭാഗ്യവും ഐശ്വര്യവും');
  add('വശ്യപ്പൊരുത്തം', gR === bR || VASHYA[gR].includes(bR) || VASHYA[bR].includes(gR), 'പരസ്പരആകർഷണം');
  add('മാഹേന്ദ്രപ്പൊരുത്തം', [4, 7, 10, 13, 16, 19, 22, 25].includes(cnt), 'സമ്പത്തും സന്താനങ്ങളും');
  add('സ്ത്രീദീർഘപ്പൊരുത്തം', cnt > 13, 'ഐശ്വര്യവും സൗഭാഗ്യവും');
  add('രജ്ജുപ്പൊരുത്തം', RAJJU[gN] !== RAJJU[bN], 'ദാമ്പത്യത്തിന്റെ ദീർഘായുസ്സ് (അനിവാര്യം)');
  add('വേധപ്പൊരുത്തം', !VEDHA.some(([a, b]) => (a === gN && b === bN) || (a === bN && b === gN)), 'ദുരിതങ്ങളിൽ നിന്നുള്ള സംരക്ഷണം (അനിവാര്യം)');

  const good = res.filter((r) => r.ok).length;
  const essentialOk = res.find((r) => r.name === 'രജ്ജുപ്പൊരുത്തം').ok && res.find((r) => r.name === 'വേധപ്പൊരുത്തം').ok;
  const out = [
    `വധുവിന്റെ നക്ഷത്രം: ${NAKSHATRA[gN]} (${RASHI[gR]} കൂറ്)\nവരന്റെ നക്ഷത്രം: ${NAKSHATRA[bN]} (${RASHI[bR]} കൂറ്)`,
    res.map((r) => `${r.ok ? '✅' : '❌'} ${r.name} – ${r.note}`).join('\n'),
    `ആകെ പൊരുത്തം: 10-ൽ ${good}`,
  ];
  if (!essentialOk) out.push('രജ്ജു അല്ലെങ്കിൽ വേധ പൊരുത്തം ഇല്ലാത്തതിനാൽ ഈ ബന്ധത്തിന് മുമ്പ് ഒരു ജ്യോതിഷിയുമായി വിശദമായി ആലോചിക്കുന്നത് നല്ലതാണ്.');
  else if (good >= 7) out.push('ഉത്തമമായ പൊരുത്തമാണ്. ഈ ബന്ധം സന്തോഷകരവും ഐശ്വര്യപൂർണ്ണവുമായ ദാമ്പത്യത്തിന് വളരെ അനുകൂലമാണ്.');
  else if (good >= 5) out.push('മധ്യമമായ പൊരുത്തമാണ്. അനിവാര്യമായ പൊരുത്തങ്ങൾ ഉള്ളതിനാൽ ഈ വിവാഹം ആലോചിക്കാവുന്നതാണ്.');
  else out.push('പൊരുത്തം കുറവാണ്. ജാതകങ്ങൾ വിശദമായി പരിശോധിച്ച ശേഷം മാത്രം തീരുമാനമെടുക്കുക.');
  const d1 = [chovvaFrom(self.chart, self.chart.lagna), chovvaFrom(self.chart, self.chart.moonSign)].filter(Boolean).length;
  const d2 = [chovvaFrom(partner.chart, partner.chart.lagna), chovvaFrom(partner.chart, partner.chart.moonSign)].filter(Boolean).length;
  if (d1 && d2) out.push('രണ്ട് ജാതകങ്ങളിലും ചൊവ്വാദോഷം ഉള്ളതിനാൽ പാപസാമ്യം ഉണ്ട് – ഇത് അനുകൂലമാണ്.');
  else if (d1 || d2) out.push('ഒരു ജാതകത്തിൽ മാത്രം ചൊവ്വാദോഷം കാണുന്നു; പാപസാമ്യം വിശദമായി പരിശോധിക്കേണ്ടതാണ്.');
  return out;
}

function customFallback(c, question) {
  const q = question || '';
  const map = [
    [/ജോലി|തൊഴിൽ|ഉദ്യോഗ|job|career/i, spouseJob],
    [/എപ്പോൾ|സമയം|വയസ്സ്|വർഷ|when|time/i, (ch) => marriageTime(ch)],
    [/പ്രണയ|ലവ്|love|arrange|നിശ്ചയ/i, loveOrArranged],
    [/സ്ഥലം|ദിക്ക്|നാട്|ദൂര|വിദേശ|place|abroad/i, spousePlace],
    [/രൂപ|സൗന്ദര്യ|ഉയരം|look|appearance/i, spouseLooks],
    [/ചൊവ്വ|ദോഷ|dosh/i, chovvaDosham],
  ];
  for (const [re, fn] of map) if (re.test(q)) return fn(c);
  return [...spouseNature(c), ...marriageOverview(c).slice(0, 2)];
}

function localReading(topic, self, partner, question) {
  const c = self.chart;
  switch (topic) {
    case 'spouse_nature': return spouseNature(c);
    case 'marriage_overview': return marriageOverview(c);
    case 'love_or_arranged': return loveOrArranged(c);
    case 'spouse_job': return spouseJob(c);
    case 'spouse_place': return spousePlace(c);
    case 'marriage_time': return marriageTime(c);
    case 'spouse_looks': return spouseLooks(c);
    case 'chovva_dosham': return chovvaDosham(c);
    case 'porutham': return porutham(self, partner);
    case 'custom': return customFallback(c, question);
    default: throw new Error('unknown topic');
  }
}

module.exports = { TOPICS, computeChart, chartSummary, localReading };
