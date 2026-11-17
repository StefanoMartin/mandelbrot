var POWER_MIN = 1, POWER_MAX = 10;
var PALETTE_KEY = "mandelbrot-julia.palette";

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

// A number as plain text for a field or a link: "-0.8", not "−0.80000".
var plain = function(v, decimals){
	var r = parseFloat(v.toFixed(decimals));
	return String(r === 0 ? 0 : r);
}

// ---- Views ----

// What a figure shows, from its centre, span and canvas size: the left and
// right ends, the top and bottom, and the size of one pixel.
var region = function(f){
	var step = f.span / Math.min(f.width, f.height);
	var x0 = f.cx - step * f.width / 2, top = f.cy + step * f.height / 2;
	return { x0: x0, x1: x0 + step * f.width, top: top, bottom: top - step * f.height, step: step };
}

// Everything the renderer needs to draw a figure.
var viewParams = function(f){
	var r = region(f);
	var params = {
		type: f.type, width: f.width, height: f.height,
		// The kernel counts rows downwards: row j is at imaginary part -(y0 + j * step).
		x0: r.x0, x1: r.x1, y0: -r.top, y1: -r.bottom,
		power: settings.power, maxIter: f.iteration,
		cr: f.c ? f.c[0] : 0, ci: f.c ? f.c[1] : 0,
		colours: paletteFor(settings.palette, f.type),
		formula: currentFormula().spec,
		smooth: settings.smooth,
		lines: settings.lines,
		lineScale: f.dpr
	};
	// Schemes that adapt spread their colours over the escape counts in view,
	// found from a quick 24 x 24 sample of it.
	if (params.colours.adaptive){
		var range = FractalKernel.valueRange(params, 24);
		if (range){
			params.low = Math.max(0, Math.floor(range[0]) - 1);
			params.high = Math.min(f.iteration, Math.max(params.low + 2, Math.ceil(range[1]) + 1));
		}
	}
	return params;
}

// The panel readout of a figure.
var showView = function(f){
	var r = region(f), id = function(name){ return byId(f.prefix + "_" + name); };
	var formula = currentFormula();
	id("formula").innerHTML = formulaHtml() + (f === mandelbrot ? ", from <i>z</i> = " + startHtml() : "");
	if (f === mandelbrot){
		byId("m_legend").textContent = formula.def.short;
		byId("m_caption").textContent = formula.def.title + ".";
	}
	id("real").textContent = formatRange([r.x0, r.x1]);
	id("imag").textContent = formatRange([r.bottom, r.top]);
	id("zoom").textContent = formatZoom(f);
	id("iter").textContent = f.iteration;
}

var build = function(){
	mandelbrot.paint();
	julia.paint();
}

// ---- Zooming and moving ----

// Farthest out and deepest in. Below about 1e-13 the pixels would be
// closer together than double-precision numbers can tell apart.
var SPAN_MAX = 64, SPAN_MIN = 1e-13;

// Zoom by `factor` (above 1 zooms in), keeping the point p where it is on screen.
var zoom_at = function(f, factor, p){
	var span = Math.min(SPAN_MAX, Math.max(SPAN_MIN, f.span / factor));
	var k = span / f.span;
	f.cx = p[0] - (p[0] - f.cx) * k;
	f.cy = p[1] - (p[1] - f.cy) * k;
	f.span = span;
	setIterations(f);
	f.paint();
}

// Zoom around the centre of the figure (the panel buttons).
var zoom_centre = function(f, factor){
	zoom_at(f, factor, [f.cx, f.cy]);
}

// Deeper views need more iterations to show their detail: 100 more for every
// 5x of zoom, as the old zoom steps did. Rounded, so the colours don't shift
// at every turn of the wheel.
var setIterations = function(f){
	var zoom = homeView(f)[2] / f.span;
	var it = f.base_iteration + 100 * Math.log(zoom) / Math.log(5);
	f.iteration = Math.max(f.base_iteration, Math.round(it / 25) * 25);
}

// Mouse wheel or trackpad: zoom in or out at the pointer.
var wheelZoom = function(f, e){
	e.preventDefault();
	var delta = e.deltaY * (e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 400 : 1));
	zoom_at(f, Math.exp(-delta * 0.0015), canvasPoint(byId(f.type), f, e));
}

// Move the view by half its shorter side: dx, dy are -1, 0 or 1 (dy = 1 is up).
var move = function(f, dx, dy){
	f.cx += dx * f.span / 2;
	f.cy += dy * f.span / 2;
	f.paint();
}

