// Fractal rendering kernel.
//
// Everything in fractalKernel() is self-contained so the same source can run
// on the main thread *and* inside a Web Worker (renderer.js turns this
// function's source text into a worker script).
//
// Speed-ups compared with the original per-pixel code:
//  - plain number arithmetic, no [re, im] arrays allocated per iteration
//  - a dedicated z^2 + c loop for power 2
//  - colours come from a lookup table instead of Math.log per pixel
//  - Mandelbrot, power 2: points in the main cardioid / period-2 bulb are
//    known to be inside the set and are skipped
//  - periodicity check: if z ever repeats *exactly*, the orbit is a cycle and
//    can never escape, so we stop early (result is identical to iterating on)
// With smooth shading off, the image is pixel-identical to the original
// algorithm. Smooth shading (see renderRows) blends between the bands.
function fractalKernel(scope) {
  "use strict";

  var palettes = {};
  var FINE = 2048;        // entries of the table used for smooth shading
  var BAIL_SMOOTH = 1e6;  // |z|^2 at which smooth shading stops iterating
  var lastMod2 = 0;       // |z|^2 when escape() last saw a point escape

  // Colour on the blend at position c (0..3) of a scheme, written as RGBA
  // bytes at o. From points that escape at once (the first stop) to those
  // that escape last (the last stop); a scheme may have any number of stops,
  // spread evenly over 0..3.
  function blend(colours, c, bytes, o) {
    var last = colours.stops.length - 1;
    var pos = last === 3 ? c : c * last / 3;   // four stops: exactly as before
    var seg = Math.min(last - 1, Math.floor(pos)), u = pos - seg;
    var a = colours.stops[seg], b = colours.stops[seg + 1];
    for (var k = 0; k < 3; k++) { bytes[o + k] = a[k] + (b[k] - a[k]) * u; }
    bytes[o + 3] = 255;
  }

  // Packed RGBA colours (little-endian Uint32), cached per scheme.
  // Banded shading: one colour per iteration count 0..maxIter; the count is
  // put on a log scale from 0 to 3; 0 (never escaped) gets `inside`.
  // Smooth shading: FINE colours along the blend, plus `inside` at the end.
  // colours = { key, inside: [r,g,b], stops: four [r,g,b] }
  // low, high: for banded shading, the counts where the blend starts and ends
  // (0 and maxIter, or see valueRange).
  function palette(colours, maxIter, smooth, low, high) {
    low = low || 0;
    high = high || maxIter;
    var key = colours.key + ":" + (smooth ? "smooth" : maxIter + "/" + low + "/" + high);
    if (palettes[key]) { return palettes[key]; }
    var size = smooth ? FINE + 1 : maxIter + 1;
    var bytes = new Uint8ClampedArray(size * 4);
    for (var i = 0; i < size; i++) {
      if (smooth ? i === FINE : i === 0) {
        bytes[i * 4] = colours.inside[0]; bytes[i * 4 + 1] = colours.inside[1];
        bytes[i * 4 + 2] = colours.inside[2]; bytes[i * 4 + 3] = 255;
      } else {
        var c = smooth ? 3 * i / (FINE - 1)
          : low || high !== maxIter
            ? Math.min(3, 3 * Math.log((i > low ? i - low : 0) + 1) / Math.log(high - low + 1))
          : 3 * Math.log(i + 1) / Math.log(maxIter + 1);
        blend(colours, c, bytes, i * 4);
      }
    }
    var lut = new Uint32Array(bytes.buffer);
    palettes[key] = lut;
    return lut;
  }

  // Escape count for one point: 0 = never escaped (inside), otherwise 1..maxIter.
  // (zr, zi) is the starting z, (cr, ci) the constant; the point has escaped
  // once |z|^2 >= bail (4 for banded shading, as the original page did).
  function escape(zr, zi, cr, ci, n, maxIter, bail) {
    if (zr * zr + zi * zi >= bail) { lastMod2 = zr * zr + zi * zi; return 1; }
    var pr = zr, pi = zi;          // periodicity reference point
    var check = 8, sinceCheck = 0; // Brent-style doubling window
    var ii, t, m;
    if (n === 2) {
      var zr2 = zr * zr, zi2 = zi * zi;
      for (ii = 0; ii < maxIter; ii++) {
        zi = 2 * zr * zi + ci;
        zr = zr2 - zi2 + cr;
        zr2 = zr * zr; zi2 = zi * zi;
        if (zr2 + zi2 >= bail) { lastMod2 = zr2 + zi2; return ii + 1; }
        if (zr === pr && zi === pi) { return 0; }
        if (++sinceCheck === check) { sinceCheck = 0; check *= 2; pr = zr; pi = zi; }
      }
    } else {
      for (ii = 0; ii < maxIter; ii++) {
        var ar = 1, ai = 0;
        for (var k = 0; k < n; k++) { t = ar * zr - ai * zi; ai = ai * zr + ar * zi; ar = t; }
        zr = ar + cr; zi = ai + ci;
        m = zr * zr + zi * zi;
        if (m >= bail) { lastMod2 = m; return ii + 1; }
        if (zr === pr && zi === pi) { return 0; }
        if (++sinceCheck === check) { sinceCheck = 0; check *= 2; pr = zr; pi = zi; }
      }
    }
    return 0;
  }

  // ---- Other formulas (formulas.js): compiled loops ----

  var loops = {};                    // compiled loops, by formula key
  var mods = new Float64Array(2);    // |z|^2 at escape and one step before

  function loopFor(fm) {
    var run = loops[fm.key];
    if (!run) {
      run = loops[fm.key] = new Function("zr", "zi", "cr", "ci", "maxIter", "bail", "n", "m", fm.loop);
    }
    return run;
  }

  function renderFormula(p, rowStart, rowEnd) {
    var fm = p.formula, run = loopFor(fm);
    var w = p.width;
    var out = new Uint32Array(w * (rowEnd - rowStart));
    var n = p.power, maxIter = p.maxIter;
    var smooth = !!p.smooth && fm.smooth;
    // Where the blend starts and ends: 0 and maxIter, or see valueRange.
    var low = p.low || 0, high = p.high || maxIter;
    var lut = palette(p.colours, maxIter, smooth, low, high);
    var inside = smooth ? lut[FINE] : lut[0];
    var bail = smooth ? BAIL_SMOOTH : fm.bail;
    // The degree d of the formula, for smooth shading: given, the power n,
    // or (for a typed formula) estimated from the last two steps, as
    // log|z_k| / log|z_k-1| tends to d once z is large.
    var logD = fm.degree > 1 ? Math.log(fm.degree) : (fm.degree === 0 && n > 1 ? Math.log(n) : 0);
    var estimate = fm.id === "custom";
    var toFine = (FINE - 1) / Math.log(high - low + 1);
    var xr = (p.x1 - p.x0) / p.width;
    var yr = (p.y1 - p.y0) / p.height;
    var isM = p.type === "mandelbrot";
    var sr = fm.start[0], si = fm.start[1];
    var idx = 0;
    for (var j = rowStart; j < rowEnd; j++) {
      var y = -(j * yr + p.y0);
      for (var i = 0; i < w; i++) {
        var x = i * xr + p.x0;
        var it = isM ? run(sr, si, x, y, maxIter, bail, n, mods)
                     : run(x, y, p.cr, p.ci, maxIter, bail, n, mods);
        if (it === 0) { out[idx++] = inside; continue; }
        if (!smooth) { out[idx++] = lut[it]; continue; }
        var m0 = mods[0], m1 = mods[1], nu = it, ld = logD;
        if (estimate) {
          ld = (m1 > 4 && m0 > m1 && m0 < Infinity) ? Math.log(Math.log(m0) / Math.log(m1)) : Math.LN2;
          if (!(ld > 0.05)) { ld = Math.LN2; }
        }
        if (m0 > 1 && m0 < Infinity && ld > 0) {
          nu = it + 1 - Math.log(0.5 * Math.log(m0) / Math.LN2) / ld;
        }
        if (!(nu >= 0)) { nu = 0; }
        var f = Math.log((nu > low ? nu - low : 0) + 1) * toFine;
        out[idx++] = lut[f >= FINE - 1 ? FINE - 1 : (f + 0.5) | 0];
      }
    }
    return out;
  }

  // ---- Ink lines: how far each pixel is from the set ----
  //
  // Outside the set, the smooth count nu grows like -log(distance) / log d
  // as a point gets closer to the set (d is the degree of the formula). So
  // the distance, in pixels, is about 1 / (log d * |change of nu from one
  // pixel to the next|). Pixels within about a pixel of the set are inked;
  // a pixel next to an inside one is on the boundary itself. This needs no
  // derivative of the formula, so it works for every formula, typed ones too.

  // What one point needs, worked out once per strip.
  function pointContext(p) {
    var fm = p.formula, classic = !fm || fm.id === "classic", n = p.power;
    var smooth = classic ? n >= 2 : fm.smooth;
    return {
      classic: classic, run: classic ? null : loopFor(fm), n: n, maxIter: p.maxIter,
      smooth: smooth,
      bail: smooth ? BAIL_SMOOTH : (classic ? 4 : fm.bail),
      logD: classic ? Math.log(n) : (fm.degree > 1 ? Math.log(fm.degree) : (fm.degree === 0 && n > 1 ? Math.log(n) : 0)),
      estimate: !classic && fm.id === "custom",
      isM: p.type === "mandelbrot",
      start: classic ? [0, 0] : fm.start,
      cr: p.cr, ci: p.ci,
      bulb: classic && n === 2 && p.type === "mandelbrot"
    };
  }

  // The smooth count of a point (the plain count where there is no smooth
  // one), or -1 inside the set.
  function pointValue(k, x, y) {
    var it, m0, m1 = 0;
    if (k.classic) {
      if (k.bulb) {
        var y2 = y * y, xq = x - 0.25, q = xq * xq + y2;
        if (q * (q + xq) <= 0.25 * y2 || (x + 1) * (x + 1) + y2 <= 0.0625) { return -1; }
      }
      it = k.isM ? escape(0, 0, x, y, k.n, k.maxIter, k.bail) : escape(x, y, k.cr, k.ci, k.n, k.maxIter, k.bail);
      m0 = lastMod2;
    } else {
      it = k.isM ? k.run(k.start[0], k.start[1], x, y, k.maxIter, k.bail, k.n, mods)
                 : k.run(x, y, k.cr, k.ci, k.maxIter, k.bail, k.n, mods);
      m0 = mods[0]; m1 = mods[1];
    }
    if (it === 0) { return -1; }
    if (!k.smooth) { return it; }
    var ld = k.logD;
    if (k.estimate) {
      ld = (m1 > 4 && m0 > m1 && m0 < Infinity) ? Math.log(Math.log(m0) / Math.log(m1)) : Math.LN2;
      if (!(ld > 0.05)) { ld = Math.LN2; }
    }
    var nu = it;
    if (m0 > 1 && m0 < Infinity && ld > 0) { nu = it + 1 - Math.log(0.5 * Math.log(m0) / Math.LN2) / ld; }
    return nu > 0 ? nu : 0;
  }

  var LINE_WIDTH = 1.0;   // CSS pixels: no ink beyond this distance from the set
  var BOUNDARY = 0.25;    // distance taken for a pixel next to an inside one
  var UNDERTONE = 0.18;   // how much of the smooth shading shows under the lines

  function renderLines(p, rowStart, rowEnd) {
    var k = pointContext(p);
    var w = p.width, h = p.height;
    var out = new Uint32Array(w * (rowEnd - rowStart));
    var low = p.low || 0, high = p.high || p.maxIter;
    var lut = palette(p.colours, p.maxIter, true);
    var toFine = (FINE - 1) / Math.log(high - low + 1);
    var paper = p.colours.stops[0], ink = p.colours.stops[p.colours.stops.length - 1], inside = lut[FINE];
    var logD = k.logD > 0 ? k.logD : Math.LN2;
    var scale = p.lineScale || 1;   // canvas pixels per CSS pixel
    var xr = (p.x1 - p.x0) / p.width;
    var yr = (p.y1 - p.y0) / p.height;

    // The values of the rows of the strip, and of one row above and below it
    // (for the change from pixel to pixel at its edges).
    var first = Math.max(0, rowStart - 1), last = Math.min(h - 1, rowEnd);
    var rows = last - first + 1;
    var v = new Float64Array(w * rows);
    for (var r = 0; r < rows; r++) {
      var y = -((first + r) * yr + p.y0);
      for (var i = 0; i < w; i++) { v[r * w + i] = pointValue(k, i * xr + p.x0, y); }
    }

    var idx = 0;
    for (var j = rowStart; j < rowEnd; j++) {
      var r0 = j - first;
      var up = j > first ? r0 - 1 : r0, down = j < last ? r0 + 1 : r0;
      for (var i2 = 0; i2 < w; i2++) {
        var c = v[r0 * w + i2];
        if (c < 0) { out[idx++] = inside; continue; }
        var left = i2 > 0 ? v[r0 * w + i2 - 1] : c, right = i2 < w - 1 ? v[r0 * w + i2 + 1] : c;
        var above = v[up * w + i2], below = v[down * w + i2];
        var d;   // distance to the set, in CSS pixels
        if (left < 0 || right < 0 || above < 0 || below < 0) {
          d = BOUNDARY;   // the boundary passes through this pixel
        } else {
          var gx = (right - left) / (i2 > 0 && i2 < w - 1 ? 2 : 1);
          var gy = (below - above) / (down - up || 1);
          var g = Math.sqrt(gx * gx + gy * gy);
          d = g > 0 ? 1 / (logD * g) / scale : Infinity;
        }
        var t = d / LINE_WIDTH, s = t >= 1 ? 0 : (1 - t) * (1 - t);   // ink strength
        // Under the ink, a light version of the smooth shading.
        var f = Math.log((c > low ? c - low : 0) + 1) * toFine;
        var shade = lut[f >= FINE - 1 ? FINE - 1 : (f + 0.5) | 0];
        var rgb = [shade & 255, (shade >>> 8) & 255, (shade >>> 16) & 255];
        var col = 0;
        for (var q = 0; q < 3; q++) {
          var base = paper[q] + (rgb[q] - paper[q]) * UNDERTONE;
          var val = Math.round(base + (ink[q] - base) * s);
          col |= (val < 0 ? 0 : val > 255 ? 255 : val) << (8 * q);
        }
        out[idx++] = (col | 0xff000000) >>> 0;
      }
    }
    return out;
  }

  // Render rows [rowStart, rowEnd) of a view into packed RGBA pixels.
  // p = { type, width, height, x0, x1, y0, y1, power, maxIter, cr, ci, colours,
  //       smooth, lines, lineScale, formula }
  function renderRows(p, rowStart, rowEnd) {
    if (p.lines) { return renderLines(p, rowStart, rowEnd); }
    if (p.formula && p.formula.id !== "classic") { return renderFormula(p, rowStart, rowEnd); }
    var w = p.width;
    var out = new Uint32Array(w * (rowEnd - rowStart));
    var n = p.power, maxIter = p.maxIter;
    // Smooth shading needs a power of at least 2 (it divides by log n).
    var smooth = !!p.smooth && n >= 2;
    // Where the blend starts and ends: 0 and maxIter, or see valueRange.
    var low = p.low || 0, high = p.high || maxIter;
    var lut = palette(p.colours, maxIter, smooth, low, high);
    var inside = smooth ? lut[FINE] : lut[0];
    var bail = smooth ? BAIL_SMOOTH : 4;
    // Smooth shading: the "normalised iteration count"
    //   nu = count + 1 - log(log|z| / log 2) / log n,
    // which grows continuously instead of in steps, then the same log scale.
    var invLogN = 1 / Math.log(n), invLog2 = 1 / Math.LN2;
    var toFine = (FINE - 1) / Math.log(high - low + 1);
    var xr = (p.x1 - p.x0) / p.width;
    var yr = (p.y1 - p.y0) / p.height;
    var isM = p.type === "mandelbrot";
    var bulbCheck = isM && n === 2;
    var idx = 0;
    for (var j = rowStart; j < rowEnd; j++) {
      var y = -(j * yr + p.y0);
      var y2 = y * y;
      for (var i = 0; i < w; i++) {
        var x = i * xr + p.x0;
        var it;
        if (isM) {
          if (bulbCheck && x * x + y2 < 4) {
            var xq = x - 0.25, q = xq * xq + y2;
            if (q * (q + xq) <= 0.25 * y2 || (x + 1) * (x + 1) + y2 <= 0.0625) {
              out[idx++] = inside;
              continue;
            }
          }
          // Mandelbrot: z starts at 0. The original pre-checks |c| >= 2.
          if (!smooth && x * x + y2 >= 4) { it = 1; }
          else { it = escape(0, 0, x, y, n, maxIter, bail); }
        } else {
          it = escape(x, y, p.cr, p.ci, n, maxIter, bail);
        }
        if (it === 0) { out[idx++] = inside; continue; }
        if (!smooth) { out[idx++] = lut[it]; continue; }
        var nu = it + 1 - Math.log(0.5 * Math.log(lastMod2) * invLog2) * invLogN;
        if (nu < 0) { nu = 0; }
        var f = Math.log((nu > low ? nu - low : 0) + 1) * toFine;
        out[idx++] = lut[f >= FINE - 1 ? FINE - 1 : (f + 0.5) | 0];
      }
    }
    return out;
  }

  // The range of smooth counts in a view, from an n x n grid of points (its
  // edges included): [smallest, 95th percentile], or null if no point of the
  // grid escapes. Colour schemes that adapt to the view spread their blend
  // over this range, so every view uses the whole range of colours; the
  // slowest few points, along the set, take the last colour.
  function valueRange(p, n) {
    var k = pointContext(p), values = [];
    for (var j = 0; j < n; j++) {
      var y = -(p.y0 + (p.y1 - p.y0) * j / (n - 1));
      for (var i = 0; i < n; i++) {
        var v = pointValue(k, p.x0 + (p.x1 - p.x0) * i / (n - 1), y);
        if (v >= 0) { values.push(v); }
      }
    }
    if (!values.length) { return null; }
    values.sort(function (a, b) { return a - b; });
    return [values[0], values[Math.floor((values.length - 1) * 0.95)]];
  }

  // When loaded as a worker: answer render requests for row ranges.
  if (scope) {
    scope.onmessage = function (e) {
      var d = e.data;
      var pixels = renderRows(d.params, d.rowStart, d.rowEnd);
      scope.postMessage({ jobId: d.jobId, rowStart: d.rowStart, rowEnd: d.rowEnd, pixels: pixels.buffer },
                        [pixels.buffer]);
    };
  }

  return { renderRows: renderRows, escape: escape, valueRange: valueRange };
}

