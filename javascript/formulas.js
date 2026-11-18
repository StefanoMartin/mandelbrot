// Formulas: the rule z -> f(z, c) that both figures iterate, and the point
// where z starts on Fig. 1.
//
// Fig. 1 colours each c by what happens to the orbit of the starting point;
// Fig. 2 keeps c and starts z at every pixel. For the two figures to belong
// together, z should start at a critical point of f (where its derivative
// is 0): 0 for z^n + c, 1/2 for c z (1 - z), pi/2 for c sin z.
//
// Every formula is written as a few lines of JavaScript that compute the
// next z (nr, ni) from z (zr, zi), the previous z (yr, yi), c (cr, ci) and
// the power n. loopSource() wraps them in a complete escape-time loop, which
// the workers compile once and reuse (kernel.js). Typed formulas are parsed
// here and turned into the same kind of lines: only maths can get through.

// z^n of (XR, XI) into (ar, ai), with n the power setting.
var powN = function(xr, xi){
  return "var ar = 1, ai = 0, t, k;\n" +
    "for (k = 0; k < n; k++) { t = ar * " + xr + " - ai * " + xi + "; ai = ai * " + xr +
    " + ar * " + xi + "; ar = t; }\n";
};

var Z = "<i>z</i>", C = "<i>c</i>";

// ---- Newton's method ----
//
// For p(z) = z^3 + (c - 1) z - c, Newton's method is z -> z - p(z) / p'(z).
// The roots of p are 1 and the two roots of z^2 + z + c. Fig. 2 colours each
// z by the root it reaches; Fig. 1 colours each c by the root reached from
// z = 0, the one critical point of the method that is not a root (p'' = 6z).
// Where that point reaches no root, the method settles into a cycle instead:
// small copies of the Mandelbrot set appear there.
var NEWTON_STEP = [
  "var z2r = zr * zr - zi * zi, z2i = 2 * zr * zi;",
  "var z3r = z2r * zr - z2i * zi, z3i = z2r * zi + z2i * zr;",
  "var vr = z3r + (cr - 1) * zr - ci * zi - cr, vi = z3i + (cr - 1) * zi + ci * zr - ci;",
  "var er = 3 * z2r + cr - 1, ei = 3 * z2i + ci, ee = er * er + ei * ei;",
  "nr = zr - (vr * er + vi * ei) / ee; ni = zi - (vi * er - vr * ei) / ee;"
].join("\n");

var NEWTON_ROOTS = {
  // 1, and (-1 +- sqrt(1 - 4c)) / 2.
  setup: [
    "var s1 = 1 - 4 * cr, s2 = -4 * ci, sm = Math.sqrt(s1 * s1 + s2 * s2);",
    "var sqr = Math.sqrt(Math.max(0, (sm + s1) / 2)), sqi = (s2 < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (sm - s1) / 2));",
    "var r2r = (-1 + sqr) / 2, r2i = sqi / 2, r3r = (-1 - sqr) / 2, r3i = -sqi / 2;"
  ].join("\n"),
  test: [
    "hit = -1;",
    "dr = zr - 1; di = zi; hd = dr * dr + di * di;",
    "if (hd < 1e-12) { hit = 0; } else {",
    "  dr = zr - r2r; di = zi - r2i; hd = dr * dr + di * di;",
    "  if (hd < 1e-12) { hit = 1; } else {",
    "    dr = zr - r3r; di = zi - r3i; hd = dr * dr + di * di;",
    "    if (hd < 1e-12) { hit = 2; }",
    "  }",
    "}"
  ].join("\n")
};

