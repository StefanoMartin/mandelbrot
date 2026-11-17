var julia = {
  type: "julia",
  prefix: "j",
  width: 400,      // canvas size in pixels, set by layout()
  height: 400,
  power: 2,
  palette: 0,
  // The view: centre and length of the shorter side (see mandelbrot.js).
  cx: 0,
  cy: 0,
  span: 4,
  c: [-0.8, 0.156],
  blocked: false,
  base_iteration: 100,   // iterations at zoom 1 (see setIterations)
  iteration: 100,
  // Request a redraw; calls within one animation frame are merged.
  paint: function(){
    byId("j_status").textContent = "Drawing…";
    julia.schedule();
  },
  render: function(){
    showView(julia);
    byId("j_c").innerHTML = byId("caption_c").innerHTML = formatComplex(julia.c);
    Renderer.render("julia", byId("julia"), viewParams(julia), function(ms){
      byId("j_status").textContent = "Drawn in " + Math.round(ms) + " ms.";
    });
  },
  set_blocked: function(blocked){
    julia.blocked = blocked;
    byId("freeze").checked = blocked;
  },
  reset: function(){
    julia.set_blocked(false);
    julia.cx = 0;
    julia.cy = 0;
    julia.span = 4;
    julia.iteration = 100;
    julia.c = [-0.8, 0.156];
    julia.paint();
  }
}

julia.schedule = Renderer.scheduler(julia.render);
