/* Cave Party music colour.
   Makes the page atmosphere (background, raised surfaces, frosted glass and the two corner lights)
   follow the artwork of the song that is playing. Text, mint and danger never change, and every
   derived colour keeps the lightness of the brand colour it replaces, so contrast holds for any song.

   Use:
     CaveMusicColor.follow('https://i.ytimg.com/vi/VIDEO_ID/mqdefault.jpg');  // when a song starts
     CaveMusicColor.clear();                                                  // when nothing plays
     CaveMusicColor.refresh();                                                // after the theme changes
*/
(function (global) {
  'use strict';

  /* ---------- colour maths: sRGB and OKLCH ---------- */

  function toLinear(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function fromLinear(v) { return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }

  function rgbToOklch(r, g, b) {
    r = toLinear(r); g = toLinear(g); b = toLinear(b);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    var L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    var A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    var B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return [L, Math.sqrt(A * A + B * B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
  }

  function oklchToLinear(L, C, h) {
    var a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
    var l = L + 0.3963377774 * a + 0.2158037573 * b;
    var m = L - 0.1055613458 * a - 0.0638541728 * b;
    var s = L - 0.0894841775 * a - 1.2914855480 * b;
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }

  function inGamut(c) { return c[0] > -0.0005 && c[0] < 1.0005 && c[1] > -0.0005 && c[1] < 1.0005 && c[2] > -0.0005 && c[2] < 1.0005; }

  // OKLCH to sRGB. If the colour is too vivid for the screen, chroma is reduced and lightness is kept.
  function oklchToRgb(L, C, h) {
    var lin = oklchToLinear(L, C, h);
    if (!inGamut(lin)) {
      var lo = 0, hi = C;
      for (var i = 0; i < 14; i++) { var mid = (lo + hi) / 2; if (inGamut(oklchToLinear(L, mid, h))) lo = mid; else hi = mid; }
      lin = oklchToLinear(L, lo, h);
    }
    return lin.map(function (v) { return Math.round(255 * fromLinear(Math.min(1, Math.max(0, v)))); });
  }

  /* ---------- the recipes ---------- */
  // Each entry: lightness, chroma, which hue to use, alpha, and whether dull artwork should mute the chroma.
  // Lightness values match the brand tokens, which is what keeps text contrast constant.

  var RECIPES = {
    cave: {
      '--bg':        [0.212, 0.088, 'h', 1, true],
      '--surface':   [0.262, 0.107, 'h', 1, true],
      '--surface-2': [0.300, 0.120, 'h', 1, true],
      '--menu':      [0.300, 0.120, 'h', 1, true],
      '--glass':     [0.262, 0.107, 'h', 0.58, true],
      '--sheet':     [0.262, 0.107, 'h', 0.90, true],
      '--glow-a':    [0.840, 0.130, 'h', 0.22, false],
      '--glow-b':    [0.740, 0.130, 'h2', 0.18, false]
    },
    daylight: {
      '--bg':        [0.972, 0.020, 'h', 1, true],
      '--surface':   [1.000, 0.000, 'h', 1, false],
      '--surface-2': [0.925, 0.035, 'h', 1, true],
      '--menu':      [1.000, 0.000, 'h', 1, false],
      '--glass':     [0.995, 0.012, 'h', 0.66, true],
      '--sheet':     [0.995, 0.008, 'h', 0.92, true],
      '--glow-a':    [0.860, 0.120, 'h', 0.34, false],
      '--glow-b':    [0.800, 0.110, 'h2', 0.24, false]
    }
  };

  // The brand colours at rest, as [r, g, b, alpha]. These are the token values.
  var REST_RGBA = {
    cave: {
      '--bg': [13, 17, 64, 1], '--surface': [22, 27, 87, 1], '--surface-2': [31, 38, 112, 1], '--menu': [31, 38, 112, 1],
      '--glass': [22, 27, 87, 0.58], '--sheet': [22, 27, 87, 0.90], '--glow-a': [116, 242, 190, 0.20], '--glow-b': [140, 155, 255, 0.16]
    },
    daylight: {
      '--bg': [244, 246, 255, 1], '--surface': [255, 255, 255, 1], '--surface-2': [221, 226, 255, 1], '--menu': [255, 255, 255, 1],
      '--glass': [255, 255, 255, 0.66], '--sheet': [255, 255, 255, 0.92], '--glow-a': [116, 242, 190, 0.34], '--glow-b': [140, 155, 255, 0.24]
    }
  };

  function rest(theme) {
    var out = {}, src = REST_RGBA[theme];
    for (var name in src) { var c = rgbToOklch(src[name][0], src[name][1], src[name][2]); out[name] = [c[0], c[1], c[2], src[name][3]]; }
    return out;
  }

  // music = { h, h2, k }: main hue, second hue, and how colourful the artwork is (0.35 to 1).
  function derive(theme, music) {
    var out = {}, rec = RECIPES[theme];
    for (var name in rec) {
      var r = rec[name];
      out[name] = [r[0], r[1] * (r[4] ? music.k : 1), music[r[2]], r[3]];
    }
    return out;
  }

  function css(c) {
    var rgb = oklchToRgb(c[0], c[1], c[2]);
    return 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', ' + (Math.round(c[3] * 1000) / 1000) + ')';
  }

  /* ---------- reading the artwork ---------- */

  // pixels: RGBA bytes, for example from getImageData. Returns { h, h2, k }, or null for artwork with no real colour.
  function analyse(pixels) {
    var BINS = 36, w = new Float64Array(BINS), wc = new Float64Array(BINS), sx = new Float64Array(BINS), sy = new Float64Array(BINS);
    var seen = 0, vivid = 0;
    for (var i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 128) continue;
      seen++;
      var c = rgbToOklch(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (c[1] < 0.04) continue;                                   // greys carry no hue
      vivid++;
      var weight = c[1] * c[1] * Math.max(0.05, 1 - Math.abs(c[0] - 0.62) / 0.62);   // vivid, mid-light pixels count most
      var bin = Math.floor(c[2] / (360 / BINS)) % BINS, rad = c[2] * Math.PI / 180;
      w[bin] += weight; wc[bin] += weight * c[1]; sx[bin] += weight * Math.cos(rad); sy[bin] += weight * Math.sin(rad);
    }
    if (!seen || vivid / seen < 0.06) return null;                 // black and white artwork: keep the brand colours

    function smooth(b) { return w[(b + BINS - 1) % BINS] + 2 * w[b] + w[(b + 1) % BINS]; }
    function hueAround(b) {
      var x = 0, y = 0;
      for (var d = -1; d <= 1; d++) { var j = (b + d + BINS) % BINS; x += sx[j]; y += sy[j]; }
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }
    var top = 0, b;
    for (b = 1; b < BINS; b++) if (smooth(b) > smooth(top)) top = b;
    var second = -1;
    for (b = 0; b < BINS; b++) {
      var dist = Math.min(Math.abs(b - top), BINS - Math.abs(b - top));
      if (dist >= 5 && (second < 0 || smooth(b) > smooth(second))) second = b;
    }
    var h = hueAround(top);
    var h2 = second >= 0 && smooth(second) >= 0.25 * smooth(top) ? hueAround(second) : (h + 40) % 360;
    var cw = 0, cc = 0;
    for (var d = -1; d <= 1; d++) { var j = (top + d + BINS) % BINS; cw += w[j]; cc += wc[j]; }
    var k = Math.min(1, Math.max(0.35, (cc / cw) / 0.13));
    return { h: h, h2: h2, k: k };
  }

  function fromCanvas(canvas) {
    try { return analyse(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data); }
    catch (e) { return null; }                                     // the browser refused to let us read the pixels
  }

  // Loads an image and reads its colours. Resolves null if the image cannot be loaded or read.
  function fromUrl(url) {
    return new Promise(function (resolve) {
      var img = new Image(), done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = 32; c.height = 18;
        try { c.getContext('2d').drawImage(img, 0, 0, 32, 18); } catch (e) { return finish(null); }
        finish(fromCanvas(c));
      };
      img.onerror = function () { finish(null); };
      setTimeout(function () { finish(null); }, 6000);
      img.src = url;
    });
  }

  /* ---------- applying it, with a slow crossfade ---------- */

  var state = { theme: null, current: null, music: null, raf: 0, ticket: 0 };

  function themeNow(opts) {
    var t = (opts && opts.theme) || document.documentElement.getAttribute('data-theme') || 'cave';
    return t === 'daylight' || t === 'light' ? 'daylight' : 'cave';
  }

  function mix(a, b, t) {
    // hue takes the short way round; a colour with no chroma borrows the other one's hue
    var ha = a[1] < 0.004 ? b[2] : a[2], hb = b[1] < 0.004 ? a[2] : b[2];
    var dh = ((hb - ha + 540) % 360) - 180;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (ha + dh * t + 360) % 360, a[3] + (b[3] - a[3]) * t];
  }

  // music: { h, h2, k } to follow a song, or null to go back to the brand colours.
  // opts: { theme, duration (ms, default 1400), root (element that carries the variables) }
  function apply(music, opts) {
    opts = opts || {};
    var root = opts.root || document.documentElement, theme = themeNow(opts);
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var duration = reduce ? 0 : (opts.duration === undefined ? 1400 : opts.duration);
    var from = state.current && state.theme === theme ? state.current : rest(theme);
    var to = music ? derive(theme, music) : rest(theme);
    state.theme = theme; state.music = music;
    cancelAnimationFrame(state.raf);
    var start = null;

    function paint(t) {
      var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // ease in and out
      var now = {};
      for (var name in to) { now[name] = mix(from[name], to[name], e); root.style.setProperty(name, css(now[name])); }
      state.current = now;
      if (t === 1 && !music) { for (var n in to) root.style.removeProperty(n); state.current = null; }   // hand back to the stylesheet
    }
    function frame(ts) {
      if (start === null) start = ts;
      var t = duration ? Math.min(1, (ts - start) / duration) : 1;
      paint(t);
      if (t < 1) state.raf = requestAnimationFrame(frame);
    }
    if (!duration) paint(1); else state.raf = requestAnimationFrame(frame);
  }

  function follow(url, opts) {
    var ticket = ++state.ticket;
    return fromUrl(url).then(function (music) {
      if (ticket === state.ticket) apply(music, opts);              // ignore results for a song that was already skipped
      return music;
    });
  }

  global.CaveMusicColor = {
    follow: follow,
    clear: function (opts) { state.ticket++; apply(null, opts); },
    refresh: function (opts) { apply(state.music, Object.assign({ duration: 0 }, opts || {})); },
    apply: apply, analyse: analyse, fromCanvas: fromCanvas, fromUrl: fromUrl, derive: derive, rest: rest, css: css,
    oklchToRgb: oklchToRgb, rgbToOklch: rgbToOklch
  };
})(typeof window !== 'undefined' ? window : this);
