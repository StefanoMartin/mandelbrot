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
  // 0..maxIter. colours = { key, inside: [r,g,b], stops: four [r,g,b] }:
  // 0 iterations (never escaped) gets `inside`; otherwise the count is put on
  // a log scale from 0 to 3 and blended along the four stops, from points
  // that escape at once (stops[0]) to those that escape last (stops[3]).
  function palette(colours, maxIter) {
    var key = colours.key + ":" + maxIter;
    if (palettes[key]) { return palettes[key]; }
    var bytes = new Uint8ClampedArray((maxIter + 1) * 4);
    var stops = colours.stops;
    for (var i = 0; i <= maxIter; i++) {
      var o = i * 4;
      if (i === 0) {
        bytes[o] = colours.inside[0]; bytes[o + 1] = colours.inside[1]; bytes[o + 2] = colours.inside[2];
      } else {
        var c = 3 * Math.log(i + 1) / Math.log(maxIter + 1);
        var seg = c < 1 ? 0 : (c < 2 ? 1 : 2), u = c - seg;
        var a = stops[seg], b = stops[seg + 1];
        for (var k = 0; k < 3; k++) { bytes[o + k] = a[k] + (b[k] - a[k]) * u; }
      }
      bytes[o + 3] = 255;
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
  // p = { type, width, height, x0, x1, y0, y1, power, maxIter, cr, ci, colours }
  function renderRows(p, rowStart, rowEnd) {
    var w = p.width;
    var out = new Uint32Array(w * (rowEnd - rowStart));
    var lut = palette(p.colours, p.maxIter);
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
