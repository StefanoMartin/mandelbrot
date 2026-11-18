// The Settings section: formula, power, colours, shading, typed formulas.

var POWER_MIN = 1, POWER_MAX = 10;
var PALETTE_KEY = "mandelbrot-julia.palette";
var PREVIEW_KEY = "mandelbrot-julia.preview";

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
	var a = parseDecimal(re.value), b = parseDecimal(im.value);
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

// A formula from the list of examples: typed in, z started automatically,
// and both figures at a view that shows it.
var chooseExample = function(){
	var example = FORMULA_EXAMPLES[byId("examples").value];
	byId("examples").value = "";
	if (!example) { return; }
	settings.custom = { expr: example.expr, start: example.start || "auto" };
	byId("custom_expr").value = settings.custom.expr;
	byId("custom_start").value = settings.custom.start;
	var home = example.home || [0, 0, 4];
	mandelbrot.cx = home[0]; mandelbrot.cy = home[1]; mandelbrot.span = home[2];
	julia.cx = 0; julia.cy = 0; julia.span = 4;
	setIterations(mandelbrot);
	setIterations(julia);
	// For Fig. 2, a c on the edge of the new set, where Julia sets have the
	// most detail: of a grid of points of Fig. 1, the one that escapes last.
	var edge = edgePoint(mandelbrot);
	if (edge) { julia.set_blocked(false); julia.c = edge; }
	hideOrbit();
	showFormulaError();
	build();
}

var edgePoint = function(f){
	var formula = currentFormula(), r = region(f), best = null, slowest = 0, N = 48;
	for (var j = 1; j < N; j++){
		for (var i = 1; i < N; i++){
			var c = [r.x0 + (r.x1 - r.x0) * i / N, r.top - (r.top - r.bottom) * j / N];
			var steps = followOrbit(formula.start, c, settings.power, f.iteration).escaped;
			if (steps > slowest) { slowest = steps; best = c; }
		}
	}
	return best ? [+best[0].toFixed(4), +best[1].toFixed(4)] : null;
}

// The insert buttons: put text in the formula where the cursor is. A function
// or brackets go around the selected text, if any, else the cursor goes
// between the brackets.
var insertIntoFormula = function(what){
	var field = byId("custom_expr");
	var text = field.value;
	var from = field.selectionStart, to = field.selectionEnd;
	if (from === null || from === undefined) { from = to = text.length; }
	var selected = text.slice(from, to), piece, cursor;
	var before = text.charAt(from - 1), after = text.charAt(to);
	if (what === "()" || /^[a-z]{2,}$/.test(what) && what !== "pi"){
		// "c" then sin gives "c sin(", not "csin(".
		var gap = /[a-z0-9.)]/i.test(before) ? " " : "";
		var open = gap + (what === "()" ? "" : what) + "(";
		piece = open + selected + ")";
		cursor = from + (selected ? piece.length : open.length);
	} else {
		// Keep z, c, i and pi apart from the letters around them: "c sin(z)".
		piece = (/[a-z0-9.)]/i.test(before) && what !== "^" ? " " : "") + what +
		        (/[a-z0-9(]/i.test(after) && what !== "^" ? " " : "");
		cursor = from + piece.length;
	}
	field.value = text.slice(0, from) + piece + text.slice(to);
	field.focus();
	field.setSelectionRange(cursor, cursor);
	change_custom();
}

var showFormulaError = function(){
	var formula = currentFormula();
	byId("formula_error").textContent = formula.error || formula.warning || "";
	byId("start_note").innerHTML = settings.formula === "custom" ? (formula.start_note || "") : "";
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

// Quick preview while moving (key Q): on or off, kept for the next visit.
var setQuickPreview = function(on){
	Renderer.setPreview(on);
	byId("quick_preview").checked = !!on;
	try { localStorage.setItem(PREVIEW_KEY, on ? "1" : "0"); } catch (e) { /* not kept: fine */ }
}

// Shading: "smooth", "bands", "lines" or "relief".
var setShading = function(shading){
	settings.smooth = shading !== "bands";
	settings.lines = shading === "lines";
	settings.relief = shading === "relief";
}

var shadingName = function(){
	return settings.lines ? "lines" : (settings.relief ? "relief" : (settings.smooth ? "smooth" : "bands"));
}

// Inside: "plain" or "period" (coloured by the length of the cycle).
var change_inside = function(){
	settings.inside = byId("inside").value === "period" ? "period" : "plain";
	build();
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
	try { saved = localStorage.getItem(PREVIEW_KEY); } catch (e) { saved = null; }
	setQuickPreview(saved === "1");

	var list = byId("formula");
	FORMULAS.forEach(function(item){
		var option = document.createElement("option");
		option.value = item.id;
		option.textContent = item.name;
		list.appendChild(option);
	});

	var examples = byId("examples");
	FORMULA_EXAMPLES.forEach(function(item, i){
		var option = document.createElement("option");
		option.value = i;
		option.textContent = item.name;
		examples.appendChild(option);
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
	byId("inside").value = settings.inside;
	applyShow();
	var id = settings.formula;
	byId("formula").value = id;
	byId("row_p").hidden = id !== "phoenix";
	byId("p_re").value = settings.p[0];
	byId("p_im").value = settings.p[1];
	["row_examples", "row_expr", "row_insert", "row_start", "custom_help"].forEach(function(row){
		byId(row).hidden = id !== "custom";
	});
	byId("custom_expr").value = settings.custom.expr;
	byId("custom_start").value = settings.custom.start;
	showFormulaError();
}

// ---- Small screens: the panel slides in over the figures ----

var openPanel = function(open){
	document.body.classList.toggle("panel_open", !!open);
	byId("panel_open").setAttribute("aria-expanded", open ? "true" : "false");
}
