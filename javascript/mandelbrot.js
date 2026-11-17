var mandelbrot = {
  type: "mandelbrot",
  prefix: "m",
  width: 400,      // canvas size in pixels, set by layout()
  height: 400,
  power: 2,
  palette: 0,
  // The view: centre (cx, cy) in the complex plane, and the length of the
  // shorter side of the canvas. The longer side shows proportionally more.
  cx: 0,
  cy: 0,
  span: 4,
  base_iteration: 200,   // iterations at zoom 1 (see setIterations)
  iteration: 200,
  // Request a redraw; calls within one animation frame are merged.
  paint: function(){
    byId("m_status").textContent = "Drawing…";
    mandelbrot.schedule();
  },
  render: function(){
    showView(mandelbrot);
    Renderer.render("mandelbrot", byId("mandelbrot"), viewParams(mandelbrot), function(ms){
      byId("m_status").textContent = "Drawn in " + Math.round(ms) + " ms.";
    });
  },
  reset: function(){
    mandelbrot.cx = 0;
    mandelbrot.cy = 0;
    mandelbrot.span = 4;
    mandelbrot.iteration = 200;
    mandelbrot.paint();
  }
}

mandelbrot.schedule = Renderer.scheduler(mandelbrot.render);
