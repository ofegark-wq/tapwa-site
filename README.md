# TAPWA — scroll hero

A one-page site whose hero is a video scrubbed by scroll position. No framework, no build step, no dependencies.

## Run it

Open `index.html` in a browser. That's it — but Safari and Chrome both restrict some video behaviour on `file://` URLs, so for a truthful test serve it:

```bash
cd tapwa-site
python3 -m http.server 8000
# then open http://localhost:8000
```

## Files

```
index.html        markup and all the copy
css/style.css     palette, type, layout
js/scroll.js      the scroll → video mapping, the copy timings, the header ink
assets/
  hero-scrub.mp4         1344×700, desktop
  hero-scrub-mobile.mp4  854 wide, served under 820px
  poster.jpg             first frame, shown before the video loads
  crescent-dusk-*.jpg    band image for the product chapter (1800w / 900w)
  crescent-dune-*.jpg    band image for the name chapter  (1800w / 900w)
```

The stylesheet and script are linked with a `?v=N` query. Bump it when you
change either file, or browsers will keep serving the cached copy.

## The page

The scroll hero opens, then four chapters run beneath it:

| # | id | ground | holds |
|---|---|---|---|
| 02 | `#crescent` | dark | dusk band, headline, spec table |
| 03 | `#made` | pale | the making, three numbered points |
| 04 | `#name` | dark | dune band, the Adamawa story |
| 05 | `#enquire` | pale | run of fifty, mailto CTA |

### Header ink

The bar is dark ink multiplied into a pale photograph, which disappears over
the dark chapters. Any region that is dark *at the top of the screen* carries
`data-ink="light"`, and an IntersectionObserver watching the top 6% of the
viewport flips the bar to light while one is under it.

Tag regions, not sections. The dune band is white sand sitting inside an
otherwise dark chapter, so it deliberately carries no tag — tagging its whole
section put light ink on white sand.

## The enquiry address

`index.html` ships a placeholder:

```
mailto:hello@tapwa.ca
```

**Swap this for the real address before going live.** It appears twice, both in
the `#enquire` section: the CTA `href` and the line of text under it. The header
and hero "Enquire" links are anchors to that section, so they need no change.

## Changing the timing

Everything lives in `BEATS` at the top of `js/scroll.js`. Each row is one text block:

```js
[fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd]   // 0 = top of hero, 1 = bottom
```

The rows are tuned to where the bag actually sits in the footage, measured frame by frame:

| scroll | bag | copy side |
|---|---|---|
| 0.00 – 0.65 | holds centre, hovering | either |
| 0.65 – 0.76 | swings left | right |
| 0.78 – 0.90 | swings right | left |
| 0.90 – 1.00 | swings left | right |

Move a block to the other side by swapping its `left` / `right` class in `index.html`.

To make the whole sequence slower or faster, change `.track { height: 620svh }` in the CSS — taller means more scroll per second of footage.

## Why the video is encoded the way it is

Normal video stores a keyframe every few seconds and everything between as differences. Scrubbing such a file means the browser jumps back to a keyframe and rebuilds forward — which is why most scroll-video stutters. This file was encoded with a keyframe on *every* frame:

```bash
ffmpeg -i joined.mp4 -an -c:v libx264 -preset slow -crf 23 \
  -g 1 -keyint_min 1 -sc_threshold 0 \
  -pix_fmt yuv420p -movflags +faststart hero-scrub.mp4
```

That's why 13 seconds costs ~8MB. It's the trade that makes seeking instant.

Re-run that command if you replace the footage. `-movflags +faststart` matters too — it lets playback begin before the file has fully downloaded.

## Known limits

- **iOS Safari** is unreliable at scrubbing MP4 even encoded like this. If it stutters on a phone, the bulletproof route is exporting frames as numbered JPEGs and drawing them to a `<canvas>`.
- **The Enquire link is a placeholder** — see above.
- **Clip 3 drifts.** In the last four seconds the snow thins and the treeline shifts — the video model regenerated the scene rather than moving through it. Regenerate that clip with a tighter camera arc if it bothers you.
- The footage is 1344×700. On a large monitor the hero is slightly soft.

## Deploying

It's static, so anything will host it. Drag the folder onto [Netlify Drop](https://app.netlify.com/drop), or:

```bash
npx vercel deploy
```

Check the video actually loads on the deployed URL — some hosts need large media committed via Git LFS.
