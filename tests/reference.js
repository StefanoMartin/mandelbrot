// The page's original per-pixel algorithm (as in the commit "Improved
// quircks", after its first bug fixes): the pictures with Classic colours and
// Bands must stay exactly as it drew them.
"use strict";

var power = function (x, n) {
  var p = [1, 0];
  for (var k = 0; k < n; k++) { p = [p[0] * x[0] - p[1] * x[1], p[1] * x[0] + p[0] * x[1]]; }
  return p;
};
var sum = function (a, b) { return [a[0] + b[0], a[1] + b[1]]; };

var isOfMandelbrot = function (c, n, iterations) {
  var x = [0, 0];
  if (c[0] * c[0] + c[1] * c[1] >= 4) { return 1; }
  for (var ii = 0; ii < iterations; ii++) {
    x = sum(power(x, n), c);
    if (x[0] * x[0] + x[1] * x[1] >= 4) { return ii + 1; }
  }
  return 0;
};

var isOfJulia = function (x, c, n, iterations) {
  if (x[0] * x[0] + x[1] * x[1] >= 4) { return 1; }
  for (var ii = 0; ii < iterations; ii++) {
    x = sum(power(x, n), c);
    if (x[0] * x[0] + x[1] * x[1] >= 4) { return ii + 1; }
  }
  return 0;
};

var colourMandelbrot = function (i, iterations, pix, ppos) {
  if (i === 0) { pix[ppos] = 255; pix[ppos + 1] = 255; pix[ppos + 2] = 200; }
  else {
    var c = 3 * Math.log(i + 1) / Math.log(iterations + 1);
    if (c < 1) { pix[ppos] = 255 * c; pix[ppos + 1] = 0; pix[ppos + 2] = 0; }
    else if (c < 2) { pix[ppos] = 255; pix[ppos + 1] = 255 * (c - 1); pix[ppos + 2] = 0; }
    else { pix[ppos] = 255; pix[ppos + 1] = 255; pix[ppos + 2] = 255 * (c - 2); }
  }
  pix[ppos + 3] = 255;
};

var colourJulia = function (i, iterations, pix, ppos) {
  if (i === 0) { pix[ppos] = 255; pix[ppos + 1] = 255; pix[ppos + 2] = 255; }
  else {
    var c = 3 * Math.log(i + 1) / Math.log(iterations + 1);
    if (c < 1) { pix[ppos] = 0; pix[ppos + 1] = 0; pix[ppos + 2] = 255 * c; }
    else if (c < 2) { pix[ppos] = 0; pix[ppos + 1] = 255 * (c - 1); pix[ppos + 2] = 255; }
    else { pix[ppos] = 255 * (c - 2); pix[ppos + 1] = 255; pix[ppos + 2] = 255; }
  }
  pix[ppos + 3] = 255;
};

// A view drawn the original way: {type, width, height, x0, x1, y0, y1, power,
// maxIter, cr, ci}, with the kernel's meaning of x0..y1.
module.exports = function draw(v) {
  var pix = new Uint8ClampedArray(v.width * v.height * 4);
  var xr = (v.x1 - v.x0) / v.width, yr = (v.y1 - v.y0) / v.height;
  for (var i = 0; i < v.width; i++) {
    for (var j = 0; j < v.height; j++) {
      var point = [i * xr + v.x0, -(j * yr + v.y0)];
      var pos = (j * v.width + i) * 4;
      if (v.type === "mandelbrot") {
        colourMandelbrot(isOfMandelbrot(point, v.power, v.maxIter), v.maxIter, pix, pos);
      } else {
        colourJulia(isOfJulia(point, [v.cr, v.ci], v.power, v.maxIter), v.maxIter, pix, pos);
      }
    }
  }
  return pix;
};
