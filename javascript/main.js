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

// Magnification compared with the starting view (span 4).
var formatZoom = function(span){
	var zoom = 4 / span;
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
	return {
		type: f.type, width: f.width, height: f.height,
		// The kernel counts rows downwards: row j is at imaginary part -(y0 + j * step).
		x0: r.x0, x1: r.x1, y0: -r.top, y1: -r.bottom,
		power: settings.power, maxIter: f.iteration,
		cr: f.c ? f.c[0] : 0, ci: f.c ? f.c[1] : 0,
		colours: paletteFor(settings.palette, f.type),
		smooth: settings.smooth
	};
}

// The panel readout of a figure.
var showView = function(f){
	var r = region(f), id = function(name){ return byId(f.prefix + "_" + name); };
	id("power").textContent = settings.power;
	id("real").textContent = formatRange([r.x0, r.x1]);
	id("imag").textContent = formatRange([r.bottom, r.top]);
	id("zoom").textContent = formatZoom(f.span);
	id("iter").textContent = f.iteration;
}

var build = function(){
	mandelbrot.paint();
	julia.paint();
}

// ---- Zooming and moving ----

// Farthest out and deepest in. Below about 1e-13 the pixels would be
// closer together than double-precision numbers can tell apart.
var SPAN_MAX = 16, SPAN_MIN = 1e-13;

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
	var zoom = 4 / f.span;
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
	var decimals = decimalsFor(region(mandelbrot).step);
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
		if (settings.power === 2 && item.c[0] === c[0] && item.c[1] === c[1]) { match = String(i); }
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
	if (settings.power !== 2){   // the names belong to z^2 + c
		settings.power = 2;
		byId("power").value = 2;
		byId("power").classList.remove("invalid");
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
			if (f === mandelbrot && e.pointerType === "mouse" && !drag) { create_julia(e); }
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
		if (!drag.moved && e.type === "pointerup" && f === mandelbrot) { create_julia(e); }
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
		if (pw !== f.width || ph !== f.height){
			f.width = pw;
			f.height = ph;
			f.paint();
		}
	});
	placeMarker();
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
	if (e.keyCode == 32) {
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

var change_palette = function(){
	settings.palette = parseInt(byId("palette").value, 10);
	try { localStorage.setItem(PALETTE_KEY, String(settings.palette)); } catch (e) { /* not kept: fine */ }
	build();
}

var change_smooth = function(){
	settings.smooth = byId("smooth").checked;
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
	byId("smooth").checked = settings.smooth;
}

// ---- Links: the address remembers the figures ----

// p = power, k = colours, s = 0 for banded shading, m and j = centre and span
// of each figure, c = the point c. Opening a link keeps its c, so that moving
// the pointer onto the page does not lose it.
var encodeState = function(){
	var view = function(f){
		var d = decimalsFor(region(f).step);
		return [plain(f.cx, d), plain(f.cy, d), String(+f.span.toPrecision(6))].join(",");
	};
	var dc = decimalsFor(region(mandelbrot).step);
	return "#p=" + settings.power +
		"&k=" + settings.palette +
		(settings.smooth ? "" : "&s=0") +
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
		} else if (key === "s"){
			settings.smooth = value !== "0"; found = true;
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
	return found;
}

var saved_hash = "";
var save_timer = null;

var saveStateNow = function(){
	clearTimeout(save_timer);
	var hash = encodeState();
	saved_hash = hash;
	if (location.hash === hash) { return; }
	try { history.replaceState(null, "", hash); } catch (e) { location.hash = hash; }
}

// Keep the address in step with the figures, a moment after they change.
var saveStateSoon = function(){
	clearTimeout(save_timer);
	save_timer = setTimeout(saveStateNow, 300);
}

// The address was edited by hand, or the browser went back or forward.
var onHashChange = function(){
	if (location.hash === saved_hash) { return; }
	if (applyState(location.hash)){
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

// A figure as it is drawn, at full resolution (without the mark of c).
var savePicture = function(f){
	var name = f === julia
		? "julia c=" + plain(julia.c[0], 4) + (julia.c[1] < 0 ? "" : "+") + plain(julia.c[1], 4) + "i.png"
		: "mandelbrot.png";
	byId(f.type).toBlob(function(blob){
		if (blob) { download(blob, name); note("Saved “" + name + "”."); }
		else { note("This browser could not save the picture."); }
	}, "image/png");
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
	on("freeze", "change", function(){ julia.set_blocked(byId("freeze").checked); placeMarker(); });
	on("c_re", "input", readCFields);
	on("c_im", "input", readCFields);
	on("famous", "change", chooseFamous);
	on("power", "input", change_power);
	on("palette", "change", change_palette);
	on("smooth", "change", change_smooth);
	on("save_m", "click", function(){ savePicture(mandelbrot); });
	on("save_j", "click", function(){ savePicture(julia); });
	on("copy_link", "click", copyLink);
	document.addEventListener("keydown", button_press);
	window.addEventListener("hashchange", onHashChange);

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
