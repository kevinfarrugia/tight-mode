'use strict';

/*
 * The demo catalogue: prose, specimen pairings, and what to look for.
 * Based on Kevin Farrugia's "Fetch Priority: the overlooked LCP opportunity"
 * — https://imkev.dev/fetchpriority-opportunity
 */

const demos = [
  {
    id: 'dom-interactive',
    num: 1,
    title: 'DOM Interactive',
    tagline: 'The moment the parser stops being blocked — and images are finally allowed to move.',
    group: 'Foundations',
    concept: [
      'Browsers load in two phases. During the first one, the browser is still working through the render-blocking content of the <code>&lt;head&gt;</code>, and it is stingy about starting anything it considers unimportant. Images are the canonical unimportant resource: they start at <strong>Low</strong> priority, every one of them.',
      '<code>domInteractive</code> — the point at which <code>document.readyState</code> flips to <code>interactive</code> and <code>readystatechange</code> fires — is a convenient marker for the end of that first phase. Line it up against the moment your images actually start downloading and the shape of the problem becomes obvious: the hero image was discovered in the first kilobyte of HTML and then sat still.',
      'Notice in this specimen that the hero begins downloading while the stylesheet is <em>still in flight</em>. It is not CSS that gates it here. It is the blocking script.',
    ],
    quote:
      'In the chart above, once the render-blocking JavaScript is downloaded and executed (pink bar), the browser begins downloading the images, even if the two CSS files are still in-flight. The yellow vertical bar illustrates DOM Interactive — or when the <code>readystatechange</code> event was fired.',
    runs: [{ id: 'd01-dom-interactive', label: 'Run the specimen', badge: 'single' }],
    lookFor: [
      'The gap between <em>Start</em> and <em>Queued</em> on the hero row — that interval is the browser holding a resource it had already found.',
      'The <code>domInteractive</code> marker: the hero request begins as the blocking script finishes executing.',
      '<code>slow-theme.css</code> finishing <em>after</em> the hero has already started — CSS is not what is holding it.',
      'The two decoy images going out immediately. They are large and they are first, so the browser boosts them out of Low priority on its own.',
    ],
    takeaway:
      'The delay you are trying to remove is not download time. It is queueing time between discovery and request start, and it is bounded by the render-blocking head.',
  },

  {
    id: 'script-defer',
    num: 2,
    title: 'script defer',
    tagline: 'Taking a script out of the render-blocking set — and pushing it to the back of the queue.',
    group: 'Foundations',
    concept: [
      'A plain <code>&lt;script src&gt;</code> in the head is parser-blocking and render-blocking: the browser will not finish the first loading phase until it has been downloaded <em>and executed</em>. Adding <code>defer</code> changes two things at once, and it is worth separating them.',
      'First, the script no longer blocks: parsing continues, the initial phase can end, and the images behind it are released much sooner. Second, its request priority drops. A deferred script is fetched at <strong>Low</strong> priority, the same band as images — which means it is now the thing waiting in line.',
      'That second effect is the one people forget. <code>defer</code> is not free speed for the script itself; it is a decision that the script matters less than the pixels.',
    ],
    quote:
      'For example, a CSS file requested in the document&rsquo;s <code>&lt;head&gt;</code> will be assigned the <code>Highest</code> priority, while a <code>&lt;script&gt;</code> element with the <code>defer</code> attribute will be assigned the <code>Low</code> priority.',
    runs: [
      { id: 'd02-sync', label: 'Synchronous script', badge: 'baseline' },
      { id: 'd02-defer', label: 'Same script, deferred', badge: 'variant' },
    ],
    lookFor: [
      'How much earlier the first image request starts in the deferred version.',
      'The script row itself: it is requested at roughly the same time in both, but nothing waits on it any more.',
      '<code>domInteractive</code> collapsing once the script stops blocking the parser.',
    ],
    takeaway:
      'Use <code>defer</code> to shorten the render-blocking phase. Accept that the deferred script now competes with images at Low priority, and hint it up if it genuinely cannot wait.',
  },

  {
    id: 'fetchpriority',
    num: 3,
    title: 'fetchpriority',
    tagline: 'One attribute, applied to exactly one image.',
    group: 'Fetch Priority',
    concept: [
      'The Fetch Priority API exposes a <code>fetchpriority</code> attribute on <code>&lt;img&gt;</code>, <code>&lt;link&gt;</code>, <code>&lt;script&gt;</code> and <code>&lt;iframe&gt;</code>, plus a <code>priority</code> option on <code>fetch()</code>. It takes <code>high</code>, <code>low</code> or <code>auto</code>.',
      'The critical detail is that it is <em>relative</em>. It does not assign an absolute priority; it nudges the resource up or down from whatever default the browser had chosen. Images default to Low, so <code>fetchpriority="high"</code> promotes them to High — which is precisely what lets them escape the initial phase.',
      'A High priority image is no longer subject to the Low priority throttle, so it is requested as soon as the preload scanner finds it, alongside the render-blocking head rather than behind it.',
      'One caveat this demo has to work around: Chromium now boosts the first two sufficiently large images out of Low priority by itself. A page with a single hero is already fast without any hint, which is why the LCP candidate here is the <em>third</em> large image. That is where the browser stops helping and the attribute starts earning its place.',
    ],
    quote:
      'Images — by default — always start at a <code>Low</code> priority. Assigning <code>fetchpriority="high"</code> will increase their priority to <code>High</code>.',
    runs: [
      { id: 'd03-baseline', label: 'Four images, no hints', badge: 'baseline' },
      { id: 'd03-high', label: 'Hero at fetchpriority="high"', badge: 'variant' },
    ],
    lookFor: [
      'In the baseline, the hero is issued at the moment the blocking script finishes — it was discovered in the first kilobyte of HTML and then held.',
      'In the variant, the hero goes out with the head, roughly 1.8 seconds earlier on a throttled connection.',
      'The two decoys, which start immediately in <em>both</em> runs. They are the browser&rsquo;s automatic boost, not your hint.',
      'The <strong>Priority</strong> column in DevTools: <code>Low</code> on the baseline hero, <code>High</code> on the hinted one.',
    ],
    takeaway:
      'Apply it to the LCP image and to nothing else on the page. The mechanism works by taking bandwidth and scheduler attention away from other resources; used broadly it cancels itself out.',
  },

  {
    id: 'preload',
    num: 4,
    title: 'preload',
    tagline: 'A cure for late discovery — not for low priority.',
    group: 'Resource hints',
    concept: [
      '<code>&lt;link rel="preload"&gt;</code> tells the browser to start fetching something it would otherwise only find later. That is a discovery mechanism, not a priority mechanism, and the distinction decides whether preloading helps you at all.',
      'An <code>&lt;img&gt;</code> written into the initial HTML is already found by the preload scanner within milliseconds. Preloading it changes almost nothing: it was never late, it was just Low. A background image referenced from a stylesheet is a different story — it cannot be requested until the CSS has downloaded, parsed, and matched a selector against a built DOM.',
      'These four specimens isolate that difference: the same image, discovered from markup and from CSS, with and without a preload.',
    ],
    quote:
      '<code>preload</code> signals critical late-discovered resources. It is less effective for early-discovered markup images, since they are already in the browser&rsquo;s resource queue.',
    runs: [
      { id: 'd04-markup', label: 'Markup image', badge: 'baseline' },
      { id: 'd04-markup-preload', label: 'Markup image + preload', badge: 'variant' },
      { id: 'd04-css-bg', label: 'CSS background image', badge: 'baseline' },
      { id: 'd04-css-bg-preload', label: 'CSS background + preload', badge: 'variant' },
    ],
    lookFor: [
      'Markup image vs markup image + preload: a small delta, if any.',
      'CSS background vs CSS background + preload: a very large delta, roughly the full download time of the stylesheet.',
      'The <em>Discovered</em> column for the CSS case — without the hint, the request cannot even be issued until the stylesheet lands.',
    ],
    takeaway:
      'Preload things the parser cannot see: fonts, CSS background images, resources fetched by JavaScript. For an image already in your HTML, reach for <code>fetchpriority</code> instead.',
  },

  {
    id: 'crossorigin-images',
    num: 5,
    title: 'Crossorigin images',
    tagline: 'Where a preload silently downloads the image twice.',
    group: 'Resource hints',
    concept: [
      'A preload is only reused if it matches the eventual request — and CORS mode is part of the match. A <code>&lt;link rel="preload" as="image"&gt;</code> without <code>crossorigin</code> issues a no-CORS request; an <code>&lt;img crossorigin="anonymous"&gt;</code> issues a CORS request. They are not the same request, so the browser makes both.',
      'The failure is quiet. The page still works, the image still appears, and the only symptom is a console warning plus double the bytes on your most important image — the opposite of what the hint was added to achieve.',
      'The same matching rule applies to fonts (always CORS, always needing <code>crossorigin</code>) and to anything you preload for a <code>fetch()</code> call.',
      'Cross-origin images also behave differently across engines. Safari restricts Low priority <em>same-origin</em> resources during the initial phase but will fetch Low priority cross-origin resources straight away, so a third-party hero can be faster on Safari than a first-party one.',
    ],
    runs: [
      { id: 'd05-plain', label: 'No CORS at all', badge: 'reference' },
      { id: 'd05-mismatch', label: 'Preload / img mismatch', badge: 'broken' },
      { id: 'd05-match', label: 'Matching crossorigin', badge: 'fixed' },
    ],
    lookFor: [
      'Two rows for the same URL in the mismatch specimen — check the resource count in the summary.',
      'The Chrome console warning about the preload not being used.',
      'One row, and the image resolving from the preload, once both sides agree.',
    ],
    takeaway:
      'If the element has <code>crossorigin</code>, the preload needs it too — and vice versa. Verify by counting requests, not by looking at the page.',
  },

  {
    id: 'preconnect',
    num: 6,
    title: 'preconnect',
    tagline: 'Pay for the handshake while you are busy with something else.',
    group: 'Resource hints',
    concept: [
      'Before a single byte of a cross-origin image can be requested, the browser has to resolve DNS, open a TCP connection and complete a TLS handshake. On a mobile connection that is comfortably a third of a second, spent doing nothing useful.',
      '<code>&lt;link rel="preconnect"&gt;</code> moves that work forward so it overlaps the render-blocking head instead of sitting in front of your hero image. It does not change priority and it does not fetch anything — it only makes sure a warm connection is waiting.',
      'In this demo the CDN origin charges a deliberate setup cost on every freshly-opened connection, because a loopback handshake is otherwise free and there would be nothing to see. A socket opened early by the hint has already paid it; a cold one pays it in front of your image.',
      'One honest caveat: the simulated cost surfaces as time-to-first-byte rather than inside the connect phase of the waterfall, since it is enforced by the server rather than by the network. The interval it removes is real; its label in DevTools is not.',
    ],
    quote:
      'We can start downloading the images earlier using the <code>preconnect</code> resource hint.',
    runs: [
      { id: 'd06-baseline', label: 'Cold connection', badge: 'baseline' },
      { id: 'd06-preconnect', label: 'With preconnect', badge: 'variant' },
    ],
    lookFor: [
      'The <strong>TTFB</strong> column on the image row: a full setup cost in the baseline, near zero once the connection has been warmed.',
      'That the saving carries through to when the image <em>finishes</em>. It only does so because this image is small. Swap in a heavy one and the transfer becomes bandwidth-bound: the setup still happens earlier, but the finish time barely moves. <code>preconnect</code> buys latency, and latency only matters when latency is what you are short of.',
      'Total time to <em>response end</em> for the hero, and the resulting LCP.',
      'That the download itself takes exactly as long in both runs. Only the setup moved.',
    ],
    takeaway:
      'Host the LCP image on your own origin if you can. If you cannot, <code>preconnect</code> to its host — and only to hosts you are certain you will use, since each one costs a connection.',
  },

  {
    id: 'preload-and-fetchpriority',
    num: 7,
    title: 'preload and fetchpriority',
    tagline: 'The one-line recommendation, and why it is written as two hints.',
    group: 'Fetch Priority',
    concept: [
      'The two hints solve different halves of the problem. <code>preload</code> fixes <em>when</em> the browser learns about a resource; <code>fetchpriority</code> fixes <em>where it sits in the queue</em> once it knows. For an LCP image that is both late-discovered and Low priority, you want both.',
      'Combining them is also the cleanest cross-browser story available. Every browser understands the preload; the ones that implement Fetch Priority additionally honour the hint, and the ones that do not simply ignore an unknown attribute. There is no branching, no user-agent sniffing and no cost to the browsers that ignore it.',
      'This is the pattern the article recommends verbatim: <code>&lt;link rel="preload" as="image" fetchpriority="high" href="…"&gt;</code>.',
    ],
    quote:
      '<code>&lt;link rel="preload" as="image" fetchpriority="high" href="…"/&gt;</code> — this approach provides progressive enhancement: Chromium browsers apply <code>fetchpriority</code>, while others fall back to <code>preload</code>.',
    runs: [
      { id: 'd07-preload', label: 'preload only', badge: 'baseline' },
      { id: 'd07-preload-high', label: 'preload + fetchpriority', badge: 'variant' },
    ],
    lookFor: [
      'Both runs discover the hero at the same instant — the preload guarantees that.',
      'Only the hinted run starts fetching it during the blocking head.',
      'The other three images sliding slightly later in the hinted run. That is the trade you are making.',
    ],
    takeaway:
      'One line in the head, on one image. It degrades to a plain preload everywhere it is not supported.',
  },

  {
    id: 'tight-mode',
    num: 8,
    title: '"Tight mode"',
    tagline: 'The specific rule that keeps your hero image waiting.',
    group: 'Foundations',
    concept: [
      'Chromium&rsquo;s name for the first loading phase is <strong>Tight mode</strong>, and its rule is unusually concrete: while the browser is in it, Low priority resources are not started <em>unless fewer than two requests are already in flight</em>.',
      'That threshold explains behaviour that otherwise looks random. A page with one slow blocking script will happily start downloading a Low priority image alongside it. Add a single stylesheet next to that script and the image stops dead until the head is done — not because the stylesheet is expensive, but because it took the second in-flight slot.',
      'These two specimens differ by exactly one <code>&lt;link rel="stylesheet"&gt;</code>. Everything else — the blocking script, its delay, the image — is identical. Measured on a throttled connection, the image is requested at ~577ms with one in-flight request and at ~2253ms with two: it waits for the script to finish, and the script is the thing that ends the phase.',
      'The image is deliberately 64&times;64. Chromium boosts the first two <em>large</em> images out of Low priority, which would hide the effect completely; a small image gets no such help and makes a clean probe.',
    ],
    quote:
      'Most browsers download resources in two phases. During the initial phase (Chromium also refers to this as &ldquo;Tight mode&rdquo;), the browser does not download <code>Low</code> priority resources unless there are less than two in-flight requests. The initial phase is completed once all blocking scripts in the <code>&lt;head&gt;</code> have been downloaded and executed (scripts with <code>async</code> or <code>defer</code> are not render-blocking).',
    runs: [
      { id: 'd08-two-inflight', label: 'Script + stylesheet (2 in flight)', badge: 'blocked' },
      { id: 'd08-one-inflight', label: 'Script only (1 in flight)', badge: 'open' },
    ],
    lookFor: [
      'With two in-flight requests, the image is issued at the end of the head, not before.',
      'With one, it overlaps the blocking script from the very beginning and has finished long before the script has.',
      'The difference in <em>Subject image requested</em> — that whole interval is the scheduler, not the network.',
    ],
    takeaway:
      'You cannot turn Tight mode off. You can shorten it (fewer blocking resources) or opt a single resource out of it (<code>fetchpriority="high"</code>).',
  },

  {
    id: 'no-render-blocking-scripts',
    num: 9,
    title: 'No render-blocking scripts',
    tagline: 'End the initial phase instead of negotiating with it.',
    group: 'Foundations',
    concept: [
      'Every technique on this site is a workaround for a phase that exists because the head is blocking. Remove the blocking scripts and the phase ends almost immediately — no hints required, no priority to negotiate, no trade against other images.',
      'This is the least glamorous and most durable fix. A hint you add today decays as the page changes; a head with nothing blocking in it stays fast on its own.',
      'Note the scope of the rule: it is <em>blocking scripts in the head</em> that hold the phase open. <code>async</code> and <code>defer</code> scripts do not, which is why moving a script rather than deleting it is usually enough.',
    ],
    quote:
      'The initial phase is completed once all blocking scripts in the <code>&lt;head&gt;</code> have been downloaded and executed (scripts with <code>async</code> or <code>defer</code> are not render-blocking).',
    runs: [
      { id: 'd09-blocking', label: 'Blocking script in head', badge: 'baseline' },
      { id: 'd09-none', label: 'Nothing blocking', badge: 'variant' },
    ],
    lookFor: [
      'The first image request start, which should move by roughly the full duration of the script request.',
      '<code>domInteractive</code>, which stops tracking the script&rsquo;s response.',
      'That no priority hints appear anywhere in the faster specimen.',
    ],
    takeaway:
      'Before reaching for <code>fetchpriority</code>, check whether the blocking script that made it necessary needs to be there at all.',
  },

  {
    id: 'early-preload',
    num: 10,
    title: 'Early preload',
    tagline: 'A hint is only worth as much as its position in the document.',
    group: 'Resource hints',
    concept: [
      'A preload cannot beat the parser to something it is declared after. The preload scanner reads ahead aggressively, so moving a hint around <em>within</em> the head costs less than intuition suggests — but the moment a hint is created by JavaScript, it has lost the race entirely.',
      'The three specimens here place the same high-priority preload in three positions: first in the head, last in the head, and injected on <code>DOMContentLoaded</code>. The first two are close. The third is a different page.',
      'This is the shape of most accidental regressions. The hint is genuinely present, it validates, it shows up in the DOM — and it fires after the resource was already needed.',
    ],
    runs: [
      { id: 'd10-early', label: 'First in the head', badge: 'best' },
      { id: 'd10-late-head', label: 'Last in the head', badge: 'variant' },
      { id: 'd10-injected', label: 'Injected on DOMContentLoaded', badge: 'too late' },
    ],
    lookFor: [
      'The <em>Discovered</em> value for the hero across the three runs.',
      'How little separates the two static positions, thanks to the preload scanner.',
      'How far the injected version falls behind — it waits for the entire blocking head before it even exists.',
    ],
    takeaway:
      'Put preloads in the static HTML, as early in the head as you can. A hint added by your framework at runtime is usually a hint that does nothing.',
  },

  {
    id: 'script-after-img',
    num: 11,
    title: '<script> after <img> elements',
    tagline: 'Let the images be parsed, laid out and painted first.',
    group: 'Document order',
    concept: [
      'A parser-blocking script stops the parser at the point it appears. Anything after it in the document has not been parsed, is not in the DOM, has no layout box and cannot be painted — even if its bytes finished downloading long ago.',
      'Moving the script below the images does not change what is downloaded or when the download starts; the preload scanner finds the images either way. What changes is that the images can be laid out and painted while the script is still on the wire, which is what LCP measures.',
      'Compare this with <a href="/demo/script-before-img">demo 13</a>, which is the same page with the script moved above the images.',
    ],
    runs: [
      { id: 'd11-script-after', label: 'Script after the images', badge: 'variant' },
      { id: 'd13-script-before', label: 'Script before the images', badge: 'baseline' },
    ],
    lookFor: [
      'Request timings for the images: near-identical between the two runs, because the preload scanner found them either way.',
      'The <em>Images parsed</em> mark, which is the whole story — with the script last, the images become real elements roughly a second and a half earlier.',
      'LCP, which follows the parse mark rather than the download. (LCP needs a visible tab and a compositing browser; it will read as a dash in headless runs.)',
    ],
    takeaway:
      'If a script must be synchronous, put it after the content it does not need. Download order and paint order are two different problems.',
  },

  {
    id: 'defer-and-fetchpriority-high',
    num: 12,
    title: 'defer and fetchpriority="high"',
    tagline: 'Fetch it early, run it late.',
    group: 'Fetch Priority',
    concept: [
      'These two attributes control different stages and compose cleanly. <code>defer</code> governs <em>execution</em>: the script runs after parsing, in document order, never blocking the parser. <code>fetchpriority</code> governs <em>the fetch</em>: where the request sits in the queue.',
      'By default a deferred script is fetched at Low priority, which puts it in the same band as every image on the page and, during the initial phase, behind the throttle. For a script that hydrates the interface, that can mean the page looks ready long before it responds to a click.',
      'Adding <code>fetchpriority="high"</code> pulls the download forward without giving back any of the parser-blocking behaviour <code>defer</code> removed.',
    ],
    runs: [
      { id: 'd12-defer', label: 'defer, Low priority', badge: 'baseline' },
      { id: 'd12-defer-high', label: 'defer + fetchpriority="high"', badge: 'variant' },
    ],
    lookFor: [
      'The script&rsquo;s request start moving earlier in the hinted run.',
      'Its execution timestamp still landing after the document has parsed, in both runs.',
      'The images arriving slightly later in the hinted run — the bandwidth came from somewhere.',
    ],
    takeaway:
      'Reach for this when a deferred script is on the interaction critical path. It buys download time, never execution time.',
  },

  {
    id: 'script-before-img',
    num: 13,
    title: '<script> before <img> elements',
    tagline: 'The default arrangement, and what it costs.',
    group: 'Document order',
    concept: [
      'This is where scripts usually end up: near the top, above the content. The parser reaches the script, stops, and waits for it to download and execute before it will even look at the markup that follows.',
      'The images below it are still <em>discovered</em> on time — the preload scanner runs ahead of the parser precisely so downloads are not serialised behind script execution. But discovery is not display. Until the parser resumes, those images have no element, no layout and no paint.',
      'Run this alongside <a href="/demo/script-after-img">demo 11</a>. The network waterfalls are nearly identical; the LCP measurements are not.',
    ],
    runs: [
      { id: 'd13-script-before', label: 'Script before the images', badge: 'baseline' },
      { id: 'd11-script-after', label: 'Script after the images', badge: 'variant' },
    ],
    lookFor: [
      'How close the two image waterfalls are — evidence the preload scanner is doing its job.',
      'How far apart the two <em>Images parsed</em> marks are — evidence that parsing, not downloading, is the bottleneck.',
      'The gap between the hero&rsquo;s <em>response end</em> and the parse mark in this specimen: that interval is pure blocking.',
    ],
    takeaway:
      'A synchronous script above your content converts finished downloads into invisible pixels. Move it, defer it, or inline it if it is small.',
  },

  {
    id: 'sync-js-after-css',
    num: 14,
    title: 'Synchronous JavaScript after CSS',
    tagline: 'A fast script held hostage by a slow stylesheet.',
    group: 'Document order',
    concept: [
      'A synchronous script may query computed styles, so the browser will not execute it until every stylesheet declared before it has been downloaded and parsed. The script&rsquo;s own download time becomes irrelevant: it waits for the CSSOM.',
      'This chains directly into the rule from demo 8. The initial phase ends once blocking scripts have <em>executed</em> — so a 150ms script sitting after a 1500ms stylesheet keeps the whole page in the throttled phase for a second and a half, and your images with it.',
      'Swap the order and the script executes the moment it arrives. Same two resources, same bytes, an order of magnitude difference in when the page is released.',
    ],
    runs: [
      { id: 'd14-js-after-css', label: 'CSS, then script', badge: 'baseline' },
      { id: 'd14-js-before-css', label: 'Script, then CSS', badge: 'variant' },
    ],
    lookFor: [
      'The <em>script execution</em> timestamp in the summary versus the script&rsquo;s own <em>response end</em>. In the baseline they are far apart.',
      '<code>domInteractive</code> tracking the stylesheet, not the script.',
      'The images, which are gated on execution and therefore inherit the stylesheet&rsquo;s latency.',
    ],
    takeaway:
      'Order matters inside the head. A synchronous script placed above your stylesheets executes on its own schedule; below them, it executes on theirs.',
  },

  {
    id: 'images-initial-high-priority',
    num: 15,
    title: 'Images with initial High priority',
    tagline: 'Which images the browser promotes on its own, and which it never will.',
    group: 'Fetch Priority',
    concept: [
      'Chromium does try to help. Every image starts at Low, but the first two sufficiently large images on the page are boosted out of that band before layout has even run — which is why a page with one hero image is usually fast without any hint at all.',
      'The heuristic has hard edges, and they are worth knowing precisely. It applies to the first <em>two</em> large images, so a third one gets nothing. It skips images below a size threshold, so a 64&times;64 image is never boosted no matter where it sits. And it is a fixed count, not a measure of importance: it has no idea which image is your LCP element.',
      'This specimen puts one of each on a single page so the Priority column tells the whole story at a glance. Note the last image in particular — it is far below the fold and still <code>High</code>, because <code>fetchpriority</code> does not care about the viewport. That is exactly why it is easy to misuse.',
    ],
    runs: [{ id: 'd15-priorities', label: 'Run the specimen', badge: 'single' }],
    lookFor: [
      'Open DevTools → Network, right-click the column headers and enable <strong>Priority</strong>.',
      'Images 1 and 2 leaving immediately, in parallel with the blocking script.',
      'Image 3 — the same size, same page, same markup — waiting for the script to finish.',
      'The 64&times;64 image staying <code>Low</code> regardless of position.',
      'The hinted image going out first of all, from below the fold.',
    ],
    takeaway:
      'The automatic boost is a safety net that covers the first two large images and nothing else. If your LCP element is not one of them, the browser will not work it out for you — hint it explicitly.',
  },
];

const byId = new Map(demos.map((d) => [d.id, d]));
const ordered = demos.slice().sort((a, b) => a.num - b.num);

module.exports = { demos, byId, ordered };
