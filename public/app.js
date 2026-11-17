// Pass the Aux: a shared song queue for a party.
// One device plays the music (YouTube), everyone else queues and reorders songs.

const CFG = window.PARTY_CONFIG || {};
const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/12.19.0';
const startParams = new URLSearchParams(location.search);
const DEMO = startParams.has('demo');
const NS = DEMO ? `pta-demo:${startParams.get('demo') || 'me'}:` : 'pta:';

/* ---------- small helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const possessive = (n) => n + (/s$/i.test(n) ? "'" : "'s");
const fmt = (sec) => {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
};
const decodeEntities = (s) => { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; };
const cleanCode = (c) => { c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return c.length >= 4 && c.length <= 8 ? c : ''; };

const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(NS + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(NS + k); } catch { /* storage unavailable */ } }
};

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  skip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14l9-7zM16 5h3v14h-3z"/></svg>',
  grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
};

/* ---------- avatars ---------- */

const PRESETS = [
  ['🦊', '#FFB870'], ['🐼', '#CFF3E3'], ['🐸', '#C2F296'], ['🦁', '#FFD338'],
  ['🐙', '#FFA3B1'], ['🦄', '#E4CCFF'], ['🐧', '#BEE2FF'], ['🐯', '#FFC489'],
  ['🐨', '#D6DCEA'], ['🦉', '#EACDA6'], ['🐵', '#F6D3BA'], ['🐳', '#A3E5F6']
];

function avatarHTML(av, cls = '') {
  if (typeof av === 'string' && av.startsWith('data:image/')) {
    return `<span class="av ${cls}"><img src="${esc(av)}" alt=""></span>`;
  }
  const p = PRESETS[parseInt(String(av || '').slice(2), 10)] || PRESETS[0];
  return `<span class="av ${cls}" style="--av:${p[1]}"><span aria-hidden="true">${p[0]}</span></span>`;
}

async function fileToAvatar(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 128, 128);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

function guessDevice() {
  const ua = navigator.userAgent, touch = navigator.maxTouchPoints > 1;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux PC';
  return 'device';
}

/* ---------- data stores ---------- */
// Both stores expose the same small surface so the app does not care which one is in use.

async function createFirebaseStore() {
  let fc = CFG.firebase;
  if (!fc || !fc.apiKey || !fc.databaseURL) {
    // On Firebase Hosting the project config is served automatically.
    try {
      const r = await fetch('/__/firebase/init.json');
      const j = r.ok ? await r.json() : null;
      if (j && j.apiKey && j.databaseURL) fc = j;
    } catch { /* not on Firebase Hosting */ }
  }
  if (!fc || !fc.apiKey || !fc.databaseURL) throw Object.assign(new Error('Firebase is not set up yet'), { code: 'not-configured' });

  const [appM, authM, dbM] = await Promise.all([
    import(`${FIREBASE_SDK}/firebase-app.js`),
    import(`${FIREBASE_SDK}/firebase-auth.js`),
    import(`${FIREBASE_SDK}/firebase-database.js`)
  ]);
  const app = appM.initializeApp(fc);
  const auth = authM.getAuth(app);
  // Anonymous sign-in is remembered by the browser, so a returning device keeps its identity.
  const existing = await new Promise((res) => { const stop = authM.onAuthStateChanged(auth, (u) => { stop(); res(u); }); });
  const uid = (existing || (await authM.signInAnonymously(auth)).user).uid;
  const db = dbM.getDatabase(app);
  const ref = (p) => dbM.ref(db, p);
  let offset = 0;
  dbM.onValue(ref('.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });

  return {
    uid,
    now: () => Date.now() + offset,
    get: (p) => dbM.get(ref(p)).then((s) => s.val()),
    watch: (p, cb, onErr) => dbM.onValue(ref(p), (s) => cb(s.val()), (e) => onErr && onErr(e)),
    set: (p, v) => dbM.set(ref(p), v),
    update: (p, obj) => dbM.update(ref(p), obj),
    remove: (p) => dbM.remove(ref(p)),
    tx: (p, fn) => dbM.runTransaction(ref(p), fn),
    newKey: (p) => dbM.push(ref(p)).key,
    presence(p, on, off) {
      const stop = dbM.onValue(ref('.info/connected'), (s) => {
        if (s.val() !== true) return;
        dbM.onDisconnect(ref(p)).update(off).then(() => dbM.update(ref(p), on())).catch(() => {});
      });
      return () => { stop(); dbM.onDisconnect(ref(p)).cancel().catch(() => {}); return dbM.update(ref(p), off).catch(() => {}); };
    }
  };
}

// Demo store: keeps everything in this browser and syncs between tabs.
// Open the app with ?demo to try it without Firebase.
function createLocalStore() {
  const KEY = 'pta-demo-tree';
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('pta-demo') : null;
  const subs = new Set();
  let uid = ls.get('uid');
  if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10); ls.set('uid', uid); }
  const keys = (p) => p.split('/').filter(Boolean);
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const at = (t, p) => keys(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), t);
  const put = (t, p, val) => {
    const ks = keys(p); let o = t;
    for (const k of ks.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }
    if (val === null || val === undefined) delete o[ks.at(-1)]; else o[ks.at(-1)] = val;
  };
  const prune = (o) => {
    for (const k of Object.keys(o)) {
      if (o[k] === null || o[k] === undefined) delete o[k];
      else if (typeof o[k] === 'object') { prune(o[k]); if (!Object.keys(o[k]).length) delete o[k]; }
    }
  };
  const notify = () => {
    const t = read();
    for (const s of subs) {
      const v = at(t, s.path) ?? null, j = JSON.stringify(v);
      if (j !== s.last) { s.last = j; s.cb(v); }
    }
  };
  const write = (fn) => { const t = read(); fn(t); prune(t); localStorage.setItem(KEY, JSON.stringify(t)); if (bc) bc.postMessage(1); notify(); };
  if (bc) bc.onmessage = notify;
  window.addEventListener('storage', (e) => { if (e.key === KEY) notify(); });

  const store = {
    uid,
    now: () => Date.now(),
    get: async (p) => at(read(), p) ?? null,
    watch(p, cb) { const s = { path: p, cb, last: undefined }; subs.add(s); queueMicrotask(notify); return () => subs.delete(s); },
    set: async (p, v) => write((t) => put(t, p, v)),
    update: async (p, obj) => write((t) => { for (const [k, v] of Object.entries(obj)) put(t, p + '/' + k, v); }),
    remove: async (p) => write((t) => put(t, p, null)),
    tx: async (p, fn) => write((t) => {
      const cur = at(t, p) ?? null;
      const out = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
      if (out !== undefined) put(t, p, out);
    }),
    newKey: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    presence(p, on, off) {
      store.update(p, on());
      const bye = () => { subs.clear(); store.update(p, off); }; // the page is closing: stop listening, then mark as gone
      window.addEventListener('pagehide', bye);
      window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
      return () => { window.removeEventListener('pagehide', bye); return store.update(p, off); };
    }
  };
  return store;
}