// The point of the complex plane under the pointer.
var canvasPoint = function(canvas, f, e){
	var rect = canvas.getBoundingClientRect();
	// Pointer position in canvas pixels (clientLeft/Top skip the border).
	var inner_w = rect.width - 2 * canvas.clientLeft, inner_h = rect.height - 2 * canvas.clientTop;
	var px = (e.clientX - rect.left - canvas.clientLeft) * canvas.width / inner_w;
	var py = (e.clientY - rect.top - canvas.clientTop) * canvas.height / inner_h;
	var r = region(f);
	return [r.x0 + px * r.step, r.top - py * r.step];
}

// ---- The point c ----

// Choose c from the point under the pointer on Fig. 1 (unless it is kept).
var create_julia = function(e){
	if (julia.blocked) { return; }
	julia.c = canvasPoint(byId("mandelbrot"), mandelbrot, e);
	julia.paint();
}

// Set c from the fields, a famous value or a link: it is then kept.
var setC = function(c){
	julia.c = c;
	julia.set_blocked(true);
	julia.paint();
}

// Well-known Julia sets of z^2 + c.
var FAMOUS = [
	{ name: "Spirals",          c: [-0.8, 0.156] },
	{ name: "Douady’s rabbit", c: [-0.123, 0.745] },
	{ name: "Basilica",         c: [-1, 0] },
	{ name: "San Marco",        c: [-0.75, 0] },
	{ name: "Airplane",         c: [-1.755, 0] },
	{ name: "Dendrite",         c: [0, 1] },
	{ name: "Siegel disk",      c: [-0.391, -0.587] },
	{ name: "Cauliflower",      c: [0.25, 0] },
	{ name: "Seahorses",        c: [-0.7269, 0.1889] }
];

// The readout of c: the two fields (unless being typed in), the caption and
// the list of famous values.
var showC = function(){
	var c = julia.c;
	var decimals = Math.max(4, decimalsFor(region(mandelbrot).step) - 1);
	[["c_re", c[0]], ["c_im", c[1]]].forEach(function(pair){
		var field = byId(pair[0]);
		if (document.activeElement !== field){
			field.value = plain(pair[1], decimals);
			field.classList.remove("invalid");
		}
	});
	byId("caption_c").innerHTML = formatComplex(c);
	var match = "";
	FAMOUS.forEach(function(item, i){
		if (settings.formula === "classic" && settings.power === 2 &&
		    item.c[0] === c[0] && item.c[1] === c[1]) { match = String(i); }
	});
	byId("famous").value = match;
}

var readCFields = function(){
	var re = byId("c_re"), im = byId("c_im");
	var a = parseFloat(re.value), b = parseFloat(im.value);
	re.classList.toggle("invalid", !isFinite(a));
	im.classList.toggle("invalid", !isFinite(b));
	if (isFinite(a) && isFinite(b)) { setC([a, b]); }
}

var chooseFamous = function(){
	var item = FAMOUS[byId("famous").value];
	if (!item) { return; }
	if (settings.formula !== "classic" || settings.power !== 2){   // the names belong to z^2 + c
		if (settings.formula !== "classic"){
			settings.formula = "classic";
			var home = homeView(mandelbrot);
			mandelbrot.cx = home[0]; mandelbrot.cy = home[1]; mandelbrot.span = home[2];
			setIterations(mandelbrot);
		}
		settings.power = 2;
		showSettings();
		mandelbrot.paint();
	}
	julia.cx = 0; julia.cy = 0; julia.span = 4;
	setIterations(julia);
	setC(item.c.slice());
}

// A small sighting mark where c is on Fig. 1. It is hidden while a mouse
// points at Fig. 1 and c follows it (the pointer is the mark then), and
// when c is outside the view.
var placeMarker = function(){
	var marker = byId("marker"), plate = marker.parentNode;
	var r = region(mandelbrot);
	var inner_w = plate.clientWidth - 2, inner_h = plate.clientHeight - 2;   // inside the border
	var x = 1 + (julia.c[0] - r.x0) / r.step * inner_w / mandelbrot.width;
	var y = 1 + (r.top - julia.c[1]) / r.step * inner_h / mandelbrot.height;
	var inside = x >= 1 && x <= inner_w + 1 && y >= 1 && y <= inner_h + 1;
	var following = plate.classList.contains("pointing") && !julia.blocked;
	marker.style.display = inside && !following ? "block" : "none";
	marker.style.left = x + "px";
	marker.style.top = y + "px";
}

// ---- Dragging a figure moves its view ----

// A press that moves less than this (CSS pixels) is a click, not a drag.
var DRAG_SLOP = 4;

