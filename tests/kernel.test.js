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
      [{ smooth: false }, { smooth: true }, { smooth: true, lines: true, lineScale: 1 },
       { smooth: true, relief: true, lineScale: 1 }, { smooth: true, periods: true }, { smooth: false, periods: true, relief: true, lineScale: 1 }].forEach(function (shading) {
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

// The colour of the one point x + iy, drawn as a 1 x 1 picture.
var pixel = function (type, x, y, extra, c) {
  var p = params({ type: type, x0: x, x1: x, y0: -y, y1: -y, power: 2, maxIter: 400,
                   cr: c ? c[0] : 0, ci: c ? c[1] : 0 }, extra);
  p.width = p.height = 1;
  var out = new Uint8Array(K.renderRows(p, 0, 1).buffer);
  return [out[0], out[1], out[2]].join(",");
};

h.group("Kernel: Inside by cycle");
[["the built-in z^2 + c", null], ["z^2 + c typed", { expr: "z^2 + c", start: "0" }]].forEach(function (t) {
  test(t[0] + ": the cardioid, the period-2 bulb and the rabbit's bulb differ", function () {
    var extra = { periods: true };
    if (t[1]) {
      page.settings.formula = "custom"; page.settings.custom = t[1];
      extra.formula = page.currentFormula().spec;
      page.settings.formula = "classic";
    }
    var one = pixel("mandelbrot", -0.1, 0, extra), two = pixel("mandelbrot", -1, 0, extra);
    var three = pixel("mandelbrot", -0.123, 0.745, extra);
    var plain = pixel("mandelbrot", -0.1, 0, t[1] ? { formula: extra.formula } : {});
    assert.notStrictEqual(one, two); assert.notStrictEqual(two, three); assert.notStrictEqual(one, three);
    assert.notStrictEqual(two, plain);
    // the same cycle gives the same colour
    assert.strictEqual(pixel("mandelbrot", -1.1, 0.05, extra), two);
  });
});
test("the outside is not changed by it", function () {
  assert.strictEqual(pixel("mandelbrot", 0.5, 0.5, { periods: true }), pixel("mandelbrot", 0.5, 0.5, {}));
});

h.group("Kernel: Newton's method");
test("for c = 0 (roots 1, 0, -1) points go to the nearest root, each with its colour", function () {
  page.settings.formula = "newton";
  var extra = { formula: page.currentFormula().spec };
  page.settings.formula = "classic";
  var a = pixel("julia", 2, 0, extra), b = pixel("julia", 0.1, 0.05, extra), c = pixel("julia", -2, 0.1, extra);
  assert.notStrictEqual(a, b); assert.notStrictEqual(b, c); assert.notStrictEqual(a, c);
  // the same root, a little lighter or darker for the steps it took
  var near = function (u, v) { u = u.split(",").map(Number); v = v.split(",").map(Number);
    return Math.abs(u[0] - v[0]) + Math.abs(u[1] - v[1]) + Math.abs(u[2] - v[2]) < 40; };
  assert.ok(near(pixel("julia", 3, -0.2, extra), a));
  assert.ok(!near(a, b) && !near(b, c) && !near(a, c));
});
test("the orbit names the root it reaches", function () {
  var all = h.load(h.ALL);
  all.settings.formula = "newton";
  var r = all.followOrbit([2, 0], [0, 0], 2, 200);
  assert.ok(r.escaped > 0);
  assert.ok(/root 1\b/.test(all.orbitVerdict(r, 100, [0, 0])), all.orbitVerdict(r, 100, [0, 0]));
  r = all.followOrbit([-2, 0], [0, 0], 2, 200);
  assert.ok(/root \u2212?-?1/.test(all.orbitVerdict(r, 100, [0, 0])) || /root -1/.test(all.orbitVerdict(r, 100, [0, 0])),
            all.orbitVerdict(r, 100, [0, 0]));
});
