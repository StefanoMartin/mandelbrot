# Mandelbrot and Julia

A small web page that draws the Mandelbrot set beside the Julia set of the
point *c* under the pointer. Every point *c* of the plane has a Julia set of
its own: moving over the Mandelbrot set shows how they change.

Open `index.html` in a browser. Nothing needs to be installed or built, and the
page works offline, also straight from disk.

## Using it

| | |
|---|---|
| Pointer on Fig. 1 | chooses *c* (or click; tap on a touch screen) |
| Drag | moves a figure |
| Mouse wheel | zooms in or out at the pointer |
| `W` `A` `S` `D` | move Fig. 1 |
| Arrow keys | move Fig. 2 |
| `Space` | keeps or frees *c* |
| `O` | shows or hides the orbit |

In the panel:

- **Formula** chooses the rule *z* → *f*(*z*, *c*) both figures follow (see
  below).
- **Power** changes the formula to *z*ⁿ + *c* (n from 1 to 10).
- **Colours** and **Shading**: five colour schemes, with smooth shading or the
  classic bands. *Classic* with bands off is the original look of the page.
- ***c***: type a value, or pick a famous Julia set (Douady's rabbit, the
  Basilica, the Airplane, …). A typed or picked *c* is kept.
- **Orbit**: shows the path *z* takes, step by step, from the point under the
  pointer (or tapped). On Fig. 1 it starts at 0 with *c* the point; on Fig. 2
  it starts at the point, with the *c* of the Julia set. A note in the corner
  of the figure says what happens: the orbit escapes at some step, settles on
  a fixed point or a cycle, or stays bounded. A point belongs to the set
  exactly when its orbit never escapes.
- **Save**: each figure as a PNG at full resolution, or a link.

## Formulas

Fig. 1 colours each *c* by what happens to the orbit of a starting point under
*f*; Fig. 2 keeps *c* and starts *z* at every pixel. For the two figures to
belong together, *z* should start at a critical point of *f* (where its
derivative is 0).

| Formula | *f*(*z*, *c*) | starts at |
|---|---|---|
| Mandelbrot | *z*ⁿ + *c* | 0 |
| Tricorn | conj(*z*)ⁿ + *c* | 0 |
| Burning Ship | (\|Re *z*\| − *i*\|Im *z*\|)ⁿ + *c* (drawn upright) | 0 |
| Celtic | \|Re *z*²\| + *i* Im *z*² + *c* | 0 |
| Buffalo | \|Re *z*²\| − *i*\|Im *z*²\| + *c* | 0 |
| Logistic | *c* *z* (1 − *z*) | ½ |
| Phoenix | *z*² + *c* + *p* · previous *z* (*p* can be set) | 0 |
| Exponential | *c* e^*z* | 0 |
| Sine | *c* sin *z* | π/2 |

**Your own formula**: type any formula of *z* and *c*, for example
`z^3 + z^2 + c`, `sin(z) * c` or `z^n + c` (n is the power setting), and the
point where *z* starts on Fig. 1. Allowed are numbers, *z*, *c*, *n*, *i*, pi,
e, `+ - * / ^` and brackets (`2z` and `z(z + 1)` also multiply), and the
functions sin, cos, tan, sinh, cosh, tanh, exp, log, sqrt, abs, conj, re, im
and arg. The formula is read as maths only and turned into a fast loop; a
mistake is explained under the field while the last working formula stays
drawn.

The address always describes the figures (formula, power, colours, both views and *c*),
so it can be bookmarked or shared. Opening a link keeps its *c*.

The deeper the zoom, the more iterations are used: 200 at the start for the
Mandelbrot set and 100 for the Julia set, plus 100 for every 5× of zoom.
Zooming stops near ×10¹³, where double-precision numbers run out.

## Files

| File | |
|---|---|
| `index.html` | the page |
| `css/style.css` | its look |
| `javascript/kernel.js` | the arithmetic and the colour schemes; runs in the page and in workers |
| `javascript/renderer.js` | draws in background workers, strip by strip, on every core |
| `javascript/figures.js` | the two figures and the settings they share |
| `javascript/formulas.js` | the formulas, and the reader for typed ones |
| `javascript/orbit.js` | follows and draws the orbit of a point |
| `javascript/main.js` | panel, pointer, keys, layout, links and saving |

## How the drawing is fast

- Plain number arithmetic, with a dedicated loop for *z*² + *c*. Every other
  formula, typed ones included, is turned into a loop of plain arithmetic
  that the workers compile once.
- Points inside the main cardioid and the period-2 bulb of the Mandelbrot set
  are recognised at once instead of iterated.
- An orbit that repeats exactly is a cycle and is stopped early.
- Colours come from a lookup table.
- The work is shared between Web Workers; a figure that takes long appears
  strip by strip, and a newer request replaces a slow one.
