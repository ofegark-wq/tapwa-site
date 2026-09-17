/* TAPWA — scroll-driven hero.
 *
 * Scroll position sets the video's currentTime. The video is encoded with a
 * keyframe on every frame (ffmpeg -g 1), which is what makes seeking instant;
 * a normally-encoded file stutters here no matter how good this code is.
 *
 * COPY TIMING — the numbers below are the whole thing.
 * They're tuned to where the bag actually is in the footage, measured frame
 * by frame, so text always sits on the empty side:
 *
 *   p 0.00 – 0.65  bag holds centre, hovering
 *   p 0.65 – 0.76  bag swings LEFT   → copy goes right
 *   p 0.78 – 0.90  bag swings RIGHT  → copy goes left
 *   p 0.90 – 1.00  bag swings LEFT   → copy goes right
 *
 * Re-time by editing BEATS. Each is [fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd].
 * Beat 0 fades in from a negative start so the h1 is already at full opacity
 * when the page loads — otherwise the landing view has no headline on it.
 */
(function () {
  'use strict';

  var BEATS = [
    [-0.04, 0.00, 0.11, 0.17],  // 0 — "Carried, not saved."   left (lit at rest)
    [0.21, 0.28, 0.39, 0.45],   // 1 — craft                   right
    [0.47, 0.53, 0.61, 0.66],   // 2 — price                   left
    [0.68, 0.73, 0.79, 0.83],   // 3 — the name                right  (bag is left)
    [0.85, 0.90, 1.01, 1.02]    // 4 — product + CTA           left   (bag is right)
  ];

  var SOURCES = {
    wide: 'assets/hero-scrub.mp4',
    narrow: 'assets/hero-scrub-mobile.mp4'
  };

  var video = document.getElementById('hero');
  var track = document.querySelector('.track');
  var bar = document.getElementById('progress');
  var copies = Array.prototype.slice.call(document.querySelectorAll('.copy'));
  var wordmark = document.getElementById('wordmark');   // rides beat 0
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- pick a source by screen width, before the browser starts loading ---- */
  video.src = window.matchMedia('(max-width: 820px)').matches ? SOURCES.narrow : SOURCES.wide;

  var duration = 0;
  var target = 0;      // where scroll says we should be
  var current = 0;     // where the video actually is
  var running = false;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { return t * t * (3 - 2 * t); }              // ease in and out
  function ramp(p, a, b) { return smooth(clamp((p - a) / (b - a), 0, 1)); }

  function progress() {
    var span = track.offsetHeight - window.innerHeight;
    if (span <= 0) return 0;
    return clamp(-track.getBoundingClientRect().top / span, 0, 1);
  }

  function paintCopy(p) {
    for (var i = 0; i < copies.length; i++) {
      var b = BEATS[i];
      if (!b) continue;
      var o = ramp(p, b[0], b[1]) * (1 - ramp(p, b[2], b[3]));
      copies[i].style.opacity = o.toFixed(3);
      // keep faded-out blocks out of the tab order and off screen readers
      copies[i].setAttribute('aria-hidden', o < 0.02 ? 'true' : 'false');
      // the wordmark sits outside the beat blocks, so drive it from beat 0
      if (i === 0 && wordmark) {
        wordmark.style.opacity = o.toFixed(3);
        wordmark.setAttribute('aria-hidden', o < 0.02 ? 'true' : 'false');
      }
    }
  }

  /* ---- the loop: chase the target rather than snapping to it ----
     Setting currentTime straight from scroll feels mechanical and twitchy.
     Easing toward it gives the footage some weight. */
  function loop() {
    if (!running) return;
    var diff = target - current;
    if (Math.abs(diff) > 0.0005) {
      current += diff * 0.12;
      if (duration) {
        try { video.currentTime = current; } catch (e) { /* seek not ready yet */ }
      }
    }
    requestAnimationFrame(loop);
  }

  function onScroll() {
    var p = progress();
    target = p * duration;
    paintCopy(p);
    bar.style.width = (p * 100).toFixed(2) + '%';
  }

  function start() {
    duration = video.duration || 0;
    running = true;
    onScroll();
    current = target;
    requestAnimationFrame(loop);
  }

  if (reduce.matches) {
    // No scrubbing. Show the first frame, let every block read normally.
    video.removeAttribute('preload');
    copies.forEach(function (c) { c.style.opacity = 1; c.setAttribute('aria-hidden', 'false'); });
    if (wordmark) { wordmark.style.opacity = 1; wordmark.setAttribute('aria-hidden', 'false'); }
  } else {
    video.addEventListener('loadedmetadata', start, { once: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // Safari sometimes needs a nudge before it will seek at all
    video.addEventListener('canplay', function () { video.pause(); }, { once: true });
  }
  /* ---- header ink over the dark photographic bands ----
     The bar is dark ink multiplied into a pale photograph. Some regions below
     are near-black, so the bar would vanish there. Flip it to light whenever a
     region marked data-ink="light" is under the top strip of the viewport.
     Tagging is per-region, not per-section: the dune band is white sand inside
     an otherwise dark chapter, so it deliberately carries no tag. Runs in both
     motion modes — it has nothing to do with scrubbing. */
  var barEl = document.getElementById('bar');
  var darkBands = document.querySelectorAll('[data-ink="light"]');

  if (barEl && darkBands.length && 'IntersectionObserver' in window) {
    // Track WHICH regions are lit, not how many. The observer's first callback
    // reports every observed element at once, so a running +1/-1 tally nets
    // negative and sticks there; a set is idempotent whatever order they arrive.
    var lit = [];
    var watch = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var at = lit.indexOf(entries[i].target);
        if (entries[i].isIntersecting) { if (at < 0) lit.push(entries[i].target); }
        else if (at > -1) { lit.splice(at, 1); }
      }
      barEl.classList.toggle('on-dark', lit.length > 0);
    }, { rootMargin: '0px 0px -94% 0px' });       // only the top strip counts

    for (var k = 0; k < darkBands.length; k++) watch.observe(darkBands[k]);
  }
})();
