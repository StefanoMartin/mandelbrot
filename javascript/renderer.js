// Renders fractals off the main thread with a pool of Web Workers.
//
// - Workers are created from a Blob built from fractalKernel's source, so this
//   also works when index.html is opened straight from disk (file://).
// - Each image is split into strips of CHUNK_ROWS rows; idle workers pull the
//   next strip, so all cores stay busy even though some regions are much
//   slower than others.
// - One job per canvas ("channel"). A new request while a job is running is
//   queued (only the newest is kept) so frames still complete during fast
//   mouse movement; if the running job is already slow it is abandoned instead,
//   so the view reacts immediately.
// - Slow jobs are drawn progressively, strip by strip.
// - Quick preview (when turned on: key Q): a figure is first drawn at a
//   quarter of the resolution, which takes 16 times less (an eighth, 64
//   times less, when it took long to draw last time), and shown enlarged;
//   then sharp. While new requests keep
//   coming (dragging, zooming, moving the pointer for c) only previews are
//   drawn, and a sharp drawing under way is dropped at once: the figure
//   follows the pointer, and turns sharp when it stops.
// - If workers are unavailable, everything is rendered on the main thread.
var Renderer = (function () {
  var CHUNK_ROWS = 16;
  var ABANDON_AFTER_MS = 150;   // replace (not queue behind) jobs older than this
  var PROGRESSIVE_AFTER_MS = 100;
  var COARSER_FROM_MS = 600;    // a drawing expected to take longer gets a coarser preview
  var previewOn = false;        // Quick preview, turned on and off from the page
  var msPerPixel = {};          // channel -> time per pixel of its last sharp drawing

  var workers = [];
  var idle = [];
  var useWorkers = false;
  var jobs = {};                // channel -> running job
  var nextJobId = 1;
  var lastChannel = null;       // for round-robin between channels

  function now() { return performance.now(); }

  function startWorkers() {
    try {
      var src = "(" + fractalKernel.toString() + ")(self);";
      var url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
      var count = Math.max(1, Math.min(8, navigator.hardwareConcurrency || 4));
      for (var k = 0; k < count; k++) {
        var w = new Worker(url);
        w.onmessage = onResult;
        w.onerror = onWorkerError;
        workers.push(w);
        idle.push(w);
      }
      useWorkers = true;
    } catch (e) {
      console.warn("Web Workers unavailable, rendering on the main thread.", e);
      stopWorkers();
    }
  }

  function stopWorkers() {
    workers.forEach(function (w) { w.terminate(); });
    workers = []; idle = []; useWorkers = false;
  }

  function onWorkerError(e) {
    console.warn("Worker failed, falling back to main-thread rendering.", e.message || e);
    if (e.preventDefault) { e.preventDefault(); }
    stopWorkers();
    // Re-run whatever was in flight on the main thread.
    Object.keys(jobs).forEach(function (ch) {
      var job = jobs[ch];
      delete jobs[ch];
      renderSync(job.canvas, job.request.params, job.onDone);
    });
  }

  function prepareCanvas(canvas, params) {
    if (canvas.width !== params.width)   { canvas.width = params.width; }
    if (canvas.height !== params.height) { canvas.height = params.height; }
    return canvas.getContext("2d");
  }

  function renderSync(canvas, params, onDone) {
    var t0 = now();
    var ctx = prepareCanvas(canvas, params);
    var img = ctx.createImageData(params.width, params.height);
    new Uint32Array(img.data.buffer).set(FractalKernel.renderRows(params, 0, params.height));
    ctx.putImageData(img, 0, 0);
    if (onDone) { onDone(now() - t0); }
  }

  // How much smaller the preview of a request is drawn (1: no preview).
  function previewFactor(channel, request) {
    var p = request.params;
    if (!request.preview || !previewOn) { return 1; }
    var expected = (msPerPixel[channel] || 0) * p.width * p.height;
    var factor = expected < COARSER_FROM_MS ? 4 : 8;
    return Math.min(p.width, p.height) / factor >= 8 ? factor : 1;
  }

  // A request: {canvas, params, onDone, preview}. Starts its preview if it
  // gets one, else its sharp drawing.
  function startRequest(channel, request) {
    var factor = previewFactor(channel, request);
    if (factor === 1) { startJob(channel, request, "sharp", 1); return; }
    var p = request.params, small = {};
    for (var key in p) { small[key] = p[key]; }   // the same view, with larger pixels
    small.width = Math.ceil(p.width / factor);
    small.height = Math.ceil(p.height / factor);
    small.lineScale = (p.lineScale || 1) / factor;
    startJob(channel, request, "preview", factor, small);
  }

  function startJob(channel, request, phase, factor, params) {
    params = params || request.params;
    var ctx = prepareCanvas(request.canvas, request.params);   // the canvas keeps its full size
    var img = ctx.createImageData(params.width, params.height);
    jobs[channel] = {
      id: nextJobId++, channel: channel, canvas: request.canvas, ctx: ctx,
      request: request, phase: phase, factor: factor,
      params: params, onDone: request.onDone,
      image: img, pixels: new Uint32Array(img.data.buffer),
      nextRow: 0, rowsDone: 0, started: now(),
      // After a preview, the sharp strips replace it as soon as they come.
      progressive: phase === "sharp" && request.previewed, doneStrips: [], queued: null
    };
    dispatch();
  }

  // Show a finished preview enlarged to the whole canvas.
  function showPreview(job) {
    var small = document.createElement("canvas");
    small.width = job.params.width;
    small.height = job.params.height;
    small.getContext("2d").putImageData(job.image, 0, 0);
    job.ctx.imageSmoothingEnabled = true;     // soft rather than blocky
    job.ctx.imageSmoothingQuality = "high";
    job.ctx.drawImage(small, 0, 0, job.canvas.width, job.canvas.height);
  }

  // Hand strips to idle workers, alternating between channels.
  function dispatch() {
    while (idle.length) {
      var job = pickJob();
      if (!job) { return; }
      var rowStart = job.nextRow;
      var rowEnd = Math.min(job.params.height, rowStart + CHUNK_ROWS);
      job.nextRow = rowEnd;
      idle.pop().postMessage({ jobId: job.id, params: job.params, rowStart: rowStart, rowEnd: rowEnd });
    }
  }

  function pickJob() {
    var channels = Object.keys(jobs).filter(function (ch) {
      return jobs[ch].nextRow < jobs[ch].params.height;
    });
    if (!channels.length) { return null; }
    var i = channels.indexOf(lastChannel);
    lastChannel = channels[(i + 1) % channels.length];
    return jobs[lastChannel];
  }

  function onResult(e) {
    idle.push(this);
    var d = e.data;
    var job = null;
    for (var ch in jobs) { if (jobs[ch].id === d.jobId) { job = jobs[ch]; } }
    if (job) { acceptStrip(job, d); }  // otherwise it belongs to an abandoned job
    dispatch();
  }

  function acceptStrip(job, d) {
    var w = job.params.width;
    job.pixels.set(new Uint32Array(d.pixels), d.rowStart * w);
    job.rowsDone += d.rowEnd - d.rowStart;

    if (job.rowsDone >= job.params.height) {
      delete jobs[job.channel];
      if (job.phase === "preview") {
        showPreview(job);
        // More requests came meanwhile: preview the newest; else draw sharp.
        if (job.queued) { startRequest(job.channel, job.queued); }
        else { job.request.previewed = true; startJob(job.channel, job.request, "sharp", 1); }
        return;
      }
      job.ctx.putImageData(job.image, 0, 0);
      var ms = now() - job.started;
      msPerPixel[job.channel] = ms / (job.params.width * job.params.height);
      if (job.onDone) { job.onDone(ms); }
      if (job.queued) { startRequest(job.channel, job.queued); }
      return;
    }

    // Slow job: show finished strips as they arrive, keeping the old picture
    // in the rows that are not done yet.
    job.doneStrips.push([d.rowStart, d.rowEnd]);
    if (!job.progressive && now() - job.started > PROGRESSIVE_AFTER_MS) {
      job.progressive = true;
    }
    if (job.progressive) {
      job.doneStrips.forEach(function (s) {
        job.ctx.putImageData(job.image, 0, 0, 0, s[0], w, s[1] - s[0]);
      });
      job.doneStrips = [];
    }
  }

  // Public: render `params` into `canvas`. onDone(ms) is called when the
  // sharp drawing is finished. options.preview = false: no preview (pictures
  // being saved).
  function render(channel, canvas, params, onDone, options) {
    if (!useWorkers) { renderSync(canvas, params, onDone); return; }
    var request = { canvas: canvas, params: params, onDone: onDone,
                    preview: !(options && options.preview === false) };
    var running = jobs[channel];
    if (running) {
      var r = running.request.params;
      var sameSize = r.width === params.width && r.height === params.height;
      // A preview is quick: let it finish, and keep only the newest request.
      if (running.phase === "preview" && sameSize) { running.queued = request; return; }
      // A sharp drawing after a preview is dropped: the view has moved on.
      // One without a preview is waited for if it has only just begun.
      if (!running.request.previewed && sameSize && now() - running.started < ABANDON_AFTER_MS) {
        running.queued = request;
        return;
      }
      delete jobs[channel];   // abandoned; its late strips are ignored
    }
    startRequest(channel, request);
  }

  // Draw at most once per frame: many requests in the same frame (e.g. a burst
  // of mousemove events) collapse into one render that uses the latest state.
  function scheduler(fn) {
    var scheduled = false;
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    return function () {
      if (scheduled) { return; }
      scheduled = true;
      raf(function () { scheduled = false; fn(); });
    };
  }

  startWorkers();

  return {
    render: render,
    scheduler: scheduler,
    setPreview: function (on) { previewOn = !!on; },
    previewing: function () { return previewOn; },
    usingWorkers: function () { return useWorkers; },
    workerCount: function () { return workers.length; }
  };
})();
