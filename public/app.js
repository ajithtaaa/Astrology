(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const chat = $('#chat');
  const composer = $('#composer');
  const composerInput = $('#composer-input');
  const dialog = $('#pay-dialog');
  const payBody = $('#pay-body');
  const K = { profile: 'jp_profile_v2', tokens: 'jp_tokens', pending: 'jp_pending_v2' };

  const ICONS = {
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    rings: '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M10 5l2-2 2 2"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
    case: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
    pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    mars: '<circle cx="10" cy="14" r="5.5"/><path d="M14 10l6-6M15 4h5v5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    gps: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ICONS.chat}</svg>`;

  let config = { topics: {}, plans: { single: { amount: 49 }, full: { amount: 199 } }, upiId: '' };
  let profile = load(K.profile);
  let partner = null;
  let poller = null;

  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  function drop(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  async function api(path, data) {
    const res = await fetch(path, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : undefined);
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json };
  }

  // ------------------------------------------------------------ tokens
  const tokens = () => (load(K.tokens) || []).filter((t) => t.expires > Date.now());
  const tokenFor = (topic) => { const t = tokens().find((x) => x.topic === '*' || x.topic === topic); return t && t.token; };
  const addToken = (t) => save(K.tokens, [...tokens(), t]);

  // ------------------------------------------------------------ place picker (live search)
  function placePicker(host, initial) {
    host.innerHTML = `
      <span>ജനനസ്ഥലം</span>
      <div class="place-box">
        <div class="place-input">
          <input type="text" placeholder="സ്ഥലത്തിന്റെ പേര് ഇംഗ്ലീഷിൽ ടൈപ്പ് ചെയ്യുക (ഉദാ: Thrissur)" role="combobox" aria-expanded="false" aria-autocomplete="list" required>
          <button class="gps" type="button" title="ഇപ്പോഴുള്ള സ്ഥലം ഉപയോഗിക്കുക" aria-label="ഇപ്പോഴുള്ള സ്ഥലം">${icon('gps')}</button>
        </div>
        <ul class="suggest" role="listbox" hidden></ul>
      </div>
      <div class="place-chosen" hidden><span></span><code></code></div>`;
    const input = $('input', host);
    const list = $('.suggest', host);
    const chosen = $('.place-chosen', host);
    let value = initial && initial.lat != null ? initial : null;
    let items = [];
    let active = -1;
    let timer;
    let seq = 0;

    const show = (v) => {
      value = v;
      if (v) {
        input.value = v.placeName;
        chosen.hidden = false;
        $('span', chosen).textContent = '✓ ' + [v.region, v.country].filter(Boolean).join(', ');
        $('code', chosen).textContent = `${v.lat.toFixed(2)}, ${v.lon.toFixed(2)} · ${v.tz}`;
      } else chosen.hidden = true;
    };
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
    const render = () => {
      list.innerHTML = items.length
        ? items.map((p, i) => `<li role="option" data-i="${i}" aria-selected="${i === active}">${esc(p.name)}<small>${esc([p.region, p.country].filter(Boolean).join(', '))}</small></li>`).join('')
        : '<li class="empty">സ്ഥലം കണ്ടെത്താനായില്ല. അടുത്തുള്ള പട്ടണത്തിന്റെ പേര് ശ്രമിക്കുക.</li>';
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    };
    const pick = (p) => { show({ placeName: p.name, region: p.region, country: p.country, lat: p.lat, lon: p.lon, tz: p.tz }); close(); };

    input.addEventListener('input', () => {
      value = null; chosen.hidden = true;
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) return close();
      timer = setTimeout(async () => {
        const my = ++seq;
        list.innerHTML = '<li class="empty">തിരയുന്നു…</li>'; list.hidden = false;
        const r = await api(`/api/places?q=${encodeURIComponent(q)}`).catch(() => ({ results: [] }));
        if (my !== seq) return;
        items = r.results || []; active = items.length ? 0 : -1; render();
      }, 250);
    });
    input.addEventListener('keydown', (e) => {
      if (list.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { active = (active + 1) % items.length; render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = (active - 1 + items.length) % items.length; render(); e.preventDefault(); }
      else if (e.key === 'Enter') { if (active >= 0) { pick(items[active]); e.preventDefault(); } }
      else if (e.key === 'Escape') close();
    });
    list.addEventListener('mousedown', (e) => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); pick(items[+li.dataset.i]); } });
    input.addEventListener('blur', () => setTimeout(close, 150));
    $('.gps', host).addEventListener('click', () => {
      if (!navigator.geolocation) return;
      input.value = 'സ്ഥലം കണ്ടെത്തുന്നു…';
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const r = await api(`/api/places?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`).catch(() => ({}));
        if (r.result) pick(r.result); else input.value = '';
      }, () => { input.value = ''; input.placeholder = 'ലൊക്കേഷൻ അനുമതി ലഭിച്ചില്ല – പേര് ടൈപ്പ് ചെയ്യുക'; }, { timeout: 10000 });
    });
    show(value);
    return { get: () => value };
  }

  // ------------------------------------------------------------ chat primitives
  let lastMsg = null;
  const scroll = () => requestAnimationFrame(() => { if (lastMsg && profile) lastMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  const bot = (html, quiet) => { const m = el(`<div class="msg bot">${html}</div>`); chat.appendChild(m); if (!quiet) { lastMsg = m; scroll(); } return m; };
  const say = (html) => bot(`<div class="bubble">${html}</div>`);
  const user = (t) => { lastMsg = el(`<div class="msg user">${esc(t)}</div>`); chat.appendChild(lastMsg); scroll(); };
  const typing = () => bot('<div class="typing"><span></span><span></span><span></span></div>');

  function badgeFor(id, t) {
    if (t.free) return '<span class="badge free">സൗജന്യം</span>';
    if (tokenFor(id)) return '<span class="badge open">ലഭ്യമാണ്</span>';
    return `<span class="badge paid">₹${config.plans.single.amount}</span>`;
  }
  const topicCard = (id, t, tag = 'button') => `<${tag} class="topic" ${tag === 'button' ? `type="button" data-topic="${id}"` : ''}><span class="ic">${icon(t.icon)}</span><b>${esc(t.title)}</b><small>${esc(t.desc)}</small>${badgeFor(id, t)}</${tag}>`;

  function showTopics(intro = 'അടുത്തതായി എന്താണ് അറിയേണ്ടത്?', quiet = false) {
    composer.hidden = true;
    const m = bot(`<div class="bubble"><p>${intro}</p></div><div class="topic-grid" style="margin-top:12px">${Object.entries(config.topics).map(([id, t]) => topicCard(id, t)).join('')}</div>`, quiet);
    m.querySelectorAll('.topic').forEach((b) => b.addEventListener('click', () => pickTopic(b.dataset.topic)));
  }

  // ------------------------------------------------------------ profile
  const form = $('#birth-form');
  const selfPlace = placePicker($('.place-field', form), profile);

  function fillForm(p) {
    if (!p) return;
    form.elements.name.value = p.name || '';
    form.querySelectorAll('input[name=gender]').forEach((r) => { r.checked = r.value === p.gender; });
    form.dob.value = p.dob || '';
    form.tob.value = p.tob || '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.form-error', form);
    const place = selfPlace.get();
    const gender = form.querySelector('input[name=gender]:checked');
    const problem = !form.elements.name.value.trim() ? 'ദയവായി പേര് നൽകുക.' : !gender ? 'ലിംഗം തിരഞ്ഞെടുക്കുക.' : !form.dob.value ? 'ജനനത്തീയതി നൽകുക.' : !form.tob.value ? 'ജനനസമയം നൽകുക.' : !place ? 'ലിസ്റ്റിൽ നിന്ന് ജനനസ്ഥലം തിരഞ്ഞെടുക്കുക.' : '';
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    err.hidden = true;
    const first = !profile;
    profile = { name: form.elements.name.value.trim(), gender: gender.value, dob: form.dob.value, tob: form.tob.value, ...place };
    save(K.profile, profile);
    await showProfile();
    if (first) chat.innerHTML = '';
    say(`<p>${esc(profile.name)}, നിങ്ങളുടെ ജാതകം തയ്യാറായി. 🙏</p><p>ആദ്യം പങ്കാളിയുടെ സ്വഭാവവും വിവാഹയോഗവും സൗജന്യമായി നോക്കാം. കൂടുതൽ വിശദമായ ചോദ്യങ്ങൾ താഴെയുണ്ട്.</p>`);
    showTopics('താഴെയുള്ളവയിൽ നിന്ന് ഒന്ന് തിരഞ്ഞെടുക്കുക:');
    if (window.innerWidth < 980) $('.chat-panel').scrollIntoView({ behavior: 'smooth' });
  });

  $('#edit-profile').addEventListener('click', () => { fillForm(profile); form.hidden = false; $('#profile-view').hidden = true; $('#edit-profile').hidden = true; });

  async function showProfile() {
    const r = await api('/api/chart', profile).catch(() => ({}));
    form.hidden = true;
    $('#profile-view').hidden = false;
    $('#edit-profile').hidden = false;
    $('#pv-initial').textContent = (profile.name || '?').trim().charAt(0);
    $('#pv-name').textContent = profile.name;
    const d = new Date(profile.dob + 'T00:00');
    $('#pv-meta').textContent = `${d.toLocaleDateString('ml-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · ${profile.tob} · ${profile.placeName}`;
    $('#chat-sub').textContent = `ജാതകം: ${profile.name}`;
    if (r.signs) {
      // South Indian chart: fixed sign positions, Pisces at top-left going clockwise.
      const pos = { 11: [0, 0], 0: [0, 1], 1: [0, 2], 2: [0, 3], 3: [1, 3], 4: [2, 3], 5: [3, 3], 6: [3, 2], 7: [3, 1], 8: [3, 0], 9: [2, 0], 10: [1, 0] };
      const cells = Object.entries(pos).map(([s, [row, col]]) => `<div class="cell" style="grid-row:${row + 1};grid-column:${col + 1}">${r.signs[s].map((p) => `<span class="${p === 'ല' ? 'lg' : ''}">${p}</span>`).join('')}<i>${r.rashiNames[s]}</i></div>`).join('');
      $('#rasi-chart').innerHTML = cells + `<div class="center">രാശിചക്രം<br>${esc(r.nakshatra)}</div>`;
      $('#pv-kv').innerHTML = `<dt>ലഗ്നം</dt><dd>${esc(r.lagna)}</dd><dt>കൂറ്</dt><dd>${esc(r.moonSign)}</dd><dt>നക്ഷത്രം</dt><dd>${esc(r.nakshatra)}</dd><dt>ദശ</dt><dd>${esc(r.dasha)}</dd>`;
    }
  }

  // ------------------------------------------------------------ topics & readings
  function pickTopic(topic) {
    if (!profile) { say('<p>ആദ്യം ഇടതുവശത്ത് ജനനവിവരങ്ങൾ നൽകുക.</p>'); form.scrollIntoView({ behavior: 'smooth' }); return; }
    const t = config.topics[topic];
    user(t.title);
    if (!t.free && !tokenFor(topic)) return openPay(topic);
    proceed(topic);
  }

  function proceed(topic) {
    if (topic === 'porutham') return askPartner();
    if (topic === 'custom') return askCustom();
    runReading(topic);
  }

  function askPartner() {
    const other = profile.gender === 'female' ? 'വരന്റെ' : 'വധുവിന്റെ';
    const m = bot(`<div class="bubble"><p>പൊരുത്തം നോക്കാൻ ${other} ജനനവിവരങ്ങൾ നൽകുക.</p>
      <form class="form" style="padding:8px 0 0" novalidate>
        <label class="field"><span>പേര്</span><input name="pname" required maxlength="40" value="${esc(partner?.name || '')}"></label>
        <div class="row2">
          <label class="field"><span>ജനനത്തീയതി</span><input type="date" name="pdob" required value="${esc(partner?.dob || '')}"></label>
          <label class="field"><span>ജനനസമയം</span><input type="time" name="ptob" required value="${esc(partner?.tob || '')}"></label>
        </div>
        <div class="field pplace"></div>
        <p class="form-error" hidden></p>
        <button class="btn btn-primary" type="submit">പൊരുത്തം നോക്കുക</button>
      </form></div>`);
    const f = $('form', m);
    const pp = placePicker($('.pplace', f), partner);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const place = pp.get();
      const err = $('.form-error', f);
      if (!f.pname.value.trim() || !f.pdob.value || !f.ptob.value || !place) { err.textContent = 'എല്ലാ വിവരങ്ങളും നൽകി, സ്ഥലം ലിസ്റ്റിൽ നിന്ന് തിരഞ്ഞെടുക്കുക.'; err.hidden = false; return; }
      partner = { name: f.pname.value.trim(), dob: f.pdob.value, tob: f.ptob.value, ...place };
      m.remove();
      user(`${partner.name} · ${partner.dob} · ${partner.tob} · ${partner.placeName}`);
      runReading('porutham');
    });
    scroll();
  }

  function askCustom() {
    say('<p>ബന്ധങ്ങളെക്കുറിച്ചോ വിവാഹത്തെക്കുറിച്ചോ നിങ്ങൾക്ക് അറിയേണ്ട കാര്യം താഴെ എഴുതി അയയ്ക്കുക.</p>');
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
  composerInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); composer.requestSubmit(); } });

  async function runReading(topic, question) {
    const wait = typing();
    const r = await api('/api/reading', { topic, self: profile, partner, question, token: tokenFor(topic) }).catch(() => ({ status: 0 }));
    wait.remove();
    if (r.status === 402) return openPay(topic);
    if (r.status !== 200) { say('<p>ക്ഷമിക്കണം, ഫലം തയ്യാറാക്കുന്നതിൽ ഒരു തടസ്സം നേരിട്ടു. ഒന്നുകൂടി ശ്രമിക്കാമോ?</p>'); return showTopics(); }
    const body = r.sections.map((s) => `<section class="report-sec"><h4>${esc(s.h)}</h4>${s.table ? `<table class="ptable">${s.table.map((row) => `<tr><td><span class="${row.ok ? 'ok-dot' : 'no-dot'}">${row.ok ? '✓' : '✕'}</span></td><td><b>${esc(row.name)}</b><small>${esc(row.note)}${row.detail ? ' · ' + esc(row.detail) : ''}</small></td></tr>`).join('')}</table>` : ''}${(s.p || []).map((p) => `<p>${esc(p)}</p>`).join('')}</section>`).join('');
    const m = bot(`<article class="report">
      <header class="report-head"><h3>${esc(r.title)}</h3><div class="chips">${r.summary.map((s) => `<span>${esc(s)}</span>`).join('')}</div></header>
      <div class="report-body">${body}</div>
      <footer class="report-foot"><p class="fine">${esc(r.disclaimer)}</p><button class="btn btn-ghost btn-sm share" type="button">പങ്കിടുക / പകർത്തുക</button></footer>
    </article>`);
    $('.share', m).addEventListener('click', async () => {
      const text = `${r.title}\n\n` + r.sections.map((s) => `${s.h}\n${(s.table || []).map((t) => `${t.ok ? '✓' : '✕'} ${t.name}`).join('\n')}${s.table ? '\n' : ''}${(s.p || []).join('\n')}`).join('\n\n');
      if (navigator.share) { navigator.share({ title: r.title, text }).catch(() => {}); return; }
      await navigator.clipboard?.writeText(text);
      $('.share', m).textContent = 'പകർത്തി ✓';
    });
    showTopics(undefined, true);
    requestAnimationFrame(() => m.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  // ------------------------------------------------------------ payment
  function openPay(topic) {
    const t = config.topics[topic];
    const { single, full } = config.plans;
    payBody.innerHTML = `
      <div class="dlg-head"><div><h3 id="pay-title">വിശദ ഫലം കാണാൻ</h3><p>"${esc(t.title)}"</p></div><button class="x" type="button" aria-label="അടയ്ക്കുക">×</button></div>
      <div class="plans">
        <button class="plan" data-plan="single" type="button"><b>ഈ ചോദ്യം മാത്രം</b><small>24 മണിക്കൂർ വീണ്ടും കാണാം</small><span class="amt">₹${single.amount}</span></button>
        <button class="plan" data-plan="full" type="button"><b>സമ്പൂർണ്ണ ജാതക പരിശോധന</b><small>എല്ലാ ചോദ്യങ്ങളും പൊരുത്തവും · 30 ദിവസം</small><span class="amt">₹${full.amount}</span></button>
      </div>
      <p class="fine" style="margin-top:14px">Google Pay, PhonePe, Paytm, BHIM തുടങ്ങി ഏത് UPI ആപ്പും ഉപയോഗിക്കാം.</p>`;
    $('.x', payBody).onclick = () => dialog.close();
    payBody.querySelectorAll('.plan').forEach((b) => b.addEventListener('click', () => startOrder(b.dataset.plan, topic, b)));
    if (!dialog.open) dialog.showModal();
  }

  async function startOrder(plan, topic, btn) {
    payBody.querySelectorAll('.plan').forEach((b) => (b.disabled = true));
    btn.querySelector('.amt').innerHTML = '<span class="spinner"></span>';
    const o = await api('/api/order', { plan, topic }).catch(() => ({ status: 0 }));
    if (o.status !== 200) {
      payBody.querySelectorAll('.plan').forEach((b) => (b.disabled = false));
      btn.querySelector('.amt').textContent = 'വീണ്ടും';
      return;
    }
    save(K.pending, { order: o.order, id: o.id, amount: o.amount, topic, expires: o.expires });
    renderPay(o, topic);
  }

  function renderPay(o, topic) {
    payBody.innerHTML = `
      <div class="dlg-head"><div><h3>UPI വഴി പണമടയ്ക്കുക</h3><p class="order-id">ഓർഡർ ${esc(o.id)}</p></div><button class="x" type="button" aria-label="അടയ്ക്കുക">×</button></div>
      <div class="paybox">
        <div class="amount-big">₹${esc(o.amount)}<small>പൈസ ഉൾപ്പെടെ ഈ കൃത്യം തുക തന്നെ അടയ്ക്കുക – അങ്ങനെയാണ് നിങ്ങളുടെ പേയ്മെന്റ് തിരിച്ചറിയുന്നത്</small></div>
        ${isMobile ? `<a class="btn btn-primary btn-block" href="${esc(o.upi)}">UPI ആപ്പിൽ പണമടയ്ക്കുക</a><p class="fine">അല്ലെങ്കിൽ മറ്റൊരു ഫോണിൽ നിന്ന് ഈ QR സ്കാൻ ചെയ്യുക</p>` : '<p class="fine" style="margin:0">ഫോണിലെ UPI ആപ്പ് ഉപയോഗിച്ച് ഈ QR കോഡ് സ്കാൻ ചെയ്യുക</p>'}
        <div class="qr">${o.qr}</div>
        <div class="upi-row">UPI ഐഡി <code>${esc(o.upiId)}</code><button class="link copy" type="button">കോപ്പി</button></div>
        <div class="status" id="pay-status"><span class="spinner"></span><span>പേയ്മെന്റ് കാത്തിരിക്കുന്നു… <span id="pay-timer"></span></span></div>
        <details class="utr">
          <summary>പണമടച്ചിട്ടും സ്ഥിരീകരിച്ചില്ലേ?</summary>
          <p class="fine">UPI ആപ്പിലെ ഇടപാട് വിവരങ്ങളിൽ കാണുന്ന 12 അക്ക UTR / UPI Reference നമ്പർ നൽകുക.</p>
          <form><input name="utr" inputmode="numeric" maxlength="12" placeholder="ഉദാ: 412345678901"><button class="btn btn-ghost btn-sm" type="submit">പരിശോധിക്കുക</button></form>
          <p class="utr-msg" hidden></p>
        </details>
      </div>`;
    $('.x', payBody).onclick = () => dialog.close();
    $('.copy', payBody).onclick = (e) => navigator.clipboard?.writeText(o.upiId).then(() => { e.target.textContent = 'കോപ്പി ചെയ്തു ✓'; });
    const f = $('.utr form', payBody);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('.utr-msg', payBody);
      const utr = f.utr.value.replace(/\D/g, '');
      if (utr.length !== 12) { msg.hidden = false; msg.className = 'utr-msg err'; msg.textContent = '12 അക്കമുള്ള UTR നമ്പർ നൽകുക.'; return; }
      const r = await api('/api/verify', { order: o.order, utr });
      if (r.status === 200 && r.token) return paid(r, topic);
      msg.hidden = false;
      msg.className = r.status === 202 ? 'utr-msg' : 'utr-msg err';
      msg.textContent = r.status === 202 ? 'ഈ UTR-ലുള്ള പേയ്മെന്റ് ഇതുവരെ ബാങ്കിൽ നിന്ന് എത്തിയിട്ടില്ല. എത്തിയാലുടൻ താനേ തുറക്കും – ഈ വിൻഡോ തുറന്നുവയ്ക്കുക.'
        : r.error === 'utr_used' ? 'ഈ UTR മറ്റൊരു ഓർഡറിന് ഉപയോഗിച്ചതാണ്.'
          : r.error === 'amount_low' ? 'ഈ UTR-ലെ തുക ഓർഡർ തുകയേക്കാൾ കുറവാണ്.' : 'പരിശോധിക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.';
    });
    startPolling(o, topic);
  }

  function startPolling(o, topic) {
    clearInterval(poller);
    const tick = async () => {
      const left = o.expires - Date.now();
      const tEl = $('#pay-timer');
      if (tEl) tEl.textContent = left > 0 ? `(${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')})` : '';
      if (left < -10 * 60 * 1000) { clearInterval(poller); drop(K.pending); return; }
      if (Math.floor(Date.now() / 1000) % 4) return;
      const r = await api('/api/verify', { order: o.order }).catch(() => ({}));
      if (r.status === 200 && r.token) paid(r, topic);
    };
    poller = setInterval(tick, 1000);
    tick();
  }
  document.addEventListener('visibilitychange', async () => {
    const p = load(K.pending);
    if (document.visibilityState === 'visible' && p) {
      const r = await api('/api/verify', { order: p.order }).catch(() => ({}));
      if (r.status === 200 && r.token) paid(r, p.topic);
    }
  });

  function paid(t, topic) {
    clearInterval(poller);
    drop(K.pending);
    addToken(t);
    const st = $('#pay-status');
    if (st && dialog.open) {
      st.className = 'status ok';
      st.innerHTML = '✓ പേയ്മെന്റ് ലഭിച്ചു. നന്ദി!';
      setTimeout(() => dialog.close(), 1200);
    }
    say('<p>✓ പേയ്മെന്റ് ലഭിച്ചു. നന്ദി! നിങ്ങളുടെ ഫലം തയ്യാറാക്കുന്നു…</p>');
    proceed(topic);
  }

  // ------------------------------------------------------------ boot
  $('#show-topics').addEventListener('click', () => (profile ? showTopics('എന്താണ് അറിയേണ്ടത്?') : form.scrollIntoView({ behavior: 'smooth' })));

  (async () => {
    const r = await api('/api/topics').catch(() => null);
    if (r && r.topics) config = r;
    document.querySelectorAll('[data-price]').forEach((n) => { n.textContent = config.plans[n.dataset.price].amount; });
    $('#footer-upi').textContent = config.upiId;
    $('#topic-showcase').innerHTML = Object.entries(config.topics).map(([id, t]) => topicCard(id, t, 'div')).join('');
    if (profile) {
      await showProfile();
      say(`<p>വീണ്ടും സ്വാഗതം, ${esc(profile.name)}! 🙏 നിങ്ങളുടെ ജാതകം തയ്യാറാണ്.</p>`);
      showTopics('ഇന്ന് എന്താണ് അറിയേണ്ടത്?');
      const p = load(K.pending);
      if (p && p.expires > Date.now() - 10 * 60 * 1000) startPolling(p, p.topic);
    } else {
      say('<p>നമസ്കാരം! 🙏</p><p>ജാതകം നോക്കി നിങ്ങളുടെ ഭാവി ജീവിതപങ്കാളിയെക്കുറിച്ച് – സ്വഭാവം, ജോലി, നാട്, വിവാഹസമയം, പ്രണയവിവാഹമോ എന്നതൊക്കെ – വിശദമായി പറഞ്ഞുതരാം.</p><p>തുടങ്ങാൻ നിങ്ങളുടെ ജനനവിവരങ്ങൾ നൽകുക.</p>');
    }
  })();
})();
