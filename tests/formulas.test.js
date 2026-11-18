// Typed formulas: what they compute, what they refuse, where z starts.
"use strict";
var h = require("./helpers");
var test = h.test, assert = h.assert;

var page = h.load(["kernel", "renderer", "figures", "formulas", "format"]);
var P = page.FormulaParser;

// One step of a typed formula at z, c (power n).
var step = function (expr, z, c, n) {
  var s = P.step(expr).step;
  return new Function("zr", "zi", "yr", "yi", "cr", "ci", "n", "var nr = 0, ni = 0;\n" + s + "\nreturn [nr, ni];")(
    z[0], z[1], 0, 0, c[0], c[1], n || 2);
};
var mul = function (a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; };
var near = function (a, b) {
  assert.ok(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 1e-12, JSON.stringify(a) + " should be " + JSON.stringify(b));
};
var Z = [0.3, -0.7], C = [0.11, 0.42], Z2 = mul(Z, Z);

h.group("Typed formulas: the maths");
[
  ["z^2 + c", [Z2[0] + C[0], Z2[1] + C[1]]],
  ["z^n + c", [Z2[0] + C[0], Z2[1] + C[1]]],
  ["2z^2", [2 * Z2[0], 2 * Z2[1]]],
  ["−z² + c", [-Z2[0] + C[0], -Z2[1] + C[1]]],
  ["c*sin(z)", mul(C, [Math.sin(Z[0]) * Math.cosh(Z[1]), Math.cos(Z[0]) * Math.sinh(Z[1])])],
  ["exp(log(z))", Z],
  ["sqrt(z)^2", Z],
  ["z^0.5 * z^0.5", Z],
  ["tan(z)*cos(z) - sin(z)", [0, 0]],
  ["conj(z) + 2pi - 2*pi", [Z[0], -Z[1]]],
  ["csin(z)", mul(C, [Math.sin(Z[0]) * Math.cosh(Z[1]), Math.cos(Z[0]) * Math.sinh(Z[1])])],
  ["zc", mul(Z, C)]
].forEach(function (t) {
  test(t[0], function () { near(step(t[0], Z, C), t[1]); });
});

h.group("Typed formulas: mistakes are explained, and only maths gets through");
[
  ["", "Write a formula."],
  ["z^2 + ", "The formula ends too soon."],
  ["sin z", "Write sin( … ) with brackets."],
  ["(z + c", "A bracket is not closed."],
  ["z^2 + x", "“x” is not known here"],
  ["alert(1)", "is not known here"],
  ["z; while(1){}", "“;” is not understood."],
  ["constructor", "is not known here"],
  ["z[\"x\"]", "“[” is not understood."]
].forEach(function (t) {
  test(JSON.stringify(t[0]), function () {
    assert.throws(function () { P.step(t[0]); }, function (e) { return e.message.indexOf(t[1]) >= 0; });
  });
});

h.group("Typed formulas: where z starts with Start z = auto");
var startOf = function (expr) {
  page.settings.formula = "custom";
  page.settings.custom = { expr: expr, start: "auto" };
  var f = page.currentFormula();
  page.settings.formula = "classic";
  return f;
};
[
  ["sin(z) + c", [Math.PI / 2, 0], "π/2"],
  ["c*sin(z)", [Math.PI / 2, 0], "π/2"],
  ["sinh(z) + c", [0, Math.PI / 2], "<i>i</i>π/2"],
  ["c*z*(1 - z)", [0.5, 0], "1/2"],
  ["z^3 - 3*z + c", [1, 0], "1"],
  ["z^3 + c", [0, 0], "0"],
  ["c*exp(z)", [0, 0], "0"],
  ["z^-2 + c", [1, 0], "1"]
].forEach(function (t) {
  test(t[0] + " starts at " + t[2].replace(/<\/?i>/g, ""), function () {
    var f = startOf(t[0]);
    near(f.start, t[1]);
    assert.strictEqual(f.start_text, t[2]);
  });
});
test("z^2 + c + 0.2/z starts at the cube root of 0.1", function () {
  var f = startOf("z^2 + c + 0.2/z");
  assert.ok(Math.abs(f.start[0] - Math.cbrt(0.1)) < 1e-4 && Math.abs(f.start[1]) < 1e-9);
});
test("formulas with exp, sin, cos... escape only when z is huge, without smooth shading", function () {
  var f = startOf("cos(z) + c");
  assert.ok(f.spec.loop.indexOf("mod >= 1e20") >= 0);
  assert.strictEqual(f.spec.smooth, false);
  assert.ok(startOf("z^3 + c").spec.loop.indexOf("mod >= bail") >= 0);
});
