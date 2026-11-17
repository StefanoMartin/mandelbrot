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
  // bytes at o. From points that escape at once (stops[0]) to those that
  // escape last (stops[3]).
  function blend(colours, c, bytes, o) {
    var seg = c < 1 ? 0 : (c < 2 ? 1 : 2), u = c - seg;
    var a = colours.stops[seg], b = colours.stops[seg + 1];
    for (var k = 0; k < 3; k++) { bytes[o + k] = a[k] + (b[k] - a[k]) * u; }
    bytes[o + 3] = 255;
  }

  // Packed RGBA colours (little-endian Uint32), cached per scheme.
  // Banded shading: one colour per iteration count 0..maxIter; the count is
  // put on a log scale from 0 to 3; 0 (never escaped) gets `inside`.
  // Smooth shading: FINE colours along the blend, plus `inside` at the end.
  // colours = { key, inside: [r,g,b], stops: four [r,g,b] }
  function palette(colours, maxIter, smooth) {
    var key = colours.key + ":" + (smooth ? "smooth" : maxIter);
    if (palettes[key]) { return palettes[key]; }
    var size = smooth ? FINE + 1 : maxIter + 1;
    var bytes = new Uint8ClampedArray(size * 4);
    for (var i = 0; i < size; i++) {
      if (smooth ? i === FINE : i === 0) {
        bytes[i * 4] = colours.inside[0]; bytes[i * 4 + 1] = colours.inside[1];
        bytes[i * 4 + 2] = colours.inside[2]; bytes[i * 4 + 3] = 255;
      } else {
        var c = smooth ? 3 * i / (FINE - 1) : 3 * Math.log(i + 1) / Math.log(maxIter + 1);
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
    var lut = palette(p.colours, maxIter, smooth);
    var inside = smooth ? lut[FINE] : lut[0];
    var bail = smooth ? BAIL_SMOOTH : fm.bail;
    // The degree d of the formula, for smooth shading: given, the power n,
    // or (for a typed formula) estimated from the last two steps, as
    // log|z_k| / log|z_k-1| tends to d once z is large.
    var logD = fm.degree > 1 ? Math.log(fm.degree) : (fm.degree === 0 && n > 1 ? Math.log(n) : 0);
    var estimate = fm.id === "custom";
    var toFine = (FINE - 1) / Math.log(maxIter + 1);
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
        var f = Math.log(nu + 1) * toFine;
        out[idx++] = lut[f >= FINE - 1 ? FINE - 1 : (f + 0.5) | 0];
      }
    }
    return out;
  }

  // Render rows [rowStart, rowEnd) of a view into packed RGBA pixels.
  // p = { type, width, height, x0, x1, y0, y1, power, maxIter, cr, ci, colours,
  //       smooth, formula }
  function renderRows(p, rowStart, rowEnd) {
    if (p.formula && p.formula.id !== "classic") { return renderFormula(p, rowStart, rowEnd); }
    var w = p.width;
    var out = new Uint32Array(w * (rowEnd - rowStart));
    var n = p.power, maxIter = p.maxIter;
    // Smooth shading needs a power of at least 2 (it divides by log n).
    var smooth = !!p.smooth && n >= 2;
    var lut = palette(p.colours, maxIter, smooth);
    var inside = smooth ? lut[FINE] : lut[0];
    var bail = smooth ? BAIL_SMOOTH : 4;
    // Smooth shading: the "normalised iteration count"
    //   nu = count + 1 - log(log|z| / log 2) / log n,
    // which grows continuously instead of in steps, then the same log scale.
    var invLogN = 1 / Math.log(n), invLog2 = 1 / Math.LN2;
    var toFine = (FINE - 1) / Math.log(maxIter + 1);
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
        var f = Math.log(nu + 1) * toFine;
        out[idx++] = lut[f >= FINE - 1 ? FINE - 1 : (f + 0.5) | 0];
      }
    }
    return out;
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

  return { renderRows: renderRows, escape: escape };
}

var FractalKernel = fractalKernel(null);

// Colour schemes, one blend per figure (see palette() above). "Classic" is the
// original look of this page.
var PALETTES = [
  { name: "Ink on paper",
    mandelbrot: { stops: ["#fbf9f3", "#d6c7a1", "#6e5034", "#1e1e1e"], inside: "#1e1e1e" },
    julia:      { stops: ["#fbf9f3", "#c9d2d8", "#3f5f80", "#1a3150"], inside: "#1a3150" } },
  { name: "Sepia",
    mandelbrot: { stops: ["#f3efe4", "#e0c9a6", "#9c6b3c", "#3b2615"], inside: "#3b2615" },
    julia:      { stops: ["#f3efe4", "#e0c9a6", "#9c6b3c", "#3b2615"], inside: "#3b2615" } },
  { name: "Red and green ink",
    mandelbrot: { stops: ["#fbf9f3", "#e8c4b4", "#a83424", "#4a1810"], inside: "#4a1810" },
    julia:      { stops: ["#fbf9f3", "#c9d8c4", "#2f6b3a", "#163a1e"], inside: "#163a1e" } },
  { name: "Blueprint",
    mandelbrot: { stops: ["#0b3d6e", "#1d5a94", "#7fbfff", "#ffffff"], inside: "#0b3d6e" },
    julia:      { stops: ["#0b3d6e", "#1d5a94", "#7fbfff", "#ffffff"], inside: "#0b3d6e" } },
  { name: "Classic",
    mandelbrot: { stops: ["#000000", "#ff0000", "#ffff00", "#ffffff"], inside: "#ffffc8" },
    julia:      { stops: ["#000000", "#0000ff", "#00ffff", "#ffffff"], inside: "#ffffff" } }
];

var hexToRgb = function (hex) {
  var n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// The colours of palette number `index` for one figure, ready for renderRows().
var paletteFor = function (index, type) {
  var p = PALETTES[index] || PALETTES[0];
  return { key: p.name + "/" + type,
           inside: hexToRgb(p[type].inside),
           stops: p[type].stops.map(hexToRgb) };
};
