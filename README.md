# fetchpriority-opportunity

A runnable series of demos about resource priority on the web: `fetchpriority`,
`preload`, `preconnect`, render-blocking scripts and Chromium's "Tight mode".

Built after Kevin Farrugia's article
[*Fetch Priority: the overlooked LCP opportunity*](https://imkev.dev/fetchpriority-opportunity).

## Running it

```sh
node server.js      # or: npm start
```

Then open <http://localhost:8080/>. There are no dependencies; Node 18+ is all
you need.

Two origins are started:

| Origin | Purpose |
| --- | --- |
| `http://localhost:8080` | the site and its first-party resources |
| `http://127.0.0.1:8081` | a second origin used as an image CDN |

The CDN charges a simulated connection setup cost (250ms by default) so that
`preconnect` has something real to save, and closes each connection after
responding so every run starts genuinely cold.

Environment variables: `PORT`, `CDN_PORT`, `CDN_HOST`, `CDN_CONNECT_DELAY`,
and `CDN_TRACE=1` to log CDN connection and request timings to stdout.

## How to read the demos

1. **Open DevTools first.** Network panel, then right-click the column headers
   and enable **Priority**. That column is ground truth; everything the site
   measures is inferred from timing.
2. **Throttle to Slow 4G.** The server builds in its own delays, but on an
   unthrottled loopback connection the transfers finish too fast to read the
   queueing intervals. Every figure quoted in the demo copy was measured on
   Slow 4G. (Demo 6, preconnect, is the exception — see its page.)
3. **Run the specimens from the demo page.** Each opens in its own tab,
   measures itself after the `load` event, and reports back. Results are stored
   per specimen so a baseline and a variant can be compared side by side.

## How it is put together

| File | Role |
| --- | --- |
| `server.js` | Two HTTP servers, an on-the-fly PNG encoder, and resources with `ttfb`/`dur` timing knobs |
| `specimens.js` | The 30 specimen documents — the pages actually under test |
| `demos.js` | The 15-demo catalogue: prose, quotes, pairings, what to look for |
| `views.js` | Hub and demo page rendering |
| `public/assets/probe.js` | In-page measurement, injected only after `load` |
| `public/assets/demo.js` | Launching specimens and diffing their results |

Generated resources accept `ttfb` (delay before the response starts) and `dur`
(how long to spread the body over), so each specimen controls exactly when its
bytes start and how long they take. Everything is served `no-store`.

## What was verified, and what that changed

The demos were checked against Chrome 151 rather than assumed from the article.
Three findings shaped the final design:

- **Tight mode reproduces exactly as described.** With one in-flight request a
  Low priority image is issued at ~577ms; add a stylesheet so two are in flight
  and the same image is held to ~2253ms, released the moment the blocking
  script completes.

- **Chromium now boosts the first two sufficiently large images** out of Low
  priority, before layout runs. A page with a single hero image is therefore
  never throttled, and a demo built that way shows nothing at all. Several
  specimens put two decoy images ahead of the hero so the LCP candidate is the
  third — the position where the browser stops helping. This is a real change
  since the article was written, and arguably its best outcome.

- **`preconnect` needs a gap between the hint and the request.** In a first
  draft the cross-origin image was requested ~7ms into the navigation and the
  hint had no time to help; the server trace showed the socket opening 1ms
  before the request. Making the image the third one restores the ~1.4s window
  the handshake needs, and the saving appears: TTFB 362ms → 125ms.

## Caveats

- **HTTP/1.1.** The six-connections-per-origin limit is a genuine confounder
  for priority experiments, so every specimen is kept to six or fewer
  subresources. The article's field data comes from HTTP/2+ pages, where
  prioritisation is a stream concern rather than a connection one.
- **Tight mode is a Chromium behaviour.** Firefox does not implement
  `fetchpriority` and waits for all render-blocking JavaScript before fetching
  Low priority images. Safari throttles Low priority same-origin resources but
  fetches cross-origin ones immediately. Run the demos in more than one browser.
- **The connection cost is simulated** by the server rather than the network, so
  it surfaces as time-to-first-byte rather than in the connect phase of the
  waterfall. The interval it removes is real; its label in DevTools is not.
- **LCP needs a real, visible browser.** Paint timings are only produced when
  the page actually composites; in a headless or background tab they come back
  empty and the site shows a dash. Request timings are unaffected.
- **The measurements here are local and illustrative.** The field data in the
  article is not.