/* ---------- app state ---------- */

const S = {
  store: null, uid: null,
  profile: ls.get('profile'),
  roomId: null, room: null,
  unwatch: null, stopPresence: null,
  sig: {}, dragging: false, sortable: null,
  lastPlayerUid: undefined, lastSkipAt: 0, healAt: 0, ticker: null,
  dialog: null
};
const P = { api: null, yt: null, creating: false, ready: false, loadedId: null, seekN: null, holdUntil: 0, stT: null, tapT: null, reportT: null };

const base = () => `rooms/${S.roomId}`;
const amPlayer = () => !!S.room && S.room.player?.uid === S.uid;
const member = (uid) => S.room?.members?.[uid] || null;
const memberName = (uid, fallback) => member(uid)?.name || fallback || 'Someone';
const deviceLabel = (uid) => { const m = member(uid); return m ? `${possessive(m.name)} ${m.device || 'device'}` : 'another device'; };
const memberRecord = () => ({ name: S.profile.name, avatar: S.profile.avatar, device: S.profile.device, online: true, seen: S.store.now() });
const once = (key, sig, fn) => { if (S.sig[key] === sig) return; S.sig[key] = sig; fn(); };

function partyName() {
  const r = S.room || {};
  if (r.meta?.name) return r.meta.name;
  const owner = r.members?.[r.player?.uid] || r.members?.[r.meta?.createdBy];
  return owner?.name ? `${possessive(owner.name)} party` : 'The party';
}

function sortedItems() {
  return Object.entries(S.room?.q?.items || {}).map(([id, it]) => ({ id, ...it })).sort((a, b) => a.order - b.order);
}

function estPos() {
  const q = S.room?.q || {}, now = q.now;
  if (!now || q.posId !== now.id) return 0;
  let p = q.pos || 0;
  if (q.state !== 'paused') p += Math.min(Math.max(0, (S.store.now() - (q.posAt || 0)) / 1000), 12);
  return q.dur ? Math.min(p, q.dur) : p;
}

/* ---------- toasts and dialog ---------- */

function toast(msg, ms = 3600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function openDialog(kind, html) {
  const d = $('#dlg');
  S.dialog = kind;
  d.className = 'dlg dlg-' + kind;
  d.innerHTML = html;
  if (!d.open) d.showModal();
  return d;
}
function closeDialog() { const d = $('#dlg'); S.dialog = null; if (d.open) d.close(); d.innerHTML = ''; }

/* ---------- screens outside a party ---------- */

function setPartyParam(code) {
  const u = new URL(location.href);
  if (code) u.searchParams.set('party', code); else u.searchParams.delete('party');
  history.pushState({}, '', u);
}

function shell(inner) {
  $('#app').innerHTML = `<main class="solo"><p class="brand">Pass the Aux</p>${inner}</main>`;
}

function profileFormHTML(p, cta) {
  const av = p.avatar || 'p:0';
  const isPhoto = av.startsWith('data:image/');
  const tiles = PRESETS.map((_, i) => `<button type="button" class="av-pick" role="radio" aria-checked="${!isPhoto && av === 'p:' + i}" data-av="p:${i}" aria-label="Avatar ${i + 1}">${avatarHTML('p:' + i, 'av-l')}</button>`).join('');
  return `
    <form class="pf" id="pf" novalidate>
      <div class="field">
        <label for="pf-name">Your name</label>
        <input id="pf-name" name="name" type="text" maxlength="24" autocomplete="nickname" value="${esc(p.name || '')}" placeholder="What your friends call you">
        <p class="err" id="pf-err" hidden>Enter a name so people know who queued what.</p>
      </div>
      <div class="field">
        <span class="label" id="pf-av-label">Your avatar</span>
        <div class="av-grid" role="radiogroup" aria-labelledby="pf-av-label">
          <label class="av-pick av-upload" role="radio" aria-checked="${isPhoto}" id="pf-photo-tile" tabindex="0">
            <input id="pf-photo" type="file" accept="image/*" hidden>
            <span id="pf-photo-face">${isPhoto ? avatarHTML(av, 'av-l') : `<span class="av av-l av-cam">${ICON.camera}</span>`}</span>
            <span class="av-upload-text">${isPhoto ? 'Change photo' : 'Use a photo'}</span>
          </label>
          ${tiles}
        </div>
      </div>
      <div class="field">
        <label for="pf-device">This device</label>
        <input id="pf-device" name="device" type="text" maxlength="24" value="${esc(p.device || guessDevice())}">
        <p class="hint">Shown to everyone when this device plays the music.</p>
      </div>
      <button class="btn sun wide" type="submit">${esc(cta)}</button>
    </form>`;
}

function bindProfileForm(root, initial, onSave) {
  let avatar = initial.avatar || 'p:' + Math.floor(Math.random() * PRESETS.length);
  const mark = () => {
    root.querySelectorAll('.av-pick[data-av]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.av === avatar)));
    $('#pf-photo-tile', root).setAttribute('aria-checked', String(avatar.startsWith('data:image/')));
  };
  mark();
  root.querySelectorAll('.av-pick[data-av]').forEach((b) => b.addEventListener('click', () => { avatar = b.dataset.av; mark(); }));
  $('#pf-photo-tile', root).addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#pf-photo', root).click(); } });
  $('#pf-photo', root).addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      avatar = await fileToAvatar(f);
      $('#pf-photo-face', root).innerHTML = avatarHTML(avatar, 'av-l');
      $('.av-upload-text', root).textContent = 'Change photo';
      mark();
    } catch { toast('That file could not be read as a photo. Try a JPG or PNG.'); }
    e.target.value = '';
  });
  $('#pf', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#pf-name', root).value.trim().replace(/\s+/g, ' ');
    if (!name) { $('#pf-err', root).hidden = false; $('#pf-name', root).focus(); return; }
    onSave({ name, avatar, device: $('#pf-device', root).value.trim() || guessDevice() });
  });
}

function saveProfile(p) {
  S.profile = p;
  ls.set('profile', p);
  if (S.roomId) S.store.update(`${base()}/members/${S.uid}`, { name: p.name, avatar: p.avatar, device: p.device }).catch(() => {});
}

