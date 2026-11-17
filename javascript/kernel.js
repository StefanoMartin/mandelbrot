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
// The produced image is pixel-identical to the original algorithm.
function fractalKernel(scope) {
  "use strict";

  var palettes = {};

  // Packed RGBA colour (as a little-endian Uint32) for every iteration count
  // 0..maxIter, using the original colour_point / colour_point2 formulas.
  function palette(scheme, maxIter) {
    var key = scheme + ":" + maxIter;
    if (palettes[key]) { return palettes[key]; }
    var bytes = new Uint8ClampedArray((maxIter + 1) * 4);
    for (var i = 0; i <= maxIter; i++) {
      var o = i * 4, r, g, b;
      if (i === 0) {
        r = 255; g = 255; b = scheme === "mandelbrot" ? 200 : 255;
      } else {
        var c = 3 * Math.log(i + 1) / Math.log(maxIter + 1);
        var lo, mid, hi;
        if (c < 1)      { lo = 255 * c; mid = 0;               hi = 0; }
        else if (c < 2) { lo = 255;     mid = 255 * (c - 1);   hi = 0; }
        else            { lo = 255;     mid = 255;             hi = 255 * (c - 2); }
        if (scheme === "mandelbrot") { r = lo; g = mid; b = hi; }  // black-red-yellow-white
        else                         { r = hi; g = mid; b = lo; }  // black-blue-cyan-white
      }
      bytes[o] = r; bytes[o + 1] = g; bytes[o + 2] = b; bytes[o + 3] = 255;
    }
    var lut = new Uint32Array(bytes.buffer);
    palettes[key] = lut;
    return lut;
  }

  // Escape count for one point: 0 = never escaped (inside), otherwise 1..maxIter.
  // (zr, zi) is the starting z, (cr, ci) the constant.
  function escape(zr, zi, cr, ci, n, maxIter) {
    if (zr * zr + zi * zi >= 4) { return 1; }
    var pr = zr, pi = zi;          // periodicity reference point
    var check = 8, sinceCheck = 0; // Brent-style doubling window
    var ii, t;
    if (n === 2) {
      var zr2 = zr * zr, zi2 = zi * zi;
      for (ii = 0; ii < maxIter; ii++) {
        zi = 2 * zr * zi + ci;
        zr = zr2 - zi2 + cr;
        zr2 = zr * zr; zi2 = zi * zi;
        if (zr2 + zi2 >= 4) { return ii + 1; }
        if (zr === pr && zi === pi) { return 0; }
        if (++sinceCheck === check) { sinceCheck = 0; check *= 2; pr = zr; pi = zi; }
      }
    } else {
      for (ii = 0; ii < maxIter; ii++) {
        var ar = 1, ai = 0;
        for (var k = 0; k < n; k++) { t = ar * zr - ai * zi; ai = ai * zr + ar * zi; ar = t; }
        zr = ar + cr; zi = ai + ci;
        if (zr * zr + zi * zi >= 4) { return ii + 1; }
        if (zr === pr && zi === pi) { return 0; }
        if (++sinceCheck === check) { sinceCheck = 0; check *= 2; pr = zr; pi = zi; }
      }
    }
    return 0;
  }

  // Render rows [rowStart, rowEnd) of a view into packed RGBA pixels.
  // p = { type, width, height, x0, x1, y0, y1, power, maxIter, cr, ci }
  function renderRows(p, rowStart, rowEnd) {
    var w = p.width;
    var out = new Uint32Array(w * (rowEnd - rowStart));
    var lut = palette(p.type, p.maxIter);
    var xr = (p.x1 - p.x0) / p.width;
    var yr = (p.y1 - p.y0) / p.height;
    var n = p.power, maxIter = p.maxIter;
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
              out[idx++] = lut[0];
              continue;
            }
          }
          // Mandelbrot: z starts at 0. The original pre-checks |c| >= 2.
          it = (x * x + y2 >= 4) ? 1 : escape(0, 0, x, y, n, maxIter);
        } else {
          it = escape(x, y, p.cr, p.ci, n, maxIter);
        }
        out[idx++] = lut[it];
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