// id: name in links; name: in the list; short: in the legend of Fig. 1;
// title: caption of Fig. 1; html(n): the formula, as shown in the panel;
// step: the code; escape: when z has escaped (default |z|^2 >= bail);
// start, start_html: where z starts on Fig. 1; power: uses the power n;
// degree: for smooth shading (0 = n; null = no smooth shading);
// bail: |z|^2 at which banded shading stops; home, julia_home: [cx, cy, span]
// of Fig. 1 and Fig. 2 to start with (default 0, 0, 4); julia_c: a good c.
var FORMULAS = [
  { id: "classic", name: "Mandelbrot: zⁿ + c", short: "Mandelbrot set", title: "The Mandelbrot set",
    html: function(n){ return Z + "<sup>" + n + "</sup> + " + C; },
    step: "var xr = zr, xi = zi;\n" + powN("xr", "xi") + "nr = ar + cr; ni = ai + ci;",
    power: true, degree: 0 },
  { id: "tricorn", name: "Tricorn: z̄ⁿ + c", short: "Tricorn", title: "The Tricorn",
    html: function(n){ return "<span class=\"bar\">" + Z + "</span><sup>" + n + "</sup> + " + C; },
    step: "var xr = zr, xi = -zi;\n" + powN("xr", "xi") + "nr = ar + cr; ni = ai + ci;",
    power: true, degree: 0, julia_c: [0.25, 0.4] },
  // Drawn with the ship upright: (|x| - i|y|)^n, the mirror image of the
  // usual (|x| + i|y|)^n, which is shown upside down with the imaginary axis up.
  { id: "ship", name: "Burning Ship", short: "Burning Ship", title: "The Burning Ship",
    html: function(n){ return "(|Re " + Z + "| − <i>i</i> |Im " + Z + "|)<sup>" + n + "</sup> + " + C; },
    step: "var xr = Math.abs(zr), xi = -Math.abs(zi);\n" + powN("xr", "xi") + "nr = ar + cr; ni = ai + ci;",
    power: true, degree: 0, home: [-0.5, 0.45, 3.4], julia_c: [-1, 0.25] },
  { id: "celtic", name: "Celtic", short: "Celtic set", title: "The Celtic set",
    html: function(){ return "|Re " + Z + "<sup>2</sup>| + <i>i</i> Im " + Z + "<sup>2</sup> + " + C; },
    step: "nr = Math.abs(zr * zr - zi * zi) + cr; ni = 2 * zr * zi + ci;",
    degree: 2, home: [-0.4, 0, 3.6], julia_c: [-0.8, 0.15] },
  { id: "buffalo", name: "Buffalo", short: "Buffalo set", title: "The Buffalo set",
    html: function(){ return "|Re " + Z + "<sup>2</sup>| − <i>i</i> |Im " + Z + "<sup>2</sup>| + " + C; },
    step: "nr = Math.abs(zr * zr - zi * zi) + cr; ni = -2 * Math.abs(zr * zi) + ci;",
    degree: 2, home: [-0.4, 0.3, 3.6], julia_c: [0.2, 0.55] },
  { id: "logistic", name: "Logistic: c z (1 − z)", short: "Logistic set", title: "The logistic set",
    html: function(){ return C + " " + Z + " (1 − " + Z + ")"; },
    step: "var wr = zr - (zr * zr - zi * zi), wi = zi - 2 * zr * zi;\n" +
          "nr = cr * wr - ci * wi; ni = cr * wi + ci * wr;",
    start: [0.5, 0], start_html: "½", degree: 2, bail: 16, home: [1, 0, 6.4], julia_c: [-0.552, 0.96],
    julia_home: [0.5, 0, 2.6] },
  { id: "phoenix", name: "Phoenix", short: "Phoenix set", title: "The Phoenix set",
    html: function(){ return Z + "<sup>2</sup> + " + C + " + <i>p</i> · " + Z + "<sub>previous</sub>"; },
    step: null,   // built from the setting p, see phoenixStep()
    degree: 2, home: [0, 0, 3.6], julia_c: [0.5667, 0] },
  { id: "exp", name: "Exponential: c eᶻ", short: "Exponential set", title: "The exponential set",
    html: function(){ return C + " <i>e</i><sup><i>z</i></sup>"; },
    step: "var e = Math.exp(zr), er = e * Math.cos(zi), ei = e * Math.sin(zi);\n" +
          "nr = cr * er - ci * ei; ni = cr * ei + ci * er;",
    escape: "zr > 50", degree: null, home: [-1, 0, 7], julia_c: [0.3, 0],
    julia_home: [1.5, 0, 10] },
  { id: "sine", name: "Sine: c sin z", short: "Sine set", title: "The sine set",
    html: function(){ return C + " sin " + Z; },
    step: "var sr = Math.sin(zr) * Math.cosh(zi), si = Math.cos(zr) * Math.sinh(zi);\n" +
          "nr = cr * sr - ci * si; ni = cr * si + ci * sr;",
    escape: "zi > 50 || zi < -50", start: [Math.PI / 2, 0], start_html: "π/2",
    degree: null, home: [0, 0, 8], julia_c: [1, 0.3] },
  { id: "newton", name: "Newton: z\u00b3 + (c \u2212 1) z \u2212 c", short: "Newton set",
    title: "Newton\u2019s method for z\u00b3 + (c \u2212 1) z \u2212 c",
    html: function(){ return Z + " \u2212 <i>p</i>(" + Z + ") / <i>p</i>\u2032(" + Z + "), <i>p</i> = " + Z + "<sup>3</sup> + (" + C + " \u2212 1) " + Z + " \u2212 " + C; },
    step: NEWTON_STEP, roots: NEWTON_ROOTS, mode: "roots",
    degree: 2, home: [0, 0, 3.2], julia_c: [0.29, 0.43] },
  { id: "custom", name: "Your own formula…", short: "Your set", title: "The set of your formula",
    html: null, step: null, degree: 0 }
];