var setupDrag = function(f){
	var canvas = byId(f.type);
	var drag = null;   // {id, x, y, startX, startY, moved}

	canvas.addEventListener("pointerdown", function(e){
		if (e.pointerType === "mouse" && e.button !== 0) { return; }
		if (drag) { return; }   // one pointer at a time
		e.preventDefault();
		canvas.setPointerCapture(e.pointerId);
		drag = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
	});

	canvas.addEventListener("pointermove", function(e){
		if (!drag || e.pointerId !== drag.id){
			// Only hovering: on Fig. 1 a mouse chooses c as it goes.
			if (e.pointerType === "mouse" && !drag){
				if (f === mandelbrot) { create_julia(e); }
				orbitAt(f, e);
			}
			return;
		}
		if (!drag.moved){
			if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_SLOP) { return; }
			drag.moved = true;
			canvas.classList.add("grabbing");
		}
		// CSS pixels moved -> canvas pixels -> units of the plane. The view
		// follows the pointer: dragging right shows what was on the left.
		var rect = canvas.getBoundingClientRect();
		var scale = canvas.width / (rect.width - 2 * canvas.clientLeft);
		var step = region(f).step * scale;
		f.cx -= (e.clientX - drag.x) * step;
		f.cy += (e.clientY - drag.y) * step;
		drag.x = e.clientX;
		drag.y = e.clientY;
		f.paint();
	});

	var end = function(e){
		if (!drag || e.pointerId !== drag.id) { return; }
		// A click (or tap) on Fig. 1 chooses c there.
		if (!drag.moved && e.type === "pointerup"){
			if (f === mandelbrot) { create_julia(e); }
			orbitAt(f, e);
		}
		drag = null;
		canvas.classList.remove("grabbing");
	};
	canvas.addEventListener("pointerup", end);
	canvas.addEventListener("pointercancel", end);
}

// ---- Layout: the figures share all the room beside the panel ----

// Pixels per CSS pixel at most: sharp on high-density screens, without
// drawing four times as many points as needed on very dense ones.
var DPR_MAX = 2;

var layout = function(){
	var figures = byId("figures");
	// Side by side in a wide room, one above the other in a tall one.
	figures.classList.toggle("stacked", figures.clientHeight > figures.clientWidth);
	var dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
	[mandelbrot, julia].forEach(function(f){
		var canvas = byId(f.type), plate = canvas.parentNode;
		var w = plate.clientWidth, h = plate.clientHeight;
		if (w < 3 || h < 3) { return; }
		canvas.style.width = w + "px";
		canvas.style.height = h + "px";
		var pw = Math.round((w - 2) * dpr), ph = Math.round((h - 2) * dpr);   // inside the 1px border
		f.dpr = dpr;
		if (pw !== f.width || ph !== f.height){
			f.width = pw;
			f.height = ph;
			f.paint();
		}
		sizeOrbitCanvas(f, w, h);
	});
	placeMarker();
	drawOrbit();
}

// ---- Showing one figure or both ----

// Show and hide the figures as settings.show says (without redrawing).
var applyShow = function(){
	[mandelbrot, julia].forEach(function(f){
		var shown = figureShown(f);
		byId(f.type).closest("figure").hidden = !shown;
		byId(f.prefix + "_panel").classList.toggle("muted", !shown);
		byId(f === mandelbrot ? "save_m" : "save_j").disabled = !shown;
		var button = byId(f.prefix + "_hide");
		button.textContent = settings.show === "both" ? "Hide" : "Show both";
		button.title = settings.show === "both" ? "Hide this figure; the other one takes all the room"
		                                        : "Show both figures again";
	});
	byId("show").value = settings.show;
}

var setShow = function(show){
	settings.show = show;
	if (show !== "both" && orbit.f && !figureShown(orbit.f)) { hideOrbit(); }
	applyShow();
	layout();
	build();
}

// The button in the corner of a figure: hide it, or show both again.
var toggleFigure = function(f){
	setShow(settings.show === "both" ? (f === mandelbrot ? "julia" : "mandelbrot") : "both");
}

// ---- Keys ----

// Keys that move a figure: [figure, dx, dy].
var KEYS = {
	87: [mandelbrot, 0, 1], 65: [mandelbrot, -1, 0], 83: [mandelbrot, 0, -1], 68: [mandelbrot, 1, 0],   // W A S D
	38: [julia, 0, 1], 37: [julia, -1, 0], 40: [julia, 0, -1], 39: [julia, 1, 0]                        // arrows
}

var button_press = function(e){
	// Don't hijack keys while the user is typing in a field or using a control.
	var tag = e.target.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") { return; }
	if (e.ctrlKey || e.metaKey || e.altKey) { return; }
	if (e.keyCode == 79) {   // O: the orbit
		e.preventDefault();
		if (!e.repeat) { setOrbitOn(!orbit.on); }
	}
	else if (e.keyCode == 75) {   // K: keep c (or free it)
		e.preventDefault();
		if (!e.repeat) { julia.set_blocked(!julia.blocked); placeMarker(); }
	}
	else if (KEYS[e.keyCode]) {
		e.preventDefault();
		var k = KEYS[e.keyCode];
		move(k[0], k[1], k[2]);
	}
}

