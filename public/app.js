// Cave Party: a shared song queue for a party. Share the aux.
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
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 1h4v2H4V4h4zM6 8h12l-1 12.1a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9zm4 2v8h2v-8zm4 0v8h2v-8z"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 16.6 4.9 12.3l-1.4 1.4 5.7 5.7L20.6 8l-1.4-1.4z"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>',
  history: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>'
};

/* ---------- themes ---------- */
// A theme is a palette (classic, mint, app, market) plus, where the palette has both, a mode (dark or light).
// The choice is kept per device, outside the profile, so it also holds in demo mode and before joining.
// The colours themselves live in styles.css. "song" says how a palette reacts to the artwork of the playing song:
// "none" keeps its colours, "kit" uses the Cave Party brand recipe in music-color.js, and "derive" keeps each
// colour's own lightness and strength and takes only the hue from the song.

const THEME_KEY = 'pta-theme';     // the mode, once someone has picked one on this device
const PALETTE_KEY = 'pta-palette';
const PALETTES = {
  classic: { name: 'Classic', modes: ['dark', 'light'], song: 'none' },
  mint: { name: 'Midnight mint', modes: ['dark', 'light'], song: 'kit' },
  app: { name: 'App colours', modes: ['dark'], song: 'derive' },
  market: { name: 'Night market', modes: ['dark'], song: 'derive' }
};
const root = document.documentElement;
const paletteNow = () => (PALETTES[root.dataset.palette] ? root.dataset.palette : 'classic');
const themeNow = () => (root.dataset.theme === 'light' ? 'light' : 'dark');
const savedTheme = () => { try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : null; } catch { return null; } };
// Follow the system setting until someone picks a mode on this device.
const wantedMode = () => savedTheme() || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

const modeLabel = () => `Switch to ${themeNow() === 'light' ? 'dark' : 'light'} mode`;
const modeButtonHTML = () => `<button class="icon" data-act="mode" aria-label="${modeLabel()}" title="${modeLabel()}"${PALETTES[paletteNow()].modes.length < 2 ? ' hidden' : ''}>${themeNow() === 'light' ? ICON.moon : ICON.sun}</button>`;
function syncModeButtons() {
  const two = PALETTES[paletteNow()].modes.length > 1;
  document.querySelectorAll('[data-act="mode"]').forEach((b) => { b.hidden = !two; b.innerHTML = themeNow() === 'light' ? ICON.moon : ICON.sun; b.setAttribute('aria-label', modeLabel()); b.title = modeLabel(); });
}

function applyLook(palette = paletteNow(), mode = wantedMode()) {
  const id = PALETTES[palette] ? palette : 'classic';
  root.dataset.palette = id;
  root.dataset.theme = PALETTES[id].modes.includes(mode) ? mode : PALETTES[id].modes[0];
  refreshRoom(); // the colours taken from the song are made again for this theme
  $('meta[name="theme-color"]')?.setAttribute('content', restTokens().raw['--bg']); // the browser bar takes the resting page colour
  syncModeButtons();
}

/* ---------- the room takes its colour from the song ---------- */
// While a song plays, the page background, the raised surfaces, the frosted glass and the two corner lights fade
// to colours read from its artwork. Text and the accent never change, and every colour keeps the lightness of the
// colour it replaces, so contrast is the same for every song. Reading the artwork and the colour maths come from
// music-color.js (the Cave Party brand kit, loaded unchanged). This runs on every device, not only the one playing.

const MC = window.CaveMusicColor;
const SONG_VARS = ['--bg', '--surface', '--surface-2', '--menu', '--glass', '--sheet', '--glow-a', '--glow-b'];
const RC = { music: null, ticket: 0, raf: 0, cur: null, kit: false, rest: {} };

// The resting value of each of those colours in the current theme: as written in the stylesheet, and as
// [lightness, chroma, hue, alpha]. Read once per theme, with any song colours lifted off for the moment.
function restTokens() {
  const key = `${paletteNow()}:${themeNow()}`;
  if (RC.rest[key]) return RC.rest[key];
  const inline = SONG_VARS.map((v) => root.style.getPropertyValue(v));
  SONG_VARS.forEach((v) => root.style.removeProperty(v));
  const cs = getComputedStyle(root), probe = document.body.appendChild(document.createElement('span'));
  const out = { raw: {}, lch: {} };
  for (const v of SONG_VARS) {
    out.raw[v] = cs.getPropertyValue(v).trim();
    probe.style.color = out.raw[v];
    const m = (getComputedStyle(probe).color.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
    const c = MC ? MC.rgbToOklch(m[0], m[1], m[2]) : [0, 0, 0];
    out.lch[v] = [c[0], c[1], c[2], m.length > 3 ? m[3] : 1];
  }
  probe.remove();
  SONG_VARS.forEach((v, i) => { if (inline[i]) root.style.setProperty(v, inline[i]); });
  return (RC.rest[key] = out);
}

// For the "derive" palettes: same lightness and alpha, the song's hue. Dull artwork gives a quieter tint.
// Greys stay grey. The first corner light takes the main colour of the artwork and the second its second colour.
function songColours(rest, music) {
  const out = {};
  for (const v of SONG_VARS) {
    const [L, C, h, alpha] = rest.lch[v], light = v.startsWith('--glow');
    out[v] = C < 0.015 ? [L, C, h, alpha] : [L, light ? C : C * music.k, v === '--glow-b' ? music.h2 : music.h, alpha];
  }
  return out;
}

function fadeRoom(to, duration, handBack) {
  cancelAnimationFrame(RC.raf);
  const from = RC.cur || restTokens().lch;
  const paint = (t) => {
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease in and out
    const now = {};
    for (const v of SONG_VARS) {
      const a = from[v], b = to[v];
      const ha = a[1] < 0.004 ? b[2] : a[2], hb = b[1] < 0.004 ? a[2] : b[2]; // a grey borrows the other colour's hue
      const dh = ((hb - ha + 540) % 360) - 180;                               // hue takes the short way round
      now[v] = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, (ha + dh * e + 360) % 360, a[3] + (b[3] - a[3]) * e];
      root.style.setProperty(v, MC.css(now[v]));
    }
    RC.cur = now;
    if (t === 1 && handBack) { SONG_VARS.forEach((v) => root.style.removeProperty(v)); RC.cur = null; } // back to the stylesheet
  };
  if (!duration) return paint(1);
  let start = null;
  const frame = (ts) => { if (start === null) start = ts; const t = Math.min(1, (ts - start) / duration); paint(t); if (t < 1) RC.raf = requestAnimationFrame(frame); };
  RC.raf = requestAnimationFrame(frame);
}

