'use strict';

/*
 * Specimen documents.
 *
 * Each specimen is a small, standalone HTML page that reproduces one loading
 * pattern. They are deliberately hand-shaped rather than generated from a
 * component system: the markup *is* the demo, so "View source" has to be worth
 * reading.
 *
 * Nothing in a specimen may perturb what it measures, so:
 *   - configuration travels in <meta> tags;
 *   - the only inline script in the head is a timestamp helper that issues no
 *     requests and executes in microseconds;
 *   - the styling is a single small inline <style>, never a request;
 *   - the measurement probe is appended only after the load event.
 *
 * Two behaviours of current Chromium shape almost every specimen here, and
 * both were verified against Chrome 151 rather than assumed:
 *
 *   1. Tight mode really does hold Low priority resources while two or more
 *      requests are in flight. With a single in-flight request, a Low priority
 *      image is issued immediately.
 *
 *   2. Chromium automatically boosts the first *two* sufficiently large images
 *      out of Low priority, so a lone hero image is never throttled at all.
 *      Small images do not get this boost.
 *
 * Consequence: to observe the delay the article is about, the LCP candidate
 * has to be the third large image on the page. That is why these specimens use
 * two "decoy" images ahead of the hero. It is not padding; without it there is
 * nothing to see.
 */

/* Specimen titles and labels legitimately contain things like
 * "<script> before the <img> elements", so they must be escaped before they
 * are placed in text nodes or attribute values. */
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const qs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

/* --------------------------------------------------------- resources ---- */

const cssUrl = (o = {}) => `/r/css?${qs({ id: 'theme', ttfb: 900, dur: 150, hue: 205, ...o })}`;
const jsUrl = (o = {}) => `/r/js?${qs({ id: 'app', label: 'app', ttfb: 700, dur: 150, ...o })}`;
const imgUrl = (o = {}) =>
  `/r/img?${qs({ id: 'img', w: 1200, h: 675, hue: 205, noise: 30, grain: 6, marks: 1, ttfb: 60, dur: 320, ...o })}`;
const cdnImg = (origin, o = {}) => `${origin}${imgUrl(o)}`;

/* The standard blocking head: one script that gates the initial phase and one
 * stylesheet, which together keep two requests in flight. */
const CSS_MAIN = cssUrl({ id: 'theme', ttfb: 900, hue: 205 });
const JS_BLOCKING = jsUrl({ id: 'blocking', label: 'blocking.js', ttfb: 1400 });

const BLOCKING_HEAD = `
<script src="${JS_BLOCKING}"></script>
<link rel="stylesheet" href="${CSS_MAIN}">`;

/* --------------------------------------------------------- fragments ---- */

const DECOY_1 = imgUrl({ id: 'decoy-1', hue: 150, marks: 1, w: 600, h: 400, dur: 160 });
const DECOY_2 = imgUrl({ id: 'decoy-2', hue: 35, marks: 2, w: 600, h: 400, dur: 160 });
const HERO = imgUrl({ id: 'hero', hue: 205, marks: 3, w: 1200, h: 675, dur: 320 });

/* A 64x64 image is below the size threshold for the automatic boost, so it
 * stays at Low priority and is the cleanest possible probe for Tight mode. */
const SMALL = imgUrl({ id: 'small', hue: 265, marks: 1, w: 64, h: 64, dur: 80 });

const imageGrid = (imgs) => `<div class="grid">\n${imgs.map((a) => `  <img ${a}>`).join('\n')}\n</div>`;

/* decoy, decoy, hero — the shape in which the article's behaviour is still
 * observable in current Chrome. `heroAttrs` lets a specimen hint the hero. */
function gallery(heroAttrs = '') {
  return `<div class="decoys">
  <img src="${DECOY_1}" width="600" height="400" alt="Decoy image 1 — boosted by the browser">
  <img src="${DECOY_2}" width="600" height="400" alt="Decoy image 2 — boosted by the browser">
</div>
<figure class="hero">
  <img src="${HERO}"${heroAttrs ? ' ' + heroAttrs : ''} width="1200" height="675" alt="The LCP candidate — the third large image">
  <figcaption>LCP candidate &mdash; the third large image on the page</figcaption>
</figure>`;
}