// ---- Settings ----

// Read an integer from an input; returns null (and flags the field) if it is
// not a whole number inside [min, max].
var read_int = function(input, min, max){
	var text = input.value.trim();
	var value = Number(text);
	var ok = text !== "" && Number.isInteger(value) && value >= min && value <= max;
	input.classList.toggle("invalid", !ok);
	input.title = ok ? "The exponent n in zⁿ + c" : "Enter a whole number from " + min + " to " + max;
	return ok ? value : null;
}

var change_power = function(){
	var value = read_int(byId("power"), POWER_MIN, POWER_MAX);
	if (value === null) { return; }
	settings.power = value;
	build();
}

// A formula from the list: both figures go back to its starting views.
var change_formula = function(){
	settings.formula = byId("formula").value;
	var formula = currentFormula();
	[mandelbrot, julia].forEach(function(f){
		var home = homeView(f);
		f.cx = home[0]; f.cy = home[1]; f.span = home[2];
		setIterations(f);
	});
	if (formula.def.julia_c){
		julia.set_blocked(false);
		julia.c = formula.def.julia_c.slice();
	}
	hideOrbit();
	showSettings();
	build();
}

// The p of the Phoenix formula.
var change_p = function(){
	var re = byId("p_re"), im = byId("p_im");
	var a = parseFloat(re.value), b = parseFloat(im.value);
	re.classList.toggle("invalid", !isFinite(a));
	im.classList.toggle("invalid", !isFinite(b));
	if (isFinite(a) && isFinite(b)){
		settings.p = [a, b];
		build();
	}
}

// A typed formula, or its starting point: drawn as soon as it makes sense.
var change_custom = function(){
	settings.custom = { expr: byId("custom_expr").value, start: byId("custom_start").value };
	showFormulaError();
	if (!currentFormula().error) { build(); }
}

var showFormulaError = function(){
	var formula = currentFormula();
	byId("formula_error").textContent = formula.error || formula.warning || "";
	byId("custom_expr").classList.toggle("invalid", !!formula.error);
	byId("power").disabled = !formula.power;
	byId("power").title = formula.power ? "The exponent n" : "This formula has no power n";
	document.querySelectorAll("button.step").forEach(function(b){ b.disabled = !formula.power; });
}

var change_palette = function(){
	settings.palette = parseInt(byId("palette").value, 10);
	try { localStorage.setItem(PALETTE_KEY, String(settings.palette)); } catch (e) { /* not kept: fine */ }
	build();
}

// Shading: "smooth", "bands" or "lines".
var setShading = function(shading){
	settings.smooth = shading !== "bands";
	settings.lines = shading === "lines";
}

var shadingName = function(){
	return settings.lines ? "lines" : (settings.smooth ? "smooth" : "bands");
}

var change_smooth = function(){
	setShading(byId("shading").value);
	build();
}

var setupLists = function(){
	var select = byId("palette");
	PALETTES.forEach(function(p, i){
		var option = document.createElement("option");
		option.value = i;
		option.textContent = p.name;
		select.appendChild(option);
	});
	var saved = null;
	try { saved = parseInt(localStorage.getItem(PALETTE_KEY), 10); } catch (e) { saved = null; }
	settings.palette = PALETTES[saved] ? saved : 0;

	var list = byId("formula");
	FORMULAS.forEach(function(item){
		var option = document.createElement("option");
		option.value = item.id;
		option.textContent = item.name;
		list.appendChild(option);
	});

	var famous = byId("famous");
	FAMOUS.forEach(function(item, i){
		var option = document.createElement("option");
		option.value = i;
		option.textContent = item.name;
		famous.appendChild(option);
	});
}

// Show the settings in the panel.
var showSettings = function(){
	byId("power").value = settings.power;
	byId("power").classList.remove("invalid");
	byId("palette").value = String(settings.palette);
	byId("shading").value = shadingName();
	applyShow();
	var id = settings.formula;
	byId("formula").value = id;
	byId("row_p").hidden = id !== "phoenix";
	byId("p_re").value = settings.p[0];
	byId("p_im").value = settings.p[1];
	["row_expr", "row_start", "custom_help"].forEach(function(row){ byId(row).hidden = id !== "custom"; });
	byId("custom_expr").value = settings.custom.expr;
	byId("custom_start").value = settings.custom.start;
	showFormulaError();
}

// ---- Links: the address remembers the figures ----

