(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const chat = $('#chat');
  const composer = $('#composer');
  const composerInput = $('#composer-input');
  const dialog = $('#pay-dialog');
  const payBody = $('#pay-body');
  const K = { profile: 'jp_profile_v2', account: 'jp_account', seen: 'jp_seen_requests' };

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

  let config = { topics: {}, upiId: '' };
  let profile = load(K.profile);
  let partner = null;
  let poller = null;
  let account = load(K.account); // { session, name, phone }
  let status = { unlocked: [], requests: [] };

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

  // ------------------------------------------------------------ account
  const isOpen = (topic) => config.topics[topic]?.free || status.unlocked.includes(topic);
  const pendingFor = (topic) => status.requests.find((r) => r.topic === topic && r.status === 'pending');
  async function refreshStatus() {
    if (!account) return;
    const r = await api('/api/user', { session: account.session }).catch(() => ({}));
    if (r.status === 401) return signOut();
    if (r.user) status = { unlocked: r.unlocked || [], requests: r.requests || [] };
  }

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
    if (id !== 'custom' && isOpen(id)) return '<span class="badge open">ലഭ്യമാണ്</span>';
    if (id !== 'custom' && pendingFor(id)) return '<span class="badge paid">പരിശോധനയിൽ</span>';
    return `<span class="badge paid">₹${t.price}</span>`;
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
    if (!account) { say('<p>ആദ്യം പേരും ഫോൺ നമ്പറും നൽകി പ്രവേശിക്കുക.</p>'); signinForm.scrollIntoView({ behavior: 'smooth' }); return; }
    if (!profile) { say('<p>ആദ്യം ഇടതുവശത്ത് ജനനവിവരങ്ങൾ നൽകുക.</p>'); form.scrollIntoView({ behavior: 'smooth' }); return; }
    const t = config.topics[topic];
    user(t.title);
    if (topic === 'custom') return askCustom();
    if (!isOpen(topic)) return pendingFor(topic) ? waitingNote(topic) : openPay(topic);
    proceed(topic);
  }

  function proceed(topic) {
    if (topic === 'porutham') return askPartner();
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
    openPay('custom', q);
  });
  composerInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); composer.requestSubmit(); } });

  async function runReading(topic, requestId) {
    const wait = typing();
    const r = await api('/api/reading', { topic, self: profile, partner, session: account?.session, requestId }).catch(() => ({ status: 0 }));
    wait.remove();
    if (r.status === 402) return topic === 'custom' ? askCustom() : openPay(topic);
    if (r.status === 401) return signOut();
    if (r.status !== 200) { say('<p>ക്ഷമിക്കണം, ഫലം തയ്യാറാക്കുന്നതിൽ ഒരു തടസ്സം നേരിട്ടു. ഒന്നുകൂടി ശ്രമിക്കാമോ?</p>'); return showTopics(); }
    const body = r.sections.map((s) => `<section class="report-sec"><h4>${esc(s.h)}</h4>${s.table ? `<table class="ptable">${s.table.map((row) => `<tr><td><span class="${row.ok ? 'ok-dot' : 'no-dot'}">${row.ok ? '✓' : '✕'}</span></td><td><b>${esc(row.name)}</b><small>${esc(row.note)}${row.detail ? ' · ' + esc(row.detail) : ''}</small></td></tr>`).join('')}</table>` : ''}${(s.p || []).map((p) => `<p>${esc(p)}</p>`).join('')}</section>`).join('');
    const m = bot(`<article class="report">
      <header class="report-head"><h3>${esc(r.title)}</h3><div class="chips">${r.summary.map((s) => `<span>${esc(s)}</span>`).join('')}</div></header>
      <div class="report-body">${body}</div>
      <footer class="report-foot"><span></span><button class="btn btn-ghost btn-sm share" type="button">പങ്കിടുക / പകർത്തുക</button></footer>
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

  // ------------------------------------------------------------ payment (manual: pay to QR, enter payer name, admin approves)
  function openPay(topic, question) {
    const t = config.topics[topic];
    const qrSrc = `/api/topics?qr=1&v=${config.qrVersion}`;
    const upiLink = config.upiId ? `upi://pay?pa=${encodeURIComponent(config.upiId)}&pn=${encodeURIComponent(config.payee || '')}&am=${t.price}&cu=INR` : '';
    payBody.innerHTML = `
      <div class="dlg-head"><div><h3 id="pay-title">${esc(t.title)}</h3><p>ഈ ചോദ്യത്തിനുള്ള തുക: <b>₹${t.price}</b></p></div><button class="x" type="button" aria-label="അടയ്ക്കുക">×</button></div>
      <div class="pay-steps">
        <div class="pay-step">
          <h4><span>1</span>താഴെയുള്ള QR കോഡിലേക്ക് ₹${t.price} അടയ്ക്കുക</h4>
          <img class="qr-img" src="${qrSrc}" alt="പേയ്മെന്റ് QR കോഡ്">
          <div class="qr-actions">
            <a class="btn btn-ghost btn-sm" href="${qrSrc}&download=1" download>QR ഡൗൺലോഡ് ചെയ്യുക</a>
            ${isMobile && upiLink ? `<a class="btn btn-primary btn-sm" href="${esc(upiLink)}">UPI ആപ്പിൽ തുറക്കുക</a>` : ''}
          </div>
          ${config.upiId ? `<p class="fine" style="text-align:center;margin-top:8px">UPI ഐഡി: <b>${esc(config.upiId)}</b></p>` : ''}
        </div>
        <form class="pay-step" id="payer-form">
          <h4><span>2</span>പണമടച്ച പേര് നൽകുക</h4>
          <label class="field"><span>Google Pay / PhonePe / UPI ആപ്പിൽ കാണുന്ന നിങ്ങളുടെ പേര്</span><input name="payer" required maxlength="80" value="${esc(account?.name || '')}"></label>
          <p class="fine" style="margin:6px 0 10px">ഇതിനകം പണമടച്ചെങ്കിൽ പേര് മാത്രം നൽകിയാൽ മതി.</p>
          <p class="form-error" hidden></p>
          <button class="btn btn-primary btn-block" type="submit">പണമടച്ചു – സ്ഥിരീകരിക്കുക</button>
        </form>
      </div>`;
    $('.x', payBody).onclick = () => dialog.close();
    const f = $('#payer-form', payBody);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('.form-error', f);
      if (!f.payer.value.trim()) { err.textContent = 'പണമടച്ച പേര് നൽകുക.'; err.hidden = false; return; }
      f.querySelector('button').disabled = true;
      const r = await api('/api/order', { session: account.session, topic, payerName: f.payer.value, question }).catch(() => ({ status: 0 }));
      f.querySelector('button').disabled = false;
      if (r.status === 401) { dialog.close(); return signOut(); }
      if (r.status !== 200) { err.textContent = 'അയയ്ക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.'; err.hidden = false; return; }
      status.requests.push({ ...r.request, payerName: f.payer.value, question });
      dialog.close();
      waitingNote(topic);
      startPolling();
    });
    if (!dialog.open) dialog.showModal();
  }

  function waitingNote(topic) {
    const wa = config.whatsapp ? ` <a href="https://wa.me/${esc(config.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : '';
    say(`<p>നന്ദി! 🙏 "${esc(config.topics[topic].title)}" എന്ന ചോദ്യത്തിനുള്ള പേയ്മെന്റ് ഞങ്ങൾ പരിശോധിക്കുകയാണ്.</p><p>സ്ഥിരീകരിച്ചാലുടൻ ഫലം ഇവിടെ താനേ വരും – ഈ പേജ് തുറന്നുവയ്ക്കുക.${wa ? ' സംശയങ്ങൾക്ക്:' + wa : ''}</p>`);
  }

  // Watch pending requests; when the admin approves one, show its answer.
  function startPolling() {
    clearInterval(poller);
    poller = setInterval(checkApprovals, 8000);
  }
  async function checkApprovals() {
    const before = new Set(status.requests.filter((r) => r.status === 'pending').map((r) => r.id));
    await refreshStatus();
    const seen = new Set(load(K.seen) || []);
    const fresh = status.requests.filter((r) => r.status !== 'pending' && !seen.has(r.id) && (before.has(r.id) || r.topic === 'custom'));
    for (const r of fresh) {
      seen.add(r.id);
      save(K.seen, [...seen]);
      const t = config.topics[r.topic];
      if (r.status === 'approved') {
        say(`<p>✓ പേയ്മെന്റ് സ്ഥിരീകരിച്ചു. നന്ദി! "${esc(t.title)}" – നിങ്ങളുടെ ഫലം തയ്യാറാക്കുന്നു…</p>`);
        if (r.topic === 'custom') runReading('custom', r.id); else proceed(r.topic);
      } else {
        say(`<p>ക്ഷമിക്കണം, "${esc(t.title)}" എന്ന ചോദ്യത്തിനുള്ള പേയ്മെന്റ് കണ്ടെത്താനായില്ല. പണമടച്ച പേര് ശരിയാണോ എന്ന് പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.</p>`);
      }
    }
    if (!status.requests.some((r) => r.status === 'pending')) clearInterval(poller);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && status.requests.some((r) => r.status === 'pending')) checkApprovals(); });

  // ------------------------------------------------------------ sign in
  const signinForm = $('#signin-form');
  function showSignedIn() {
    signinForm.hidden = true;
    $('#who-chip').hidden = false;
    $('#who-name').textContent = account.name;
  }
  function signOut() {
    clearInterval(poller);
    account = null; profile = null; status = { unlocked: [], requests: [] };
    [K.account, K.profile, K.seen].forEach(drop);
    location.reload();
  }
  $('#logout').addEventListener('click', signOut);
  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.form-error', signinForm);
    const name = signinForm.uname.value.trim();
    const phone = signinForm.uphone.value.trim();
    if (name.length < 2) { err.textContent = 'ദയവായി പേര് നൽകുക.'; err.hidden = false; return; }
    if (phone.replace(/\D/g, '').length < 10) { err.textContent = 'ശരിയായ ഫോൺ നമ്പർ നൽകുക.'; err.hidden = false; return; }
    const r = await api('/api/user', { action: 'login', name, phone }).catch(() => ({ status: 0 }));
    if (r.status !== 200) { err.textContent = r.error === 'bad_phone' ? 'ശരിയായ ഫോൺ നമ്പർ നൽകുക.' : 'പ്രവേശിക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.'; err.hidden = false; return; }
    account = { session: r.session, name: r.user.name, phone: r.user.phone };
    save(K.account, account);
    await refreshStatus();
    showSignedIn();
    form.hidden = false;
    form.elements.name.value = form.elements.name.value || name;
    say(`<p>സ്വാഗതം, ${esc(name)}! 🙏 ഇനി നിങ്ങളുടെ ജനനവിവരങ്ങൾ നൽകുക.</p>`);
  });

  // ------------------------------------------------------------ boot
  $('#show-topics').addEventListener('click', () => (profile ? showTopics('എന്താണ് അറിയേണ്ടത്?') : form.scrollIntoView({ behavior: 'smooth' })));

  (async () => {
    const r = await api('/api/topics').catch(() => null);
    if (r && r.topics) config = r;
    $('#price-list').innerHTML = Object.values(config.topics).map((t) => `<div><span>${esc(t.title)}</span><b>${t.free ? 'സൗജന്യം' : '₹' + t.price}</b></div>`).join('');
    if (!account) {
      signinForm.hidden = false;
      say('<p>നമസ്കാരം! 🙏</p><p>ജാതകം നോക്കി നിങ്ങളുടെ ഭാവി ജീവിതപങ്കാളിയെക്കുറിച്ച് – സ്വഭാവം, ജോലി, നാട്, വിവാഹസമയം, പ്രണയവിവാഹമോ എന്നതൊക്കെ – വിശദമായി പറഞ്ഞുതരാം.</p><p>തുടങ്ങാൻ നിങ്ങളുടെ പേരും ഫോൺ നമ്പറും നൽകി പ്രവേശിക്കുക.</p>');
      return;
    }
    showSignedIn();
    await refreshStatus();
    if (!account) return;
    if (profile) {
      await showProfile();
      say(`<p>വീണ്ടും സ്വാഗതം, ${esc(account.name)}! 🙏 നിങ്ങളുടെ ജാതകം തയ്യാറാണ്.</p>`);
      showTopics('ഇന്ന് എന്താണ് അറിയേണ്ടത്?');
      await checkApprovals();
      if (status.requests.some((q) => q.status === 'pending')) startPolling();
    } else {
      form.hidden = false;
      form.elements.name.value = account.name;
      say(`<p>സ്വാഗതം, ${esc(account.name)}! 🙏 നിങ്ങളുടെ ജനനവിവരങ്ങൾ നൽകുക.</p>`);
    }
  })();
})();
