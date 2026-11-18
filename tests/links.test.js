// Links (the address describes the figures) and Back / Forward.
"use strict";
var h = require("./helpers");
var test = h.test, assert = h.assert;

var fresh = function () {
  var page = h.load(h.ALL);
  page.mandelbrot.width = page.mandelbrot.height = 400;
  page.julia.width = page.julia.height = 400;
  return page;
};

// Everything a link should bring back.
var state = function (page) {
  var round = function (v) { return +v.toPrecision(8); };
  return JSON.stringify({
    formula: page.settings.formula, custom: page.settings.formula === "custom" ? page.settings.custom : null,
    p: page.settings.formula === "phoenix" ? page.settings.p : null,
    power: page.settings.power, palette: page.settings.palette, smooth: page.settings.smooth,
    lines: page.settings.lines, relief: page.settings.relief, inside: page.settings.inside, show: page.settings.show,
    m: [page.mandelbrot.cx, page.mandelbrot.cy, page.mandelbrot.span].map(round),
    j: [page.julia.cx, page.julia.cy, page.julia.span].map(round),
    c: page.julia.c.map(round)
  });
};

h.group("Links: what the address says comes back");
[
  { name: "the starting view", set: function () {} },
  { name: "a deep zoom", set: function (p) { p.mandelbrot.cx = -0.743643887037; p.mandelbrot.cy = 0.131825904205; p.mandelbrot.span = 3e-9; } },
  { name: "Burning Ship, power 3, Night, ink lines, Fig. 1 only", set: function (p) {
      p.settings.formula = "ship"; p.settings.power = 3; p.settings.palette = 3; p.setShading("lines"); p.settings.show = "mandelbrot"; } },
  { name: "Newton, relief, inside by cycle", set: function (p) {
      p.settings.formula = "newton"; p.setShading("relief"); p.settings.inside = "period"; } },
  { name: "Phoenix with its p", set: function (p) { p.settings.formula = "phoenix"; p.settings.p = [-0.4, 0.15]; } },
  { name: "a typed formula with + / ^ and spaces", set: function (p) {
      p.settings.formula = "custom"; p.settings.custom = { expr: "c * exp(z) + z^2/3", start: "pi/2" }; } },
  { name: "bands, Fig. 2 only, c below the axis", set: function (p) {
      p.setShading("bands"); p.settings.show = "julia"; p.julia.c = [-0.391, -0.587]; } }
].forEach(function (t) {
  test(t.name, function () {
    var a = fresh();
    t.set(a);
    var link = a.encodeState();
    var b = fresh();
    assert.ok(b.applyState(link), "the link describes nothing: " + link);
    assert.strictEqual(state(b), state(a), "link: " + link);
  });
});
test("a link without a formula means z^n + c with both figures", function () {
  var b = fresh();
  b.settings.formula = "tricorn"; b.settings.show = "julia";
  b.applyState("#p=2&m=0,0,4&j=0,0,4&c=0.1,0.2");
  assert.strictEqual(b.settings.formula, "classic");
  assert.strictEqual(b.settings.show, "both");
});
test("opening a link keeps its c", function () {
  var b = fresh();
  b.applyState("#p=2&m=0,0,4&j=0,0,4&c=0.1,0.2");
  assert.strictEqual(b.julia.blocked, true);
});

h.group("History: which changes make a new step for Back");
var steps = function (page) { return page.__history.map(function (e) { return e[0]; }).join(" "); };
test("the first view replaces; a change after a pause adds a step", function () {
  var p = fresh();
  p.saveStateNow();
  p.__clock.now += 300; p.mandelbrot.cx = 0.5; p.saveStateNow();     // soon after the start: still a step
  p.__clock.now += 2000; p.mandelbrot.cx = 0.6; p.saveStateNow();    // after a pause: a step
  assert.strictEqual(steps(p), "replace push push");
});
test("changes in quick succession are one step", function () {
  var p = fresh();
  p.saveStateNow();
  p.__clock.now += 2000; p.mandelbrot.span = 2; p.saveStateNow();
  p.__clock.now += 400; p.mandelbrot.span = 1; p.saveStateNow();
  p.__clock.now += 400; p.mandelbrot.span = 0.5; p.saveStateNow();
  assert.strictEqual(steps(p), "replace push replace replace");
});
test("c following the pointer never adds a step", function () {
  var p = fresh();
  p.saveStateNow();
  p.__clock.now += 5000; p.julia.c = [0.2, 0.3]; p.saveStateNow();
  p.__clock.now += 5000; p.julia.c = [0.25, 0.1]; p.saveStateNow();
  assert.strictEqual(steps(p), "replace replace replace");
});
test("coming back with Back does not add a step", function () {
  var p = fresh();
  p.saveStateNow();
  p.__clock.now += 5000;
  p.location.hash = "#p=2&m=0.3,0.1,1&j=0,0,4&c=0.1,0.2";
  p.onHashChange();
  p.saveStateNow();
  assert.strictEqual(steps(p), "replace replace");
});