// p = power, k = colours, s = 0 for bands or l for ink lines, v = m or j when
// only Fig. 1 or Fig. 2 is shown, m and j = centre and span
// of each figure, c = the point c; f = formula (when not z^n + c), with
// fp = its p (Phoenix), fe and fs = a typed formula and its start. Opening a
// link keeps its c, so that moving the pointer onto the page does not lose it.
var encodeState = function(){
	var view = function(f){
		var d = decimalsFor(region(f).step);
		return [plain(f.cx, d), plain(f.cy, d), String(+f.span.toPrecision(6))].join(",");
	};
	var dc = decimalsFor(region(mandelbrot).step);
	var id = settings.formula;
	var formula = id === "classic" ? "" : "&f=" + id +
		(id === "phoenix" ? "&fp=" + settings.p[0] + "," + settings.p[1] : "") +
		(id === "custom" ? "&fe=" + encodeURIComponent(settings.custom.expr) +
		                   "&fs=" + encodeURIComponent(settings.custom.start) : "");
	return "#p=" + settings.power + formula +
		"&k=" + settings.palette +
		(settings.lines ? "&s=l" : (settings.smooth ? "" : "&s=0")) +
		(settings.show === "both" ? "" : "&v=" + (settings.show === "mandelbrot" ? "m" : "j")) +
		"&m=" + view(mandelbrot) +
		"&j=" + view(julia) +
		"&c=" + plain(julia.c[0], dc) + "," + plain(julia.c[1], dc);
}

