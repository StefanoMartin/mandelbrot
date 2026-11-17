// The orbit of a point: the path z takes, step by step, under z -> z^n + c.
//
// On Fig. 1 the orbit starts at z = 0 and c is the point under the pointer:
// the point belongs to the Mandelbrot set when this orbit never escapes.
// On Fig. 2 c is the Julia set's own, and the orbit starts at the point
// under the pointer: it belongs to the Julia set's filled-in shape when its
// orbit never escapes.

// Most steps drawn (the figure's own iteration limit, up to this).
var ORBIT_DRAWN_MAX = 1000;
// Steps followed to tell what happens after the drawn ones.
var ORBIT_FOLLOWED = 5000;
// The first steps get their number written beside them.
var ORBIT_NUMBERED = 8;
// Longest cycle looked for at the end of a bounded orbit.
var ORBIT_PERIOD_MAX = 64;

var ORBIT_INK = "#8a2b1a";
var ORBIT_HALO = "rgba(251, 249, 243, 0.85)";

var orbit = {
  on: false,
  f: null,        // the figure the orbit is shown on, or null
  start: null     // the point under the pointer when it was chosen
};

// Follow z from z0 under z^n + c for at most `steps` steps.
// Returns the points (z0 first) and the step at which |z| >= 2, or 0.
var followOrbit = function(z0, c, n, steps){
  var zr = z0[0], zi = z0[1];
  var points = [[zr, zi]];
  for (var k = 1; k <= steps; k++){
    var ar = 1, ai = 0, t;
    for (var m = 0; m < n; m++) { t = ar * zr - ai * zi; ai = ai * zr + ar * zi; ar = t; }
    zr = ar + c[0];
    zi = ai + c[1];
    points.push([zr, zi]);
    if (zr * zr + zi * zi >= 4) { return { points: points, escaped: k }; }
  }
  return { points: points, escaped: 0 };
};

// The shortest cycle the end of a bounded orbit has settled into, or 0.
var orbitPeriod = function(points){
  var last = points[points.length - 1];
  var tolerance = 1e-9 * Math.max(1, Math.hypot(last[0], last[1]));
  for (var p = 1; p <= ORBIT_PERIOD_MAX && p < points.length; p++){
    var q = points[points.length - 1 - p];
    if (Math.hypot(last[0] - q[0], last[1] - q[1]) < tolerance) { return p; }
  }
  return 0;
};

// What happens to the orbit, in words (HTML).
var orbitVerdict = function(result, limit){
  var e = result.escaped;
  if (e && e <= limit){
    return "escapes at step " + e + ": outside the set.";
  }
  if (e){
    return "escapes only at step " + e.toLocaleString("en-US") + ", after the " + limit +
      " iterations of the figure: just outside the set.";
  }
  var p = orbitPeriod(result.points);
  if (p === 1) { return "settles on a fixed point: inside the set."; }
  if (p > 1) { return "settles into a cycle of " + p + " points: inside the set."; }
  return "stays bounded for " + ORBIT_FOLLOWED.toLocaleString("en-US") + " steps: inside the set, or very near it.";
};

// The overlay canvas of a figure, where its orbit is drawn.
var orbitCanvas = function(f){
  return byId(f.type + "_orbit");
};

var clearOrbitCanvas = function(f){
  var canvas = orbitCanvas(f);
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
};

// Draw the current orbit on its figure, and describe it in a note in the
// corner of the figure.
var drawOrbit = function(){
  [mandelbrot, julia].forEach(function(f){
    if (f !== orbit.f || !orbit.on){
      clearOrbitCanvas(f);
      byId(f.type + "_note").innerHTML = "";
    }
  });
  var f = orbit.f;
  if (!orbit.on || !f) { return; }
  var text = byId(f.type + "_note");

  var z0 = f === mandelbrot ? [0, 0] : orbit.start;
  var c = f === mandelbrot ? orbit.start : julia.c;
  var limit = Math.min(f.iteration, ORBIT_DRAWN_MAX);
  var result = followOrbit(z0, c, settings.power, Math.max(limit, ORBIT_FOLLOWED));
  var shown = result.points.slice(0, limit + 1);

  text.innerHTML = (f === mandelbrot ? "From <i>z</i> = 0 with <i>c</i> = " + formatComplex(c)
                                     : "From <i>z</i> = " + formatComplex(z0)) +
    ", the orbit " + orbitVerdict(result, limit);

  var canvas = orbitCanvas(f);
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var dpr = canvas.width / Math.max(1, canvas.clientWidth);
  var r = region(f);
  // Plane -> canvas pixels; far-away points are pulled in so the line still
  // leaves the figure in the right direction.
  var LIMIT = 1e5;
  var X = function(p){ return Math.max(-LIMIT, Math.min(LIMIT, (p[0] - r.x0) / r.step)); };
  var Y = function(p){ return Math.max(-LIMIT, Math.min(LIMIT, (r.top - p[1]) / r.step)); };

  var path = function(){
    ctx.beginPath();
    shown.forEach(function(p, k){ if (k) { ctx.lineTo(X(p), Y(p)); } else { ctx.moveTo(X(p), Y(p)); } });
  };
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // A pale line under the ink, so the orbit shows on any colours.
  ctx.strokeStyle = ORBIT_HALO;
  ctx.lineWidth = 3.5 * dpr;
  path();
  ctx.stroke();
  ctx.strokeStyle = ORBIT_INK;
  ctx.lineWidth = 1.2 * dpr;
  path();
  ctx.stroke();

  // A dot at every step, an open ring at the start.
  shown.forEach(function(p, k){
    ctx.beginPath();
    ctx.arc(X(p), Y(p), (k ? 2.2 : 4.5) * dpr, 0, 2 * Math.PI);
    ctx.fillStyle = ORBIT_HALO;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X(p), Y(p), (k ? 1.6 : 3.5) * dpr, 0, 2 * Math.PI);
    if (k) { ctx.fillStyle = ORBIT_INK; ctx.fill(); }
    else { ctx.strokeStyle = ORBIT_INK; ctx.lineWidth = 1.4 * dpr; ctx.stroke(); }
  });

  // The number of the first steps.
  ctx.font = "italic " + (12 * dpr) + "px Georgia, 'Times New Roman', serif";
  ctx.textBaseline = "bottom";
  shown.slice(0, ORBIT_NUMBERED).forEach(function(p, k){
    var x = X(p) + 5 * dpr, y = Y(p) - 3 * dpr;
    ctx.strokeStyle = ORBIT_HALO;
    ctx.lineWidth = 3 * dpr;
    ctx.strokeText(String(k), x, y);
    ctx.fillStyle = ORBIT_INK;
    ctx.fillText(String(k), x, y);
  });
};

// Show the orbit of the point under the pointer (mouse) or tapped (touch).
var orbitAt = function(f, e){
  if (!orbit.on) { return; }
  orbit.f = f;
  orbit.start = canvasPoint(byId(f.type), f, e);
  drawOrbit();
};

var hideOrbit = function(){
  orbit.f = null;
  drawOrbit();
};

var setOrbitOn = function(on){
  orbit.on = on;
  byId("orbit").checked = on;
  byId("orbit_help").hidden = !on;
  if (!on) { hideOrbit(); }
};

// Size the overlay like its figure's canvas (inside the border).
var sizeOrbitCanvas = function(f, w, h){
  var canvas = orbitCanvas(f);
  canvas.style.width = (w - 2) + "px";
  canvas.style.height = (h - 2) + "px";
  if (canvas.width !== f.width || canvas.height !== f.height){
    canvas.width = f.width;
    canvas.height = f.height;
  }
};
