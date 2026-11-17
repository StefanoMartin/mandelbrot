var POWER_MIN = 1, POWER_MAX = 10;
var PALETTE_KEY = "mandelbrot-julia.palette";

var byId = function(id){
	return document.getElementById(id);
}

// ---- Numbers as they are shown in the panel ----

// Two decimals, with a true minus sign.
var formatNumber = function(n){
	var r = Math.round(n * 100) / 100;
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
	var im = Math.round(c[1] * 100) / 100;
	return formatNumber(c[0]) + (im < 0 ? " − " : " + ") + formatNumber(Math.abs(im)) + "<i>i</i>";
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
		power: f.power, maxIter: f.iteration,
		cr: f.c ? f.c[0] : 0, ci: f.c ? f.c[1] : 0,
		colours: paletteFor(f.palette, f.type)
	};
}

// The panel readout of a figure.
var showView = function(f){
	var r = region(f), id = function(name){ return byId(f.prefix + "_" + name); };
	id("power").textContent = f.power;
	id("real").textContent = formatRange([r.x0, r.x1]);
	id("imag").textContent = formatRange([r.bottom, r.top]);
	id("zoom").textContent = formatZoom(f.span);
	id("iter").textContent = f.iteration;
}

// ---- Drawing ----

var build = function(){
	mandelbrot.paint();
	julia.paint();
}

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

// Choose c from the point under the pointer on Fig. 1 (unless it is kept).
var create_julia = function(e){
	if (julia.blocked) { return; }
	julia.c = getPoint(e);
	julia.paint();
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

var getPoint = function(e){
	return canvasPoint(byId("mandelbrot"), mandelbrot, e);
}

var getPointJulia = function(e){
	return canvasPoint(byId("julia"), julia, e);
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
}

var reset_fractals = function(){
	mandelbrot.reset();
	julia.reset();
}

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
		if (!e.repeat) { julia.set_blocked(!julia.blocked); }
	}
	else if (KEYS[e.keyCode]) {
		e.preventDefault();
		var k = KEYS[e.keyCode];
		move(k[0], k[1], k[2]);
	}
}

// Read an integer from an input; returns null (and flags the field) if it is
// not a whole number inside [min, max].
var read_int = function(input, min, max){
	let text = input.value.trim();
	let value = Number(text);
	let ok = text !== "" && Number.isInteger(value) && value >= min && value <= max;
	input.classList.toggle("invalid", !ok);
	input.title = ok ? "The exponent n in zⁿ + c" : "Enter a whole number from " + min + " to " + max;
	return ok ? value : null;
}

var change_power = function(){
	let value = read_int(byId("power"), POWER_MIN, POWER_MAX);
	if (value === null) { return; }
	mandelbrot.power = value;
	julia.power = value;
	build();
}

var change_palette = function(){
	let index = parseInt(byId("palette").value, 10);
	mandelbrot.palette = julia.palette = index;
	try { localStorage.setItem(PALETTE_KEY, String(index)); } catch (e) { /* not kept: fine */ }
	build();
}

var setupPalettes = function(){
	var select = byId("palette");
	PALETTES.forEach(function(p, i){
		var option = document.createElement("option");
		option.value = i;
		option.textContent = p.name;
		select.appendChild(option);
	});
	var saved = null;
	try { saved = parseInt(localStorage.getItem(PALETTE_KEY), 10); } catch (e) { saved = null; }
	var index = PALETTES[saved] ? saved : 0;
	select.value = String(index);
	mandelbrot.palette = julia.palette = index;
}

var on = function(id, type, handler){
	byId(id).addEventListener(type, handler);
}

var setupEvents = function(){
	setupDrag(mandelbrot);
	setupDrag(julia);
	byId("mandelbrot").addEventListener("wheel", function(e){ wheelZoom(mandelbrot, e); }, { passive: false });
	byId("julia").addEventListener("wheel", function(e){ wheelZoom(julia, e); }, { passive: false });
	on("reset", "click", reset_fractals);
	on("reset_m", "click", mandelbrot.reset);
	on("reset_j", "click", julia.reset);
	on("zoom_in_m", "click", function(){ zoom_centre(mandelbrot, 2); });
	on("zoom_out_m", "click", function(){ zoom_centre(mandelbrot, 1 / 2); });
	on("zoom_in_j", "click", function(){ zoom_centre(julia, 2); });
	on("zoom_out_j", "click", function(){ zoom_centre(julia, 1 / 2); });
	on("freeze", "change", function(){ julia.set_blocked(byId("freeze").checked); });
	on("power", "input", change_power);
	on("palette", "change", change_palette);
	document.addEventListener("keydown", button_press);

	// − / + buttons: step a number field by one, within its limits.
	document.querySelectorAll("button.step").forEach(function(button){
		button.addEventListener("click", function(){
			var input = byId(button.getAttribute("data-target"));
			var current = parseInt(input.value, 10);
			if (!isFinite(current)) { current = mandelbrot.power; }
			var next = current + parseInt(button.getAttribute("data-step"), 10);
			input.value = Math.min(POWER_MAX, Math.max(POWER_MIN, next));
			change_power();
		});
	});
}

document.addEventListener("DOMContentLoaded", function(){
	setupPalettes();
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
