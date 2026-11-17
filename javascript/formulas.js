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
// (z and the previous z) has settled into a cycle and is stopped early.
var loopSource = function(step, escape){
  var esc = escape || "mod >= bail";
  return [
    "var yr = 0, yi = 0, nr = 0, ni = 0, mod = zr * zr + zi * zi, prev = 0;",
    "var qr = zr, qi = zi, qyr = 0, qyi = 0, check = 8, since = 0, dr, di, dyr, dyi;",
    "if (" + esc + ") { m[0] = mod; m[1] = 0; return 1; }",
    "for (var it = 0; it < maxIter; it++) {",
    step,
    "yr = zr; yi = zi; zr = nr; zi = ni;",
    "prev = mod; mod = zr * zr + zi * zi;",
    "if (mod !== mod || mod === Infinity || " + esc + ") { m[0] = mod; m[1] = prev; return it + 1; }",
    "dr = zr - yr; di = zi - yi;",
    "if (dr * dr + di * di < 1e-24) { return 0; }",   // a fixed point: z has stopped moving
    "dr = zr - qr; di = zi - qi; dyr = yr - qyr; dyi = yi - qyi;",
    "if (dr * dr + di * di + dyr * dyr + dyi * dyi < 1e-24) { return 0; }",
    "if (++since === check) { since = 0; check *= 2; qr = zr; qi = zi; qyr = yr; qyi = yi; }",
    "}",
    "return 0;"
  ].join("\n");
};

// ---- Typed formulas ----

var FormulaParser = (function(){
  var FUNCTIONS = ["sin", "cos", "tan", "sinh", "cosh", "tanh", "exp", "log", "ln",
                   "sqrt", "abs", "conj", "re", "im", "arg"];

  var tokenize = function(text){
    var s = text.replace(/[−–]/g, "-").replace(/[×·⋅]/g, "*")
      .replace(/²/g, "^2").replace(/³/g, "^3").replace(/\*\*/g, "^").replace(/π/g, "pi");
    var re = /\s*(?:((?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)|([A-Za-z_]\w*)|(\S))/g;
    var tokens = [], m;
    while ((m = re.exec(s)) !== null && m[0].trim() !== ""){
      if (m[1] !== undefined) { tokens.push({ k: "num", v: parseFloat(m[1]) }); }
      else if (m[2] !== undefined) { tokens.push({ k: "id", v: m[2].toLowerCase() }); }
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
      return { step: code.lines.join("\n") + "\nnr = " + code.r + "; ni = " + code.i + ";", power: uses(tree, "n") };
    },
    // A constant, such as the starting point: [re, im].
    value: function(text){
      var v = evaluate(parse(tokenize(text), []));
      if (!isFinite(v[0]) || !isFinite(v[1])) { throw new Error("The starting point is not a finite number."); }
      return v;
    }
  };
})();

// ---- The formula in use ----

// The current formula, compiled: {def, spec, step, escapes, power, error}.
// spec goes to the renderer (plain data); step and escapes are for the orbit.
var formula_cache = { key: null, value: null };

var currentFormula = function(){
  var def = formulaById(settings.formula);
  var key = JSON.stringify([def.id, settings.p, settings.custom]);
  if (formula_cache.key === key) { return formula_cache.value; }

  var step = def.step, power = !!def.power, start = def.start || [0, 0], error = "";
  if (def.id === "phoenix") { step = phoenixStep(settings.p); }
  if (def.id === "custom"){
    try {
      var parsed = FormulaParser.step(settings.custom.expr);
      step = parsed.step;
      power = parsed.power;
      start = FormulaParser.value(settings.custom.start || "0");
      // Try it once, so that a mistake shows here and not in the workers.
      new Function("zr", "zi", "yr", "yi", "cr", "ci", "n", "var nr = 0, ni = 0;\n" + step + "\nreturn [nr, ni];")(0.1, 0.2, 0, 0, 0.3, 0.4, 2);
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
  var escape = def.escape || "mod >= bail";
  var bail = def.bail || 4;
  var value = {
    def: def,
    error: error,
    power: power,
    start: start,
    spec: {
      id: def.id,
      loop: loopSource(step, def.escape),
      key: def.id + ":" + step + ":" + escape,
      start: start,
      smooth: def.degree !== null,
      degree: def.degree,   // 0: the power n (or, for a typed formula, estimated)
      bail: bail
    },
    step: new Function("zr", "zi", "yr", "yi", "cr", "ci", "n", "var nr = 0, ni = 0;\n" + step + "\nreturn [nr, ni];"),
    escapes: new Function("zr", "zi", "mod", "bail", "return " + escape + ";")
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
  return f.start[1] === 0 ? formatNumber(f.start[0], 4) : formatComplex(f.start);
};

// Where a figure starts for the current formula: [cx, cy, span].
var homeView = function(f){
  var def = currentFormula().def;
  return (f === mandelbrot ? def.home : def.julia_home) || [0, 0, 4];
};
