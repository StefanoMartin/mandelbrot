# Mandelbrot and Julia

A small web page that draws the Mandelbrot set beside the Julia set of the
point *c* under the pointer. Every point *c* of the plane has a Julia set of
its own: moving over the Mandelbrot set shows how they change.

**Try it online:** <https://stefanomartin.github.io/mandelbrot/>
(published with GitHub Pages from this repository; it works on phones and
tablets too).

To run it locally, open `index.html` in a browser. Nothing needs to be
installed or built, and the page works offline, also straight from disk.

A link copied from the page (*Copy link*, or the address bar) opens the same
figures for anyone: on the online page, it can be shared as it is.

## Using it

| | |
|---|---|
| Pointer on Fig. 1 | chooses *c* (or click; tap on a touch screen) |
| Drag | moves a figure |
| Mouse wheel | zooms in or out at the pointer |
| Two fingers | pinch to zoom, and move, on a touch screen |
| `W` `A` `S` `D` | move Fig. 1 |
| Arrow keys | move Fig. 2 |
| `K` | keeps or frees *c* |
| `O` | shows or hides the orbit |
| `Q` | turns the quick preview on or off |

On a phone, or in a small window (narrower than 760 pixels or lower than
500), the figures get the whole screen under a title line, and the panel
slides in over them with the *Settings* button (*Close*, a tap beside it or
`Esc` puts it away). There the panel keeps only what can be set: the coordinates,
zoom and timing readouts and the explanations are left out, and on a touch
screen the keyboard shortcuts are not mentioned.

In the panel:

- **Formula** chooses the rule *z* → *f*(*z*, *c*) both figures follow (see
  below).
- **Power** changes the formula to *z*ⁿ + *c* (n from 1 to 10).
- **Show**: both figures, or one of them using all the room (also with the
  *Hide* / *Show both* button in the corner of each figure). A hidden figure
  is not drawn at all.
- **Colours** and **Shading**: six colour schemes, and four ways to shade
  the outside of the set: *Smooth*, *Bands* (with *Classic* colours, the
  original look of the page), *Relief*, which lights the smooth shading from
  the upper left as if the set were embossed in the paper, and *Ink lines*, which draws the edge of the set
  and its finest filaments as thin lines, like an engraving. Ink lines
  estimate the distance of each pixel to the set from how fast the smooth
  shading changes between neighbouring pixels, so they work for every
  formula, typed ones too.
  *Ink on paper*, *Watercolour*, *Atlas* and *Night* adapt to the view: a
  quick sample of it finds how fast its points escape, and their colours are
  spread over that range, so the gradual change towards the set shows at
  every zoom. *Sepia* and *Classic* keep the first look of the page.
- **Inside**: *One colour*, or *By cycle*: every point inside the set ends up
  going round a cycle, and its colour tells how long it is. The main cardioid
  (a fixed point) keeps the inside colour; the big bulb on its left is the
  2-cycle, the bulbs on top and below the 3-cycle, and so on.
- ***c***: type a value, or pick a famous Julia set (Douady's rabbit, the
  Basilica, the Airplane, …). A typed or picked *c* is kept.
- **Orbit**: shows the path *z* takes, step by step, from the point under the
  pointer (or tapped). On Fig. 1 it starts at 0 with *c* the point; on Fig. 2
  it starts at the point, with the *c* of the Julia set. A note in the corner
  of the figure says what happens: the orbit escapes at some step, settles on
  a fixed point or a cycle, or stays bounded. A point belongs to the set
  exactly when its orbit never escapes.
- **Places and pictures**: go to a place worth seeing (Seahorse Valley,
  Elephant Valley, a mini Mandelbrot set, the little Burning Ship…), or keep
  what the figures show among your favourites, by name. Favourites stay in
  this browser and can be saved to a file and loaded from one, to keep them
  or to move them to another browser. Each figure can be saved as a PNG, as
  on the screen or drawn again two or four times as large (in the
  background, up to 40 million pixels).

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
| Newton | *z* − *p*(*z*) / *p*′(*z*), *p* = *z*³ + (*c* − 1) *z* − *c* | 0 |

