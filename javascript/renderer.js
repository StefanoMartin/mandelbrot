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
// - If workers are unavailable, everything is rendered on the main thread.
var Renderer = (function () {
  var CHUNK_ROWS = 16;
  var ABANDON_AFTER_MS = 150;   // replace (not queue behind) jobs older than this
  var PROGRESSIVE_AFTER_MS = 100;

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
      renderSync(job.canvas, job.params, job.onDone);
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

  function startJob(channel, canvas, params, onDone) {
    var ctx = prepareCanvas(canvas, params);
    var img = ctx.createImageData(params.width, params.height);
    jobs[channel] = {
      id: nextJobId++, channel: channel, canvas: canvas, ctx: ctx,
      params: params, onDone: onDone,
      image: img, pixels: new Uint32Array(img.data.buffer),
      nextRow: 0, rowsDone: 0, started: now(),
      progressive: false, doneStrips: [], queued: null
    };
    dispatch();
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
      job.ctx.putImageData(job.image, 0, 0);
      delete jobs[job.channel];
      if (job.onDone) { job.onDone(now() - job.started); }
      if (job.queued) {
        var q = job.queued;
        startJob(job.channel, q.canvas, q.params, q.onDone);
      }
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

  // Public: render `params` into `canvas`. onDone(ms) is called when finished.
  function render(channel, canvas, params, onDone) {
    if (!useWorkers) { renderSync(canvas, params, onDone); return; }
    var running = jobs[channel];
    var sameSize = running && running.params.width === params.width &&
                   running.params.height === params.height;
    if (running && sameSize && now() - running.started < ABANDON_AFTER_MS) {
      running.queued = { canvas: canvas, params: params, onDone: onDone };
      return;
    }
    if (running) { delete jobs[channel]; }   // abandon; late strips are ignored
    startJob(channel, canvas, params, onDone);
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
    usingWorkers: function () { return useWorkers; },
    workerCount: function () { return workers.length; }
  };
})();
