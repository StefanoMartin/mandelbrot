// The address describes the figures (links and bookmarks), and Back and
// Forward go through the views explored.

// ---- Links: the address remembers the figures ----

// p = power, k = colours, s = 0 for bands, l for ink lines or r for relief,
// i = p when the inside is coloured by cycle, v = m or j when
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
		(settings.lines ? "&s=l" : (settings.relief ? "&s=r" : (settings.smooth ? "" : "&s=0"))) +
		(settings.inside === "period" ? "&i=p" : "") +
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
			setShading(value === "0" ? "bands" : (value === "l" ? "lines" : (value === "r" ? "relief" : "smooth"))); found = true;
		} else if (key === "i"){
			settings.inside = value === "p" ? "period" : "plain"; found = true;
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
	if (found && !/(^|&)i=/.test(text)) { settings.inside = "plain"; }
	if (found && !/(^|&)s=/.test(text)) { setShading("smooth"); }
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
