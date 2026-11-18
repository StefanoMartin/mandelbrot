// Keyboard shortcuts.

// ---- Keys ----

// Keys that move a figure: [figure, dx, dy].
var KEYS = {
	87: [mandelbrot, 0, 1], 65: [mandelbrot, -1, 0], 83: [mandelbrot, 0, -1], 68: [mandelbrot, 1, 0],   // W A S D
	38: [julia, 0, 1], 37: [julia, -1, 0], 40: [julia, 0, -1], 39: [julia, 1, 0]                        // arrows
}

// Does a key pressed in this element belong to it rather than to the shortcuts?
// Every key does in a field where text is typed; the arrow keys do in a list
// (they choose an entry) and in a number field (they step it). Elsewhere, a
// list or a checkbox just chosen keeps the focus, and the shortcuts still work.
var keyBelongsTo = function(el, e){
	var tag = el.tagName;
	if (tag === "TEXTAREA" || el.isContentEditable) { return true; }
	if (tag === "INPUT"){
		var type = (el.type || "text").toLowerCase();
		if (type === "number") { return e.keyCode >= 37 && e.keyCode <= 40; }
		return ["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].indexOf(type) < 0;
	}
	if (tag === "SELECT") { return e.keyCode >= 37 && e.keyCode <= 40; }
	return false;
}

var button_press = function(e){
	if (e.key === "Escape" && document.body.classList.contains("panel_open")) { openPanel(false); return; }
	if (keyBelongsTo(e.target, e)) { return; }
	if (e.ctrlKey || e.metaKey || e.altKey) { return; }
	if (e.keyCode == 79) {   // O: the orbit
		e.preventDefault();
		if (!e.repeat) { setOrbitOn(!orbit.on); }
	}
	else if (e.keyCode == 75) {   // K: keep c (or free it)
		e.preventDefault();
		if (!e.repeat) { julia.set_blocked(!julia.blocked); placeMarker(); }
	}
	else if (e.keyCode == 81) {   // Q: quick preview while moving
		e.preventDefault();
		if (!e.repeat) { setQuickPreview(!Renderer.previewing()); }
	}
	else if (KEYS[e.keyCode]) {
		e.preventDefault();
		var k = KEYS[e.keyCode];
		move(k[0], k[1], k[2]);
	}
}