function paintRoom(duration = 1400) {
  if (!MC) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) duration = 0;
  const how = PALETTES[paletteNow()].song;
  if (how === 'kit') {
    cancelAnimationFrame(RC.raf); RC.cur = null; RC.kit = true;
    MC.apply(RC.music, { theme: themeNow() === 'light' ? 'daylight' : 'cave', duration });
    return;
  }
  if (RC.kit) { MC.apply(null, { duration: 0 }); RC.kit = false; } // stop the brand recipe and lift its colours off
  const rest = restTokens();
  if (how === 'derive' && RC.music) fadeRoom(songColours(rest, RC.music), duration, false);
  else if (RC.cur) fadeRoom(rest.lch, duration, true);
  else SONG_VARS.forEach((v) => root.style.removeProperty(v));
}

// After a change of theme: drop what was painted for the old one and paint the new one at once.
function refreshRoom() {
  cancelAnimationFrame(RC.raf); RC.cur = null;
  if (!RC.kit) SONG_VARS.forEach((v) => root.style.removeProperty(v));
  paintRoom(0);
}

// url: the artwork of the playing song, or '' when nothing plays. Artwork that is nearly black and white, or
// that cannot be read, gives null and the theme keeps its own colours.
function followRoom(url) {
  const ticket = ++RC.ticket;
  if (!MC) return;
  if (!url) { RC.music = null; paintRoom(); return; }
  MC.fromUrl(url).then((music) => { if (ticket !== RC.ticket) return; RC.music = music; paintRoom(); }); // a skipped song is ignored
}

applyLook();
window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (!savedTheme()) applyLook(); });

// The theme chooser. It sits in the profile dialog, under the name and avatar. A pick applies at once and is kept
// on this device. It does not wait for "Save changes", which is only for the name, avatar and device.
function themeSectionHTML() {
  const pal = paletteNow(), mode = themeNow(), cur = PALETTES[pal];
  const cards = Object.entries(PALETTES).map(([id, t]) => `
    <button type="button" class="theme-card" role="radio" aria-checked="${id === pal}" data-act="pick-palette" data-palette="${id}">
      <span class="theme-swatch" data-palette="${id}" data-theme="${t.modes.includes(mode) ? mode : t.modes[0]}" aria-hidden="true"><i class="sw-panel"></i><i class="sw-title"></i><i class="sw-quiet"></i><i class="sw-bar"></i><i class="sw-dot"></i></span>
      <span class="theme-name">${esc(t.name)}${id === 'classic' ? '<small>Default</small>' : ''}</span>
    </button>`).join('');
  const modes = cur.modes.length > 1
    ? `<p class="hint">${esc(cur.name)} has a light and a dark mode. Switch with the sun or moon button beside your avatar.</p>`
    : `<p class="hint">${esc(cur.name)} has one look, so there is no light mode.</p>`;
  return `
    <h3 id="theme-title">Theme</h3>
    <p class="hint">How the party looks on this device. Everyone else keeps their own choice.</p>
    <div class="theme-grid" role="radiogroup" aria-labelledby="theme-title">${cards}</div>
    ${modes}
    <p class="hint">${cur.song === 'none' ? 'Classic keeps its own colours. The other themes take colours from the song that is playing.' : `${esc(cur.name)} takes colours from the song that is playing.`}</p>`;
}

// Redraws only the theme part, so a name or photo that is being edited above it is not lost.
function renderThemeSection(focus) {
  const sec = $('#theme-sec');
  if (!sec) return;
  sec.innerHTML = themeSectionHTML();
  if (focus) $(focus, sec)?.focus();
}

function pickLook(palette, mode) {
  try { localStorage.setItem(PALETTE_KEY, palette); if (mode) localStorage.setItem(THEME_KEY, mode); } catch { /* storage unavailable */ }
  applyLook(palette, mode || wantedMode());
}