function viewProfile(code) {
  shell(`
    <h1>${code ? 'Join the party' : 'First, who are you?'}</h1>
    <p class="lede">${code ? 'Tell everyone who you are, then start adding songs.' : 'Pick a name and a face. This device remembers them for next time.'}</p>
    ${profileFormHTML({}, code ? 'Join the party' : 'Continue')}`);
  bindProfileForm($('#app'), {}, (p) => { saveProfile(p); route(); });
  $('#pf-name').focus();
}

function viewHome() {
  const last = cleanCode(ls.get('lastRoom'));
  document.title = 'Pass the Aux';
  shell(`
    <h1>One speaker. Everyone picks the next song.</h1>
    <p class="lede">Start a party on the device with the speakers, then share the link. Friends add and reorder songs from their own phones.</p>
    <button class="me-row" data-act="edit-profile">
      ${avatarHTML(S.profile.avatar, 'av-m')}
      <span><b>${esc(S.profile.name)}</b><small>on this ${esc(S.profile.device)}</small></span>
      <span class="me-edit">Edit</span>
    </button>
    <button class="btn sun wide" data-act="create">Start a party</button>
    <form class="code-form" id="code-form" novalidate>
      <label for="code-input">Have a party code?</label>
      <div class="code-row">
        <input id="code-input" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" maxlength="8" placeholder="e.g. KXQ7M">
        <button class="btn line" type="submit">Join</button>
      </div>
    </form>
    ${last ? `<button class="link" data-act="rejoin" data-code="${esc(last)}">Go back to your last party (${esc(last)})</button>` : ''}
    ${DEMO ? '<p class="hint">Demo mode: parties live only in this browser. Open more tabs to act as more people.</p>' : ''}`);
  $('#code-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = cleanCode($('#code-input').value);
    if (!code) return toast('Party codes are 4 to 8 letters and numbers.');
    setPartyParam(code);
    route();
  });
}

function viewNotFound(code) {
  ls.del('lastRoom');
  shell(`
    <h1>No party with the code ${esc(code)}</h1>
    <p class="lede">Check the link or code with whoever invited you. Codes use letters and numbers only.</p>
    <button class="btn sun wide" data-act="home">Back to start</button>`);
}

function viewSetup(err) {
  const code = err?.code || '';
  let title = 'Could not connect', body = `<p class="lede">${esc(err?.message || 'Something went wrong while connecting.')}</p>`;
  if (code === 'not-configured') {
    title = 'Connect Firebase to go live';
    body = `
      <p class="lede">The app needs a Firebase project to sync the party between devices. It takes about five minutes.</p>
      <ol class="steps">
        <li>Create a project at console.firebase.google.com and add a web app.</li>
        <li>Create a Realtime Database and turn on Anonymous sign-in under Authentication.</li>
        <li>Paste the web app config into <code>public/config.js</code>, then deploy.</li>
      </ol>
      <p class="hint">The README in the project folder has every step.</p>
      <a class="btn line wide" href="?demo">Try it now in demo mode</a>`;
  } else if (/operation-not-allowed|admin-restricted|configuration-not-found/.test(code)) {
    title = 'Turn on Anonymous sign-in';
    body = '<p class="lede">In the Firebase console, open Authentication, then Sign-in method, and enable Anonymous. Reload this page afterwards.</p>';
  } else if (/permission/i.test(code + (err?.message || ''))) {
    title = 'The database rules are blocking the app';
    body = '<p class="lede">Deploy the rules that ship with the project by running <code>firebase deploy --only database</code>, then reload.</p>';
  }
  shell(`<h1>${title}</h1>${body}`);
}

/* ---------- joining and leaving ---------- */

function randomCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(5)), (n) => abc[n % abc.length]).join('');
}

async function createRoom() {
  try {
    let code = randomCode();
    for (let i = 0; i < 4 && (await S.store.get(`rooms/${code}/meta`)); i++) code = randomCode();
    const t = S.store.now();
    await S.store.update(`rooms/${code}`, {
      meta: { createdAt: t, createdBy: S.uid },
      player: { uid: S.uid, at: t, by: S.uid },
      [`members/${S.uid}`]: memberRecord()
    });
    setPartyParam(code);
    enterRoom(code);
  } catch (e) { viewSetup(e); }
}

async function joinRoom(code) {
  $('#app').innerHTML = '<p class="boot">Finding the party</p>';
  let meta;
  try { meta = await S.store.get(`rooms/${code}/meta`); } catch (e) { return viewSetup(e); }
  if (!meta) return viewNotFound(code);
  enterRoom(code);
}

function enterRoom(code) {
  leaveRoom(true);
  S.roomId = code;
  S.room = null;
  S.sig = {};
  S.lastPlayerUid = undefined;
  ls.set('lastRoom', code);
  mountRoom();
  S.stopPresence = S.store.presence(`${base()}/members/${S.uid}`, memberRecord, { online: false });
  S.unwatch = S.store.watch(base(), (room) => { S.room = room || {}; onRoom(); }, () => toast('Lost the connection to the party. Reload to try again.', 8000));
  S.ticker = setInterval(tick, 500);
  P.reportT = setInterval(() => { if (amPlayer() && P.ready && playerState() === 1) report(); }, 4000);
}

function leaveRoom(silent) {
  if (!S.roomId) return;
  destroyPlayer();
  clearInterval(S.ticker); clearInterval(P.reportT);
  if (S.unwatch) S.unwatch();
  if (S.stopPresence) S.stopPresence();
  if (S.sortable) { S.sortable.destroy(); S.sortable = null; }
  S.unwatch = S.stopPresence = null;
  S.roomId = null; S.room = null;
  closeDialog();
  if (!silent) ls.del('lastRoom');
}

function route() {
  const code = cleanCode(new URLSearchParams(location.search).get('party'));
  if (!S.profile || !S.profile.name) return viewProfile(code);
  if (code) return joinRoom(code);
  leaveRoom(true);
  viewHome();
}

/* ---------- the party screen ---------- */

