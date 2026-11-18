// The drawing: exact pictures, and every formula and shading drawn without fault.
"use strict";
var h = require("./helpers");
var reference = require("./reference");
var test = h.test, assert = h.assert;

var page = h.load(["kernel", "renderer", "figures", "formulas", "format"]);
var K = page.FractalKernel;
var CLASSIC = 4;   // index of "Classic" in PALETTES

var views = [
  { name: "the whole Mandelbrot set", type: "mandelbrot", x0: -2, x1: 2, y0: -2, y1: 2, power: 2, maxIter: 200, cr: 0, ci: 0 },
  { name: "Seahorse Valley", type: "mandelbrot", x0: -0.76, x1: -0.73, y0: -0.13, y1: -0.1, power: 2, maxIter: 600, cr: 0, ci: 0 },
  { name: "the Mandelbrot set of z^3 + c", type: "mandelbrot", x0: -2, x1: 2, y0: -2, y1: 2, power: 3, maxIter: 200, cr: 0, ci: 0 },
  { name: "Douady's rabbit", type: "julia", x0: -2, x1: 2, y0: -2, y1: 2, power: 2, maxIter: 300, cr: -0.123, ci: 0.745 },
  { name: "a Julia set of z^3 + c", type: "julia", x0: -2, x1: 2, y0: -2, y1: 2, power: 3, maxIter: 200, cr: 0.3, ci: 0.5 }
];

var params = function (v, extra) {
  var p = { width: 120, height: 120, colours: page.paletteFor(CLASSIC, v.type), smooth: false };
  Object.keys(v).forEach(function (k) { if (k !== "name") { p[k] = v[k]; } });
  Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; });
  return p;
};

h.group("Kernel: Classic colours with Bands draw exactly what the original page drew");
views.forEach(function (v) {
  test(v.name, function () {
    var p = params(v);
    assert.strictEqual(h.differingBytes(K.renderRows(p, 0, p.height), reference(p)), 0);
  });
});

h.group("Kernel: a typed formula draws like the built-in one");
views.forEach(function (v) {
  test("z^n + c, typed, on " + v.name, function () {
    page.settings.formula = "custom";
    page.settings.custom = { expr: "z^n + c", start: "0" };
    var typed = page.currentFormula().spec;
    page.settings.formula = "classic";
    var p = params(v);
    var fast = K.renderRows(p, 0, p.height);
    p.formula = typed;
    assert.strictEqual(h.differingBytes(K.renderRows(p, 0, p.height), fast), 0);
  });
});

h.group("Kernel: every formula, in every shading, draws opaque pixels");
page.FORMULAS.forEach(function (def) {
  test(def.name, function () {
    page.settings.formula = def.id;
    page.settings.custom = { expr: "c*sin(z)", start: "auto" };
    var formula = page.currentFormula();
    ["mandelbrot", "julia"].forEach(function (type) {
      [{ smooth: false }, { smooth: true }, { smooth: true, lines: true, lineScale: 1 }].forEach(function (shading) {
        var p = params({ type: type, x0: -2, x1: 2, y0: -2, y1: 2, power: 2, maxIter: 60, cr: -0.4, ci: 0.6 }, shading);
        p.formula = formula.spec;
        p.colours = page.paletteFor(0, type);
        var range = K.valueRange(p, 8);
        if (range) { p.low = Math.floor(range[0]); p.high = Math.max(p.low + 2, Math.ceil(range[1])); }
        var out = new Uint8Array(K.renderRows(p, 0, 40).buffer);
        for (var k = 3; k < out.length; k += 4) {
          if (out[k] !== 255) { throw new Error(type + " " + JSON.stringify(shading) + ": a pixel is not opaque"); }
        }
      });
    });
    page.settings.formula = "classic";
  });
});
