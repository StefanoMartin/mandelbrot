// Saving pictures and copying the link.

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

// Largest picture drawn for saving, in pixels (about 160 MB while it is made).
var PICTURE_MAX_PIXELS = 40e6;

// A figure as a picture (without the mark of c or the orbit): as on the
// screen, or drawn again two or four times as large, in the background.
var savePicture = function(f){
	var scale = parseInt(byId("picture_size").value, 10) || 1;
	while (scale > 1 && f.width * f.height * scale * scale > PICTURE_MAX_PIXELS) { scale /= 2; }
	var name = (f === julia
		? "julia c=" + plain(julia.c[0], 4) + (julia.c[1] < 0 ? "" : "+") + plain(julia.c[1], 4) + "i"
		: currentFormula().def.short.toLowerCase().replace(/ /g, "-")) +
		(scale > 1 ? " " + scale + "x" : "") + ".png";
	var finish = function(canvas){
		canvas.toBlob(function(blob){
			if (blob) { download(blob, name); note("Saved \u201c" + name + "\u201d (" + canvas.width + " \u00d7 " + canvas.height + ")."); }
			else { note("This browser could not save the picture."); }
		}, "image/png");
	};
	if (scale === 1) { finish(byId(f.type)); return; }

	var params = viewParams(f);   // the same view, with smaller pixels
	params.width = f.width * scale;
	params.height = f.height * scale;
	params.lineScale = f.dpr * scale;
	var canvas = document.createElement("canvas");
	note("Drawing a picture of " + params.width + " \u00d7 " + params.height + "\u2026");
	Renderer.render("picture_" + f.type, canvas, params, function(){ finish(canvas); }, { preview: false });
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
