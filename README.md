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

In the panel:

- **Power** changes the formula to *z*ⁿ + *c* (n from 1 to 10).
- **Colours** and **Shading**: five colour schemes, with smooth shading or the
  classic bands. *Classic* with bands off is the original look of the page.
- ***c***: type a value, or pick a famous Julia set (Douady's rabbit, the
  Basilica, the Airplane, …). A typed or picked *c* is kept.
- **Save**: each figure as a PNG at full resolution, or a link.

The address always describes the figures (power, colours, both views and *c*),
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
| `javascript/main.js` | panel, pointer, keys, layout, links and saving |

## How the drawing is fast

- Plain number arithmetic, with a dedicated loop for *z*² + *c*.
- Points inside the main cardioid and the period-2 bulb of the Mandelbrot set
  are recognised at once instead of iterated.
- An orbit that repeats exactly is a cycle and is stopped early.
- Colours come from a lookup table.
- The work is shared between Web Workers; a figure that takes long appears
  strip by strip, and a newer request replaces a slow one.
