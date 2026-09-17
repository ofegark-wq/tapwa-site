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
 */
(function () {
  'use strict';

  var BEATS = [
    [0.00, 0.04, 0.11, 0.17],   // 0 — "Carried, not saved."   left
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
  } else {
    video.addEventListener('loadedmetadata', start, { once: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // Safari sometimes needs a nudge before it will seek at all
    video.addEventListener('canplay', function () { video.pause(); }, { once: true });
  }
})();