**Newton** is Newton's method for the roots of *p*: 1 and the two roots of
*z*² + *z* + *c*. Fig. 2 colours each *z* by the root it reaches (one ink per
root, lighter the faster it gets there); Fig. 1 colours each *c* by the root
reached from *z* = 0. Where no root is reached the method is caught in a cycle,
and small copies of the Mandelbrot set appear. The orbit says which root the
point reaches, or how long its cycle is.

**Your own formula**: type any formula of *z* and *c*, as on paper: `z^3 + c`,
`2z`, `c sin(z)`, `exp(z) + c` (names written together, as `csin(z)`, are
understood too). The *Insert* buttons put *z*, *c*, *i*, π, ^, brackets and the
common functions at the cursor; a function goes around the selected text.
*Examples* starts from a dozen formulas that give a good picture, with a *c*
on the edge of the new set for Fig. 2. Allowed are numbers, *z*, *c*, *n* (the
power), *i*, pi, e, `+ - * / ^`, brackets, and sin, cos, tan, sinh, cosh,
tanh, exp, log, sqrt, abs, conj, re, im and arg. The formula is read as maths
only and turned into a fast loop; a mistake is explained under the field
while the last working formula stays drawn.

Leave *Start z* on `auto`: the page looks for a critical point of the formula
(where its derivative is 0, the same for every *c*) with Newton's method, and
says where *z* starts (π/2 for `sin(z) + c`, *i*π/2 for `sinh(z) + c`, ½ for
`c z (1 − z)`). Formulas with exp, sin, cos, tan, sinh, cosh or tanh, where *z*
can grow large and come back, count a point as escaped only once |*z*| passes
10¹⁰.

The address always describes the figures (formula, power, colours, shading,
both views and *c*), so it can be bookmarked or shared. Opening a link keeps
its *c*. Back and Forward in the browser go through the views explored: a
change after a pause of more than a second is a new step, changes in quick
succession (turning the wheel, a drag) are one step, and *c* following the
pointer never adds one.

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
| `javascript/format.js` | finding elements; numbers as they are shown and typed |
| `javascript/view.js` | the views: zooming, moving, dragging, layout, showing one figure |
| `javascript/point.js` | the point *c*: chosen, typed, famous values, its mark |
| `javascript/panel.js` | the Settings section: formula, power, colours, shading, typed formulas |
| `javascript/links.js` | links, and Back / Forward |
| `javascript/saving.js` | saving pictures, copying the link |
| `javascript/places.js` | places worth seeing, and favourites |
| `javascript/keys.js` | keyboard shortcuts |
| `javascript/main.js` | wiring: the events of the page, and what happens when it opens |
| `tests/` | the tests (see below) |

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
- Quick preview (*Quick preview while moving* in Settings, or key `Q`; off
  at first, and remembered): a figure is first drawn at a quarter of the
  resolution (an eighth when it took long last time), then sharp. While you drag, zoom or
  move the pointer, only previews are drawn, so the figure follows at once;
  it turns sharp when you stop. Saved pictures are always drawn sharp.

## Tests

    node tests/run.js

Needs only Node (version 14 or later), nothing to install; takes a few seconds.
The page's scripts are loaded as they are, with small stand-ins for the browser.
The tests check that:

- with *Classic* colours and *Bands*, the pictures are exactly, byte for
  byte, what the original page drew (`tests/reference.js` is its algorithm);
- a typed `z^n + c` draws the same picture as the built-in formula;
- every formula draws in every shading;
- typed formulas compute the right values, explain mistakes, and refuse
  anything that is not maths;
- *Start z = auto* finds the right starting point (π/2 for `sin(z) + c`…);
- links bring back everything they describe;
- Back and Forward get a new step exactly when they should.

The command ends with an error code when a test fails.
