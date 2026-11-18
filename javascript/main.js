// Wiring: the events of the page, and what happens when it opens.

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
	on("inside", "change", change_inside);
	on("quick_preview", "change", function(){ setQuickPreview(byId("quick_preview").checked); });
	on("show", "change", function(){ setShow(byId("show").value); });
	on("m_hide", "click", function(){ toggleFigure(mandelbrot); });
	on("j_hide", "click", function(){ toggleFigure(julia); });
	on("formula", "change", change_formula);
	on("p_re", "input", change_p);
	on("p_im", "input", change_p);
	on("custom_expr", "input", change_custom);
	on("custom_start", "input", change_custom);
	on("examples", "change", chooseExample);
	byId("insert_pad").querySelectorAll("button").forEach(function(button){
		// Keep the cursor in the formula while a button is pressed.
		button.addEventListener("pointerdown", function(e){ e.preventDefault(); });
		button.addEventListener("click", function(){ insertIntoFormula(button.getAttribute("data-insert")); });
	});
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
