var mandelbrot = {
  width: 400,
  height: 400,
  power: 2,
  x: [-2, 2],
  y: [-2, 2],
  iteration: 200,
  // Request a redraw; calls within one animation frame are merged.
  paint: function(){
    $("#loading_m")[0].innerHTML = "Loading...";
    mandelbrot.schedule();
  },
  render: function(){
    $("#p_m_1")[0].innerHTML = mandelbrot.power;
    $("#p_m_2")[0].innerHTML = "[" + round(mandelbrot.x[0]) + "," + round(mandelbrot.x[1]) + "]";
    $("#p_m_3")[0].innerHTML = "[" + round(mandelbrot.y[0]) + "," + round(mandelbrot.y[1]) + "]";
    $("#p_m_4")[0].innerHTML = mandelbrot.iteration;

    Renderer.render("mandelbrot", $("#mandelbrot")[0], {
      type: "mandelbrot", width: mandelbrot.width, height: mandelbrot.height,
      x0: mandelbrot.x[0], x1: mandelbrot.x[1], y0: mandelbrot.y[0], y1: mandelbrot.y[1],
      power: mandelbrot.power, maxIter: mandelbrot.iteration,
      cr: 0, ci: 0
    }, function(ms){
      $("#loading_m")[0].innerHTML = "Ready (" + Math.round(ms) + " ms)";
    });
  },
  reset: function(){
    mandelbrot.x = [-2, 2];
    mandelbrot.y = [-2, 2];
    mandelbrot.iteration = 200;
    mandelbrot.paint();
  },
  move: function(keyCode){
    let dx = (mandelbrot.x[1] - mandelbrot.x[0]) / 2;
    let dy = (mandelbrot.y[1] - mandelbrot.y[0]) / 2;
    switch (keyCode) {
      case 87: //W up
        mandelbrot.y[0] -= dy;
        mandelbrot.y[1] -= dy;
        break;
      case 65: //A left
        mandelbrot.x[0] -= dx;
        mandelbrot.x[1] -= dx;
        break;
      case 83: //S down
        mandelbrot.y[0] += dy;
        mandelbrot.y[1] += dy;
        break;
      case 68: //D right
        mandelbrot.x[0] += dx;
        mandelbrot.x[1] += dx;
        break;
      default:
        return;
    }
    mandelbrot.paint();
  }
}

mandelbrot.schedule = Renderer.scheduler(mandelbrot.render);
