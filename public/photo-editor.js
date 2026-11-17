// Photo editor for avatars.
// Drag the photo to move it. Zoom with the slider, the mouse wheel or a pinch. Rotate in quarter turns, and adjust
// brightness and contrast. What sits inside the circle is what becomes the avatar: a 128 pixel square.
//
// The editor works on a copy of the photo that is at most 900 pixels on a side. That copy is what the app keeps on
// this device, so a photo can be adjusted again later from the original framing, not from the small result.

const ROTATE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>';

export const OUT = 128;
export const DEFAULTS = { zoom: 1, px: 0, py: 0, rot: 0, bright: 1, contrast: 1 };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = src; });
}

// A JPEG copy of the photo, no bigger than max pixels on a side, with any camera rotation already applied.
export function shrink(img, max = 900) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); // a see-through PNG gets a white ground, not black
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

// Where the photo sits. The position is kept as a fraction of the square, so the same framing gives the same
// picture on the preview and on the 128 pixel result.
function frame(img, p, S) {
  const turned = p.rot % 2 === 1;
  const rw = turned ? img.naturalHeight : img.naturalWidth, rh = turned ? img.naturalWidth : img.naturalHeight;
  const scale = (S / Math.min(rw, rh)) * p.zoom; // zoom 1 means the photo just covers the square
  return { scale, dw: rw * scale, dh: rh * scale };
}

// The photo can be moved but never far enough to leave an empty edge inside the square.
export function clampParams(img, p) {
  const f = frame(img, p, 1);
  const mx = Math.max(0, (f.dw - 1) / 2), my = Math.max(0, (f.dh - 1) / 2);
  p.px = clamp(p.px, -mx, mx); p.py = clamp(p.py, -my, my);
  return p;
}

function drawTo(ctx, img, p, S) {
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, S, S);
  ctx.imageSmoothingQuality = 'high';
  const f = frame(img, p, S);
  ctx.translate(S / 2 + p.px * S, S / 2 + p.py * S);
  ctx.rotate((p.rot * Math.PI) / 2);
  ctx.scale(f.scale, f.scale);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();
}

// Brightness then contrast, on each colour channel. This is the same maths as the CSS brightness() and contrast()
// filters used on the preview, written out so the saved picture matches it in every browser.
function tone(ctx, S, b, c) {
  if (b === 1 && c === 1) return;
  const d = ctx.getImageData(0, 0, S, S), a = d.data;
  for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) a[i + k] = clamp((((a[i + k] / 255) * b - 0.5) * c + 0.5) * 255, 0, 255);
  ctx.putImageData(d, 0, 0);
}

// The avatar itself: a 128 pixel JPEG as a data URL. Drawn at twice the size first and then scaled down, which
// keeps a big photo from looking jagged.
export function renderAvatar(img, params) {
  const p = clampParams(img, { ...DEFAULTS, ...params });
  const big = document.createElement('canvas'); big.width = big.height = OUT * 2;
  const bx = big.getContext('2d', { willReadFrequently: true }); drawTo(bx, img, p, OUT * 2); tone(bx, OUT * 2, p.bright, p.contrast);
  const out = document.createElement('canvas'); out.width = out.height = OUT;
  const ox = out.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(big, 0, 0, OUT, OUT);
  return out.toDataURL('image/jpeg', 0.85);
}

