// Places worth seeing, and favourites kept in this browser.

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
	title.textContent = "Choose a place\u2026";
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
