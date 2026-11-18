// Small test framework, and a way to load the page's scripts into Node.
"use strict";
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var assert = require("assert");

var tests = [];
var current = "";

// test("what is checked", function () { ... assert ... });
function test(name, fn) { tests.push({ group: current, name: name, fn: fn }); }
function group(name) { current = name; }

function runAll() {
  var failed = 0, shown = null, t0 = Date.now();
  tests.forEach(function (t) {
    if (t.group !== shown) { console.log("\n" + t.group); shown = t.group; }
    try {
      t.fn();
      console.log("  ✓ " + t.name);
    } catch (e) {
      failed++;
      console.log("  ✗ " + t.name + "\n      " + String(e.message).split("\n").join("\n      "));
    }
  });
  console.log("\n" + (tests.length - failed) + " passed, " + failed + " failed (" + (Date.now() - t0) + " ms)");
  return failed;
}

// ---- Loading the page's scripts ----

var ROOT = path.join(__dirname, "..", "javascript");

// The scripts of the page, in the order of index.html.
var ALL = ["kernel", "renderer", "figures", "formulas", "orbit", "format", "view", "point",
           "panel", "links", "saving", "places", "keys", "main"];

// A drawing context that draws nothing.
var noop = function () {};
var fakeContext = {
  clearRect: noop, fillRect: noop, putImageData: noop, drawImage: noop, beginPath: noop,
  moveTo: noop, lineTo: noop, stroke: noop, fill: noop, arc: noop, setLineDash: noop,
  strokeText: noop, fillText: noop,
  createImageData: function (w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
};

// A stand-in for a page element: enough for the scripts to read and set it.
function fakeElement(id) {
  var classes = {};
  var el = {
    id: id, value: "", checked: false, hidden: false, disabled: false,
    textContent: "", innerHTML: "", title: "", style: {},
    width: 400, height: 400, clientWidth: 402, clientHeight: 402, clientLeft: 1, clientTop: 1,
    selectionStart: 0, selectionEnd: 0,
    classList: {
      add: function (c) { classes[c] = true; },
      remove: function (c) { delete classes[c]; },
      toggle: function (c, on) { if (on === undefined ? !classes[c] : on) { classes[c] = true; } else { delete classes[c]; } },
      contains: function (c) { return !!classes[c]; }
    },
    addEventListener: function () {},
    appendChild: function () {},
    querySelectorAll: function () { return []; },
    closest: function () { return el; },
    focus: function () {},
    setSelectionRange: function () {},
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 402, height: 402 }; },
    getContext: function () { return fakeContext; }
  };
  el.parentNode = el;
  return el;
}

// A Node context with the given scripts loaded, and stand-ins for the
// browser: page elements, address and history, storage, a clock.
// Returns the context; its globals are the page's (mandelbrot, encodeState...).
function load(names) {
  var elements = {};
  var clock = { now: 1e6 };
  var location = { hash: "", href: "file:///index.html" };
  var historyLog = [];
  var storage = {};
  var ctx = {
    // The renderer says when it has no workers (there are none here): not shown.
    console: { log: console.log, error: console.error, warn: noop },
    Math: Math, JSON: JSON, Number: Number, String: String, Object: Object,
    Array: Array, Error: Error, isFinite: isFinite, parseFloat: parseFloat, parseInt: parseInt,
    Float64Array: Float64Array, Uint32Array: Uint32Array, Uint8Array: Uint8Array,
    Uint8ClampedArray: Uint8ClampedArray, Int32Array: Int32Array, Map: Map,
    encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
    performance: { now: function () { return clock.now; } },
    Date: { now: function () { return clock.now; } },
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    navigator: { hardwareConcurrency: 1 },
    localStorage: {
      getItem: function (k) { return k in storage ? storage[k] : null; },
      setItem: function (k, v) { storage[k] = String(v); }
    },
    location: location,
    history: {
      pushState: function (s, t, h) { historyLog.push(["push", h]); location.hash = h; },
      replaceState: function (s, t, h) { historyLog.push(["replace", h]); location.hash = h; }
    },
    document: {
      getElementById: function (id) { return elements[id] || (elements[id] = fakeElement(id)); },
      querySelectorAll: function () { return []; },
      addEventListener: function () {},
      createElement: function (tag) { return fakeElement(tag); },
      activeElement: null
    },
    window: { addEventListener: function () {}, requestAnimationFrame: function () { return 0; } }
  };
  ctx.self = ctx.window;
  vm.createContext(ctx);
  // No workers here: the renderer draws on the "main thread" (not used by the tests).
  names.forEach(function (name) {
    var file = path.join(ROOT, name + ".js");
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });
  });
  ctx.__clock = clock;
  ctx.__history = historyLog;
  ctx.__elements = elements;
  return ctx;
}

// Bytes that differ between two pixel arrays (0: identical).
function differingBytes(a, b) {
  var x = new Uint8Array(a.buffer || a), y = new Uint8Array(b.buffer || b), n = 0;
  if (x.length !== y.length) { return Infinity; }
  for (var k = 0; k < x.length; k++) { if (x[k] !== y[k]) { n++; } }
  return n;
}

module.exports = { test: test, group: group, runAll: runAll, load: load, ALL: ALL,
                   assert: assert, differingBytes: differingBytes };