function mountRoom() {
  const hasSearch = !!CFG.youtubeApiKey;
  $('#app').innerHTML = `
    <div class="room">
      <header class="top">
        <button class="party-name" data-act="rename" id="party-name" title="Rename the party"></button>
        <div class="top-actions">
          <button class="people-chip" data-act="people" id="people-chip"></button>
          <button class="btn sun small" data-act="invite">Invite</button>
          <button class="me-btn" data-act="edit-profile" id="me-btn" aria-label="Edit your name and avatar"></button>
        </div>
      </header>
      <div class="cols">
        <section class="stage" aria-label="Now playing">
          <div class="screen" id="screen">
            <div id="yt-host"></div>
            <img id="poster" alt="" hidden>
            <p class="screen-msg" id="screen-msg"></p>
            <button class="tap" id="tap" data-act="tap" hidden>${ICON.play}<span>Tap to start the music on this device</span></button>
          </div>
          <div class="np" id="np"></div>
          <div class="device" id="device"></div>
        </section>
        <section class="side" aria-label="Queue">
          <form class="add" id="add" novalidate>
            <label for="add-input">${hasSearch ? 'Find a song to add' : 'Add a song'}</label>
            <div class="add-row">
              <input id="add-input" type="text" autocomplete="off" enterkeyhint="${hasSearch ? 'search' : 'done'}" placeholder="${hasSearch ? 'Song title, artist or a line of lyrics' : 'Paste a YouTube link'}">
              <button class="btn sun" type="submit" id="add-btn">${hasSearch ? 'Search' : 'Add'}</button>
            </div>
          </form>
          <div id="add-out"></div>
          <h2 class="q-title" id="q-title">Up next</h2>
          <ol class="queue" id="queue"></ol>
          <p class="q-empty" id="q-empty" hidden></p>
        </section>
      </div>
    </div>`;

  $('#add').addEventListener('submit', onAddSubmit);
  $('#add-input').addEventListener('input', () => {
    if (hasSearch) $('#add-btn').textContent = parseVideoId($('#add-input').value) ? 'Add' : 'Search';
  });

  if (window.Sortable) {
    S.sortable = new window.Sortable($('#queue'), {
      handle: '.grip', animation: 160, ghostClass: 'ticket-ghost', chosenClass: 'ticket-chosen',
      onStart: () => { S.dragging = true; },
      onEnd: (evt) => {
        S.dragging = false;
        const id = evt.item.dataset.id;
        if (evt.oldIndex !== evt.newIndex) moveTo(id, evt.newIndex);
        S.sig.queue = null;
        renderQueue();
      }
    });
  }
}

function onRoom() {
  const r = S.room;

  // Keep this device marked as present (covers a second tab closing, or a dropped connection).
  const me = r.members?.[S.uid];
  if ((!me || me.online !== true) && Date.now() - S.healAt > 3000) {
    S.healAt = Date.now();
    S.store.update(`${base()}/members/${S.uid}`, memberRecord()).catch(() => {});
  }

  // Tell people when the music moves to another device.
  const pu = r.player?.uid || null;
  if (S.lastPlayerUid !== undefined && pu !== S.lastPlayerUid && pu) {
    if (pu === S.uid && r.player.by && r.player.by !== S.uid) toast(`${memberName(r.player.by)} picked this device to play the music.`);
    else if (pu !== S.uid) toast(`The music now plays on ${deviceLabel(pu)}.`);
  }
  S.lastPlayerUid = pu;

  // Tell people when a song had to be skipped.
  const note = r.q?.skipNote, noteAt = note?.at || 0;
  if (noteAt && noteAt !== S.lastSkipAt && S.store.now() - noteAt < 15000) {
    toast(note.why === 'embed' ? `Skipped "${note.title}". Its owner does not allow playing it outside YouTube.` : `Skipped "${note.title}". The video is not available.`, 6000);
  }
  S.lastSkipAt = noteAt;

  renderHeader();
  renderStage();
  renderDevice();
  renderQueue();
  if (S.dialog === 'people') renderPeople(true);
  playerSync();
  tick();
}

function onlineMembers() {
  return Object.entries(S.room?.members || {}).filter(([, m]) => m && m.online === true && m.name)
    .map(([uid, m]) => ({ uid, ...m })).sort((a, b) => (a.uid === S.uid ? -1 : b.uid === S.uid ? 1 : a.name.localeCompare(b.name)));
}

function renderHeader() {
  const name = partyName();
  const on = onlineMembers();
  once('name', name, () => {
    $('#party-name').innerHTML = `<span>${esc(name)}</span>${ICON.pencil}`;
    document.title = `${name} | Pass the Aux`;
  });
  once('people', JSON.stringify(on.map((m) => [m.uid, m.avatar])), () => {
    const n = on.length;
    $('#people-chip').innerHTML = `<span class="stack">${on.slice(0, 4).map((m) => avatarHTML(m.avatar, 'av-s')).join('')}</span><span class="count">${n} ${n === 1 ? 'person' : 'people'} here</span>`;
    $('#people-chip').setAttribute('aria-label', `${n} ${n === 1 ? 'person' : 'people'} in the party. Show everyone.`);
  });
  once('me', S.profile.avatar, () => { $('#me-btn').innerHTML = avatarHTML(S.profile.avatar, 'av-m'); });
}

function renderStage() {
  const q = S.room.q || {}, now = q.now, mine = amPlayer();
  const playerUid = S.room.player?.uid, playerOn = !!member(playerUid)?.online;
  const sig = JSON.stringify([now && [now.id, now.videoId, now.title, now.channel, now.by], q.state, mine, playerUid, playerOn, now && member(now.by) && [member(now.by).name, member(now.by).avatar]]);
  once('stage', sig, () => {
    const screen = $('#screen'), poster = $('#poster'), msg = $('#screen-msg');
    screen.dataset.mode = !now ? 'empty' : mine ? 'player' : 'remote';
    if (now && !mine && /^[\w-]{11}$/.test(now.videoId)) { poster.src = `https://i.ytimg.com/vi/${now.videoId}/hqdefault.jpg`; poster.hidden = false; }
    else { poster.hidden = true; poster.removeAttribute('src'); }
    msg.textContent = now ? '' : 'Nothing is playing. Add a song and it starts here.';

    if (!now) { $('#np').innerHTML = ''; return; }
    const paused = q.state === 'paused';
    $('#np').innerHTML = `
      <p class="np-by">${avatarHTML(member(now.by)?.avatar, 'av-s')}<span>${now.by === S.uid ? 'You' : esc(memberName(now.by, now.byName))} queued this</span></p>
      <h1 class="np-title">${esc(now.title || 'YouTube video')}</h1>
      ${now.channel ? `<p class="np-ch">${esc(now.channel)}</p>` : ''}
      <div class="bar" id="bar" data-act="seek" role="slider" tabindex="0" aria-label="Song position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="bar-fill"></i></div>
      <div class="times"><span id="t-cur">0:00</span><span id="t-dur"></span></div>
      <div class="ctl">
        <button class="round sun" data-act="toggle" aria-label="${paused ? 'Play' : 'Pause'}">${paused ? ICON.play : ICON.pause}</button>
        <button class="round line" data-act="skip" aria-label="Skip to the next song">${ICON.skip}</button>
        <span class="ctl-state">${paused ? 'Paused' : playerOn ? `<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>Playing` : 'Waiting for a device'}</span>
      </div>`;
  });
}