// Apply a link; returns false if it describes nothing.
var applyState = function(hash){
	var text = hash.replace(/^#/, "");
	if (!text) { return false; }
	var numbers = function(value, count){
		var list = value.split(",").map(parseFloat);
		return list.length === count && list.every(isFinite) ? list : null;
	};
	var found = false;
	text.split("&").forEach(function(part){
		var i = part.indexOf("="), key = part.slice(0, i), value = part.slice(i + 1);
		if (i < 0) { return; }
		var v;
		if (key === "p"){
			v = parseInt(value, 10);
			if (v >= POWER_MIN && v <= POWER_MAX) { settings.power = v; found = true; }
		} else if (key === "k"){
			v = parseInt(value, 10);
			if (PALETTES[v]) { settings.palette = v; found = true; }
		} else if (key === "v"){
			settings.show = value === "m" ? "mandelbrot" : (value === "j" ? "julia" : "both"); found = true;
		} else if (key === "f"){
			if (formulaById(value).id === value) { settings.formula = value; found = true; }
		} else if (key === "fp"){
			v = numbers(value, 2);
			if (v) { settings.p = v; }
		} else if (key === "fe" || key === "fs"){
			try { v = decodeURIComponent(value); } catch (e) { v = null; }
			if (v !== null){
				settings.custom = { expr: key === "fe" ? v : settings.custom.expr,
				                    start: key === "fs" ? v : settings.custom.start };
			}
		} else if (key === "s"){
			setShading(value === "0" ? "bands" : (value === "l" ? "lines" : "smooth")); found = true;
		} else if (key === "m" || key === "j"){
			v = numbers(value, 3);
			var f = key === "m" ? mandelbrot : julia;
			if (v && v[2] >= SPAN_MIN && v[2] <= SPAN_MAX){
				f.cx = v[0]; f.cy = v[1]; f.span = v[2];
				setIterations(f);
				found = true;
			}
		} else if (key === "c"){
			v = numbers(value, 2);
			if (v) { julia.c = v; julia.set_blocked(true); found = true; }
		}
	});
	// A link without a formula is about z^n + c, and shows both figures.
	if (found && !/(^|&)f=/.test(text)) { settings.formula = "classic"; }
	if (found && !/(^|&)v=/.test(text)) { settings.show = "both"; }
	return found;
}

// History: Back and Forward go through the views explored. A change after
// a pause starts a new history entry; changes in quick succession (a turn of
// the wheel, a drag, the next turn soon after) update the same entry. Only
// c changing (the pointer moving over Fig. 1) never makes a new entry.
var HISTORY_PAUSE = 1200;   // ms

var saved_hash = "";
var save_timer = null;
var entry_key = null;       // the current entry, without c
var entry_time = 0;         // when it was last written
var restoring = false;      // the figures come from Back/Forward: do not add an entry

var withoutC = function(hash){
	return hash.replace(/&c=[^&]*/, "");
}

var saveStateNow = function(){
	clearTimeout(save_timer);
	var hash = encodeState(), key = withoutC(hash), now = Date.now();
	saved_hash = hash;
	applied_hash = null;
	var push = !restoring && entry_key !== null && key !== entry_key && now - entry_time > HISTORY_PAUSE;
	// The first view of the page keeps its own entry, however soon the next change comes.
	var first = entry_key === null;
	entry_key = key;
	entry_time = first ? 0 : now;
	restoring = false;
	if (current_place && current_place.key === null) { current_place.key = key; }
	showPlace();
	if (location.hash === hash) { return; }
	try {
		if (push) { history.pushState(null, "", hash); }
		else { history.replaceState(null, "", hash); }
	} catch (e) {
		location.hash = hash;
	}
}

// Keep the address in step with the figures, a moment after they change.
var saveStateSoon = function(){
	clearTimeout(save_timer);
	save_timer = setTimeout(saveStateNow, 300);
}

// The address was edited by hand, or the browser went back or forward.
// (Both "hashchange" and "popstate" may report it: the second is ignored.)
var applied_hash = null;

var onHashChange = function(){
	if (location.hash === saved_hash || location.hash === applied_hash) { return; }
	applied_hash = location.hash;
	if (applyState(location.hash)){
		restoring = true;
		hideOrbit();
		showSettings();
		build();
	}
}

// ---- Saving ----

var download = function(blob, name){
	var url = URL.createObjectURL(blob);
	var a = document.createElement("a");
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}

var note = function(text){
	byId("save_note").textContent = text;
}

// Largest picture drawn for saving, in pixels (about 160 MB while it is made).
var PICTURE_MAX_PIXELS = 40e6;

// A figure as a picture (without the mark of c or the orbit): as on the
// screen, or drawn again two or four times as large, in the background.
var savePicture = function(f){
	var scale = parseInt(byId("picture_size").value, 10) || 1;
	while (scale > 1 && f.width * f.height * scale * scale > PICTURE_MAX_PIXELS) { scale /= 2; }
	var name = (f === julia
		? "julia c=" + plain(julia.c[0], 4) + (julia.c[1] < 0 ? "" : "+") + plain(julia.c[1], 4) + "i"
		: currentFormula().def.short.toLowerCase().replace(/ /g, "-")) +
		(scale > 1 ? " " + scale + "x" : "") + ".png";
	var finish = function(canvas){
		canvas.toBlob(function(blob){
			if (blob) { download(blob, name); note("Saved \u201c" + name + "\u201d (" + canvas.width + " \u00d7 " + canvas.height + ")."); }
			else { note("This browser could not save the picture."); }
		}, "image/png");
	};
	if (scale === 1) { finish(byId(f.type)); return; }

	var params = viewParams(f);   // the same view, with smaller pixels
	params.width = f.width * scale;
	params.height = f.height * scale;
	params.lineScale = f.dpr * scale;
	var canvas = document.createElement("canvas");
	note("Drawing a picture of " + params.width + " \u00d7 " + params.height + "\u2026");
	Renderer.render("picture_" + f.type, canvas, params, function(){ finish(canvas); });
}

var copyLink = function(){
	saveStateNow();
	var url = location.href;
	var fallback = function(){
		var field = document.createElement("textarea");
		field.value = url;
		document.body.appendChild(field);
		field.select();
		var ok = false;
		try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
		field.remove();
		note(ok ? "Link copied." : "Copy the address from the address bar.");
	};
	if (navigator.clipboard && navigator.clipboard.writeText){
		navigator.clipboard.writeText(url).then(function(){ note("Link copied."); }, fallback);
	} else {
		fallback();
	}
}

// ---- Places: places worth seeing, and favourites kept in this browser ----

var FAVOURITES_KEY = "mandelbrot-julia.favourites";

// Links without colours and shading, so that those stay as they are.
var PLACES = [
	{ name: "Seahorse Valley",       link: "#p=2&m=-0.7453,0.1127,0.012&j=0,0,3.2&c=-0.7453,0.1127" },
	{ name: "Elephant Valley",       link: "#p=2&m=0.2925,0.0149,0.012&j=0,0,3.2&c=0.2925,0.0149" },
	{ name: "Triple-spiral Valley",  link: "#p=2&m=-0.088,0.654,0.012&j=0,0,3.2&c=-0.088,0.654" },
	{ name: "A mini Mandelbrot set", link: "#p=2&m=-1.7549,0,0.04&j=0,0,3.4&c=-1.7549,0" },
	{ name: "The little Burning Ship", link: "#p=2&f=ship&m=-1.762,0.028,0.09&j=0,0,4&c=-1.762,0.028" }
];

// Keep the well-formed entries only: a list may come from a file, or from a
// store edited by hand. An entry is {name, link}.
var cleanFavourites = function(list){
	if (!Array.isArray(list)) { return []; }
	return list.filter(function(item){
		return item && typeof item.name === "string" && item.name.trim() &&
			typeof item.link === "string" && item.link.charAt(0) === "#" && item.link.length < 4000;
	}).map(function(item){
		return { name: item.name.trim().slice(0, 40), link: item.link };
	});
}

var loadFavourites = function(){
	try { return cleanFavourites(JSON.parse(localStorage.getItem(FAVOURITES_KEY))); }
	catch (e) { return []; }
}

// Returns false when the browser refuses to store (private mode, storage full...).
var storeFavourites = function(list){
	try { localStorage.setItem(FAVOURITES_KEY, JSON.stringify(list)); return true; }
	catch (e) { return false; }
}

// The entry last picked (or saved): {kind: "p" | "f", index, name, key}.
// The list shows it while the figures are unchanged (key: the address without c).
var current_place = null;

var renderPlaces = function(message){
	var list = loadFavourites();
	var select = byId("places");
	select.innerHTML = "";
	var title = document.createElement("option");
	title.value = "";
	title.textContent = "Go to a place\u2026";
	select.appendChild(title);
	var group = function(label, items, prefix){
		var g = document.createElement("optgroup");
		g.label = label;
		items.forEach(function(item, i){
			var option = document.createElement("option");
			option.value = prefix + i;
			option.textContent = item.name;
			g.appendChild(option);
		});
		select.appendChild(g);
	};
	group("Places worth seeing", PLACES, "p:");
	if (list.length) { group("Your favourites", list, "f:"); }
	// A picked favourite may have moved in the list, or been deleted.
	if (current_place && current_place.kind === "f"){
		var found = -1;
		list.forEach(function(item, i){ if (item.name === current_place.name) { found = i; } });
		if (found < 0) { current_place = null; } else { current_place.index = found; }
	}
	showPlace();
	byId("favourites_note").textContent = message ||
		(list.length ? "" : "Save what the figures show under a name: it is kept in this browser.");
}

// Show the picked place in the list while the figures still show it.
var showPlace = function(){
	var select = byId("places");
	var on = current_place && (current_place.key === null || current_place.key === withoutC(saved_hash));
	select.value = on ? current_place.kind + ":" + current_place.index : "";
	byId("deleteFavourite").hidden = !(on && current_place.kind === "f");
}

var goToPlace = function(){
	var value = byId("places").value;
	var kind = value.slice(0, 1), index = parseInt(value.slice(2), 10);
	var item = kind === "p" ? PLACES[index] : loadFavourites()[index];
	if (!item){ showPlace(); return; }
	if (applyState(item.link)){
		current_place = { kind: kind, index: index, name: item.name, key: null };
		entry_time = 0;   // a jump: always a new step in the history
		hideOrbit();
		showSettings();
		build();
	}
}

var saveFavourite = function(){
	var list = loadFavourites();
	var field = byId("favourite_name");
	var name = field.value.trim();
	if (!name){
		var taken = list.map(function(item){ return item.name; });
		var number = list.length + 1;
		while (taken.indexOf("Place " + number) >= 0) { number++; }
		name = "Place " + number;
	}
	saveStateNow();
	var entry = { name: name, link: saved_hash };
	var replaced = false;
	list.forEach(function(item, i){ if (item.name === name) { list[i] = entry; replaced = true; } });
	if (!replaced) { list.push(entry); }
	if (storeFavourites(list)){
		field.value = "";
		current_place = { kind: "f", index: 0, name: name, key: withoutC(saved_hash) };
		renderPlaces((replaced ? "Replaced" : "Saved as") + " \u201c" + name + "\u201d.");
	} else {
		renderPlaces("This browser did not allow the place to be saved.");
	}
}

var deleteFavourite = function(){
	if (!current_place || current_place.kind !== "f") { return; }
	var name = current_place.name;
	if (!confirm("Delete the favourite \u201c" + name + "\u201d?")) { return; }
	var list = loadFavourites().filter(function(item){ return item.name !== name; });
	current_place = null;
	renderPlaces(storeFavourites(list) ? "Deleted \u201c" + name + "\u201d."
	                                   : "This browser did not allow the favourite to be deleted.");
}

var saveFavouritesFile = function(){
	var list = loadFavourites();
	if (!list.length) { renderPlaces("There are no favourites to save yet."); return; }
	var text = JSON.stringify({ app: "mandelbrot-julia", favourites: list }, null, 2);
	download(new Blob([text], { type: "application/json" }), "mandelbrot-julia-favourites.json");
}

// Add the favourites of a file to the list; the same names are replaced.
var loadFavouritesFile = function(file){
	var reader = new FileReader();
	reader.onload = function(){
		var data = null;
		try { data = JSON.parse(reader.result); } catch (e) { data = null; }
		var incoming = cleanFavourites(data && data.favourites ? data.favourites : data);
		if (!incoming.length) { renderPlaces("That file holds no favourites."); return; }
		var list = loadFavourites();
		incoming.forEach(function(entry){
			var at = -1;
			list.forEach(function(item, i){ if (item.name === entry.name) { at = i; } });
			if (at >= 0) { list[at] = entry; } else { list.push(entry); }
		});
		renderPlaces(storeFavourites(list)
			? incoming.length + (incoming.length === 1 ? " favourite" : " favourites") + " loaded."
			: "This browser did not allow the favourites to be saved.");
	};
	reader.onerror = function(){ renderPlaces("That file could not be read."); };
	reader.readAsText(file);
}

// ---- Events ----

var on = function(id, type, handler){
	byId(id).addEventListener(type, handler);
}

var setupEvents = function(){
	setupDrag(mandelbrot);
	setupDrag(julia);
	byId("mandelbrot").addEventListener("wheel", function(e){ wheelZoom(mandelbrot, e); }, { passive: false });
	byId("julia").addEventListener("wheel", function(e){ wheelZoom(julia, e); }, { passive: false });

	// While a mouse points at Fig. 1 (and c follows it), the mark of c is hidden.
	var plate = byId("mandelbrot").parentNode;
	plate.addEventListener("pointerenter", function(e){
		if (e.pointerType === "mouse") { plate.classList.add("pointing"); placeMarker(); }
	});
	plate.addEventListener("pointerleave", function(){ plate.classList.remove("pointing"); placeMarker(); });

	on("reset", "click", function(){ mandelbrot.reset(); julia.reset(); });
	on("reset_m", "click", mandelbrot.reset);
	on("reset_j", "click", julia.reset);
	on("zoom_in_m", "click", function(){ zoom_centre(mandelbrot, 2); });
	on("zoom_out_m", "click", function(){ zoom_centre(mandelbrot, 1 / 2); });
	on("zoom_in_j", "click", function(){ zoom_centre(julia, 2); });
	on("zoom_out_j", "click", function(){ zoom_centre(julia, 1 / 2); });
	on("orbit", "change", function(){ setOrbitOn(byId("orbit").checked); });
	// A mouse leaving a figure takes its orbit away (a tapped one stays).
	["mandelbrot", "julia"].forEach(function(id){
		byId(id).addEventListener("pointerleave", function(e){
			if (e.pointerType === "mouse" && orbit.f && orbit.f.type === id) { hideOrbit(); }
		});
	});
	on("freeze", "change", function(){ julia.set_blocked(byId("freeze").checked); placeMarker(); });
	on("c_re", "input", readCFields);
	on("c_im", "input", readCFields);
	on("famous", "change", chooseFamous);
	on("power", "input", change_power);
	on("palette", "change", change_palette);
	on("shading", "change", change_smooth);
	on("show", "change", function(){ setShow(byId("show").value); });
	on("m_hide", "click", function(){ toggleFigure(mandelbrot); });
	on("j_hide", "click", function(){ toggleFigure(julia); });
	on("formula", "change", change_formula);
	on("p_re", "input", change_p);
	on("p_im", "input", change_p);
	on("custom_expr", "input", change_custom);
	on("custom_start", "input", change_custom);
	on("save_m", "click", function(){ savePicture(mandelbrot); });
	on("save_j", "click", function(){ savePicture(julia); });
	on("copy_link", "click", copyLink);
	on("places", "change", goToPlace);
	on("deleteFavourite", "click", deleteFavourite);
	on("saveFavourite", "click", saveFavourite);
	on("favourite_name", "keydown", function(e){ if (e.key === "Enter") { saveFavourite(); } });
	on("favouritesToFile", "click", saveFavouritesFile);
	on("favouritesFromFile", "click", function(){ byId("favourites_file").click(); });
	on("favourites_file", "change", function(e){
		if (e.target.files.length) { loadFavouritesFile(e.target.files[0]); }
		e.target.value = "";   // so that the same file can be chosen again
	});
	document.addEventListener("keydown", button_press);
	window.addEventListener("hashchange", onHashChange);
	window.addEventListener("popstate", onHashChange);

	// − / + buttons: step a number field by one, within its limits.
	document.querySelectorAll("button.step").forEach(function(button){
		button.addEventListener("click", function(){
			var input = byId(button.getAttribute("data-target"));
			var current = parseInt(input.value, 10);
			if (!isFinite(current)) { current = settings.power; }
			var next = current + parseInt(button.getAttribute("data-step"), 10);
			input.value = Math.min(POWER_MAX, Math.max(POWER_MIN, next));
			change_power();
		});
	});
}

document.addEventListener("DOMContentLoaded", function(){
	setupLists();
	renderPlaces();
	// Start from the link if it describes the figures.
	applyState(location.hash);
	showSettings();
	setupEvents();
	layout();
	build();
	// Redraw at the new size whenever the room for the figures changes.
	if (window.ResizeObserver) {
		new ResizeObserver(layout).observe(byId("figures"));
	} else {
		window.addEventListener("resize", layout);
	}
});
