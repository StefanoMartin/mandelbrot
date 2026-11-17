var mandelbrot = {
  width: 400,
  height: 400,
  power: 2,
  x: [-2, 2],
  y: [-2, 2],
  iteration: 200,
  pending: false,
  // Schedule a render. Repeated calls before the render starts are merged
  // into one, so a burst of events never queues up a backlog of renders.
  paint: function(){
    if (mandelbrot.pending) { return; }
    mandelbrot.pending = true;
    $("#loading_m")[0].innerHTML = "Loading...";
    setTimeout(function() {
      mandelbrot.pending = false;
      mandelbrot.render();
    }, 0);
  },
  render: function(){
    $("#p_m_1")[0].innerHTML = mandelbrot.power;
    $("#p_m_2")[0].innerHTML = "[" + round(mandelbrot.x[0]) + "," + round(mandelbrot.x[1]) + "]";
    $("#p_m_3")[0].innerHTML = "[" + round(mandelbrot.y[0]) + "," + round(mandelbrot.y[1]) + "]";
    $("#p_m_4")[0].innerHTML = mandelbrot.iteration;

    var canvas = $("#mandelbrot")[0];
    canvas.width  = mandelbrot.width;
    canvas.height = mandelbrot.height;

    var ctx = canvas.getContext('2d');
    var id = ctx.createImageData(canvas.width, canvas.height);
    var pixels = id.data;

    var x_resize = (mandelbrot.x[1] - mandelbrot.x[0]) / canvas.width;
    var y_resize = (mandelbrot.y[1] - mandelbrot.y[0]) / canvas.height;

    for (let i = 0; i < canvas.width; i++) {
      for (let j = 0; j < canvas.height; j++) {
        let point = [i*x_resize + mandelbrot.x[0], -(j*y_resize + mandelbrot.y[0])];
        let iterations = mandelbrot.is_of_mandelbrot(point);
        colour_point(iterations, mandelbrot.iteration, pixels, (j*id.width + i)*4);
      }
    }
    ctx.putImageData(id, 0, 0);
    $("#loading_m")[0].innerHTML = "Ready";
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
  },
  is_of_mandelbrot: function(c){
    let x = [0, 0];
    if (c[0]*c[0] + c[1]*c[1] >= 4) { return 1; }
    for (let ii = 0; ii < mandelbrot.iteration; ii++) {
      x = sum(power(x, mandelbrot.power), c);
      if (x[0]*x[0] + x[1]*x[1] >= 4) { return ii + 1; }
    }
    return 0;
  }
}

var colour_point = function(i, iterations, pix, ppos){
  if (i == 0) {
    pix[ppos] = 255;
    pix[ppos + 1] = 255;
    pix[ppos + 2] = 200;
  } else {
    var c = 3 * Math.log(i+1) / Math.log(iterations+1);
    if (c < 1) {
      pix[ppos] = 255 * c;
      pix[ppos + 1] = 0;
      pix[ppos + 2] = 0;
    }
    else if ( c < 2 ) {
      pix[ppos] = 255;
      pix[ppos + 1] = 255 * (c - 1);
      pix[ppos + 2] = 0;
    } else {
      pix[ppos] = 255;
      pix[ppos + 1] = 255;
      pix[ppos + 2] = 255 * (c - 2);
    }
  }
  pix[ppos+3] = 255;
}

// Complex power x^n for a non-negative integer n (iterative, no recursion).
var power = function(x, n){
  let p = [1, 0];
  for (let k = 0; k < n; k++) {
    p = [p[0]*x[0] - p[1]*x[1], p[1]*x[0] + p[0]*x[1]];
  }
  return p;
}

var sum = function(a, b){
  return [a[0]+b[0], a[1]+b[1]];
}