var formulaById = function(id){
  for (var k = 0; k < FORMULAS.length; k++) { if (FORMULAS[k].id === id) { return FORMULAS[k]; } }
  return FORMULAS[0];
};

var phoenixStep = function(p){
  var pr = "(" + p[0] + ")", pi = "(" + p[1] + ")";
  return "nr = zr * zr - zi * zi + cr + " + pr + " * yr - " + pi + " * yi;\n" +
         "ni = 2 * zr * zi + ci + " + pr + " * yi + " + pi + " * yr;";
};

// The complete loop: returns 0 if z never escapes within maxIter steps,
// otherwise the step at which it did, with |z|^2 then and one step before in
// m[0] and m[1]. An orbit that comes back to within 1e-12 of an earlier state
// (z and the previous z) has settled into a cycle and is stopped early; the
// length of the cycle goes in m[2] (0: not known). With wp (Inside: By cycle),
// an orbit still going after maxIter steps is followed further to find it.
// roots: for formulas that look for roots (Newton), code that works out the
// roots for c (setup) and tells whether z has reached one (test: hit = its
// number, hd = |z - root|^2); "escaping" is then reaching a root, which goes
// in m[3].
var loopSource = function(step, escape, roots){
  var esc = escape || "mod >= bail";
  var test = roots
    ? roots.test + "\nif (hit >= 0) { m[0] = hd; m[1] = 0; m[3] = hit; return it + 1; }" +
      "\nif (mod !== mod || mod === Infinity) { return 0; }"
    : "if (mod !== mod || mod === Infinity || " + esc + ") { m[0] = mod; m[1] = prev; return it + 1; }";
  return [
    "var yr = 0, yi = 0, nr = 0, ni = 0, mod = zr * zr + zi * zi, prev = 0, hit = -1, hd = 0;",
    "var qr = zr, qi = zi, qyr = 0, qyi = 0, check = 8, since = 0, dr, di, dyr, dyi;",
    "m[2] = 0; m[3] = 0;",
    roots ? roots.setup : "if (" + esc + ") { m[0] = mod; m[1] = 0; return 1; }",
    "for (var it = 0; it < maxIter; it++) {",
    step,
    "yr = zr; yi = zi; zr = nr; zi = ni;",
    "prev = mod; mod = zr * zr + zi * zi;",
    test,
    "dr = zr - yr; di = zi - yi;",
    "if (dr * dr + di * di < 1e-24) { m[2] = 1; return 0; }",   // a fixed point: z has stopped moving
    "dr = zr - qr; di = zi - qi; dyr = yr - qyr; dyi = yi - qyi;",
    "if (dr * dr + di * di + dyr * dyr + dyi * dyi < 1e-24) { m[2] = since + 1; return 0; }",
    "if (++since === check) { since = 0; check *= 2; qr = zr; qi = zi; qyr = yr; qyi = yi; }",
    "}",
    "if (wp) {",
    "  var sr0 = zr, si0 = zi, tol0 = 1e-20 * (1 + zr * zr + zi * zi);",
    "  for (var pp = 1; pp <= 64; pp++) {",
    step,
    "    yr = zr; yi = zi; zr = nr; zi = ni;",
    "    dr = zr - sr0; di = zi - si0;",
    "    if (dr * dr + di * di < tol0) { m[2] = pp; return 0; }",
    "  }",
    "}",
    "return 0;"
  ].join("\n");
};

// ---- Typed formulas ----

