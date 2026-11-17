// The two figures. Both are made by makeFigure(); the Julia set adds its
// point c on top.

// Settings shared by both figures.
var settings = {
  power: 2,       // the exponent n in z^n + c
  palette: 0,     // index into PALETTES (kernel.js)
  smooth: true    // smooth shading instead of bands
};

// type: "mandelbrot" or "julia" (also the id of its canvas);
// prefix: start of the ids of its readout in the panel;
// base_iteration: iterations at zoom 1 (see setIterations in main.js).
var makeFigure = function(type, prefix, base_iteration){
  var f = {
    type: type,
    prefix: prefix,
    width: 400,      // canvas size in pixels, set by layout()
    height: 400,
    // The view: centre (cx, cy) in the complex plane, and the length of the
    // shorter side of the canvas. The longer side shows proportionally more.
    cx: 0,
    cy: 0,
    span: 4,
    base_iteration: base_iteration,
    iteration: base_iteration,
    after_view: null,   // called when the view is redrawn (readouts, marker)
    on_reset: null,

    // Request a redraw; calls within one animation frame are merged.
    paint: function(){
      byId(prefix + "_status").textContent = "Drawing…";
      f.schedule();
    },
    render: function(){
      showView(f);
      if (f.after_view) { f.after_view(); }
      Renderer.render(type, byId(type), viewParams(f), function(ms){
        byId(prefix + "_status").textContent = "Drawn in " + Math.round(ms) + " ms.";
      });
      saveStateSoon();
    },
    reset: function(){
      f.cx = 0;
      f.cy = 0;
      f.span = 4;
      f.iteration = base_iteration;
      if (f.on_reset) { f.on_reset(); }
      f.paint();
    }
  };
  f.schedule = Renderer.scheduler(f.render);
  return f;
};

var mandelbrot = makeFigure("mandelbrot", "m", 200);
var julia = makeFigure("julia", "j", 100);

// The Julia set is drawn for the point c, chosen on the Mandelbrot set.
var START_C = [-0.8, 0.156];
julia.c = START_C.slice();
julia.blocked = false;   // "Keep this c": the pointer no longer changes c

julia.set_blocked = function(blocked){
  julia.blocked = blocked;
  byId("freeze").checked = blocked;
};

julia.on_reset = function(){
  julia.set_blocked(false);
  julia.c = START_C.slice();
};

// When a figure is redrawn, its readouts, the mark of c and the orbit follow.
// (The orbit on Fig. 2 also depends on c.)
mandelbrot.after_view = function(){ placeMarker(); drawOrbit(); };
julia.after_view = function(){ showC(); placeMarker(); drawOrbit(); };
