// The views of the figures: what they show, zooming, moving, dragging,
// and how they share the room beside the panel.

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