function renderDevice() {
  const pu = S.room.player?.uid, pm = member(pu), mine = amPlayer();
  once('device', JSON.stringify([pu, pm && [pm.name, pm.device, pm.avatar, pm.online], mine]), () => {
    const el = $('#device');
    if (!pm) {
      el.innerHTML = `<div class="device-text"><p><b>No device is playing the music.</b></p><p class="sub">Pick the one connected to the speakers.</p></div>
        <div class="device-actions"><button class="btn sun small" data-act="play-here">Play on this device</button></div>`;
    } else if (!pm.online) {
      el.innerHTML = `${avatarHTML(pm.avatar, 'av-m av-off')}<div class="device-text"><p><b>${esc(deviceLabel(pu))} is offline</b></p><p class="sub">The music stops until it comes back or another device takes over.</p></div>
        <div class="device-actions"><button class="btn sun small" data-act="play-here">Play on this device</button><button class="btn line small" data-act="people">Change</button></div>`;
    } else {
      el.innerHTML = `${avatarHTML(pm.avatar, 'av-m')}<div class="device-text"><p class="sub">Music plays on</p><p><b>${esc(deviceLabel(pu))}</b>${mine ? '<span class="pill">this device</span>' : ''}</p></div>
        <div class="device-actions"><button class="btn line small" data-act="people">Change</button></div>`;
    }
  });
}

function renderQueue() {
  if (S.dragging) return;
  const items = sortedItems();
  const sig = JSON.stringify([!!S.room.q?.now, items.map((i) => [i.id, i.title, i.channel, i.by, member(i.by)?.name, member(i.by)?.avatar])]);
  once('queue', sig, () => {
    $('#q-title').textContent = items.length ? `Up next (${items.length})` : 'Up next';
    $('#q-empty').hidden = items.length > 0;
    $('#q-empty').textContent = S.room.q?.now ? 'Nothing queued after this song. Add the next one.' : 'The queue is empty. Add the first song to get the party going.';
    $('#queue').innerHTML = items.map((i, idx) => {
      const who = i.by === S.uid ? 'You' : memberName(i.by, i.byName);
      const thumb = /^[\w-]{11}$/.test(i.videoId) ? `<img class="tk-thumb" src="https://i.ytimg.com/vi/${i.videoId}/mqdefault.jpg" alt="" loading="lazy">` : '';
      return `
        <li class="ticket" data-id="${esc(i.id)}">
          <div class="stub" title="Queued by ${esc(who)}">${avatarHTML(member(i.by)?.avatar, 'av-m')}<span class="stub-name">${esc(who)}</span></div>
          <div class="tk-main">${thumb}<div class="tk-text"><p class="tk-title">${esc(i.title || 'YouTube video')}</p>${i.channel ? `<p class="tk-ch">${esc(i.channel)}</p>` : ''}</div></div>
          <div class="tk-actions">
            <button class="icon grip" aria-label="Drag to reorder">${ICON.grip}</button>
            <details class="menu">
              <summary class="icon" aria-label="More actions for ${esc(i.title || 'this song')}">${ICON.more}</summary>
              <div class="menu-pop">
                ${idx > 0 ? `<button data-act="q-next" data-id="${esc(i.id)}">Play next</button><button data-act="q-up" data-id="${esc(i.id)}">Move up</button>` : ''}
                ${idx < items.length - 1 ? `<button data-act="q-down" data-id="${esc(i.id)}">Move down</button>` : ''}
                <button class="danger" data-act="q-remove" data-id="${esc(i.id)}">Remove</button>
              </div>
            </details>
          </div>
        </li>`;
    }).join('');
  });
}

function tick() {
  const q = S.room?.q, bar = $('#bar-fill');
  if (!q || !q.now || !bar) return;
  let cur = estPos(), dur = q.posId === q.now.id ? q.dur || 0 : 0;
  if (amPlayer() && P.ready && P.loadedId === q.now.id) {
    try { const c = P.yt.getCurrentTime(), d = P.yt.getDuration(); if (c >= 0) cur = c; if (d > 0) dur = d; } catch { /* player not ready */ }
  }
  const pct = dur ? Math.min(100, (cur / dur) * 100) : 0;
  bar.style.width = pct + '%';
  $('#bar').setAttribute('aria-valuenow', String(Math.round(pct)));
  $('#bar').dataset.dur = dur;
  $('#t-cur').textContent = fmt(cur);
  $('#t-dur').textContent = dur ? fmt(dur) : '';
}

/* ---------- dialogs ---------- */

function renderPeople(onlyIfChanged) {
  const pu = S.room.player?.uid;
  const sig = JSON.stringify([pu, Object.entries(S.room.members || {}).map(([uid, m]) => [uid, m.name, m.device, m.avatar, m.online])]);
  if (onlyIfChanged && S.sig.peopleDlg === sig) return;
  S.sig.peopleDlg = sig;
  const all = Object.entries(S.room.members || {}).filter(([, m]) => m && m.name).map(([uid, m]) => ({ uid, ...m }))
    .sort((a, b) => (a.uid === S.uid ? -1 : b.uid === S.uid ? 1 : (b.online === true) - (a.online === true) || a.name.localeCompare(b.name)));
  const on = all.filter((m) => m.online === true).length;
  const rows = all.map((m) => `
    <li class="person ${m.online === true ? '' : 'is-off'}">
      ${avatarHTML(m.avatar, 'av-m')}
      <div class="person-text"><p><b>${esc(m.name)}</b>${m.uid === S.uid ? ' (you)' : ''}</p><p class="sub">${esc(m.device || 'device')}${m.online === true ? '' : ', left the party'}</p></div>
      ${m.uid === pu ? '<span class="pill sun">Playing the music</span>' : m.online === true ? `<button class="btn line small" data-act="set-player" data-uid="${esc(m.uid)}">Play here</button>` : ''}
    </li>`).join('');
  openDialog('people', `
    <header class="dlg-head"><h2 id="dlg-title">${on} ${on === 1 ? 'person' : 'people'} in the party</h2><button class="icon" data-act="close" aria-label="Close">✕</button></header>
    <p class="dlg-lede">The music plays on one device. Choose "Play here" to move it to another one.</p>
    <ul class="people">${rows}</ul>
    <button class="link danger" data-act="leave">Leave this party</button>`);
}

function openRename() {
  const d = openDialog('rename', `
    <header class="dlg-head"><h2 id="dlg-title">Rename the party</h2><button class="icon" data-act="close" aria-label="Close">✕</button></header>
    <form id="rename-form" novalidate>
      <div class="field">
        <label for="rename-input">Party name</label>
        <input id="rename-input" type="text" maxlength="40" value="${esc(S.room.meta?.name || '')}" placeholder="${esc(partyName())}">
        <p class="hint">Leave it empty to name the party after whoever's device plays the music.</p>
      </div>
      <button class="btn sun wide" type="submit">Save name</button>
    </form>`);
  $('#rename-form', d).addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#rename-input', d).value.trim().replace(/\s+/g, ' ');
    S.store.update(`${base()}/meta`, { name: v || null }).catch(() => toast('The name could not be saved. Try again.'));
    closeDialog();
  });
  $('#rename-input', d).select();
}