// The blurred artwork of the current song, shown behind the glass panels.
function setArt(videoId) {
  const el = $('#backdrop-art');
  if (!el) return;
  const url = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '';
  if (el.dataset.url === url) return;
  el.dataset.url = url;
  followRoom(url);
  if (!url) { el.classList.remove('on'); return; }
  const img = new Image(); // swap only once the new picture has loaded, so the backdrop never flashes empty
  img.onload = () => { if (el.dataset.url !== url) return; el.style.backgroundImage = `url("${url}")`; el.classList.add('on'); };
  img.src = url;
}

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
const P = { api: null, yt: null, creating: false, ready: false, loadedId: null, seekN: null, holdUntil: 0, stT: null, tapT: null, tapTried: false, errAt: 0, reportT: null };

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
  $('#app').innerHTML = `<main class="solo"><header class="solo-top"><p class="brand"><img class="brand-mark" src="favicon.svg" alt="" width="28" height="28">Cave Party</p>${modeButtonHTML()}</header>${inner}</main>`;
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
      <button class="btn primary wide" type="submit">${esc(cta)}</button>
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
  document.title = 'Cave Party';
  shell(`
    <h1>One speaker. Everyone picks the next song.</h1>
    <p class="lede">Start a party on the device with the speakers, then share the link. Friends add and reorder songs from their own phones.</p>
    <button class="me-row" data-act="edit-profile">
      ${avatarHTML(S.profile.avatar, 'av-m')}
      <span><b>${esc(S.profile.name)}</b><small>on this ${esc(S.profile.device)}</small></span>
      <span class="me-edit">Edit</span>
    </button>
    <button class="btn primary wide" data-act="create">Start a party</button>
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
    <button class="btn primary wide" data-act="home">Back to start</button>`);
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
  REC.forId = null; REC.list = []; REC.n++;
  R.items = []; R.next = null;
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
  setArt(null);
  if (stageWatch) stageWatch.disconnect();
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
    <div class="room" id="room" data-hist="closed">
      <header class="top">
        <button class="icon hist-toggle" data-act="history" aria-controls="hist" aria-expanded="false" aria-label="Show history" title="Show history">${ICON.history}</button>
        <button class="party-name" data-act="rename" id="party-name" title="Rename the party"></button>
        <div class="top-actions">
          <button class="people-chip" data-act="people" id="people-chip"></button>
          <button class="btn primary small" data-act="invite">Invite</button>
          ${modeButtonHTML()}
          <button class="me-btn" data-act="edit-profile" id="me-btn" aria-label="Your profile and theme" title="Your profile and theme"></button>
        </div>
      </header>
      <div class="cols">
        <aside class="hist" id="hist" aria-label="Songs this party has played" inert>
          <div class="q-head">
            <h2 class="q-title">History</h2>
            <button class="icon" data-act="history" aria-label="Hide history" title="Hide history">${ICON.back}</button>
          </div>
          <ul class="results scroll" id="hist-list" hidden></ul>
          <p class="q-empty" id="hist-empty">Nothing yet. Songs show up here once they have played or been skipped.</p>
        </aside>
        <section class="stage" aria-label="Now playing">
          <div class="screen" id="screen">
            <div id="yt-host"></div>
            <img id="poster" alt="" hidden>
            <p class="screen-msg" id="screen-msg"></p>
            <button class="tap" id="tap" data-act="tap" hidden>${ICON.play}<span>Tap to start the music on this device</span></button>
          </div>
          <p class="tap-hint" id="tap-hint" hidden>Press play on the video above to start the music.</p>
          <div class="np" id="np"></div>
          <div class="device" id="device"></div>
        </section>
        <section class="side" aria-label="Queue">
          <div class="q-head">
            <h2 class="q-title" id="q-title">Up next</h2>
            <button class="btn line small" data-act="shuffle" id="shuffle-btn" hidden>${ICON.shuffle}Shuffle</button>
          </div>
          <ol class="queue" id="queue"></ol>
          <p class="q-empty" id="q-empty" hidden></p>
          <form class="add" id="add" novalidate>
            <label for="add-input">${hasSearch ? 'Find a song to add' : 'Add a song'}</label>
            <div class="add-row">
              <div class="add-field">
                <input id="add-input" type="text" autocomplete="off" enterkeyhint="${hasSearch ? 'search' : 'done'}" placeholder="${hasSearch ? 'Song title, artist or a line of lyrics' : 'Paste a YouTube link'}"${hasSearch ? ' role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="add-suggest"' : ''}>
                <ul class="suggest" id="add-suggest" role="listbox" aria-label="Search predictions" hidden></ul>
              </div>
              <button class="btn primary" type="submit" id="add-btn">${hasSearch ? 'Search' : 'Add'}</button>
            </div>
          </form>
          <div id="add-out"></div>
          <div class="recs" id="recs" hidden></div>
        </section>
      </div>
      <div class="hist-scrim" data-act="history"></div>
    </div>`;

  // The sidebar starts open on a wide screen unless it was hidden there before, and tucked away on a narrow one.
  let savedHist = null;
  try { savedHist = localStorage.getItem(HIST_KEY); } catch { /* storage unavailable */ }
  applyHist(histWide() && savedHist !== 'closed');
  if (stageWatch) { stageWatch.disconnect(); stageWatch.observe($('.stage')); }
  syncHistHeight();

  $('#add').addEventListener('submit', onAddSubmit);
  $('#add-input').addEventListener('input', () => {
    if (!hasSearch) return;
    $('#add-btn').textContent = parseVideoId($('#add-input').value) ? 'Add' : 'Search';
    onSuggestInput();
  });
  if (hasSearch) {
    $('#add-input').addEventListener('keydown', onSuggestKey);
    $('#add-input').addEventListener('blur', () => closeSuggest());
    $('#add-suggest').addEventListener('mousedown', (e) => e.preventDefault()); // keep the typing focus while picking a prediction
  }

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
  renderHistory();
  loadRecs();
  playerSync();
  tick();
  refreshFades();
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
    document.title = `${name} | Cave Party`;
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
    setArt(now && /^[\w-]{11}$/.test(now.videoId) ? now.videoId : null);

    if (!now) { $('#np').innerHTML = ''; return; }
    const paused = q.state === 'paused';
    $('#np').innerHTML = `
      <p class="np-by">${avatarHTML(member(now.by)?.avatar, 'av-s')}<span>${now.by === S.uid ? 'You' : esc(memberName(now.by, now.byName))} queued this</span></p>
      <h1 class="np-title">${esc(now.title || 'YouTube video')}</h1>
      ${now.channel ? `<p class="np-ch">${esc(now.channel)}</p>` : ''}
      <div class="bar" id="bar" data-act="seek" role="slider" tabindex="0" aria-label="Song position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="bar-fill"></i></div>
      <div class="times"><span id="t-cur">0:00</span><span id="t-dur"></span></div>
      <div class="ctl">
        <button class="round primary" data-act="toggle" aria-label="${paused ? 'Play' : 'Pause'}">${paused ? ICON.play : ICON.pause}</button>
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
        <div class="device-actions"><button class="btn primary small" data-act="play-here">Play on this device</button></div>`;
    } else if (!pm.online) {
      el.innerHTML = `${avatarHTML(pm.avatar, 'av-m av-off')}<div class="device-text"><p><b>${esc(deviceLabel(pu))} is offline</b></p><p class="sub">The music stops until it comes back or another device takes over.</p></div>
        <div class="device-actions"><button class="btn primary small" data-act="play-here">Play on this device</button><button class="btn line small" data-act="people">Change</button></div>`;
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
    $('#shuffle-btn').hidden = items.length < 2;
    $('#q-empty').hidden = items.length > 0;
    $('#q-empty').textContent = S.room.q?.now ? 'Nothing queued after this song. Add the next one.' : 'The queue is empty. Add the first song to get the party going.';
    $('#queue').innerHTML = items.map((i, idx) => {
      const who = i.by === S.uid ? 'You' : memberName(i.by, i.byName);
      const thumb = /^[\w-]{11}$/.test(i.videoId) ? `<img class="tk-thumb" src="https://i.ytimg.com/vi/${i.videoId}/mqdefault.jpg" alt="" loading="lazy">` : '';
      return `
        <li class="ticket" data-id="${esc(i.id)}">
          <div class="tk-main">${thumb}<div class="tk-text"><p class="tk-title">${esc(i.title || 'YouTube video')}</p>
            <p class="tk-meta"><span class="stub" title="Queued by ${esc(who)}">${avatarHTML(member(i.by)?.avatar, 'av-s')}<span class="stub-name">${esc(who)}</span></span>${i.channel ? `<span class="tk-ch">${esc(i.channel)}</span>` : ''}</p></div></div>
          <div class="tk-actions">
            <button class="icon grip" aria-label="Move ${esc(i.title || 'this song')}. Drag, or press the up and down arrow keys." title="Drag to reorder">${ICON.grip}</button>
            <button class="icon icon-danger" data-act="q-remove" data-id="${esc(i.id)}" aria-label="Remove ${esc(i.title || 'this song')} from the queue" title="Remove from the queue">${ICON.trash}</button>
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
      ${m.uid === pu ? '<span class="pill primary">Playing the music</span>' : m.online === true ? `<button class="btn line small" data-act="set-player" data-uid="${esc(m.uid)}">Play here</button>` : ''}
    </li>`).join('');
  openDialog('people', `
    <header class="dlg-head"><h2 id="dlg-title">${on} ${on === 1 ? 'person' : 'people'} in the party</h2><button class="icon" data-act="close" aria-label="Close">✕</button></header>
    <p class="dlg-lede">The music plays on one device. Choose "Play here" to move it to another one.</p>
    <ul class="people">${rows}</ul>
    <button class="link danger" data-act="leave">Leave this party</button>`);
}

const ago = (t) => {
  const min = Math.max(0, Math.round((S.store.now() - (t || 0)) / 60000));
  return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : `${Math.floor(min / 60)} h ${min % 60} min ago`;
};

// The history sidebar: songs the party has already played or skipped, newest first. Each can be queued again.
// On wide screens it is a column at the left edge. On narrow ones it slides in over the page.
const HIST_KEY = 'pta-hist'; // remembered per device, like the theme
const histWide = () => window.matchMedia('(min-width: 1200px)').matches;
let histOpen = false;

function applyHist(open) {
  histOpen = open;
  const room = $('#room');
  if (!room) return;
  room.dataset.hist = open ? 'open' : 'closed';
  const label = open ? 'Hide history' : 'Show history';
  document.querySelectorAll('.hist-toggle').forEach((b) => { b.setAttribute('aria-expanded', String(open)); b.setAttribute('aria-label', label); b.title = label; });
  $('#hist')?.toggleAttribute('inert', !open);
}

function toggleHist(open = !histOpen) {
  if (histWide()) { try { localStorage.setItem(HIST_KEY, open ? 'open' : 'closed'); } catch { /* storage unavailable */ } } // a phone always starts with it tucked away
  applyHist(open);
}

// When the window crosses between the two layouts, go back to that layout's resting state.
window.matchMedia('(min-width: 1200px)').addEventListener?.('change', (e) => {
  let saved = null;
  try { saved = localStorage.getItem(HIST_KEY); } catch { /* storage unavailable */ }
  applyHist(e.matches && saved !== 'closed');
  syncHistHeight();
});

// On wide screens the history card is exactly as tall as the player card beside it, and its list scrolls inside.
function syncHistHeight() {
  const hist = $('#hist'), stage = $('.stage');
  if (!hist || !stage) return;
  hist.style.height = histWide() ? `${stage.offsetHeight}px` : '';
  refreshFades();
}
const stageWatch = 'ResizeObserver' in window ? new ResizeObserver(syncHistHeight) : null;

// Lists that scroll inside their own frame fade at an edge only while more rows wait behind it.
function refreshFades() {
  document.querySelectorAll('.queue, .results.scroll').forEach((el) => {
    el.toggleAttribute('data-more-up', el.scrollTop > 2);
    el.toggleAttribute('data-more-down', el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  });
}

function renderHistory() {
  const box = $('#hist-list');
  if (!box) return;
  const q = S.room.q || {};
  const list = Object.entries(q.hist || {}).map(([id, h]) => ({ id, ...h })).sort((a, b) => b.at - a.at);
  const waiting = new Set([q.now, ...Object.values(q.items || {})].filter(Boolean).map((i) => i.videoId));
  const sig = JSON.stringify([list.map((h) => [h.id, waiting.has(h.videoId), member(h.by)?.name, member(h.by)?.avatar]), Math.floor(S.store.now() / 60000)]);
  once('hist', sig, () => {
    $('#hist-empty').hidden = list.length > 0;
    box.hidden = !list.length;
    const keep = box.scrollTop;
    box.innerHTML = list.map((h) => {
      const who = h.by === S.uid ? 'You' : memberName(h.by, h.byName);
      const thumb = /^[\w-]{11}$/.test(h.videoId) ? `<img src="https://i.ytimg.com/vi/${h.videoId}/mqdefault.jpg" alt="" loading="lazy">` : '';
      const queued = waiting.has(h.videoId);
      return `
        <li>${thumb}
          <div class="tk-text"><p class="tk-title">${esc(h.title || 'YouTube video')}</p>
            <p class="tk-meta"><span class="stub" title="Queued by ${esc(who)}">${avatarHTML(member(h.by)?.avatar, 'av-s')}<span class="stub-name">${esc(who)}</span></span><span class="tk-ch">${esc(ago(h.at))}</span></p></div>
          <button class="icon" data-act="add-hist" data-vid="${esc(h.videoId)}" data-title="${esc(h.title || '')}" data-channel="${esc(h.channel || '')}" ${queued ? 'disabled aria-label="Already in the queue" title="Already in the queue"' : `aria-label="Add ${esc(h.title || 'this song')} again" title="Add again"`}>${queued ? ICON.check : ICON.plus}</button></li>`;
    }).join('');
    box.scrollTop = keep;
  });
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
      <button class="btn primary wide" type="submit">Save name</button>
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
    <div class="link-row"><input id="invite-link" type="text" readonly value="${esc(link)}" aria-label="Party link"><button class="btn primary" data-act="copy-link">Copy link</button></div>
    ${navigator.share ? '<button class="btn line wide" data-act="share-link">Share</button>' : ''}`);
}

