var POWER_MIN = 1, POWER_MAX = 10;
var SIZE_MIN = 50, SIZE_MAX = 1500;

var build = function(){
	mandelbrot.paint();
	julia.paint();
}

// Zoom in 5x around point p and raise the iteration limit.
var zoom_in = function(fractal, p){
	let half = (fractal.x[1] - fractal.x[0]) / 10;
	fractal.x = [p[0] - half, p[0] + half];
	fractal.y = [-p[1] - half, -p[1] + half];
	fractal.iteration += 100;
	fractal.paint();
}

// Zoom out 5x around the current centre and lower the iteration limit.
var zoom_out = function(fractal){
	let cx = (fractal.x[0] + fractal.x[1]) / 2;
	let cy = (fractal.y[0] + fractal.y[1]) / 2;
	let half_x = (fractal.x[1] - fractal.x[0]) * 2.5;
	let half_y = (fractal.y[1] - fractal.y[0]) * 2.5;
	fractal.x = [cx - half_x, cx + half_x];
	fractal.y = [cy - half_y, cy + half_y];
	fractal.iteration = Math.max(100, fractal.iteration - 100);
	fractal.paint();
}

var zoom_mandelbrot = function(e){
	e.preventDefault();
	zoom_in(mandelbrot, getPoint(e));
}

var zoom_out_mandelbrot = function(e){
	if (e) { e.preventDefault(); }
	zoom_out(mandelbrot);
}

var zoom_julia = function(e){
	e.preventDefault();
	zoom_in(julia, getPointJulia(e));
}

var zoom_out_julia = function(e){
	if (e) { e.preventDefault(); }
	zoom_out(julia);
}

var create_julia = function(e){
	if (julia.blocked) { return; }
	julia.c = getPoint(e);
	julia.paint();
}

var canvasPoint = function(canvas, fractal, e){
	let rect = canvas.getBoundingClientRect();
	// Scale for the case where the canvas is displayed at a different size
	// than its pixel resolution.
	let px = (e.clientX - rect.left) * canvas.width / rect.width;
	let py = (e.clientY - rect.top) * canvas.height / rect.height;
	let x = px * (fractal.x[1] - fractal.x[0]) / canvas.width + fractal.x[0];
	let y = -(py * (fractal.y[1] - fractal.y[0]) / canvas.height + fractal.y[0]);
	return [x, y];
}

var getPoint = function(e){
	return canvasPoint($("#mandelbrot")[0], mandelbrot, e);
}

var getPointJulia = function(e){
	return canvasPoint($("#julia")[0], julia, e);
}

var reset_fractals = function(e){
	if (e) { e.preventDefault(); }
	mandelbrot.reset();
	julia.reset();
}

var round = function(number){
	return Math.round(number*100)/100;
}

var button_press = function(e){
	// Don't hijack keys while the user is typing in an input field.
	if ($(e.target).is("input, textarea, select")) { return; }
	if (e.keyCode == 32) {
		e.preventDefault();
		if (!e.originalEvent.repeat) { unblock_julia(); }
	}
	else if ([87,65,83,68].includes(e.keyCode)) { e.preventDefault(); mandelbrot.move(e.keyCode); }
	else if ([38,37,40,39].includes(e.keyCode)) { e.preventDefault(); julia.move(e.keyCode); }
}

var unblock_julia = function(e){
	if (e) { e.preventDefault(); }
	julia.set_blocked(!julia.blocked);
}

// Read an integer from an input; returns null (and flags the field) if it is
// not a whole number inside [min, max].
var read_int = function(input, min, max){
	let text = input.value.trim();
	let value = Number(text);
	let ok = text !== "" && Number.isInteger(value) && value >= min && value <= max;
	$(input).toggleClass("invalid", !ok);
	input.title = ok ? "" : "Enter a whole number from " + min + " to " + max;
	return ok ? value : null;
}

var change_power = function(eventObject){
	let value = read_int(eventObject.target, POWER_MIN, POWER_MAX);
	if (value === null) { return; }
	mandelbrot.power = value;
	julia.power = value;
	build();
}

var change_size_canvas = function(eventObject){
	let value = read_int(eventObject.target, SIZE_MIN, SIZE_MAX);
	if (value === null) { return; }
	mandelbrot.width = value;
	mandelbrot.height = value;
	julia.width = value;
	julia.height = value;
	build();
}

var clickEvents = function(){
	$("#mandelbrot").on("mousemove", create_julia);
	$("#mandelbrot").on("dblclick", zoom_mandelbrot);
	$("#julia").on("dblclick", zoom_julia);
	$("#reset").on("click", reset_fractals);
	$("#reset_m").on("click", function(e){ e.preventDefault(); mandelbrot.reset(); });
	$("#reset_j").on("click", function(e){ e.preventDefault(); julia.reset(); });
	$("#zoom_out_m").on("click", zoom_out_mandelbrot);
	$("#zoom_out_j").on("click", zoom_out_julia);
	$("#blocking").on("click", unblock_julia);
	$(document).on("keydown", button_press);
	$("body").on("input", "#power", change_power);
	$("body").on("input", "#size_canvas", change_size_canvas);
}

$(document).ready(function(){
	build();
	clickEvents();
});