var FormulaParser = (function(){
  var FUNCTIONS = ["sin", "cos", "tan", "sinh", "cosh", "tanh", "exp", "log", "ln",
                   "sqrt", "abs", "conj", "re", "im", "arg"];

  // A name written without spaces, as "csin" or "zc", is read as the known
  // names it is made of ("c sin", "z c"), the longest first; a name that is
  // not made of known ones is kept as it is (and reported, if unknown).
  var KNOWN = FUNCTIONS.concat(["pi", "z", "c", "n", "i", "e"]).sort(function(a, b){ return b.length - a.length; });
  var splitName = function(name){
    if (KNOWN.indexOf(name) >= 0) { return [name]; }
    var parts = [], at = 0;
    while (at < name.length){
      var found = null;
      for (var k = 0; k < KNOWN.length; k++){
        if (name.substr(at, KNOWN[k].length) === KNOWN[k]) { found = KNOWN[k]; break; }
      }
      if (!found) { return [name]; }
      parts.push(found);
      at += found.length;
    }
    return parts;
  };

  var tokenize = function(text){
    var s = text.replace(/[−–]/g, "-").replace(/[×·⋅]/g, "*")
      .replace(/²/g, "^2").replace(/³/g, "^3").replace(/\*\*/g, "^").replace(/π/g, "pi");
    var re = /\s*(?:((?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)|([A-Za-z_]\w*)|(\S))/g;
    var tokens = [], m;
    while ((m = re.exec(s)) !== null && m[0].trim() !== ""){
      if (m[1] !== undefined) { tokens.push({ k: "num", v: parseFloat(m[1]) }); }
      else if (m[2] !== undefined) { splitName(m[2].toLowerCase()).forEach(function(v){ tokens.push({ k: "id", v: v }); }); }
      else if ("+-*/^(),".indexOf(m[3]) >= 0) { tokens.push({ k: "op", v: m[3] }); }
      else { throw new Error("“" + m[3] + "” is not understood."); }
    }
    return tokens;
  };

  // expr := term (+|- term)*      term := unary ((*|/) unary | implicit)*
  // unary := -unary | power       power := primary (^ unary)?
  var parse = function(tokens, names){
    var pos = 0;
    var isOp = function(v){ var t = tokens[pos]; return t && t.k === "op" && t.v === v; };
    var expect = function(v){
      if (!isOp(v)) { throw new Error(v === ")" ? "A bracket is not closed." : "“" + v + "” is missing."); }
      pos++;
    };
    var startsOperand = function(){
      var t = tokens[pos];
      return t && (t.k === "num" || t.k === "id" || (t.k === "op" && t.v === "("));
    };
    var expr = function(){
      var a = term();
      while (isOp("+") || isOp("-")){
        var o = tokens[pos++].v;
        a = { t: o === "+" ? "add" : "sub", a: a, b: term() };
      }
      return a;
    };
    var term = function(){
      var a = unary();
      for (;;){
        if (isOp("*") || isOp("/")){
          var o = tokens[pos++].v;
          a = { t: o === "*" ? "mul" : "div", a: a, b: unary() };
        } else if (startsOperand()){
          a = { t: "mul", a: a, b: power() };   // 2z, 3(z + 1), z c
        } else {
          return a;
        }
      }
    };
    var unary = function(){
      if (isOp("-")) { pos++; return { t: "neg", a: unary() }; }
      if (isOp("+")) { pos++; return unary(); }
      return power();
    };
    var power = function(){
      var a = primary();
      if (isOp("^")) { pos++; return { t: "pow", a: a, b: unary() }; }
      return a;
    };
    var primary = function(){
      var t = tokens[pos];
      if (!t) { throw new Error("The formula ends too soon."); }
      pos++;
      if (t.k === "num") { return { t: "const", re: t.v, im: 0 }; }
      if (t.k === "id"){
        if (FUNCTIONS.indexOf(t.v) >= 0){
          if (!isOp("(")) { throw new Error("Write " + t.v + "( … ) with brackets."); }
          pos++;
          var arg = expr();
          expect(")");
          return { t: "call", f: t.v, a: arg };
        }
        if (names.indexOf(t.v) >= 0) { return { t: "var", name: t.v }; }
        if (t.v === "i")  { return { t: "const", re: 0, im: 1 }; }
        if (t.v === "pi") { return { t: "const", re: Math.PI, im: 0 }; }
        if (t.v === "e")  { return { t: "const", re: Math.E, im: 0 }; }
        if (names.length && /^[zcni]+$/.test(t.v)){
          throw new Error("Write " + t.v.split("").join("*") + " to multiply.");
        }
        throw new Error("“" + t.v + "” is not known here. Use " +
          (names.length ? names.join(", ") + ", i, pi, e or a function." : "numbers, i, pi and e."));
      }
      if (t.v === "(") { var e = expr(); expect(")"); return e; }
      throw new Error("“" + t.v + "” is not expected there.");
    };
    if (!tokens.length) { throw new Error("Write a formula."); }
    var tree = expr();
    if (pos < tokens.length) { throw new Error("“" + tokens[pos].v + "” is not expected there."); }
    return tree;
  };

  var calls = function(node, names){
    if (!node) { return false; }
    if (node.t === "call" && names.indexOf(node.f) >= 0) { return true; }
    return calls(node.a, names) || calls(node.b, names);
  };

  var uses = function(node, name){
    if (!node) { return false; }
    if (node.t === "var") { return node.name === name; }
    return uses(node.a, name) || uses(node.b, name);
  };
  var hasVariables = function(node){
    return uses(node, "z") || uses(node, "c") || uses(node, "n");
  };

  // Turn a tree into lines of code computing its value as two numbers.
  // Returns {lines, r, i}; with fold, parts without variables are worked out
  // at once and written as plain numbers.
  var generate = function(tree, fold){
    var lines = [], count = 0;
    var tmp = function(r, i){
      var name = "t" + (count++);
      lines.push("var " + name + "r = " + r + ", " + name + "i = " + i + ";");
      return { r: name + "r", i: name + "i" };
    };
    var lit = function(v){ return "(" + (v === 0 ? 0 : v) + ")"; };
    var ONE = { r: "1", i: "0" };
    var mul = function(a, b){
      return tmp(a.r + " * " + b.r + " - " + a.i + " * " + b.i, a.r + " * " + b.i + " + " + a.i + " * " + b.r);
    };
    var div = function(a, b){
      var d = tmp(b.r + " * " + b.r + " + " + b.i + " * " + b.i, "0");
      return tmp("(" + a.r + " * " + b.r + " + " + a.i + " * " + b.i + ") / " + d.r,
                 "(" + a.i + " * " + b.r + " - " + a.r + " * " + b.i + ") / " + d.r);
    };
    var ipow = function(a, k){   // k >= 0, by repeated squaring
      var result = null, base = a;
      while (k > 0){
        if (k & 1) { result = result ? mul(result, base) : base; }
        k >>= 1;
        if (k) { base = mul(base, base); }
      }
      return result || ONE;
    };
    var call = function(f, a){
      var e, m;
      switch (f){
        case "exp":
          e = tmp("Math.exp(" + a.r + ")", "0");
          return tmp(e.r + " * Math.cos(" + a.i + ")", e.r + " * Math.sin(" + a.i + ")");
        case "log": case "ln":
          return tmp("Math.log(Math.hypot(" + a.r + ", " + a.i + "))", "Math.atan2(" + a.i + ", " + a.r + ")");
        case "sin":  return tmp("Math.sin(" + a.r + ") * Math.cosh(" + a.i + ")", "Math.cos(" + a.r + ") * Math.sinh(" + a.i + ")");
        case "cos":  return tmp("Math.cos(" + a.r + ") * Math.cosh(" + a.i + ")", "-Math.sin(" + a.r + ") * Math.sinh(" + a.i + ")");
        case "sinh": return tmp("Math.sinh(" + a.r + ") * Math.cos(" + a.i + ")", "Math.cosh(" + a.r + ") * Math.sin(" + a.i + ")");
        case "cosh": return tmp("Math.cosh(" + a.r + ") * Math.cos(" + a.i + ")", "Math.sinh(" + a.r + ") * Math.sin(" + a.i + ")");
        case "tan":  return div(call("sin", a), call("cos", a));
        case "tanh": return div(call("sinh", a), call("cosh", a));
        case "sqrt":
          m = tmp("Math.hypot(" + a.r + ", " + a.i + ")", "0");
          return tmp("Math.sqrt(Math.max(0, (" + m.r + " + " + a.r + ") / 2))",
                     "(" + a.i + " < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (" + m.r + " - " + a.r + ") / 2))");
        case "abs":  return tmp("Math.hypot(" + a.r + ", " + a.i + ")", "0");
        case "conj": return tmp(a.r, "-" + a.i);
        case "re":   return tmp(a.r, "0");
        case "im":   return tmp(a.i, "0");
        case "arg":  return tmp("Math.atan2(" + a.i + ", " + a.r + ")", "0");
      }
      throw new Error("Unknown function " + f + ".");
    };
    var power = function(node){
      var a = g(node.a);
      if (!hasVariables(node.b)){
        var k = evaluate(node.b);
        if (k[1] === 0 && Number.isInteger(k[0]) && Math.abs(k[0]) <= 64){
          var p = ipow(a, Math.abs(k[0]));
          return k[0] < 0 ? div(ONE, p) : p;
        }
      }
      if (node.b.t === "var" && node.b.name === "n"){   // the power setting, a whole number
        var t = "t" + (count++);
        lines.push("var " + t + "r = 1, " + t + "i = 0, " + t + "t, " + t + "k;");
        lines.push("for (" + t + "k = 0; " + t + "k < n; " + t + "k++) { " + t + "t = " + t + "r * " + a.r + " - " +
          t + "i * " + a.i + "; " + t + "i = " + t + "i * " + a.r + " + " + t + "r * " + a.i + "; " + t + "r = " + t + "t; }");
        return { r: t + "r", i: t + "i" };
      }
      // a^b = e^(b log a), and 0^b = 0.
      var b = g(node.b);
      var l = tmp("Math.log(Math.hypot(" + a.r + ", " + a.i + "))", "Math.atan2(" + a.i + ", " + a.r + ")");
      var w = mul(b, l);
      var zero = "(" + a.r + " === 0 && " + a.i + " === 0)";
      return tmp(zero + " ? 0 : Math.exp(" + w.r + ") * Math.cos(" + w.i + ")",
                 zero + " ? 0 : Math.exp(" + w.r + ") * Math.sin(" + w.i + ")");
    };
    var g = function(node){
      if (fold && node.t !== "const" && !hasVariables(node)){
        var v = evaluate(node);
        return { r: lit(v[0]), i: lit(v[1]) };
      }
      var a, b;
      switch (node.t){
        case "const": return { r: lit(node.re), i: lit(node.im) };
        case "var":
          if (node.name === "z") { return { r: "zr", i: "zi" }; }
          if (node.name === "c") { return { r: "cr", i: "ci" }; }
          return { r: "n", i: "0" };
        case "neg": a = g(node.a); return tmp("-" + a.r, "-" + a.i);
        case "add": a = g(node.a); b = g(node.b); return tmp(a.r + " + " + b.r, a.i + " + " + b.i);
        case "sub": a = g(node.a); b = g(node.b); return tmp(a.r + " - " + b.r, a.i + " - " + b.i);
        case "mul": return mul(g(node.a), g(node.b));
        case "div": return div(g(node.a), g(node.b));
        case "pow": return power(node);
        case "call": return call(node.f, g(node.a));
      }
      throw new Error("Unknown part of a formula.");
    };
    var result = g(tree);
    return { lines: lines, r: result.r, i: result.i };
  };

  // The value of a part without variables, as [re, im].
  var evaluate = function(tree){
    var code = generate(tree, false);
    return new Function(code.lines.join("\n") + "\nreturn [" + code.r + ", " + code.i + "];")();
  };

  return {
    // A formula of z and c (and n): the code of one step, and whether it uses n.
    step: function(text){
      var tree = parse(tokenize(text), ["z", "c", "n"]);
      var code = generate(tree, true);
      return {
        step: code.lines.join("\n") + "\nnr = " + code.r + "; ni = " + code.i + ";",
        power: uses(tree, "n"),
        // Exponential and trigonometric formulas: z can grow past 2 and come
        // back, so they need another escape rule (see currentFormula).
        transcendental: calls(tree, ["exp", "sin", "cos", "tan", "sinh", "cosh", "tanh"]),
        // Where the derivative is not a complex one: no automatic start.
        holomorphic: !calls(tree, ["abs", "conj", "re", "im", "arg"])
      };
    },
    // A constant, such as the starting point: [re, im].
    value: function(text){
      var v = evaluate(parse(tokenize(text), []));
      if (!isFinite(v[0]) || !isFinite(v[1])) { throw new Error("The starting point is not a finite number."); }
      return v;
    }
  };
})();

// ---- Where z starts, found automatically ----

// For the two figures to belong together, z starts on Fig. 1 at a critical
// point of f: where its derivative f'(z) is 0, whatever c is. This looks for
// one with Newton's method on f', worked out numerically, from a few starting
// guesses, and keeps the one nearest to 0 that is the same for two values of
// c. Returns {z, html} or null if there is none (c e^z has none, say).
var findCriticalPoint = function(step, n){
  var f = function(z, c){ return step(z[0], z[1], 0, 0, c[0], c[1], n); };
  // f'(z): for a formula of z alone (no abs, conj...), the change along the
  // real axis is the complex derivative.
  var d1 = function(z, c){
    var h = 1e-6, a = f([z[0] + h, z[1]], c), b = f([z[0] - h, z[1]], c);
    return [(a[0] - b[0]) / (2 * h), (a[1] - b[1]) / (2 * h)];
  };
  var d2 = function(z, c){
    var h = 1e-4, a = d1([z[0] + h, z[1]], c), b = d1([z[0] - h, z[1]], c);
    return [(a[0] - b[0]) / (2 * h), (a[1] - b[1]) / (2 * h)];
  };
  var size = function(v){ return Math.hypot(v[0], v[1]); };
  var C1 = [0.31, 0.17], C2 = [-0.43, 0.29];
  var newton = function(z){
    for (var k = 0; k < 60; k++){
      var g = d1(z, C1), h = d2(z, C1), d = h[0] * h[0] + h[1] * h[1];
      if (!(d > 1e-300) || !isFinite(d)) { return null; }
      var stepZ = [(g[0] * h[0] + g[1] * h[1]) / d, (g[1] * h[0] - g[0] * h[1]) / d];
      z = [z[0] - stepZ[0], z[1] - stepZ[1]];
      if (!isFinite(z[0]) || !isFinite(z[1]) || size(z) > 1e3) { return null; }
      if (size(stepZ) < 1e-12) { break; }
    }
    return z;
  };
  var best = null;
  var guesses = [[0, 0], [0.5, 0], [-0.5, 0], [1, 0], [-1, 0], [0, 0.5], [0, -0.5],
                 [1.5, 0], [-1.5, 0], [0, 1.5], [0.7, 0.7], [-0.7, 0.7], [2, 0], [-2, 0]];
  guesses.forEach(function(g){
    var z = newton(g);
    if (!z) { return; }
    // f' must be 0 there for both values of c, and f must have a value.
    var scale = 1e-6 * Math.max(1, size(d2(z, C1)));
    if (size(d1(z, C1)) > scale || size(d1(z, C2)) > scale) { return; }
    var v = f(z, C1);
    if (!isFinite(v[0]) || !isFinite(v[1])) { return; }
    // Far out, e^z and the like are so small that f' only looks like 0.
    if (size(z) > 4) { return; }
    if (!best || size(z) < size(best) - 1e-9) { best = z; }
  });
  if (!best) { return null; }
  return niceNumber(best);
};

// A point found numerically, put on the simple value it is so close to that
// it must be that (0, 1/2, pi/2...), with a name for it. (Newton's method
// comes slowly to a point where f' has a double zero, as z^3 + c at 0.)
var NICE = 1e-5;
var niceNumber = function(z){
  var part = function(v){
    if (Math.abs(v) < NICE) { return { v: 0, text: "0" }; }
    for (var q = 1; q <= 12; q++){
      var p = Math.round(v * q);
      if (Math.abs(v - p / q) < NICE){
        return { v: p / q, text: q === 1 ? String(p) : p + "/" + q };
      }
    }
    for (var q2 = 1; q2 <= 8; q2++){
      var p2 = Math.round(v * q2 / Math.PI);
      if (p2 !== 0 && Math.abs(v - p2 * Math.PI / q2) < NICE){
        var k = Math.abs(p2) === 1 ? "" : String(Math.abs(p2));
        return { v: p2 * Math.PI / q2, text: (p2 < 0 ? "\u2212" : "") + k + "\u03c0" + (q2 === 1 ? "" : "/" + q2) };
      }
    }
    return { v: v, text: formatNumber(v, 4) };
  };
  var re = part(z[0]), im = part(z[1]);
  // The imaginary part: "i", "2i", "0.5i", or "iπ/2" (i first before π).
  var imAbs = im.text.replace("\u2212", "");
  var imHtml = Math.abs(im.v) === 1 ? "<i>i</i>"
    : (imAbs.indexOf("\u03c0") >= 0 ? "<i>i</i>" + imAbs : imAbs + "<i>i</i>");
  var html = im.v === 0 ? re.text
    : (re.v === 0 ? (im.v < 0 ? "\u2212" : "") : re.text + (im.v < 0 ? " \u2212 " : " + ")) + imHtml;
  return { z: [re.v, im.v], html: html.replace("1\u03c0", "\u03c0") };
};

// Formulas to start from, all with a picture worth seeing.
// home: the view of Fig. 1 to start with; c: a good c for Fig. 2.
var FORMULA_EXAMPLES = [
  { name: "z\u00b3 + c",            expr: "z^3 + c" },
  { name: "z\u2074 \u2212 z\u00b2 + c",  expr: "z^4 - z^2 + c", home: [0, 0, 3.2] },
  { name: "z\u00b2\u02d9\u2075 + c",      expr: "z^2.5 + c" },
  { name: "sin(z) + c",            expr: "sin(z) + c", home: [-1.57, 0, 7] },
  { name: "cos(z) + c",            expr: "cos(z) + c", home: [-1, 0, 7] },
  { name: "c \u00b7 sin(z)",        expr: "c*sin(z)", home: [0, 0, 8] },
  { name: "c \u00b7 cos(z)",        expr: "c*cos(z)", home: [0, 0, 8] },
  { name: "exp(z) + c",            expr: "exp(z) + c", home: [-1, 0, 8] },
  { name: "c \u00b7 exp(z)",        expr: "c*exp(z)", home: [-1, 0, 7] },
  { name: "sinh(z) + c",           expr: "sinh(z) + c", home: [0, 0, 7] },
  { name: "c z (1 \u2212 z)",       expr: "c*z*(1 - z)", home: [1, 0, 6.4] },
  { name: "z\u00b2 + c + 0.2 / z",  expr: "z^2 + c + 0.2/z" }
];

// ---- The formula in use ----

// The current formula, compiled: {def, spec, step, escapes, power, error}.
// spec goes to the renderer (plain data); step and escapes are for the orbit.
var formula_cache = { key: null, value: null };

var currentFormula = function(){
  var def = formulaById(settings.formula);
  var key = JSON.stringify([def.id, settings.p, settings.custom]);
  if (formula_cache.key === key) { return formula_cache.value; }

  var step = def.step, power = !!def.power, start = def.start || [0, 0], error = "";
  var escape = def.escape || "mod >= bail", degree = def.degree, startNote = "", startText = null;
  if (def.id === "phoenix") { step = phoenixStep(settings.p); }
  if (def.id === "custom"){
    try {
      var parsed = FormulaParser.step(settings.custom.expr);
      step = parsed.step;
      power = parsed.power;
      // Try it once, so that a mistake shows here and not in the workers.
      var tryStep = new Function("zr", "zi", "yr", "yi", "cr", "ci", "n", "var nr = 0, ni = 0;\n" + step + "\nreturn [nr, ni];");
      tryStep(0.1, 0.2, 0, 0, 0.3, 0.4, 2);
      if (parsed.transcendental){
        // e^z, sin z... grow so fast that a z this large has escaped for good.
        escape = "mod >= 1e20";
        degree = null;   // no smooth shading: there is no degree
      }
      var startField = String(settings.custom.start || "").trim().toLowerCase();
      if (startField === "" || startField === "auto"){
        var found = parsed.holomorphic ? findCriticalPoint(tryStep, settings.power) : null;
        if (found){
          start = found.z;
          startText = found.html;
          startNote = "Start z = auto: z starts at " + found.html + ", where f\u2032(z) = 0.";
        } else if (!isFinite(tryStep(0, 0, 0, 0, 0.31, 0.17, settings.power)[0])){
          // 0 is a pole (z^-2 + c): start at 1 instead.
          start = [1, 0];
          startText = "1";
          startNote = "Start z = auto: no point where f\u2032(z) = 0 was found, and 0 is a pole, so z starts at 1.";
        } else {
          start = [0, 0];
          startText = "0";
          startNote = parsed.holomorphic
            ? "Start z = auto: no point where f\u2032(z) = 0 was found, so z starts at 0."
            : "Start z = auto: with abs, conj, re, im or arg there is no derivative to follow, so z starts at 0.";
        }
      } else {
        start = FormulaParser.value(settings.custom.start);
      }
    } catch (e) {
      // Keep drawing the last formula that worked.
      error = e.message;
      if (formula_cache.value && formula_cache.value.def.id === "custom"){
        var last = Object.create(formula_cache.value);
        last.error = error;
        return last;
      }
      step = FORMULAS[0].step; power = true; start = [0, 0];
    }
  }
  var bail = def.bail || 4;
  var value = {
    def: def,
    error: error,
    power: power,
    start: start,
    start_text: startText,   // a typed formula started automatically: the start, as HTML
    start_note: startNote,
    spec: {
      id: def.id,
      loop: loopSource(step, escape, def.roots),
      key: def.id + ":" + step + ":" + escape + (def.roots ? ":roots" : ""),
      mode: def.mode || "escape",
      start: start,
      smooth: degree !== null,
      degree: degree,   // 0: the power n (or, for a typed formula, estimated)
      bail: bail
    },
    step: new Function("zr", "zi", "yr", "yi", "cr", "ci", "n", "var nr = 0, ni = 0;\n" + step + "\nreturn [nr, ni];"),
    // Has z escaped (or, for Newton, reached a root)? For the orbit.
    escapes: def.roots
      ? new Function("zr", "zi", "mod", "bail", "cr", "ci",
          "var hit = -1, hd = 0, dr, di;\n" + def.roots.setup + "\n" + def.roots.test + "\nreturn hit >= 0;")
      : new Function("zr", "zi", "mod", "bail", "cr", "ci", "return " + escape + ";")
  };
  // Starting at a pole (0 for z^-2 + c, say) makes every point escape at once.
  var first = value.step(start[0], start[1], 0, 0, 0.123, 0.0456, settings.power);
  value.warning = isFinite(first[0]) && isFinite(first[1]) ? "" :
    "From this start z escapes at once, so Fig. 1 is empty: try another start, such as 1.";
  formula_cache = { key: key, value: value };
  return value;
};

// The formula as shown in the panel (HTML), and where z starts.
var formulaHtml = function(){
  var f = currentFormula();
  if (f.def.id === "custom"){
    return settings.custom.expr.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\b([zc])\b/g, "<i>$1</i>");
  }
  return f.def.html(settings.power);
};

var startHtml = function(){
  var f = currentFormula();
  if (f.def.start_html) { return f.def.start_html; }
  if (f.start_text) { return f.start_text; }
  return f.start[1] === 0 ? formatNumber(f.start[0], 4) : formatComplex(f.start);
};

// Where a figure starts for the current formula: [cx, cy, span].
var homeView = function(f){
  var def = currentFormula().def;
  return (f === mandelbrot ? def.home : def.julia_home) || [0, 0, 4];
};