function openInvite() {
  const u = new URL(location.origin + location.pathname);
  u.searchParams.set('party', S.roomId);
  if (DEMO) u.searchParams.set('demo', 'guest' + Math.floor(Math.random() * 1000));
  const link = u.toString();
  let qr = '';
  try { const g = window.qrcode(0, 'M'); g.addData(link); g.make(); qr = g.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch { /* QR is optional */ }
  openDialog('invite', `
    <header class="dlg-head"><h2 id="dlg-title">Invite people</h2><button class="icon" data-act="close" aria-label="Close">✕</button></header>
    <p class="dlg-lede">Anyone with this link can join and add songs.</p>
    ${qr ? `<div class="qr" aria-label="QR code for the party link">${qr}</div>` : ''}
    <p class="code-big"><span>Party code</span><b>${esc(S.roomId)}</b></p>
    <div class="link-row"><input id="invite-link" type="text" readonly value="${esc(link)}" aria-label="Party link"><button class="btn sun" data-act="copy-link">Copy link</button></div>
    ${navigator.share ? '<button class="btn line wide" data-act="share-link">Share</button>' : ''}`);
}

function openProfile() {
  const d = openDialog('profile', `
    <header class="dlg-head"><h2 id="dlg-title">Your name and avatar</h2><button class="icon" data-act="close" aria-label="Close">✕</button></header>
    ${profileFormHTML(S.profile, 'Save changes')}`);
  bindProfileForm(d, S.profile, (p) => {
    saveProfile(p);
    closeDialog();
    S.sig.me = null;
    if (S.roomId) renderHeader(); else viewHome();
    toast('Saved');
  });
}

/* ---------- adding songs ---------- */

function parseVideoId(text) {
  text = String(text || '').trim();
  if (!/youtu\.?be/i.test(text)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text);
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.split('/')[1];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else { const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/); id = m && m[1]; }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

async function fetchMeta(videoId) {
  const watch = encodeURIComponent('https://www.youtube.com/watch?v=' + videoId);
  const sources = [`https://www.youtube.com/oembed?format=json&url=${watch}`, `https://noembed.com/embed?url=${watch}`];
  for (let i = 0; i < sources.length; i++) {
    try {
      const r = await fetch(sources[i], { signal: AbortSignal.timeout(4500) });
      if (i === 0 && (r.status === 401 || r.status === 403)) throw Object.assign(new Error('blocked'), { code: 'blocked' });
      if (i === 0 && (r.status === 404 || r.status === 400)) throw Object.assign(new Error('gone'), { code: 'gone' });
      if (!r.ok) continue;
      const j = await r.json();
      if (j.title) return { title: j.title, channel: j.author_name || '' };
    } catch (e) { if (e.code) throw e; }
  }
  return { title: 'YouTube video', channel: '' }; // the playing device fills in the real title later
}

// Search uses the YouTube Data API. YouTube's own search matches lyrics as well as titles,
// so typing a line from the song finds it. Results are cached for everyone to save the daily search allowance.
async function ytApi(path, params) {
  const u = new URL('https://www.googleapis.com/youtube/v3/' + path);
  u.search = new URLSearchParams({ ...params, key: CFG.youtubeApiKey }).toString();
  const r = await fetch(u);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || 'Search failed'), { reason: j?.error?.errors?.[0]?.reason || '' });
  return j;
}

const isoSeconds = (iso) => {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : 0;
};

async function ytSearch(text) {
  const params = { part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '10', q: text };
  let j = await ytApi('search', { ...params, videoCategoryId: '10' }); // music first
  if (!(j.items || []).length) j = await ytApi('search', params);      // then anything
  const items = (j.items || []).filter((i) => i.id?.videoId).map((i) => ({
    videoId: i.id.videoId, title: decodeEntities(i.snippet?.title), channel: decodeEntities(i.snippet?.channelTitle), dur: 0
  }));
  if (items.length) {
    try { // song lengths, so people can tell the single from the one hour mix
      const d = await ytApi('videos', { part: 'contentDetails', id: items.map((i) => i.videoId).join(',') });
      const len = Object.fromEntries((d.items || []).map((v) => [v.id, isoSeconds(v.contentDetails?.duration)]));
      items.forEach((i) => { i.dur = len[i.videoId] || 0; });
    } catch { /* lengths are a nice extra */ }
  }
  return items;
}

const normQuery = (t) => String(t).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function hashKey(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const SEARCH_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
async function searchSongs(text) {
  const q = normQuery(text), path = `search/${hashKey(q)}`;
  try {
    const hit = await S.store.get(path);
    if (hit && hit.q === q && hit.items && S.store.now() - hit.at < SEARCH_CACHE_MS) return Object.values(hit.items);
  } catch { /* no cache, search directly */ }
  const items = await ytSearch(text);
  if (items.length) S.store.set(path, { q, at: S.store.now(), items }).catch(() => {});
  return items;
}

async function addSong(videoId, meta) {
  const q = S.room?.q || {};
  if (q.now?.videoId === videoId) return toast('That song is playing right now.');
  if (Object.values(q.items || {}).some((i) => i.videoId === videoId)) return toast('That song is already in the queue.');
  try { meta = meta || (await fetchMeta(videoId)); }
  catch (e) { return toast(e.code === 'gone' ? 'No video found at that link. Check it and paste again.' : 'That video is private or cannot be played outside YouTube. Pick another version.', 5000); }
  const id = S.store.newKey(`${base()}/q/items`);
  const t = S.store.now();
  try {
    await S.store.set(`${base()}/q/items/${id}`, { videoId, title: String(meta.title || 'YouTube video').slice(0, 200), channel: String(meta.channel || '').slice(0, 100), by: S.uid, byName: S.profile.name, order: t, at: t });
    if (!S.room?.q?.now) advance(null);
    toast('Added to the queue');
    return true;
  } catch { toast('The song could not be added. Check your connection and try again.'); }
}

async function onAddSubmit(e) {
  e.preventDefault();
  const input = $('#add-input'), out = $('#add-out'), text = input.value.trim();
  if (!text) return input.focus();
  const vid = parseVideoId(text);
  if (vid) {
    $('#add-btn').disabled = true;
    const ok = await addSong(vid);
    $('#add-btn').disabled = false;
    if (ok) { input.value = ''; out.innerHTML = ''; if (CFG.youtubeApiKey) $('#add-btn').textContent = 'Search'; }
    return;
  }
  const ytLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(text)}`;
  if (!CFG.youtubeApiKey) {
    out.innerHTML = `<p class="add-hint">Search is not switched on for this site yet. <a href="${esc(ytLink)}" target="_blank" rel="noopener">Find "${esc(text)}" on YouTube</a>, copy the video's link, then paste it here.</p>`;
    return;
  }
  out.innerHTML = '<p class="add-hint">Searching</p>';
  $('#add-btn').disabled = true;
  try {
    const res = await searchSongs(text).finally(() => { $('#add-btn').disabled = false; });
    if (!res.length) { out.innerHTML = '<p class="add-hint">Nothing found. Try the title with the artist, or a different line from the lyrics.</p>'; return; }
    out.innerHTML = `<ul class="results">${res.map((r) => `
      <li><img src="https://i.ytimg.com/vi/${esc(r.videoId)}/mqdefault.jpg" alt="" loading="lazy">
        <div class="tk-text"><p class="tk-title">${esc(r.title)}</p><p class="tk-ch">${r.dur ? `<span class="dur">${fmt(r.dur)}</span>` : ''}${esc(r.channel)}</p></div>
        <button class="btn sun small" data-act="add-result" data-vid="${esc(r.videoId)}" data-title="${esc(r.title)}" data-channel="${esc(r.channel)}">Add</button></li>`).join('')}</ul>
      <button class="link" data-act="clear-results">Close results</button>`;
  } catch (err) {
    out.innerHTML = `<p class="add-hint">${/quota|rateLimit/i.test(err.reason) ? 'Search has hit its daily limit.' : 'Search is not working right now.'} <a href="${esc(ytLink)}" target="_blank" rel="noopener">Find it on YouTube</a> and paste the link here instead.</p>`;
  }
}