var FractalKernel = fractalKernel(null);

// Colour schemes, one blend per figure (see palette() above), from the points
// that escape at once (first stop) to those that escape last (last stop),
// and the colour of the inside of the set. Schemes that adapt spread their
// stops over the escape counts found in the view (see valueRange), so the
// evolution towards the set shows at every zoom; their last stop stands out
// from the inside, so the edge of the set stays crisp. Sepia and Classic
// keep the first look of this page ("Classic" is its original look).
var PALETTES = [
  { name: "Ink on paper", adaptive: true,
    mandelbrot: { stops: ["#fbf9f3", "#f1e6c8", "#dcc08a", "#c08a52", "#a2522f", "#7e2622"], inside: "#1c1a22" },
    julia:      { stops: ["#fbf9f3", "#e4ece7", "#b3cfc8", "#76a8b3", "#4a7fa3", "#2f5687"], inside: "#161a2e" } },
  { name: "Sepia",
    mandelbrot: { stops: ["#f3efe4", "#e0c9a6", "#9c6b3c", "#3b2615"], inside: "#3b2615" },
    julia:      { stops: ["#f3efe4", "#e0c9a6", "#9c6b3c", "#3b2615"], inside: "#3b2615" } },
  { name: "Watercolour", adaptive: true,
    mandelbrot: { stops: ["#fbf9f3", "#f7eab2", "#f3c27f", "#e8896e", "#c95a86", "#8a4aa6"], inside: "#1d1b38" },
    julia:      { stops: ["#fbf9f3", "#e0f0dc", "#a6d6bf", "#6bb5b8", "#5a86bd", "#6a55a8"], inside: "#22183a" } },
  { name: "Night", adaptive: true,
    mandelbrot: { stops: ["#0b1626", "#123047", "#1d5c6e", "#3c9a8f", "#f2c14e", "#f08a4b", "#fff3e0"], inside: "#0b1626" },
    julia:      { stops: ["#0b1626", "#1c2a55", "#3b3f8f", "#8f4f9c", "#d9667a", "#f1b16e", "#fdf2d0"], inside: "#0b1626" } },
  { name: "Classic",
    mandelbrot: { stops: ["#000000", "#ff0000", "#ffff00", "#ffffff"], inside: "#ffffc8" },
    julia:      { stops: ["#000000", "#0000ff", "#00ffff", "#ffffff"], inside: "#ffffff" } },
  { name: "Atlas", adaptive: true,
    mandelbrot: { stops: ["#f4f1e6", "#dfe8c8", "#b7d39a", "#e6cf86", "#d49a5a", "#ad5a37"], inside: "#2b1d1a" },
    julia:      { stops: ["#f4f1e6", "#dae9ee", "#a8d0e0", "#6fb0d2", "#4686bf", "#2d5f9e"], inside: "#101c33" } }
];

var hexToRgb = function (hex) {
  var n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// The colours of palette number `index` for one figure, ready for renderRows().
var paletteFor = function (index, type) {
  var p = PALETTES[index] || PALETTES[0];
  return { key: p.name + "/" + type,
           adaptive: !!p.adaptive,
           inside: hexToRgb(p[type].inside),
           stops: p[type].stops.map(hexToRgb) };
};