const HERO_ONLY = (attrs = '') =>
  `<figure class="hero"><img src="${HERO}"${attrs ? ' ' + attrs : ''} width="1200" height="675" alt="Hero image"><figcaption>Hero</figcaption></figure>`;

/* ---------------------------------------------------------- document ---- */

const INLINE_STYLE = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
           background: #0c0f16; color: #e6eaf2; }
    .wrap { max-width: 1040px; margin: 0 auto; padding: 28px 22px 80px; }
    header.spec { border-bottom: 1px solid #232a39; padding-bottom: 18px; margin-bottom: 22px; }
    .kicker { font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .14em;
              text-transform: uppercase; color: #7c8aa5; }
    h1 { font-size: 23px; margin: 10px 0 6px; letter-spacing: -.01em; }
    h2 { font-size: 15px; margin: 26px 0 8px; }
    header.spec p { margin: 0; color: #9aa7bd; max-width: 68ch; }
    .decoys { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
    img { max-width: 100%; height: auto; display: block; border-radius: 10px; background: #161c27; }
    figure.hero { margin: 0; }
    figure.hero figcaption { margin-top: 7px; font-size: 12px; color: #7c8aa5; }
    .fold { margin-top: 120vh; }
    .css-background { height: 420px; border-radius: 12px; background: #161c27 50% / cover no-repeat; }
    .note { margin: 22px 0 0; padding: 12px 14px; border-left: 3px solid #3d5afe;
            background: #121826; border-radius: 0 8px 8px 0; color: #b8c4d8; font-size: 14px; }
    .thumb { width: 64px; height: 64px; border-radius: 8px; }
`;

/* Records a timestamp without issuing a request. Placed first in the head so
 * it cannot be delayed by a stylesheet, and used to mark parser progress in
 * the specimens where paint order is the thing under test. */
const MARK_HELPER =
  '<script>window.__fpoMark=function(n){(window.__marks=window.__marks||[]).push({name:n,at:Math.round(performance.now())})}</script>';

const mark = (name) => `<script>__fpoMark(${JSON.stringify(name)})</script>`;

function doc({ title, specimen, label, demo, subject = 'hero', head = '', body = '', tail = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="fpo-specimen" content="${esc(specimen)}">
<meta name="fpo-label" content="${esc(label)}">
<meta name="fpo-demo" content="${esc(demo)}">
<meta name="fpo-subject" content="${esc(subject)}">
<title>${esc(title)}</title>
${MARK_HELPER}
${head.trim()}
<style>${INLINE_STYLE}</style>
</head>
<body>
<div class="wrap">
<header class="spec">
  <div class="kicker">Specimen &middot; ${esc(specimen)}</div>
  <h1>${esc(title)}</h1>
  <p>${esc(label)}</p>
</header>
${body.trim()}
${tail.trim()}
</div>
<!-- The probe is appended only after the load event, so measuring the page cannot change it. -->
<script>addEventListener("load",function(){var s=document.createElement("script");s.src="/assets/probe.js";document.body.appendChild(s);});</script>
</body>
</html>
`;
}

const BOOST_NOTE = `<p class="note">The two smaller images above the hero are there on purpose. Chromium
  automatically boosts the first two sufficiently large images out of <code>Low</code> priority, so a page
  with a single hero never shows this behaviour at all. The hero here is the third large image, which is
  where the browser stops helping.</p>`;

/* ---------------------------------------------------------- specimens --- */

const specimens = {};
const def = (id, spec) => { specimens[id] = spec; };

/* 01 — DOM Interactive ---------------------------------------------------- */

def('d01-dom-interactive', {
  title: 'Render-blocking head, then images',
  summary: 'A blocking script ahead of a slow stylesheet. The hero starts once the script has executed.',
  html: () =>
    doc({
      specimen: 'd01-dom-interactive',
      demo: 'dom-interactive',
      title: 'Render-blocking head, then images',
      label: 'A blocking script (700ms) placed before a slower stylesheet (1600ms), then three images.',
      head: `
<script src="${jsUrl({ id: 'blocking', label: 'blocking.js', ttfb: 700 })}"></script>
<link rel="stylesheet" href="${cssUrl({ id: 'slow-theme', ttfb: 1600 })}">`,
      body: gallery(),
      tail: `<p class="note">The script sits <em>before</em> the stylesheet, so its execution is not held up
        by the CSSOM. Watch the hero begin downloading as soon as the script has executed, while
        <code>slow-theme.css</code> is still in flight &mdash; and compare that moment with
        <code>domInteractive</code> in the table below.</p>${BOOST_NOTE}`,
    }),
});

/* 02 — script defer ------------------------------------------------------- */

def('d02-sync', {
  title: 'Synchronous script in the head',
  summary: 'A parser-blocking script holds the initial phase open until it has executed.',
  html: () =>
    doc({
      specimen: 'd02-sync',
      demo: 'script-defer',
      title: 'Synchronous script in the head',
      label: 'A parser-blocking <script src> with a 1400ms server delay, ahead of three images.',
      head: `
<link rel="stylesheet" href="${cssUrl({ id: 'theme', ttfb: 600 })}">
<script src="${jsUrl({ id: 'sync', label: 'sync.js', ttfb: 1400 })}"></script>`,
      body: gallery(),
    }),
});

def('d02-defer', {
  title: 'The same script, with defer',
  summary: 'defer removes the script from the render-blocking set and drops it to Low priority.',
  html: () =>
    doc({
      specimen: 'd02-defer',
      demo: 'script-defer',
      title: 'The same script, with defer',
      label: 'Identical markup, except the script carries the defer attribute.',
      head: `
<link rel="stylesheet" href="${cssUrl({ id: 'theme', ttfb: 600 })}">
<script defer src="${jsUrl({ id: 'deferred', label: 'deferred.js', ttfb: 1400 })}"></script>`,
      body: gallery(),
      tail: `<p class="note">A deferred script is requested at <strong>Low</strong> priority and is not
        render-blocking, so it neither holds the parser nor extends the initial phase &mdash; but it now
        queues behind higher priority work instead of ahead of it.</p>`,
    }),
});

/* 03 — fetchpriority ------------------------------------------------------ */

def('d03-baseline', {
  title: 'Hero at the default priority',
  summary: 'The third large image starts at Low priority and waits out the initial phase.',
  html: () =>
    doc({
      specimen: 'd03-baseline',
      demo: 'fetchpriority',
      title: 'Hero at the default priority',
      label: 'No priority hints. The hero is requested at the browser default for <img>: Low.',
      head: BLOCKING_HEAD,
      body: gallery(),
      tail: BOOST_NOTE,
    }),
});

def('d03-high', {
  title: 'The hero gets fetchpriority="high"',
  summary: 'One attribute lifts the hero out of the Low priority queue entirely.',
  html: () =>
    doc({
      specimen: 'd03-high',
      demo: 'fetchpriority',
      title: 'The hero gets fetchpriority="high"',
      label: 'Identical to the baseline, except the hero carries fetchpriority="high".',
      head: BLOCKING_HEAD,
      body: gallery('fetchpriority="high"'),
      tail: `<p class="note">The hint is <em>relative</em>: it does not set an absolute priority, it raises
        this image above the Low default it would otherwise have been given.</p>`,
    }),
});

/* 04 — preload ------------------------------------------------------------ */

def('d04-markup', {
  title: 'Image in the markup, no preload',
  summary: 'The baseline for judging whether preload helps an already early-discovered image.',
  html: () =>
    doc({
      specimen: 'd04-markup',
      demo: 'preload',
      title: 'Image in the markup, no preload',
      label: 'The hero is a plain <img> in the HTML. The preload scanner finds it immediately.',
      head: BLOCKING_HEAD,
      body: gallery(),
    }),
});

def('d04-markup-preload', {
  title: 'Image in the markup, with preload',
  summary: 'Preloading a resource the scanner already found buys very little.',
  html: () =>
    doc({
      specimen: 'd04-markup-preload',
      demo: 'preload',
      title: 'Image in the markup, with preload',
      label: 'The same markup image, additionally preloaded from the head.',
      head: `
<link rel="preload" as="image" href="${HERO}">
${BLOCKING_HEAD.trim()}`,
      body: gallery(),
      tail: `<p class="note">Expect a small delta at best. The hero was never <em>late-discovered</em>; it
        was already in the queue, at Low priority, waiting for the initial phase to end. A preload changes
        when a resource is found, not where it sits in the queue.</p>`,
    }),
});

def('d04-css-bg', {
  title: 'LCP image discovered from CSS',
  summary: 'A background-image cannot be requested until the stylesheet has arrived and matched.',
  html: () =>
    doc({
      specimen: 'd04-css-bg',
      demo: 'preload',
      title: 'LCP image discovered from CSS',
      label: 'The hero is a background-image inside a slow stylesheet — the preload scanner cannot see it.',
      head: `
<script src="${JS_BLOCKING}"></script>
<link rel="stylesheet" href="${cssUrl({ id: 'hero-css', ttfb: 1200, hue: 205, bg: HERO })}">`,
      body: `<div class="css-background"></div>`,
      tail: `<p class="note">This is the case <code>preload</code> exists for: the request cannot even be
        issued until the CSS has downloaded, parsed and matched a selector against the DOM.</p>`,
    }),
});

def('d04-css-bg-preload', {
  title: 'CSS background image, preloaded',
  summary: 'Preload turns a late discovery into an immediate one.',
  html: () =>
    doc({
      specimen: 'd04-css-bg-preload',
      demo: 'preload',
      title: 'CSS background image, preloaded',
      label: 'Same stylesheet, plus a preload for the background image at the top of the head.',
      head: `
<link rel="preload" as="image" href="${HERO}">
<script src="${JS_BLOCKING}"></script>
<link rel="stylesheet" href="${cssUrl({ id: 'hero-css', ttfb: 1200, hue: 205, bg: HERO })}">`,
      body: `<div class="css-background"></div>`,
    }),
});

/* 05 — Crossorigin images ------------------------------------------------- */

const XO = (ctx, id, hue) => cdnImg(ctx.CDN_ORIGIN, { id, hue, marks: 1, w: 1200, h: 675, dur: 320 });
/* preconnect saves connection *latency*, and it can only save it if there is a
 * gap between the hint and the request. Two things create that gap here: the
 * image is light (so the measurement is latency-bound rather than
 * bandwidth-bound), and it is the third large image on the page (so Tight mode
 * holds it until the blocking head is done, giving the handshake ~1.4s to
 * complete in the background). Verified: without the decoys the image is
 * requested ~7ms into the navigation and the hint has no time to help at all. */
const XO_LIGHT = (ctx, id, hue) => cdnImg(ctx.CDN_ORIGIN, { id, hue, marks: 3, w: 520, h: 340, dur: 120 });

const xoGallery = (ctx, id, hue) => `<div class="decoys">
  <img src="${DECOY_1}" width="600" height="400" alt="Decoy image 1 — same origin">
  <img src="${DECOY_2}" width="600" height="400" alt="Decoy image 2 — same origin">
</div>
<figure class="hero">
  <img src="${XO_LIGHT(ctx, id, hue)}" width="520" height="340" alt="Cross-origin hero">
  <figcaption>LCP candidate, served from the second origin</figcaption>
</figure>`;

def('d05-plain', {
  title: 'Cross-origin image, no CORS',
  summary: 'A cross-origin <img> without the crossorigin attribute: a plain no-CORS request.',
  html: (ctx) =>
    doc({
      specimen: 'd05-plain',
      demo: 'crossorigin-images',
      subject: 'cdn-plain',
      title: 'Cross-origin image, no CORS',
      label: 'A single image served from a second origin, requested in no-CORS mode.',
      head: BLOCKING_HEAD,
      body: `<img src="${XO(ctx, 'cdn-plain', 260)}" width="1200" height="675" alt="Cross-origin hero">`,
    }),
});

def('d05-mismatch', {
  title: 'Preload / image CORS mismatch',
  summary: 'A preload whose CORS mode differs from the image is not reused — the bytes arrive twice.',
  html: (ctx) =>
    doc({
      specimen: 'd05-mismatch',
      demo: 'crossorigin-images',
      subject: 'cdn-mismatch',
      title: 'Preload / image CORS mismatch',
      label: 'preload without crossorigin, <img> with crossorigin="anonymous". Count the requests.',
      head: `
<link rel="preload" as="image" href="${XO(ctx, 'cdn-mismatch', 15)}">
${BLOCKING_HEAD.trim()}`,
      body: `<img src="${XO(ctx, 'cdn-mismatch', 15)}" crossorigin="anonymous" width="1200" height="675" alt="Cross-origin hero">`,
      tail: `<p class="note">Chrome logs <em>&ldquo;A preload for &hellip; is found, but is not used because
        the request credentials mode does not match&rdquo;</em> and downloads the image a second time. The
        preload made the page <strong>slower and heavier</strong>. Check the request count in the
        measurements below.</p>`,
    }),
});

def('d05-match', {
  title: 'Preload / image CORS match',
  summary: 'crossorigin on both sides: one request, served from the preload cache.',
  html: (ctx) =>
    doc({
      specimen: 'd05-match',
      demo: 'crossorigin-images',
      subject: 'cdn-match',
      title: 'Preload / image CORS match',
      label: 'Both the preload and the <img> carry crossorigin="anonymous", so the preload is reused.',
      head: `
<link rel="preload" as="image" href="${XO(ctx, 'cdn-match', 95)}" crossorigin="anonymous">
${BLOCKING_HEAD.trim()}`,
      body: `<img src="${XO(ctx, 'cdn-match', 95)}" crossorigin="anonymous" width="1200" height="675" alt="Cross-origin hero">`,
    }),
});

/* 06 — preconnect --------------------------------------------------------- */

def('d06-baseline', {
  title: 'Cross-origin hero, cold connection',
  summary: 'The connection to the image host is opened only when the image is requested.',
  html: (ctx) =>
    doc({
      specimen: 'd06-baseline',
      demo: 'preconnect',
      subject: 'cdn-cold',
      title: 'Cross-origin hero, cold connection',
      label: `The hero is the third large image and lives on a second origin whose connection setup costs ${ctx.CDN_CONNECT_DELAY}ms. No resource hints.`,
      head: BLOCKING_HEAD,
      body: xoGallery(ctx, 'cdn-cold', 250),
    }),
});

def('d06-preconnect', {
  title: 'Cross-origin hero, warmed with preconnect',
  summary: 'The setup is paid during the blocking head, off the image critical path.',
  html: (ctx) =>
    doc({
      specimen: 'd06-preconnect',
      demo: 'preconnect',
      subject: 'cdn-warm',
      title: 'Cross-origin hero, warmed with preconnect',
      label: 'Identical, plus a single <link rel="preconnect"> as the first element in the head.',
      head: `
<link rel="preconnect" href="${ctx.CDN_ORIGIN}">
${BLOCKING_HEAD.trim()}`,
      body: xoGallery(ctx, 'cdn-warm', 250),
      tail: `<p class="note">Compare the <strong>TTFB</strong> column for the hero row against the cold run.
        The bytes take just as long to transfer; the connection setup simply is not happening while you wait
        for them any more &mdash; it happened during the blocking head, while nothing was using the network
        for this host anyway.</p>${BOOST_NOTE}`,
    }),
});

/* 07 — preload and fetchpriority ------------------------------------------ */

def('d07-preload', {
  title: 'preload only',
  summary: 'The hero is discovered early, but still sits at the Low default.',
  html: () =>
    doc({
      specimen: 'd07-preload',
      demo: 'preload-and-fetchpriority',
      title: 'preload only',
      label: '<link rel="preload" as="image"> for the hero, with no priority hint.',
      head: `
<link rel="preload" as="image" href="${HERO}">
${BLOCKING_HEAD.trim()}`,
      body: gallery(),
    }),
});

def('d07-preload-high', {
  title: 'preload + fetchpriority="high"',
  summary: 'The pattern the article recommends: early discovery everywhere, high priority where supported.',
  html: () =>
    doc({
      specimen: 'd07-preload-high',
      demo: 'preload-and-fetchpriority',
      title: 'preload + fetchpriority="high"',
      label: 'The preload carries fetchpriority="high" — a progressive enhancement.',
      head: `
<link rel="preload" as="image" fetchpriority="high" href="${HERO}">
${BLOCKING_HEAD.trim()}`,
      body: gallery(),
      tail: `<p class="note">Browsers that do not implement Fetch Priority ignore the attribute and keep the
        preload. Browsers that do implement it get both.</p>`,
    }),
});

/* 08 — Tight mode --------------------------------------------------------- */

const TIGHT_NOTE = `<p class="note">The image on this page is deliberately 64&times;64. Chromium boosts the
  first two <em>large</em> images out of Low priority, which would hide the effect entirely; a small image
  gets no such help, so it stays <code>Low</code> and becomes a clean probe for the scheduler. It is also
  the only image here, so the in-flight count is exactly what the head declares.</p>`;

def('d08-two-inflight', {
  title: 'Two requests in flight',
  summary: 'A blocking script and a stylesheet together keep the Low priority queue closed.',
  html: () =>
    doc({
      specimen: 'd08-two-inflight',
      demo: 'tight-mode',
      subject: 'small',
      title: 'Two requests in flight',
      label: 'One blocking script (1500ms) and one stylesheet (1500ms) — two in-flight requests throughout.',
      head: `
<script src="${jsUrl({ id: 'slow-blocking', label: 'blocking.js', ttfb: 1500 })}"></script>
<link rel="stylesheet" href="${cssUrl({ id: 'slow-theme', ttfb: 1500 })}">`,
      body: `<img class="thumb" src="${SMALL}" width="64" height="64" alt="Small Low priority image">`,
      tail: TIGHT_NOTE,
    }),
});

def('d08-one-inflight', {
  title: 'One request in flight',
  summary: 'Remove the stylesheet and the image slips through during the initial phase.',
  html: () =>
    doc({
      specimen: 'd08-one-inflight',
      demo: 'tight-mode',
      subject: 'small',
      title: 'One request in flight',
      label: 'The same blocking script (1500ms), no stylesheet — a single in-flight request.',
      head: `
<script src="${jsUrl({ id: 'slow-blocking', label: 'blocking.js', ttfb: 1500 })}"></script>`,
      body: `<img class="thumb" src="${SMALL}" width="64" height="64" alt="Small Low priority image">`,
      tail: `<p class="note">Same render-blocking script, same image. The only change is that fewer than two
        requests are in flight, which is exactly the condition under which Chromium will start a Low
        priority download during the initial phase.</p>${TIGHT_NOTE}`,
    }),
});

/* 09 — No render-blocking scripts ----------------------------------------- */

def('d09-blocking', {
  title: 'Blocking script in the head',
  summary: 'The initial phase lasts until the script has downloaded and executed.',
  html: () =>
    doc({
      specimen: 'd09-blocking',
      demo: 'no-render-blocking-scripts',
      title: 'Blocking script in the head',
      label: 'A stylesheet plus a render-blocking script (1400ms), then three images.',
      head: `
<link rel="stylesheet" href="${cssUrl({ id: 'theme', ttfb: 600 })}">
<script src="${jsUrl({ id: 'head-blocking', label: 'blocking.js', ttfb: 1400 })}"></script>`,
      body: gallery(),
    }),
});

def('d09-none', {
  title: 'No render-blocking scripts',
  summary: 'The same script, moved to the end of the body with defer.',
  html: () =>
    doc({
      specimen: 'd09-none',
      demo: 'no-render-blocking-scripts',
      title: 'No render-blocking scripts',
      label: 'Identical stylesheet and images; the script is deferred and sits after the content.',
      head: `
<link rel="stylesheet" href="${cssUrl({ id: 'theme', ttfb: 600 })}">`,
      body: gallery(),
      tail: `<script defer src="${jsUrl({ id: 'tail-deferred', label: 'deferred.js', ttfb: 1400 })}"></script>
<p class="note">Nothing render-blocking remains, so the initial phase ends as soon as the head is parsed and
        the hero is free to download &mdash; with no hints on it at all.</p>`,
    }),
});

/* 10 — Early preload ------------------------------------------------------ */

def('d10-early', {
  title: 'Preload first in the head',
  summary: 'The hint is the first thing the parser sees.',
  html: () =>
    doc({
      specimen: 'd10-early',
      demo: 'early-preload',
      title: 'Preload first in the head',
      label: 'A high-priority preload placed before every other element in the head.',
      head: `
<link rel="preload" as="image" fetchpriority="high" href="${HERO}">
${BLOCKING_HEAD.trim()}`,
      body: gallery(),
    }),
});

def('d10-late-head', {
  title: 'Preload last in the head',
  summary: 'The same hint, declared after the blocking script and the stylesheet.',
  html: () =>
    doc({
      specimen: 'd10-late-head',
      demo: 'early-preload',
      title: 'Preload last in the head',
      label: 'The preload is the final element of the head, behind the script and stylesheet.',
      head: `
${BLOCKING_HEAD.trim()}
<link rel="preload" as="image" fetchpriority="high" href="${HERO}">`,
      body: gallery(),
      tail: `<p class="note">The preload scanner reads ahead, so document order inside the head costs less
        than you might fear &mdash; but resources of equal priority are still issued in discovery order.</p>`,
    }),
});

def('d10-injected', {
  title: 'Preload injected by script',
  summary: 'A preload that only exists after JavaScript runs is not an early preload at all.',
  html: () =>
    doc({
      specimen: 'd10-injected',
      demo: 'early-preload',
      title: 'Preload injected by script',
      label: 'The preload is created in JavaScript on DOMContentLoaded, and the hero is added with it.',
      head: BLOCKING_HEAD,
      body: `<div class="decoys">
  <img src="${DECOY_1}" width="600" height="400" alt="Decoy image 1">
  <img src="${DECOY_2}" width="600" height="400" alt="Decoy image 2">
</div>
<div id="slot"></div>`,
      tail: `<script>
  addEventListener("DOMContentLoaded", function () {
    var link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.fetchPriority = "high";
    link.href = ${JSON.stringify(HERO)};
    document.head.appendChild(link);

    var img = new Image(1200, 675);
    img.src = ${JSON.stringify(HERO)};
    document.getElementById("slot").appendChild(img);
  });
</script>
<p class="note">A preload cannot beat the parser to a resource it is declared after. This is the shape of
        most accidental regressions: the hint is real, it validates, it appears in the DOM &mdash; and it
        fires long after the resource was needed.</p>`,
    }),
});

/* 11 & 13 — script position relative to images ---------------------------- */

def('d13-script-before', {
  title: '<script> before the <img> elements',
  summary: 'The parser stops at the script; nothing after it can be laid out or painted yet.',
  html: () =>
    doc({
      specimen: 'd13-script-before',
      demo: 'script-before-img',
      title: '<script> before the <img> elements',
      label: 'A parser-blocking script (1400ms) sits in the body, ahead of the images.',
      head: `<link rel="stylesheet" href="${cssUrl({ id: 'theme', ttfb: 600 })}">`,
      body: `<script src="${jsUrl({ id: 'body-before', label: 'body-before.js', ttfb: 1400 })}"></script>
${gallery()}
${mark('images-parsed')}`,
      tail: `<p class="note">The images are still <em>discovered</em> on time by the preload scanner. What
        they cannot do is exist as elements until the parser gets past the script.</p>`,
    }),
});

def('d11-script-after', {
  title: '<script> after the <img> elements',
  summary: 'The images are parsed, laid out and painted before the script blocks anything.',
  html: () =>
    doc({
      specimen: 'd11-script-after',
      demo: 'script-after-img',
      title: '<script> after the <img> elements',
      label: 'The same parser-blocking script (1400ms), moved below the images.',
      body: `${gallery()}
${mark('images-parsed')}
<script src="${jsUrl({ id: 'body-after', label: 'body-after.js', ttfb: 1400 })}"></script>`,
      head: `<link rel="stylesheet" href="${cssUrl({ id: 'theme', ttfb: 600 })}">`,
      tail: `<p class="note">Both pages request exactly the same bytes. Only the parse and paint order
        differs &mdash; watch the <code>images-parsed</code> mark in the measurements below.</p>`,
    }),
});

/* 12 — defer and fetchpriority="high" ------------------------------------- */

def('d12-defer', {
  title: 'defer, default priority',
  summary: 'A deferred script is Low priority and queues behind everything else.',
  html: () =>
    doc({
      specimen: 'd12-defer',
      demo: 'defer-and-fetchpriority-high',
      title: 'defer, default priority',
      label: 'A deferred application script competing with three images, all at Low priority.',
      head: `
<link rel="stylesheet" href="${cssUrl({ id: 'theme', ttfb: 600 })}">
<script defer src="${jsUrl({ id: 'defer-low', label: 'defer-low.js', ttfb: 400, dur: 700 })}"></script>`,
      body: gallery(),
    }),
});

def('d12-defer-high', {
  title: 'defer + fetchpriority="high"',
  summary: 'Download early, still execute after parsing.',
  html: () =>
    doc({
      specimen: 'd12-defer-high',
      demo: 'defer-and-fetchpriority-high',
      title: 'defer + fetchpriority="high"',
      label: 'The same deferred script, raised to High priority for the download only.',
      head: `
<link rel="stylesheet" href="${cssUrl({ id: 'theme', ttfb: 600 })}">
<script defer fetchpriority="high" src="${jsUrl({ id: 'defer-high', label: 'defer-high.js', ttfb: 400, dur: 700 })}"></script>`,
      body: gallery(),
      tail: `<p class="note"><code>fetchpriority</code> changes <em>when the bytes are fetched</em>, not when
        the script runs. Execution order is still governed by <code>defer</code> &mdash; check the script
        execution timestamp against the <code>images-parsed</code> mark.</p>`,
    }),
});

/* 14 — Synchronous JavaScript after CSS ----------------------------------- */

def('d14-js-after-css', {
  title: 'Synchronous JavaScript after CSS',
  summary: 'The script downloads in 150ms but cannot execute until the stylesheet is parsed.',
  html: () =>
    doc({
      specimen: 'd14-js-after-css',
      demo: 'sync-js-after-css',
      title: 'Synchronous JavaScript after CSS',
      label: 'A slow stylesheet (1500ms) followed by a fast synchronous script (150ms).',
      head: `
<link rel="stylesheet" href="${cssUrl({ id: 'slow-css', ttfb: 1500 })}">
<script src="${jsUrl({ id: 'after-css', label: 'after-css.js', ttfb: 150 })}"></script>`,
      body: gallery(),
      tail: `<p class="note">The script is on the wire and finished within ~150ms, yet its execution
        timestamp lands after the stylesheet. Everything gated on &ldquo;blocking scripts have
        executed&rdquo; is gated on the CSS too.</p>`,
    }),
});

def('d14-js-before-css', {
  title: 'Synchronous JavaScript before CSS',
  summary: 'The same script, moved ahead of the stylesheet, executes as soon as it arrives.',
  html: () =>
    doc({
      specimen: 'd14-js-before-css',
      demo: 'sync-js-after-css',
      title: 'Synchronous JavaScript before CSS',
      label: 'Identical resources; the script is now declared before the slow stylesheet.',
      head: `
<script src="${jsUrl({ id: 'before-css', label: 'before-css.js', ttfb: 150 })}"></script>
<link rel="stylesheet" href="${cssUrl({ id: 'slow-css', ttfb: 1500 })}">`,
      body: gallery(),
    }),
});

/* 15 — Images with initial High priority ---------------------------------- */

def('d15-priorities', {
  title: 'Which images start High?',
  summary: 'Five images that exercise every branch of Chromium’s image priority rules.',
  html: () =>
    doc({
      specimen: 'd15-priorities',
      demo: 'images-initial-high-priority',
      title: 'Which images start High?',
      label: 'First, third, small, hinted and lazy images on a single page, behind one blocking script.',
      head: `<script src="${jsUrl({ id: 'blocking', label: 'blocking.js', ttfb: 1500 })}"></script>`,
      body: `<h2>1 &amp; 2. The first two large images — automatically boosted</h2>
<div class="decoys">
  <img src="${DECOY_1}" width="600" height="400" alt="First large image">
  <img src="${DECOY_2}" width="600" height="400" alt="Second large image">
</div>

<h2>3. The third large image — no help from the browser</h2>
<img src="${HERO}" width="1200" height="675" alt="Third large image, stays Low">

<h2>4. A small image — below the size threshold</h2>
<img class="thumb" src="${SMALL}" width="64" height="64" alt="64x64 image">

<h2>5. Explicit fetchpriority="high", below the fold</h2>
<img class="fold" src="${imgUrl({ id: 'hinted', hue: 320, marks: 5, w: 1200, h: 675, dur: 320 })}" fetchpriority="high" width="1200" height="675" alt="Explicitly prioritised image below the fold">`,
      tail: `<p class="note">Open the Network panel and add the <strong>Priority</strong> column. The first
        two large images are boosted out of <code>Low</code> before layout has even run. The third is not.
        The small one is not. The hinted one is <code>High</code> from the start despite being far below the
        fold &mdash; the hint does not care about the viewport, which is exactly why it is easy to misuse.</p>`,
    }),
});

module.exports = { specimens, HERO, DECOY_1, DECOY_2, SMALL, CSS_MAIN, JS_BLOCKING };