// Fills root with the editor. img is the (shrunk) photo, start the saved framing or null.
// hooks.onDone({ dataUrl, params }) when the person is happy, hooks.onCancel() when they are not.
// Returns { destroy() }. openPhotoEditor below puts this into a popup, which is how the app uses it.
export function mountEditor(root, img, start, hooks) {
  const p = clampParams(img, { ...DEFAULTS, ...(start || {}) });
  root.innerHTML = `
    <div class="crop" role="group" aria-label="Adjust your photo">
      <p class="hint">Drag the photo to move it. Pinch, scroll or use the slider to zoom.</p>
      <div class="crop-stage" tabindex="0" role="img" aria-label="Photo preview. Drag to move it. Arrow keys nudge it and plus and minus zoom.">
        <canvas class="crop-canvas"></canvas><span class="crop-mask"></span>
        <button type="button" class="crop-rotate" data-c="rotate" aria-label="Rotate a quarter turn" title="Rotate">${ROTATE}</button>
      </div>
      <div class="crop-controls">
        <label class="crop-row"><span>Zoom</span><input type="range" data-k="zoom" min="1" max="4" step="0.01"></label>
        <label class="crop-row"><span>Brightness</span><input type="range" data-k="bright" min="0.5" max="1.5" step="0.01"></label>
        <label class="crop-row"><span>Contrast</span><input type="range" data-k="contrast" min="0.5" max="1.5" step="0.01"></label>
      </div>
      <div class="crop-actions">
        <button type="button" class="btn quiet small" data-c="reset">Reset</button>
        <button type="button" class="btn line small" data-c="cancel">Cancel</button>
        <button type="button" class="btn primary small" data-c="done">Use photo</button>
      </div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const stage = $('.crop-stage'), canvas = $('.crop-canvas'), sliders = [...root.querySelectorAll('input[type=range]')];
  let raf = 0, gone = false;

  // The sliders always show the real values, even before the editor is on screen. The picture needs a size, so it is
  // drawn once the popup is visible (see refresh).
  const syncSliders = () => { for (const s of sliders) { const v = String(p[s.dataset.k]); if (s.value !== v) s.value = v; } };
  const draw = () => {
    raf = 0;
    if (gone) return;
    syncSliders();
    const S = Math.round(stage.clientWidth), d = Math.min(2, window.devicePixelRatio || 1);
    if (!S) return;
    canvas.width = canvas.height = Math.round(S * d);
    const ctx = canvas.getContext('2d');
    ctx.scale(d, d);
    drawTo(ctx, img, p, S);
    canvas.style.filter = p.bright === 1 && p.contrast === 1 ? '' : `brightness(${p.bright}) contrast(${p.contrast})`;
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const move = (dx, dy) => { p.px += dx; p.py += dy; clampParams(img, p); schedule(); };
  const zoomTo = (z) => { z = clamp(z, 1, 4); const k = z / p.zoom; p.px *= k; p.py *= k; p.zoom = z; clampParams(img, p); schedule(); };

  // Drag to move, two fingers to pinch.
  const pts = new Map(); let lastDist = 0;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    try { stage.setPointerCapture(e.pointerId); } catch { /* a pointer that is already gone */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastDist = 0;
    stage.focus({ preventScroll: true });
  });
  stage.addEventListener('pointermove', (e) => {
    const was = pts.get(e.pointerId);
    if (!was) return;
    const S = stage.clientWidth || 1;
    if (pts.size === 1) move((e.clientX - was.x) / S, (e.clientY - was.y) / S);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist) zoomTo(p.zoom * (dist / lastDist));
      lastDist = dist;
    }
  });
  const lift = (e) => { pts.delete(e.pointerId); lastDist = 0; };
  stage.addEventListener('pointerup', lift);
  stage.addEventListener('pointercancel', lift);
  stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomTo(p.zoom * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  stage.addEventListener('keydown', (e) => {
    const step = 0.02, keys = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (keys[e.key]) { e.preventDefault(); move(...keys[e.key]); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(p.zoom + 0.1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo(p.zoom - 0.1); }
  });

  for (const s of sliders) s.addEventListener('input', () => { if (s.dataset.k === 'zoom') zoomTo(Number(s.value)); else { p[s.dataset.k] = Number(s.value); schedule(); } });

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    if (b.dataset.c === 'rotate') { p.rot = (p.rot + 1) % 4; p.px = p.py = 0; clampParams(img, p); schedule(); }
    else if (b.dataset.c === 'reset') { Object.assign(p, DEFAULTS); schedule(); }
    else if (b.dataset.c === 'cancel') { destroy(); hooks.onCancel(); }
    else if (b.dataset.c === 'done') { const params = { ...p }, dataUrl = renderAvatar(img, params); destroy(); hooks.onDone({ dataUrl, params }); }
  });

  function destroy() {
    if (gone) return;
    gone = true;
    cancelAnimationFrame(raf);
  }

  draw();
  return { destroy, refresh: draw, focus: () => stage.focus({ preventScroll: true }) };
}

// The editor in a popup on top of whatever is open, such as the profile dialog. Nothing underneath is touched, so a
// name being typed there is safe. Escape, the cross and a click outside all cancel. Use photo hands the result back.
export function openPhotoEditor(img, start, hooks) {
  const dlg = document.createElement('dialog');
  dlg.className = 'dlg dlg-photo';
  dlg.setAttribute('aria-labelledby', 'photo-title');
  dlg.innerHTML = '<header class="dlg-head"><h2 id="photo-title">Adjust your photo</h2><button type="button" class="icon" data-x aria-label="Close" title="Close">\u2715</button></header><div class="crop-body"></div>';
  document.body.appendChild(dlg);
  let done = false;
  const finish = (fn) => { if (done) return; done = true; editor.destroy(); dlg.close(); dlg.remove(); fn(); };
  const editor = mountEditor(dlg.querySelector('.crop-body'), img, start, {
    onDone: (r) => finish(() => hooks.onDone(r)),
    onCancel: () => finish(() => hooks.onCancel())
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(() => hooks.onCancel()); }); // Escape
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-x]')) finish(() => hooks.onCancel()); });
  dlg.showModal();
  editor.refresh(); // now it has a size: draw the photo
  editor.focus();
}
