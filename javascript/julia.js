var julia = {
  width: 400,
  height: 400,
  power: 2,
  x: [-2, 2],
  y: [-2, 2],
  c: [-2, 2],
  blocked: false,
  iteration: 100,
  // Request a redraw; calls within one animation frame are merged.
  paint: function(){
    $("#loading_j")[0].innerHTML = "Loading...";
    julia.schedule();
  },
  render: function(){
    $("#p_j_1")[0].innerHTML = julia.power;
    $("#p_j_2")[0].innerHTML = round(julia.c[0]);
    $("#p_j_3")[0].innerHTML = round(julia.c[1]);
    $("#p_j_4")[0].innerHTML = "[" + round(julia.x[0]) + "," + round(julia.x[1]) + "]";
    $("#p_j_5")[0].innerHTML = "[" + round(julia.y[0]) + "," + round(julia.y[1]) + "]";
    $("#p_j_6")[0].innerHTML = julia.iteration;

    Renderer.render("julia", $("#julia")[0], {
      type: "julia", width: julia.width, height: julia.height,
      x0: julia.x[0], x1: julia.x[1], y0: julia.y[0], y1: julia.y[1],
      power: julia.power, maxIter: julia.iteration,
      cr: julia.c[0], ci: julia.c[1]
    }, function(ms){
      $("#loading_j")[0].innerHTML = "Ready (" + Math.round(ms) + " ms)";
    });
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
  }
}

julia.schedule = Renderer.scheduler(julia.render);