/* ---------- queue actions ---------- */

function advance(expectId, note) {
  const t = S.store.now();
  return S.store.tx(`${base()}/q`, (q) => {
    q = q || {};
    const curId = q.now ? q.now.id : null;
    if (curId !== expectId) return q; // someone else already moved the queue on
    const items = q.items || {};
    const next = Object.entries(items).sort((a, b) => a[1].order - b[1].order)[0];
    if (next) {
      q.now = { ...next[1], id: next[0], startedAt: t };
      delete items[next[0]];
      q.items = items;
      q.state = 'playing';
      q.posId = next[0];
    } else {
      q.now = null;
      q.posId = null;
    }
    q.pos = 0; q.posAt = t; q.dur = null; q.seek = null;
    if (note) q.skipNote = note;
    return q;
  }).catch(() => {});
}

function moveTo(id, index) {
  const list = sortedItems().filter((i) => i.id !== id);
  const prev = list[index - 1], next = list[index];
  const order = prev && next ? (prev.order + next.order) / 2 : prev ? prev.order + 1000 : next ? next.order - 1000 : S.store.now();
  return S.store.tx(`${base()}/q/items/${id}`, (it) => { if (!it) return it; it.order = order; return it; }).catch(() => {});
}

function setPlayer(uid) {
  return S.store.update(`${base()}/player`, { uid, at: S.store.now(), by: S.uid }).catch(() => toast('Could not switch devices. Try again.'));
}

/* ---------- the YouTube player (only on the device that plays the music) ---------- */

function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!P.api) {
    P.api = new Promise((res, rej) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { P.api = null; rej(new Error('YouTube did not load')); };
      document.head.appendChild(s);
    });
  }
  return P.api;
}

const playerState = () => { try { return P.yt.getPlayerState(); } catch { return -1; } };

async function createPlayer() {
  P.creating = true;
  try { await loadYT(); }
  catch { P.creating = false; toast('YouTube could not load on this device. Check the connection, then reload.', 6000); return; }
  if (!amPlayer() || P.yt) { P.creating = false; return; }
  $('#yt-host').innerHTML = '<div id="yt-frame"></div>';
  P.seekN = S.room.q?.seek?.n ?? null;
  P.yt = new window.YT.Player('yt-frame', {
    width: '100%', height: '100%',
    playerVars: { playsinline: 1, rel: 0, origin: location.origin },
    events: {
      onReady: () => { P.ready = true; P.creating = false; reconcile(); },
      onStateChange: onPlayerState,
      onError: onPlayerError
    }
  });
}

function destroyPlayer() {
  clearTimeout(P.stT); clearTimeout(P.tapT);
  try { if (P.yt) P.yt.destroy(); } catch { /* already gone */ }
  P.yt = null; P.ready = false; P.creating = false; P.loadedId = null;
  const host = $('#yt-host'); if (host) host.innerHTML = '';
  showTap(false);
}

function playerSync() {
  const mine = amPlayer();
  if (mine && !P.yt && !P.creating) createPlayer();
  else if (!mine && (P.yt || P.creating)) destroyPlayer();
  else if (mine && P.ready) reconcile();
}

function showTap(on) { const t = $('#tap'); if (t) t.hidden = !on; }

// Browsers sometimes refuse to start audio until someone taps the page. Offer a tap target when that happens.
function armTapCheck() {
  clearTimeout(P.tapT);
  P.tapT = setTimeout(() => {
    const q = S.room?.q || {};
    if (!amPlayer() || !P.ready || !q.now || q.state === 'paused') return showTap(false);
    const st = playerState();
    showTap(st !== 1 && st !== 3);
  }, 2800);
}

function reconcile() {
  const q = S.room.q || {}, now = q.now, yt = P.yt;
  if (!now) {
    if (P.loadedId) { try { yt.stopVideo(); } catch { /* nothing loaded */ } P.loadedId = null; }
    showTap(false);
    if (q.items) advance(null);
    return;
  }
  if (now.id !== P.loadedId) {
    P.loadedId = now.id;
    const arg = { videoId: now.videoId, startSeconds: Math.floor(estPos()) };
    if (q.state === 'paused') yt.cueVideoById(arg); else { yt.loadVideoById(arg); armTapCheck(); }
    return;
  }
  if (q.seek && q.seek.n !== P.seekN) {
    P.seekN = q.seek.n;
    if (q.seek.id === now.id) { try { yt.seekTo(q.seek.to, true); } catch { /* ignore */ } setTimeout(() => report(), 600); }
  }
  if (Date.now() < P.holdUntil) return;
  const st = playerState();
  if (q.state === 'paused' && (st === 1 || st === 3)) yt.pauseVideo();
  else if (q.state !== 'paused' && (st === 2 || st === 5 || st === -1)) { yt.playVideo(); armTapCheck(); }
}

