// The point c: chosen on Fig. 1, typed, or picked from famous values,
// and its mark on Fig. 1.

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
	var a = parseDecimal(re.value), b = parseDecimal(im.value);
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
