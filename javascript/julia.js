var julia = {
  width: 400,
  height: 400,
  power: 2,
  x: [-2, 2],
  y: [-2, 2],
  c: [-2, 2],
  blocked: false,
  iteration: 100,
  pending: false,
  // Schedule a render. Repeated calls before the render starts (e.g. many
  // mousemove events) are merged into one, which always uses the latest c.
  paint: function(){
    if (julia.pending) { return; }
    julia.pending = true;
    $("#loading_j")[0].innerHTML = "Loading...";
    setTimeout(function() {
      julia.pending = false;
      julia.render();
    }, 0);
  },
  render: function(){
    $("#p_j_1")[0].innerHTML = julia.power;
    $("#p_j_2")[0].innerHTML = round(julia.c[0]);
    $("#p_j_3")[0].innerHTML = round(julia.c[1]);
    $("#p_j_4")[0].innerHTML = "[" + round(julia.x[0]) + "," + round(julia.x[1]) + "]";
    $("#p_j_5")[0].innerHTML = "[" + round(julia.y[0]) + "," + round(julia.y[1]) + "]";
    $("#p_j_6")[0].innerHTML = julia.iteration;

    var canvas = $("#julia")[0];
    canvas.width  = julia.width;
    canvas.height = julia.height;

    var ctx = canvas.getContext('2d');
    var id = ctx.createImageData(canvas.width, canvas.height);
    var pixels = id.data;

    var x_resize = (julia.x[1] - julia.x[0]) / canvas.width;
    var y_resize = (julia.y[1] - julia.y[0]) / canvas.height;

    for (let i = 0; i < canvas.width; i++) {
      for (let j = 0; j < canvas.height; j++) {
        let point = [i*x_resize + julia.x[0], -(j*y_resize + julia.y[0])];
        let iterations = julia.is_of_julia(point);
        colour_point2(iterations, julia.iteration, pixels, (j*id.width + i)*4);
      }
    }
    ctx.putImageData(id, 0, 0);
    $("#loading_j")[0].innerHTML = "Ready";
  },
  set_blocked: function(blocked){
    julia.blocked = blocked;
    $("#blocking")[0].innerHTML = blocked ? "Blocked" : "Unblocked";
  },
  reset: function(){
    julia.set_blocked(false);
    julia.x = [-2, 2];
    julia.y = [-2, 2];
    julia.iteration = 100;
    julia.c = [-2, 2];
    julia.paint();
  },
  move: function(keyCode){
    let dx = (julia.x[1] - julia.x[0]) / 2;
    let dy = (julia.y[1] - julia.y[0]) / 2;
    switch (keyCode) {
      case 38: //up
        julia.y[0] -= dy;
        julia.y[1] -= dy;
        break;
      case 37: //left
        julia.x[0] -= dx;
        julia.x[1] -= dx;
        break;
      case 40: //down
        julia.y[0] += dy;
        julia.y[1] += dy;
        break;
      case 39: //right
        julia.x[0] += dx;
        julia.x[1] += dx;
        break;
      default:
        return;
    }
    julia.paint();
  },
  is_of_julia: function(x){
    if (x[0]*x[0] + x[1]*x[1] >= 4) { return 1; }
    for (let ii = 0; ii < julia.iteration; ii++) {
      x = sum(power(x, julia.power), julia.c);
      if (x[0]*x[0] + x[1]*x[1] >= 4) { return ii + 1; }
    }
    return 0;
  }
}

var colour_point2 = function(i, iterations, pix, ppos){
  if (i == 0) {
    pix[ppos] = 255;
    pix[ppos + 1] = 255;
    pix[ppos + 2] = 255;
  } else {
    var c = 3 * Math.log(i+1) / Math.log(iterations+1);
    if (c < 1) {
      pix[ppos] = 0;
      pix[ppos + 1] = 0;
      pix[ppos + 2] = 255 * c;
    }
    else if ( c < 2 ) {
      pix[ppos] = 0;
      pix[ppos + 1] = 255 * (c - 1);
      pix[ppos + 2] = 255;
    } else {
      pix[ppos] = 255 * (c - 2);
      pix[ppos + 1] = 255;
      pix[ppos + 2] = 255;
    }
  }
  pix[ppos+3] = 255;
}