function openProfile() {
  const d = openDialog('profile', `
    <header class="dlg-head"><h2 id="dlg-title">Your profile</h2><button class="icon" data-act="close" aria-label="Close">✕</button></header>
    ${profileFormHTML(S.profile, 'Save changes')}
    <section class="theme-sec" id="theme-sec">${themeSectionHTML()}</section>`);
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

// One call returns up to 50 videos, the most YouTube gives at once, and costs the same as a small one.
// "next" is the ticket for the following 50, used by "Show more results". Only videos that can be
// played outside YouTube are asked for, because the others would be skipped by the player anyway.
async function ytSearch(text, pageToken) {
  const params = { part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '50', q: text };
  if (pageToken) params.pageToken = pageToken;
  const j = await ytApi('search', params);
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
  return { items, next: j.nextPageToken || null };
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
  const q = normQuery(text), path = `search/${hashKey('v2 ' + q)}`; // v2: entries hold up to 50 results and the ticket for more
  try {
    const hit = await S.store.get(path);
    if (hit && hit.q === q && hit.items && S.store.now() - hit.at < SEARCH_CACHE_MS) return { items: Object.values(hit.items), next: hit.next || null };
  } catch { /* no cache, search directly */ }
  const res = await ytSearch(text);
  if (res.items.length) S.store.set(path, { q, at: S.store.now(), items: res.items, next: res.next }).catch(() => {});
  return res;
}

/* ---------- search predictions ---------- */
// Predictions come from Google's public suggestion feed for YouTube. It is free and separate from the
// YouTube Data API, so typing never spends the daily search allowance. A real search still runs only
// when someone presses Search or picks a prediction. The feed has no CORS headers, so it loads as a script.

function jsonp(url, ms = 4500) {
  return new Promise((res, rej) => {
    const name = '__pta' + Math.random().toString(36).slice(2);
    const s = document.createElement('script');
    const finish = (fn, v) => { clearTimeout(t); s.remove(); window[name] = () => { delete window[name]; }; fn(v); }; // a late answer lands on a no-op
    const t = setTimeout(() => finish(rej, new Error('timeout')), ms);
    window[name] = (data) => finish(res, data);
    s.onerror = () => finish(rej, new Error('failed'));
    s.src = `${url}${url.includes('?') ? '&' : '?'}callback=${name}`;
    document.head.appendChild(s);
  });
}

const SG = { n: 0, t: null, items: [], active: -1 };

function renderSuggest() {
  const box = $('#add-suggest'), input = $('#add-input');
  if (!box || !input) return;
  const open = SG.items.length > 0;
  box.hidden = !open;
  input.setAttribute('aria-expanded', String(open));
  if (SG.active >= 0 && open) input.setAttribute('aria-activedescendant', 'sg-' + SG.active); else input.removeAttribute('aria-activedescendant');
  box.innerHTML = SG.items.map((text, i) => `<li role="option" id="sg-${i}" data-act="suggest" data-i="${i}" aria-selected="${i === SG.active}">${ICON.search}<span>${esc(text)}</span></li>`).join('');
}

function closeSuggest() {
  clearTimeout(SG.t);
  SG.n++; // drops any answer that is still on its way
  SG.items = []; SG.active = -1;
  renderSuggest();
}

function onSuggestInput() {
  clearTimeout(SG.t);
  const text = $('#add-input').value.trim();
  if (text.length < 2 || parseVideoId(text)) return closeSuggest();
  SG.t = setTimeout(async () => {
    const n = ++SG.n;
    try {
      const j = await jsonp(`https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(text)}`);
      if (n !== SG.n || $('#add-input')?.value.trim() !== text) return; // the person kept typing
      SG.items = (j?.[1] || []).map((x) => String(Array.isArray(x) ? x[0] : x)).filter(Boolean).slice(0, 7);
      SG.active = -1;
      renderSuggest();
    } catch { /* predictions are a nice extra */ }
  }, 180);
}

function onSuggestKey(e) {
  if (!SG.items.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const n = SG.items.length, step = e.key === 'ArrowDown' ? 1 : -1;
    SG.active = SG.active < 0 ? (step > 0 ? 0 : n - 1) : (SG.active + step + n) % n;
    $('#add-input').value = SG.items[SG.active];
    renderSuggest();
  } else if (e.key === 'Escape') { e.preventDefault(); closeSuggest(); }
}

/* ---------- next song suggestions ---------- */
// Songs that go with what is playing, from Deezer's public catalogue (free, no key): find the artist of the
// current song, then ask for that artist's radio. The picks carry no YouTube link, so Add looks the song up
// with one normal search (cached like any other) and queues the best match.

const REC = { forId: null, list: [], n: 0, artistId: null, seen: new Set() };
const DEEZER = 'https://api.deezer.com';

// "Queen – Bohemian Rhapsody (Official Video Remastered)" -> "Queen Bohemian Rhapsody"
const cleanSongTitle = (t) => String(t || '')
  .replace(/\([^)]*\)|\[[^\]]*\]|\u3010[^\u3011]*\u3011/g, ' ')
  .replace(/\bofficial\s+(music\s+|lyric\s+|hd\s+)?(video|audio)\b|\blyrics?\s*(video)?\s*$|\bm\/v\b|\b(hd|4k)\b/gi, ' ')
  .replace(/\b(ft|feat|featuring)\b\.?\s.*$/i, ' ')
  .replace(/[-\u2013\u2014|:"]+/g, ' ').replace(/\s+/g, ' ').trim();

// Deezer's artist radio hands out a different random mix of that artist and similar ones on every call.
async function artistRadio(artistId) {
  const radio = await jsonp(`${DEEZER}/artist/${artistId}/radio?limit=40&output=jsonp`);
  return (radio?.data || []).filter((t) => t && t.title && t.artist?.name).map((t) => ({
    key: String(t.id), title: t.title_short || t.title, artist: t.artist.name, cover: t.album?.cover_medium || t.album?.cover_small || ''
  }));
}

// "Randomize": deal a new random set. Songs already shown are set aside until the pool runs low.
async function moreRecs(btn) {
  btn.disabled = true;
  const n = REC.n;
  document.querySelectorAll('#recs [data-key]').forEach((b) => REC.seen.add(b.dataset.key));
  let extra = [];
  try { if (REC.artistId) extra = await artistRadio(REC.artistId); } catch { /* reuse what is already loaded */ }
  if (n !== REC.n) return; // the song changed while waiting
  const byKey = new Map([...REC.list, ...extra].map((r) => [r.key, r]));
  let pool = [...byKey.values()].filter((r) => !REC.seen.has(r.key));
  if (pool.length < 5) { REC.seen.clear(); pool = [...byKey.values()]; } // everything has had its turn: start over
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  REC.list = pool;
  S.sig.recs = null;
  renderRecs();
}

async function loadRecs() {
  const now = S.room?.q?.now;
  if (!CFG.youtubeApiKey || !now) { REC.forId = null; REC.list = []; REC.n++; return renderRecs(); }
  if (REC.forId === now.id) return renderRecs();
  REC.forId = now.id;
  const n = ++REC.n;
  try {
    const find = async (text) => (text ? (await jsonp(`${DEEZER}/search?limit=1&output=jsonp&q=${encodeURIComponent(text)}`))?.data?.[0] : null);
    const hit = (await find(cleanSongTitle(now.title))) || (await find(String(now.channel || '').replace(/vevo$|official|- topic/gi, ' ').trim()));
    if (n !== REC.n) return;
    REC.artistId = hit?.artist?.id || null;
    REC.seen = new Set();
    const list = REC.artistId ? await artistRadio(REC.artistId) : [];
    if (n !== REC.n) return;
    REC.list = list;
  } catch { if (n === REC.n) REC.list = []; }
  if (n === REC.n) renderRecs();
}

function renderRecs() {
  const box = $('#recs');
  if (!box) return;
  const q = S.room?.q || {};
  const have = [q.now, ...Object.values(q.items || {})].filter(Boolean).map((i) => normQuery(i.title));
  const fresh = REC.list.filter((r) => { const t = normQuery(r.title), a = normQuery(r.artist).split(' ')[0]; return !have.some((h) => h.includes(t) && h.includes(a)); }).slice(0, 5);
  once('recs', JSON.stringify(fresh.map((r) => r.key)), () => {
    box.hidden = !fresh.length;
    box.innerHTML = !fresh.length ? '' : `
      <h2 class="q-title">Suggested next</h2>
      <p class="sub">Picked to go with what is playing.</p>
      <ul class="results">${fresh.map((r) => `
        <li>${/^https:\/\//.test(r.cover) ? `<img src="${esc(r.cover)}" alt="" loading="lazy">` : ''}
          <div class="tk-text"><p class="tk-title">${esc(r.title)}</p><p class="tk-ch">${esc(r.artist)}</p></div>
          <button class="btn line small" data-act="add-rec" data-key="${esc(r.key)}" data-q="${esc(r.artist + ' ' + r.title)}">Add</button></li>`).join('')}</ul>
      <button class="btn line small wide recs-more" data-act="more-recs" title="Show a new random set of suggestions">${ICON.shuffle}Randomize</button>`;
  });
}

/* ---------- search results ---------- */

const R = { text: '', items: [], next: null };
const searchFailText = (err) => (/quota|rateLimit/i.test(err?.reason || '') ? 'Search has hit its daily limit.' : 'Search is not working right now.');

function renderResults() {
  const out = $('#add-out');
  if (!out) return;
  const q = S.room?.q || {};
  const inQueue = new Set([q.now, ...Object.values(q.items || {})].filter(Boolean).map((i) => i.videoId));
  const keepPage = window.scrollY; // the list is long and the page scrolls, so "Show more" must not move the view
  out.innerHTML = `
    <div class="results-head"><p class="sub">${R.items.length} ${R.items.length === 1 ? 'result' : 'results'}</p><button class="link" data-act="clear-results">Close results</button></div>
    <ul class="results" id="results">${R.items.map((r) => `
      <li><img src="https://i.ytimg.com/vi/${esc(r.videoId)}/mqdefault.jpg" alt="" loading="lazy">
        <div class="tk-text"><p class="tk-title">${esc(r.title)}</p><p class="tk-ch">${r.dur ? `<span class="dur">${fmt(r.dur)}</span>` : ''}${esc(r.channel)}</p></div>
        <button class="btn line small" data-act="add-result" data-vid="${esc(r.videoId)}" data-title="${esc(r.title)}" data-channel="${esc(r.channel)}"${inQueue.has(r.videoId) ? ' disabled>Added' : '>Add'}</button></li>`).join('')}</ul>
    ${R.next ? '<button class="btn line small wide" data-act="more-results">Show more results</button>' : ''}`;
  if (window.scrollY !== keepPage) window.scrollTo(0, keepPage);
  refreshFades();
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
  closeSuggest();
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
    if (!res.items.length) { out.innerHTML = '<p class="add-hint">Nothing found. Try the title with the artist, or a different line from the lyrics.</p>'; return; }
    R.text = text; R.items = res.items; R.next = res.next;
    out.innerHTML = '';
    renderResults();
  } catch (err) {
    out.innerHTML = `<p class="add-hint">${searchFailText(err)} <a href="${esc(ytLink)}" target="_blank" rel="noopener">Find it on YouTube</a> and paste the link here instead.</p>`;
  }
}

// The next 50 results for the same search. This is one more search call, so it only runs when asked for.
async function moreResults(btn) {
  if (!R.next) return;
  btn.disabled = true; btn.textContent = 'Loading';
  try {
    const res = await ytSearch(R.text, R.next);
    const seen = new Set(R.items.map((i) => i.videoId));
    R.items = R.items.concat(res.items.filter((i) => !seen.has(i.videoId)));
    R.next = res.next;
    renderResults();
  } catch (err) {
    toast(`${searchFailText(err)} The results so far stay on screen.`, 5000);
    btn.disabled = false; btn.textContent = 'Show more results';
  }
}

// Mix the queue. One transaction on the whole list, so a song removed at the same moment cannot come back half-made.
function shuffleQueue() {
  return S.store.tx(`${base()}/q/items`, (items) => {
    if (!items) return items;
    const ids = Object.keys(items).sort((a, b) => items[a].order - items[b].order);
    if (ids.length < 2) return items;
    const mixed = ids.slice();
    for (let tries = 0; tries < 8 && (tries === 0 || mixed.join() === ids.join()); tries++) {
      for (let i = mixed.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mixed[i], mixed[j]] = [mixed[j], mixed[i]]; }
    }
    const t = S.store.now(); // every new place is in the past, so songs added later still land at the end
    mixed.forEach((id, i) => { items[id].order = t - (mixed.length - i); });
    return items;
  }).then(() => toast('Queue shuffled')).catch(() => toast('The queue could not be shuffled. Try again.'));
}

/* ---------- queue actions ---------- */

const HISTORY_MAX = 50;

function advance(expectId, note) {
  const t = S.store.now();
  return S.store.tx(`${base()}/q`, (q) => {
    q = q || {};
    const curId = q.now ? q.now.id : null;
    if (curId !== expectId) return q; // someone else already moved the queue on
    if (q.now) {
      // Keep the song that is ending in the party's history (the newest 50).
      const hist = q.hist || {}, old = q.now;
      hist[old.id] = { videoId: old.videoId || '', title: old.title || 'YouTube video', channel: old.channel || '', by: old.by || '', byName: old.byName || '', at: t };
      Object.keys(hist).sort((a, b) => hist[b].at - hist[a].at).slice(HISTORY_MAX).forEach((id) => { delete hist[id]; });
      q.hist = hist;
    }
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
  P.yt = null; P.ready = false; P.creating = false; P.loadedId = null; P.tapTried = false;
  const host = $('#yt-host'); if (host) host.innerHTML = '';
  showTap(false);
}

function playerSync() {
  const mine = amPlayer();
  if (mine && !P.yt && !P.creating) createPlayer();
  else if (!mine && (P.yt || P.creating)) destroyPlayer();
  else if (mine && P.ready) reconcile();
}

// The overlay covers the video. The hint sits under it and leaves the video free to be tapped.
function showTap(overlay, hint = false) {
  const t = $('#tap'), h = $('#tap-hint');
  if (t) t.hidden = !overlay;
  if (h) h.hidden = !hint;
}

// Browsers sometimes refuse to start audio until someone taps the page. Offer a tap target when that happens.
// On iPhone and iPad a tap on our overlay does not count as a tap on the video itself, so after one try
// the overlay steps aside and points at the play button inside the video instead.
function armTapCheck() {
  clearTimeout(P.tapT);
  P.tapT = setTimeout(() => {
    const q = S.room?.q || {};
    if (!amPlayer() || !P.ready || !q.now || q.state === 'paused') return showTap(false);
    const st = playerState(), stuck = st !== 1 && st !== 3;
    showTap(stuck && !P.tapTried, stuck && P.tapTried);
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
  if (q.state === 'paused') showTap(false);
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
    P.tapTried = false;
    const now = S.room?.q?.now;
    if (now && now.id === P.loadedId && (!now.title || now.title === 'YouTube video')) {
      // A transaction, so a title that arrives just after a skip cannot bring the old song back as a half-empty entry.
      try {
        const d = P.yt.getVideoData(), id = now.id;
        if (d && d.title) S.store.tx(`${base()}/q/now`, (n) => { if (n && n.id === id) { n.title = d.title; n.channel = d.author || ''; } return n; }).catch(() => {});
      } catch { /* no data yet */ }
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
  const code = Number(e.data);
  // 2: bad video id. 100: removed or private. 101 and 150: the owner does not allow playing it outside YouTube.
  // These are about the song, so skip it and tell everyone why.
  if ([2, 100, 101, 150].includes(code)) {
    advance(now.id, { title: String(now.title || 'a song').slice(0, 80), at: S.store.now(), why: code === 101 || code === 150 ? 'embed' : 'gone' });
    return;
  }
  // Anything else is trouble on this device (connection, browser, player), not with the song.
  // Skipping would run through the whole queue in seconds, so stay on the song and say what to do.
  if (Date.now() - P.errAt > 15000) toast('YouTube could not play this song on this device. Skip it, or move the music to another device.', 8000);
  P.errAt = Date.now();
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
  history: () => toggleHist(),
  'add-hist': async (el) => {
    el.disabled = true;
    const ok = await addSong(el.dataset.vid, { title: el.dataset.title || 'YouTube video', channel: el.dataset.channel });
    if (!ok) el.disabled = false; // on success the list redraws with a tick
  },
  close: () => closeDialog(),
  leave: () => { leaveRoom(false); setPartyParam(''); route(); },
  'play-here': () => setPlayer(S.uid),
  'set-player': (el) => { setPlayer(el.dataset.uid); closeDialog(); },
  tap: () => { showTap(false); P.tapTried = true; try { P.yt.playVideo(); } catch { /* player gone */ } armTapCheck(); },
  'pick-palette': (el) => { pickLook(el.dataset.palette); renderThemeSection('.theme-card[aria-checked="true"]'); },
  mode: () => pickLook(paletteNow(), themeNow() === 'light' ? 'dark' : 'light'),
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
  'q-remove': (el) => S.store.remove(`${base()}/q/items/${el.dataset.id}`).then(() => toast('Removed from the queue')).catch(() => {}),
  'add-result': async (el) => {
    el.disabled = true;
    const ok = await addSong(el.dataset.vid, { title: el.dataset.title, channel: el.dataset.channel });
    if (ok) el.textContent = 'Added'; else el.disabled = false;
  },
  'clear-results': () => { $('#add-out').innerHTML = ''; R.items = []; R.next = null; },
  'more-results': (el) => moreResults(el),
  shuffle: () => shuffleQueue(),
  suggest: (el) => { $('#add-input').value = SG.items[Number(el.dataset.i)] || ''; closeSuggest(); $('#add').requestSubmit(); },
  'more-recs': (el) => moreRecs(el),
  'add-rec': async (el) => {
    el.disabled = true; el.textContent = 'Finding';
    try {
      const { items } = await searchSongs(el.dataset.q);
      const hit = items.find((i) => i.dur > 60 && i.dur < 720) || items[0]; // a song-length video first, not an hour-long mix
      if (!hit) toast('That song could not be found on YouTube.');
      else if (await addSong(hit.videoId, { title: hit.title, channel: hit.channel })) {
        REC.list = REC.list.filter((r) => r.key !== el.dataset.key);
        return renderRecs();
      }
    } catch (err) { toast(`${searchFailText(err)} Paste a YouTube link instead.`, 5000); }
    el.disabled = false; el.textContent = 'Add';
  },
  'copy-link': async (el) => {
    const input = $('#invite-link');
    try { await navigator.clipboard.writeText(input.value); el.textContent = 'Copied'; }
    catch { input.select(); toast('Press and hold the link to copy it.'); }
  },
  'share-link': () => navigator.share({ title: partyName(), text: `Join ${partyName()} and add your songs`, url: $('#invite-link').value }).catch(() => {})
};

document.addEventListener('click', (e) => {
  if (e.target.id === 'dlg') return closeDialog(); // click on the backdrop
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el, e);
});

document.addEventListener('scroll', (e) => { if (e.target instanceof Element && e.target.matches('.queue, .results.scroll')) refreshFades(); }, true);
window.addEventListener('resize', refreshFades);

// Keyboard way to reorder: with the grip focused, the up and down arrows move the song one place.
document.addEventListener('keydown', (e) => {
  const grip = e.target.closest?.('.grip');
  if (!grip || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const id = grip.closest('.ticket').dataset.id, list = sortedItems(), i = list.findIndex((x) => x.id === id);
  const to = i + (e.key === 'ArrowUp' ? -1 : 1);
  if (i < 0 || to < 0 || to >= list.length) return;
  moveTo(id, to).then(() => requestAnimationFrame(() => $(`#queue [data-id="${CSS.escape(id)}"] .grip`)?.focus()));
});
// Escape tucks the history away when it is covering the page.
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && histOpen && !histWide() && !$('#dlg').open) toggleHist(false); });

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