function report(state) {
  const now = S.room?.q?.now;
  if (!amPlayer() || !P.ready || !now || now.id !== P.loadedId) return;
  let pos = 0, dur = 0;
  try { pos = P.yt.getCurrentTime() || 0; dur = P.yt.getDuration() || 0; } catch { return; }
  const patch = { pos, posAt: S.store.now(), posId: now.id, dur: dur || null };
  if (state) patch.state = state;
  S.store.update(`${base()}/q`, patch).catch(() => {});
}

function onPlayerState(e) {
  const st = e.data;
  if (st === 0) { if (P.loadedId) advance(P.loadedId); return; }
  if (st === 1) {
    showTap(false);
    const now = S.room?.q?.now;
    if (now && now.id === P.loadedId && (!now.title || now.title === 'YouTube video')) {
      try { const d = P.yt.getVideoData(); if (d && d.title) S.store.update(`${base()}/q/now`, { title: d.title, channel: d.author || '' }).catch(() => {}); } catch { /* no data yet */ }
    }
  }
  if (st === 1 || st === 2) {
    const dbState = S.room?.q?.state === 'paused' ? 'paused' : 'playing';
    clearTimeout(P.stT);
    if ((st === 1 ? 'playing' : 'paused') === dbState) {
      // The player did what the party asked for. Share the position and carry on.
      P.holdUntil = 0;
      P.stT = setTimeout(() => report(), 300);
      return;
    }
    // Someone used the controls inside the video. Wait a moment before sharing it,
    // so scrubbing (pause, then play again) does not flicker on everyone's screen.
    P.holdUntil = Date.now() + 1200;
    P.stT = setTimeout(() => {
      P.holdUntil = 0;
      const s = playerState();
      const want = s === 1 || s === 3 ? 'playing' : s === 2 ? 'paused' : null;
      if (want && want !== (S.room?.q?.state === 'paused' ? 'paused' : 'playing')) report(want);
      else { report(); if (amPlayer() && P.ready) reconcile(); }
    }, 500);
  }
}

function onPlayerError(e) {
  const now = S.room?.q?.now;
  if (!now || now.id !== P.loadedId) return;
  advance(now.id, { title: String(now.title || 'a song').slice(0, 80), at: S.store.now(), why: e.data === 101 || e.data === 150 ? 'embed' : 'gone' });
}

/* ---------- clicks ---------- */

const ACTIONS = {
  create: () => createRoom(),
  home: () => { setPartyParam(''); route(); },
  rejoin: (el) => { setPartyParam(el.dataset.code); route(); },
  'edit-profile': () => openProfile(),
  rename: () => openRename(),
  invite: () => openInvite(),
  people: () => renderPeople(),
  close: () => closeDialog(),
  leave: () => { leaveRoom(false); setPartyParam(''); route(); },
  'play-here': () => setPlayer(S.uid),
  'set-player': (el) => { setPlayer(el.dataset.uid); closeDialog(); },
  tap: () => { showTap(false); try { P.yt.playVideo(); } catch { /* player gone */ } armTapCheck(); },
  toggle: () => {
    const q = S.room?.q || {};
    if (!q.now) return;
    const next = q.state === 'paused' ? 'playing' : 'paused';
    if (amPlayer() && P.ready) { P.holdUntil = 0; try { next === 'playing' ? P.yt.playVideo() : P.yt.pauseVideo(); } catch { /* ignore */ } }
    S.store.update(`${base()}/q`, { state: next, pos: estPos(), posAt: S.store.now(), posId: q.now.id }).catch(() => {});
  },
  skip: () => { const now = S.room?.q?.now; if (now) advance(now.id); },
  seek: (el, e) => {
    const q = S.room?.q || {}, dur = Number(el.dataset.dur) || 0;
    if (!q.now || !dur) return;
    const rect = el.getBoundingClientRect();
    const to = Math.max(0, Math.min(dur - 1, ((e.clientX - rect.left) / rect.width) * dur));
    S.store.update(`${base()}/q`, { seek: { to, id: q.now.id, n: S.store.now() }, pos: to, posAt: S.store.now(), posId: q.now.id }).catch(() => {});
  },
  'q-next': (el) => moveTo(el.dataset.id, 0),
  'q-up': (el) => { const i = sortedItems().findIndex((x) => x.id === el.dataset.id); if (i > 0) moveTo(el.dataset.id, i - 1); },
  'q-down': (el) => { const l = sortedItems(), i = l.findIndex((x) => x.id === el.dataset.id); if (i > -1 && i < l.length - 1) moveTo(el.dataset.id, i + 1); },
  'q-remove': (el) => S.store.remove(`${base()}/q/items/${el.dataset.id}`).then(() => toast('Removed from the queue')).catch(() => {}),
  'add-result': async (el) => {
    el.disabled = true;
    const ok = await addSong(el.dataset.vid, { title: el.dataset.title, channel: el.dataset.channel });
    if (ok) el.textContent = 'Added'; else el.disabled = false;
  },
  'clear-results': () => { $('#add-out').innerHTML = ''; },
  'copy-link': async (el) => {
    const input = $('#invite-link');
    try { await navigator.clipboard.writeText(input.value); el.textContent = 'Copied'; }
    catch { input.select(); toast('Press and hold the link to copy it.'); }
  },
  'share-link': () => navigator.share({ title: partyName(), text: `Join ${partyName()} and add your songs`, url: $('#invite-link').value }).catch(() => {})
};

document.addEventListener('click', (e) => {
  // Close any open song menu when clicking elsewhere.
  document.querySelectorAll('details.menu[open]').forEach((d) => { if (!d.contains(e.target) || e.target.closest('.menu-pop button')) d.removeAttribute('open'); });
  if (e.target.id === 'dlg') return closeDialog(); // click on the backdrop
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el, e);
});

document.addEventListener('keydown', (e) => {
  if (e.target.id !== 'bar' || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const q = S.room?.q || {}, dur = Number(e.target.dataset.dur) || 0;
  if (!q.now || !dur) return;
  e.preventDefault();
  const to = Math.max(0, Math.min(dur - 1, estPos() + (e.key === 'ArrowRight' ? 10 : -10)));
  S.store.update(`${base()}/q`, { seek: { to, id: q.now.id, n: S.store.now() }, pos: to, posAt: S.store.now(), posId: q.now.id }).catch(() => {});
});

$('#dlg').addEventListener('close', () => { S.dialog = null; });
window.addEventListener('popstate', () => route());

/* ---------- start ---------- */

(async function boot() {
  try { S.store = DEMO ? createLocalStore() : await createFirebaseStore(); }
  catch (e) { return viewSetup(e); }
  S.uid = S.store.uid;
  route();
})();
