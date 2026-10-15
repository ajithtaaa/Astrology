(() => {
  const chat = document.getElementById('chat');
  const composer = document.getElementById('composer');
  const composerInput = document.getElementById('composer-input');
  const KEY_PROFILE = 'jp_profile';
  const KEY_TOKENS = 'jp_tokens';
  const KEY_PENDING = 'jp_pending';

  const PLACES = [
    ['കേരളം', [
      ['തിരുവനന്തപുരം', 8.5241, 76.9366], ['കൊല്ലം', 8.8932, 76.6141], ['പത്തനംതിട്ട', 9.2648, 76.787],
      ['ആലപ്പുഴ', 9.4981, 76.3388], ['കോട്ടയം', 9.5916, 76.5222], ['ഇടുക്കി (തൊടുപുഴ)', 9.8959, 76.7184],
      ['എറണാകുളം / കൊച്ചി', 9.9312, 76.2673], ['തൃശ്ശൂർ', 10.5276, 76.2144], ['പാലക്കാട്', 10.7867, 76.6548],
      ['മലപ്പുറം', 11.051, 76.0711], ['കോഴിക്കോട്', 11.2588, 75.7804], ['വയനാട് (കൽപ്പറ്റ)', 11.6085, 76.083],
      ['കണ്ണൂർ', 11.8745, 75.3704], ['കാസർഗോഡ്', 12.4996, 74.9869],
    ].map((p) => [...p, 'Asia/Kolkata'])],
    ['ഇന്ത്യ', [
      ['ബെംഗളൂരു', 12.9716, 77.5946], ['ചെന്നൈ', 13.0827, 80.2707], ['കോയമ്പത്തൂർ', 11.0168, 76.9558],
      ['മംഗളൂരു', 12.9141, 74.856], ['മുംബൈ', 19.076, 72.8777], ['പൂനെ', 18.5204, 73.8567],
      ['ഹൈദരാബാദ്', 17.385, 78.4867], ['ഡൽഹി', 28.6139, 77.209],
    ].map((p) => [...p, 'Asia/Kolkata'])],
    ['വിദേശം', [
      ['ദുബായ്', 25.2048, 55.2708, 'Asia/Dubai'], ['അബുദാബി', 24.4539, 54.3773, 'Asia/Dubai'], ['ഷാർജ', 25.3463, 55.4209, 'Asia/Dubai'],
      ['ദോഹ', 25.2854, 51.531, 'Asia/Qatar'], ['മസ്കറ്റ്', 23.588, 58.3829, 'Asia/Muscat'], ['റിയാദ്', 24.7136, 46.6753, 'Asia/Riyadh'],
      ['ജിദ്ദ', 21.4858, 39.1925, 'Asia/Riyadh'], ['കുവൈത്ത്', 29.3759, 47.9774, 'Asia/Kuwait'], ['ബഹ്റൈൻ', 26.2285, 50.586, 'Asia/Bahrain'],
      ['സിംഗപ്പൂർ', 1.3521, 103.8198, 'Asia/Singapore'], ['ലണ്ടൻ', 51.5072, -0.1276, 'Europe/London'], ['ന്യൂയോർക്ക്', 40.7128, -74.006, 'America/New_York'],
    ]],
  ];

  let config = { topics: {}, plans: {} };
  let profile = load(KEY_PROFILE);
  let partner = null;
  let pendingTopic = null;

  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function scroll() { requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; }); }
  function bot(html) { const m = el(`<div class="msg bot">${html}</div>`); chat.appendChild(m); scroll(); return m; }
  function user(text) { chat.appendChild(el(`<div class="msg user">${esc(text)}</div>`)); scroll(); }
  function typing() { return bot('<div class="typing"><span></span><span></span><span></span></div>'); }

  async function api(path, data) {
    const res = await fetch(path, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : undefined);
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json };
  }

  // ---------- tokens ----------
  function tokens() { return (load(KEY_TOKENS) || []).filter((t) => t.expires > Date.now()); }
  function tokenFor(topic) { const t = tokens().find((x) => x.topic === '*' || x.topic === topic); return t && t.token; }
  function addToken(t) { save(KEY_TOKENS, [...tokens(), t]); }

  // ---------- place picker ----------
  function placeOptions(selected) {
    return PLACES.map(([group, list]) => `<optgroup label="${group}">${list.map(([n, la, lo, tz]) =>
      `<option value="${la},${lo},${tz}" ${selected === n ? 'selected' : ''}>${n}</option>`).join('')}</optgroup>`).join('')
      + '<option value="other">മറ്റൊരു സ്ഥലം…</option>';
  }

  function birthFields(prefix, p = {}) {
    return `
      <div class="row">
        <label>ജനനത്തീയതി<input type="date" name="${prefix}dob" required value="${esc(p.dob || '')}" max="${new Date().toISOString().slice(0, 10)}"></label>
        <label>ജനനസമയം<input type="time" name="${prefix}tob" required value="${esc(p.tob || '')}"></label>
      </div>
      <label>ജനനസ്ഥലം
        <select name="${prefix}place" required><option value="">തിരഞ്ഞെടുക്കുക</option>${placeOptions(p.placeName)}</select>
      </label>
      <div class="other-place" hidden>
        <label>സ്ഥലത്തിന്റെ പേര് (ഇംഗ്ലീഷിൽ) <input type="text" name="${prefix}search" placeholder="ഉദാ: Thalassery"></label>
        <div class="place-results"></div>
        <div class="row">
          <label>അക്ഷാംശം (Latitude)<input type="number" step="any" name="${prefix}lat"></label>
          <label>രേഖാംശം (Longitude)<input type="number" step="any" name="${prefix}lon"></label>
        </div>
        <label>സമയമേഖല (Timezone)<input type="text" name="${prefix}tz" value="Asia/Kolkata"></label>
      </div>`;
  }

  function wirePlace(form, prefix) {
    const sel = form.querySelector(`[name="${prefix}place"]`);
    const other = sel.closest('label').nextElementSibling;
    const search = form.querySelector(`[name="${prefix}search"]`);
    const results = other.querySelector('.place-results');
    sel.addEventListener('change', () => { other.hidden = sel.value !== 'other'; scroll(); });
    let timer;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      const q = search.value.trim();
      if (q.length < 3) { results.innerHTML = ''; return; }
      timer = setTimeout(async () => {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`);
          const list = await r.json();
          results.innerHTML = '';
          list.forEach((it) => {
            const b = el(`<button type="button">${esc(it.display_name)}</button>`);
            b.onclick = () => {
              form.querySelector(`[name="${prefix}lat"]`).value = Number(it.lat).toFixed(4);
              form.querySelector(`[name="${prefix}lon"]`).value = Number(it.lon).toFixed(4);
              search.value = it.display_name.split(',')[0];
              results.innerHTML = '';
            };
            results.appendChild(b);
          });
        } catch { results.innerHTML = '<span class="err">സ്ഥലം കണ്ടെത്താനായില്ല; അക്ഷാംശവും രേഖാംശവും നേരിട്ട് നൽകുക.</span>'; }
      }, 500);
    });
  }

  function readBirth(form, prefix) {
    const f = (n) => form.querySelector(`[name="${prefix}${n}"]`);
    const place = f('place').value;
    let lat, lon, tz, placeName;
    if (place === 'other') {
      lat = Number(f('lat').value); lon = Number(f('lon').value); tz = f('tz').value.trim() || 'Asia/Kolkata';
      placeName = f('search').value.trim() || `${lat}, ${lon}`;
      if (!f('lat').value || !f('lon').value) throw new Error('സ്ഥലത്തിന്റെ അക്ഷാംശവും രേഖാംശവും നൽകുക.');
      try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { throw new Error('സമയമേഖല ശരിയല്ല (ഉദാ: Asia/Kolkata).'); }
    } else {
      [lat, lon, tz] = place.split(',');
      lat = Number(lat); lon = Number(lon);
      placeName = f('place').selectedOptions[0].textContent;
    }
    return { dob: f('dob').value, tob: f('tob').value, lat, lon, tz, placeName };
  }

  // ---------- flows ----------
  function askDetails() {
    composer.hidden = true;
    const p = profile || {};
    const m = bot(`
      <p>ദയവായി നിങ്ങളുടെ ജനനവിവരങ്ങൾ നൽകുക. കൃത്യമായ ജനനസമയം നൽകിയാൽ ഫലവും കൂടുതൽ കൃത്യമായിരിക്കും.</p>
      <form class="card">
        <label>പേര്<input name="name" required maxlength="40" value="${esc(p.name || '')}"></label>
        <div class="radio">
          <label><input type="radio" name="gender" value="male" ${p.gender === 'male' ? 'checked' : ''} required> പുരുഷൻ</label>
          <label><input type="radio" name="gender" value="female" ${p.gender === 'female' ? 'checked' : ''}> സ്ത്രീ</label>
        </div>
        ${birthFields('', p)}
        <span class="err" hidden></span>
        <button class="primary" type="submit">തുടരുക</button>
      </form>`);
    const form = m.querySelector('form');
    wirePlace(form, '');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = form.querySelector('.err');
      try {
        const birth = readBirth(form, '');
        profile = { name: form.elements.name.value.trim(), gender: form.elements.gender.value, ...birth };
        save(KEY_PROFILE, profile);
        form.closest('.msg').remove();
        user(`${profile.name}, ${profile.dob}, ${profile.tob}, ${profile.placeName}`);
        bot(`<p>നന്ദി, ${esc(profile.name)}! 🙏 നിങ്ങളുടെ ജാതകം തയ്യാറാക്കി. താഴെയുള്ളവയിൽ നിന്ന് ഒരു ചോദ്യം തിരഞ്ഞെടുക്കുക.</p>`);
        showMenu();
      } catch (ex) { err.hidden = false; err.textContent = ex.message; }
    });
  }

  function showMenu() {
    composer.hidden = true;
    const entries = Object.entries(config.topics);
    const chips = entries.map(([id, t]) => {
      const tag = t.free ? '<span class="tag">സൗജന്യം</span>' : tokenFor(id) ? '<span class="tag open">ലഭ്യം</span>' : `<span class="tag paid">₹${config.plans.single.amount}</span>`;
      return `<button class="chip" data-topic="${id}" type="button">${esc(t.title)}${tag}</button>`;
    }).join('');
    const m = bot(`<p>എന്താണ് അറിയേണ്ടത്?</p><div class="chips">${chips}</div>`);
    m.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => pickTopic(b.dataset.topic)));
  }

  function pickTopic(topic) {
    if (!profile) return askDetails();
    const t = config.topics[topic];
    user(t.title);
    if (!t.free && !tokenFor(topic)) return paywall(topic);
    if (topic === 'porutham') return askPartner();
    if (topic === 'custom') return askCustom();
    runReading(topic);
  }

  function askPartner() {
    const other = profile.gender === 'female' ? 'വരന്റെ' : 'വധുവിന്റെ';
    const m = bot(`
      <p>പൊരുത്തം നോക്കാൻ ${other} ജനനവിവരങ്ങൾ നൽകുക.</p>
      <form class="card">
        <label>പേര്<input name="pname" required maxlength="40" value="${esc(partner?.name || '')}"></label>
        ${birthFields('p', partner || {})}
        <span class="err" hidden></span>
        <button class="primary" type="submit">പൊരുത്തം നോക്കുക</button>
      </form>`);
    const form = m.querySelector('form');
    wirePlace(form, 'p');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = form.querySelector('.err');
      try {
        partner = { name: form.pname.value.trim(), ...readBirth(form, 'p') };
        form.closest('.msg').remove();
        user(`${partner.name}, ${partner.dob}, ${partner.tob}, ${partner.placeName}`);
        runReading('porutham');
      } catch (ex) { err.hidden = false; err.textContent = ex.message; }
    });
  }

  function askCustom() {
    bot('<p>ബന്ധങ്ങളെക്കുറിച്ചോ വിവാഹത്തെക്കുറിച്ചോ ഉള്ള നിങ്ങളുടെ ചോദ്യം താഴെ എഴുതി അയയ്ക്കുക.</p>');
    composer.hidden = false;
    composerInput.focus();
  }

  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = composerInput.value.trim();
    if (q.length < 4) return;
    composerInput.value = '';
    composer.hidden = true;
    user(q);
    runReading('custom', q);
  });
  composerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); composer.requestSubmit(); }
  });

  async function runReading(topic, question) {
    const wait = typing();
    const res = await api('/api/reading', { topic, self: profile, partner, question, token: tokenFor(topic) }).catch(() => ({ status: 0 }));
    wait.remove();
    if (res.status === 402) return paywall(topic);
    if (res.status !== 200) {
      bot('<p class="err">ക്ഷമിക്കണം, ഫലം തയ്യാറാക്കുന്നതിൽ ഒരു പിശക് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.</p>');
      return showMenu();
    }
    bot(`
      <h3>${esc(res.title)}</h3>
      <div class="summary">${res.summary.map((s) => `<span>${esc(s)}</span>`).join('')}</div>
      ${res.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
      <div class="note">${esc(res.disclaimer)}</div>`);
    showMenu();
  }

  // ---------- payment ----------
  function paywall(topic) {
    const t = config.topics[topic];
    const s = config.plans.single, f = config.plans.full;
    const m = bot(`
      <p>🔒 "${esc(t.title)}" ഒരു പ്രീമിയം ചോദ്യമാണ്. തുടരാൻ ഒരു പ്ലാൻ തിരഞ്ഞെടുക്കുക:</p>
      <div class="plans">
        <button class="plan" data-plan="single" type="button"><b>₹${s.amount}</b>ഈ ചോദ്യം മാത്രം<br><small>24 മണിക്കൂർ ലഭ്യം</small></button>
        <button class="plan" data-plan="full" type="button"><b>₹${f.amount}</b>എല്ലാ പ്രീമിയം ചോദ്യങ്ങളും<br><small>പൊരുത്തവും സ്വന്തം ചോദ്യങ്ങളും ഉൾപ്പെടെ, 30 ദിവസം</small></button>
      </div>`);
    m.querySelectorAll('.plan').forEach((b) => b.addEventListener('click', () => { m.querySelectorAll('.plan').forEach((x) => (x.disabled = true)); startOrder(b.dataset.plan, topic); }));
  }

  async function startOrder(plan, topic) {
    const wait = typing();
    const o = await api('/api/order', { plan, topic }).catch(() => ({ status: 0 }));
    wait.remove();
    if (o.status !== 200) { bot('<p class="err">പേയ്മെന്റ് ആരംഭിക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.</p>'); return showMenu(); }
    save(KEY_PENDING, { order: o.order, id: o.id, topic, plan });
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    const m = bot(`
      <div class="pay">
        <p><b>₹${o.amount}</b> അടയ്ക്കുക – ഓർഡർ നമ്പർ: <code>${esc(o.id)}</code></p>
        <div class="qr">${o.qr}</div>
        ${isMobile ? `<div class="upi-apps"><a class="primary" href="${esc(o.upi)}">UPI ആപ്പിൽ പണമടയ്ക്കുക</a></div>` : ''}
        <div class="upi-id">UPI ഐഡി: <code>${esc(o.upiId)}</code> <button class="ghost copy" type="button">കോപ്പി ചെയ്യുക</button></div>
        <ol class="steps">
          <li>Google Pay, PhonePe, Paytm, BHIM തുടങ്ങിയ ഏതെങ്കിലും UPI ആപ്പ് ഉപയോഗിച്ച് QR കോഡ് സ്കാൻ ചെയ്യുക${isMobile ? ', അല്ലെങ്കിൽ മുകളിലെ ബട്ടൺ അമർത്തുക' : ''}.</li>
          <li>കൃത്യം ₹${o.amount} അടയ്ക്കുക.</li>
          <li>പണമടച്ചതിനു ശേഷം ലഭിക്കുന്ന 12 അക്ക UTR / UPI Reference നമ്പർ താഴെ നൽകുക.</li>
        </ol>
        <form class="card">
          <label>UTR / UPI Reference നമ്പർ<input name="utr" inputmode="numeric" pattern="\\d{12}" maxlength="12" required placeholder="ഉദാ: 412345678901"></label>
          <span class="err" hidden></span>
          <button class="primary" type="submit">പേയ്മെന്റ് സ്ഥിരീകരിക്കുക</button>
        </form>
      </div>`);
    m.querySelector('.copy').onclick = () => navigator.clipboard?.writeText(o.upiId).then(() => { m.querySelector('.copy').textContent = 'കോപ്പി ചെയ്തു ✓'; });
    const form = m.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.err');
      const btn = form.querySelector('button');
      btn.disabled = true;
      const r = await api('/api/verify', { order: o.order, utr: form.utr.value }).catch(() => ({ status: 0 }));
      btn.disabled = false;
      if (r.status === 200 && r.token) return unlocked(r, topic);
      if (r.status === 202) return manualPending(o, r, topic, form.utr.value);
      err.hidden = false;
      err.textContent = r.error === 'bad_utr' ? '12 അക്കമുള്ള ശരിയായ UTR നമ്പർ നൽകുക.' : 'സ്ഥിരീകരണം പരാജയപ്പെട്ടു. വീണ്ടും ശ്രമിക്കുക.';
    });
  }

  function manualPending(o, r, topic, utr) {
    const wa = r.whatsapp ? `https://wa.me/${r.whatsapp}?text=${encodeURIComponent(`നമസ്കാരം, ഞാൻ ₹${o.amount} അടച്ചു. ഓർഡർ: ${o.id}, UTR: ${utr}`)}` : null;
    const m = bot(`
      <p>നന്ദി! 🙏 നിങ്ങളുടെ പേയ്മെന്റ് ഞങ്ങൾ പരിശോധിക്കുകയാണ്. സ്ഥിരീകരിച്ചാൽ നിങ്ങൾക്ക് ഒരു അൺലോക്ക് കോഡ് ലഭിക്കും.</p>
      <p>ഓർഡർ നമ്പർ: <code>${esc(o.id)}</code></p>
      ${wa ? `<p><a class="ghost" href="${wa}" target="_blank" rel="noopener">WhatsApp വഴി അറിയിക്കുക</a></p>` : ''}
      <form class="card">
        <label>അൺലോക്ക് കോഡ്<input name="code" maxlength="8" required></label>
        <span class="err" hidden></span>
        <button class="primary" type="submit">അൺലോക്ക് ചെയ്യുക</button>
      </form>`);
    const form = m.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r2 = await api('/api/verify', { order: o.order, utr, code: form.code.value }).catch(() => ({ status: 0 }));
      if (r2.status === 200 && r2.token) return unlocked(r2, topic);
      const err = form.querySelector('.err');
      err.hidden = false;
      err.textContent = 'കോഡ് ശരിയല്ല. ദയവായി പരിശോധിച്ച് വീണ്ടും നൽകുക.';
    });
  }

  function unlocked(t, topic) {
    addToken(t);
    localStorage.removeItem(KEY_PENDING);
    bot('<p class="ok">✅ പേയ്മെന്റ് സ്വീകരിച്ചു. നന്ദി! നിങ്ങളുടെ ഫലം തയ്യാറാക്കുന്നു…</p>');
    if (topic === 'porutham') return askPartner();
    if (topic === 'custom') return askCustom();
    runReading(topic);
  }

  // ---------- boot ----------
  document.getElementById('btn-edit').onclick = askDetails;
  document.getElementById('btn-menu').onclick = () => (profile ? showMenu() : askDetails());

  (async () => {
    const r = await api('/api/topics').catch(() => null);
    if (r && r.topics) config = r;
    bot(`<p>നമസ്കാരം! 🙏 <b>ജീവിതപങ്കാളി ജ്യോതിഷത്തിലേക്ക്</b> സ്വാഗതം.</p>
      <p>നിങ്ങളുടെ ജാതകം അടിസ്ഥാനമാക്കി ഭാവി ജീവിതപങ്കാളിയുടെ സ്വഭാവം, ജോലി, നാട്, പ്രണയവിവാഹമോ നിശ്ചയിച്ച വിവാഹമോ, വിവാഹസമയം, ചൊവ്വാദോഷം, നക്ഷത്രപ്പൊരുത്തം എന്നിവ ഞാൻ പറഞ്ഞുതരാം.</p>`);
    if (profile) {
      bot(`<p>വീണ്ടും സ്വാഗതം, ${esc(profile.name)}! മുമ്പ് നൽകിയ ജനനവിവരങ്ങൾ ഉപയോഗിക്കുന്നു (${esc(profile.dob)}, ${esc(profile.tob)}, ${esc(profile.placeName)}).</p>`);
      showMenu();
    } else {
      askDetails();
    }
  })();
})();
