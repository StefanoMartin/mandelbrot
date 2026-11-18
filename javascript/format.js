// Small helpers: finding elements, and numbers as they are shown and typed.

var byId = function(id){
	return document.getElementById(id);
}

// ---- Numbers as they are shown in the panel ----

// At most `decimals` decimals (no trailing zeros), with a true minus sign.
var formatNumber = function(n, decimals){
	var p = Math.pow(10, decimals === undefined ? 2 : decimals);
	var r = Math.round(n * p) / p;
	if (r === 0) { r = 0; }   // no "−0"
	return String(r).replace("-", "−");
}

// Enough decimals to tell the two ends of a narrow range apart.
var formatRange = function(r){
	var width = Math.abs(r[1] - r[0]);
	var decimals = Math.min(15, Math.max(2, Math.ceil(-Math.log10(width)) + 2));
	var f = function(v){
		var text = Math.abs(v) < 1e-15 ? "0" : v.toFixed(decimals).replace(/\.?0+$/, "");
		return text.replace("-", "−");
	};
	return "[" + f(r[0]) + ", " + f(r[1]) + "]";
}

// Magnification compared with the figure's starting view.
var formatZoom = function(f){
	var zoom = homeView(f)[2] / f.span;
	return "×" + (zoom < 10 ? formatNumber(zoom) : Math.round(zoom).toLocaleString("en-US"));
}

// c as "a + bi" (HTML: the i is in italics).
var formatComplex = function(c){
	var im = formatNumber(Math.abs(c[1]), 4);
	return formatNumber(c[0], 4) + (c[1] < 0 && im !== "0" ? " − " : " + ") + im + "<i>i</i>";
}

// Decimals that keep a value as precise as one pixel of Fig. 1 (for c), or
// of the figure itself (for its centre), plus some to spare.
var decimalsFor = function(step){
	return Math.min(17, Math.max(4, Math.ceil(-Math.log10(step)) + 2));
}

// A number typed in a field: "-0.8", "−0.8" or "-0,8"; NaN if it is not one.
var parseDecimal = function(text){
	var t = String(text).trim().replace(/\u2212/g, "-").replace(",", ".");
	return t === "" ? NaN : Number(t);
}

// A number as plain text for a field or a link: "-0.8", not "−0.80000".
var plain = function(v, decimals){
	var r = parseFloat(v.toFixed(decimals));
	return String(r === 0 ? 0 : r);
}
