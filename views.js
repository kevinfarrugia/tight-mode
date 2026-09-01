'use strict';

const { specimens } = require('./specimens');

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GROUPS = ['Foundations', 'Fetch Priority', 'Resource hints', 'Document order'];

function layout({ title, subtitle, body, ctx, script, activeId }) {
  const nav = require('./demos').ordered;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(subtitle || 'Runnable demos for fetchpriority, preload, preconnect and Tight mode.')}">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="shell">
  <aside class="sidebar">
    <a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true">FP</span>
      <span>
        <strong>fetchpriority</strong>
        <em>opportunity</em>
      </span>
    </a>
    <nav aria-label="Demos">
      <ol class="nav-list">
        ${nav
          .map(
            (d) => `<li${d.id === activeId ? ' class="is-active"' : ''}>
          <a href="/demo/${d.id}"><span class="n">${String(d.num).padStart(2, '0')}</span><span class="t">${esc(d.title)}</span></a>
        </li>`
          )
          .join('\n        ')}
      </ol>
    </nav>
    <footer class="side-foot">
      <p>Site <code>:${ctx.PORT}</code> &middot; CDN <code>:${ctx.CDN_PORT}</code></p>
      <p>Based on <a href="https://imkev.dev/fetchpriority-opportunity" rel="noreferrer">imkev.dev</a></p>
    </footer>
  </aside>
  <main id="main">
${body}
  </main>
</div>
${script ? `<script src="${script}"></script>` : ''}
</body>
</html>
`;
}

/* -------------------------------------------------------------- hub ----- */

function renderHub(ordered, ctx) {
  const cards = GROUPS.map((group) => {
    const items = ordered.filter((d) => d.group === group);
    if (!items.length) return '';
    return `<section class="group">
      <h2 class="group-title">${esc(group)}</h2>
      <div class="cards">
        ${items
          .map(
            (d) => `<a class="card" href="/demo/${d.id}">
          <span class="card-num">${String(d.num).padStart(2, '0')}</span>
          <h3>${esc(d.title)}</h3>
          <p>${esc(d.tagline)}</p>
          <span class="card-go">Open demo &rarr;</span>
        </a>`
          )
          .join('\n        ')}
      </div>
    </section>`;
  }).join('\n');

  const body = `
    <header class="hero">
      <p class="eyebrow">Resource priority, demonstrated</p>
      <h1>Why your LCP image waits<br><span class="grad">and what actually moves it</span></h1>
      <p class="lede">Fifteen runnable demos covering <code>fetchpriority</code>, <code>preload</code>,
        <code>preconnect</code>, render-blocking scripts and Chromium&rsquo;s Tight mode. Every demo serves
        real resources with real delays from a local server, measures itself, and shows you the waterfall.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="/demo/dom-interactive">Start at demo 01 &rarr;</a>
        <a class="btn" href="/demo/tight-mode">Jump to Tight mode</a>
      </div>
    </header>

    <section class="how">
      <h2>How to run these</h2>
      <ol class="how-steps">
        <li><strong>Open DevTools before you run a demo.</strong> Network panel, then right-click the column
          headers and enable <strong>Priority</strong>. That column is the ground truth; everything this site
          measures is an inference from timing.</li>
        <li><strong>Each demo opens its specimens in new tabs.</strong> A specimen is a standalone page that
          reproduces one loading pattern and nothing else. It measures itself after the
          <code>load</code> event and reports back here.</li>
        <li><strong>Compare the runs on the demo page.</strong> Results are stored per specimen, so you can
          run a baseline, run a variant, and read the delta without screenshotting anything.</li>
        <li><strong>Throttle the network to <em>Slow 4G</em>.</strong> This matters more than it sounds.
          The server builds in server-side delays, but on an unthrottled loopback connection the downloads
          themselves finish so fast that the queueing intervals are hard to read. Every number quoted on
          these pages was measured on Slow 4G.</li>
      </ol>
    </section>

    ${cards}

    <section class="caveats">
      <h2>Caveats worth knowing</h2>
      <dl>
        <dt>This server speaks HTTP/1.1</dt>
        <dd>So the six-connections-per-origin limit is in play, and it is a genuine confounder for
          priority experiments. Every specimen is kept to six or fewer subresources to stay clear of it.
          The article&rsquo;s field data comes from HTTP/2+ pages, where prioritisation is a stream concern
          rather than a connection one.</dd>
        <dt>Tight mode is a Chromium behaviour</dt>
        <dd>Firefox does not implement <code>fetchpriority</code> and waits for all render-blocking
          JavaScript before fetching Low priority images, which is why <code>preload</code> remains the
          portable workaround. Safari throttles Low priority same-origin resources but fetches cross-origin
          ones immediately. Run these demos in more than one browser.</dd>
        <dt>Connection cost is simulated</dt>
        <dd>Loopback handshakes are free, so the CDN origin on port ${ctx.CDN_PORT} charges
          ${ctx.CDN_CONNECT_DELAY}ms on every freshly-opened connection. A socket warmed by
          <code>preconnect</code> has already paid it. The saving is real; because the server enforces it,
          it shows up as time-to-first-byte rather than in the connect phase.</dd>
        <dt>Chromium boosts the first two large images</dt>
        <dd>Current Chromium lifts the first two sufficiently large images out of <code>Low</code> priority
          on its own, before layout runs. A page with a single hero image is therefore never throttled, and
          a demo built that way would show nothing. Several specimens here put two decoy images ahead of the
          hero so that the LCP candidate is the third — the position where the browser stops helping. This
          is a real change since the article was written, and arguably its best outcome.</dd>
        <dt>LCP needs a real, visible browser</dt>
        <dd>Paint and Largest Contentful Paint timings are only produced when the page actually composites.
          In a headless or background tab they come back empty and this site shows them as a dash. The
          request timings are unaffected.</dd>
        <dt>Nothing is cached</dt>
        <dd>Every generated resource is served <code>no-store</code>, so each run starts cold. The preload
          cache still works normally — it is a per-navigation memory cache, not the HTTP cache.</dd>
      </dl>
    </section>

    <footer class="page-foot">
      <p>Demos built after Kevin Farrugia&rsquo;s
        <a href="https://imkev.dev/fetchpriority-opportunity" rel="noreferrer">Fetch Priority: the overlooked LCP opportunity</a>.
        The measurements here are local and illustrative; the field data in the article is not.</p>
    </footer>`;

  return layout({ title: 'fetchpriority-opportunity — resource priority demos', body, ctx, script: null });
}

/* ------------------------------------------------------------- demo ----- */

function renderDemo(demo, ordered, ctx) {
  const idx = ordered.findIndex((d) => d.id === demo.id);
  const prev = ordered[idx - 1];
  const next = ordered[idx + 1];

  const runs = demo.runs
    .map((r) => {
      const spec = specimens[r.id];
      return `<article class="run" data-specimen="${r.id}">
        <header>
          <span class="badge badge-${r.badge.replace(/\s+/g, '-')}">${esc(r.badge)}</span>
          <h3>${esc(r.label)}</h3>
        </header>
        <p class="run-summary">${esc(spec ? spec.summary : '')}</p>
        <div class="run-actions">
          <button type="button" class="btn btn-primary" data-run="${r.id}">Run &nearr;</button>
          <button type="button" class="btn btn-ghost" data-source="${r.id}">Markup</button>
        </div>
        <div class="run-result" data-result="${r.id}"><p class="empty">Not run yet.</p></div>
      </article>`;
    })
    .join('\n      ');

  const body = `
    <nav class="crumbs"><a href="/">All demos</a> <span>/</span> <span>${String(demo.num).padStart(2, '0')}</span></nav>

    <header class="demo-head">
      <p class="eyebrow">${esc(demo.group)}</p>
      <h1>${esc(demo.title)}</h1>
      <p class="lede">${esc(demo.tagline)}</p>
    </header>

    <section class="concept">
      ${demo.concept.map((p) => `<p>${p}</p>`).join('\n      ')}
      ${
        demo.quote
          ? `<blockquote class="quote">
        <p>${demo.quote}</p>
        <cite><a href="https://imkev.dev/fetchpriority-opportunity" rel="noreferrer">imkev.dev/fetchpriority-opportunity</a></cite>
      </blockquote>`
          : ''
      }
    </section>

    <section class="runs">
      <div class="runs-head">
        <h2>Specimens</h2>
        <div class="runs-tools">
          <button type="button" class="btn btn-ghost" id="run-all">Run all in sequence</button>
          <button type="button" class="btn btn-ghost" id="clear-results">Clear results</button>
        </div>
      </div>
      <div class="run-grid">
      ${runs}
      </div>
    </section>

    <section class="compare" id="compare" hidden>
      <h2>Comparison</h2>
      <div class="table-scroll"><table class="cmp"><tbody></tbody></table></div>
      <p class="fineprint">Times are milliseconds from navigation start, taken from Navigation and
        Resource Timing in your browser. <strong>First image request starts</strong> is the metric most of
        these demos turn on: the article&rsquo;s whole subject is the interval between an image being
        discovered and its request actually being issued. Each specimen page also prints a per-resource
        waterfall with that gap broken out.</p>
    </section>

    <section class="lookfor">
      <h2>What to look for</h2>
      <ul>
        ${demo.lookFor.map((l) => `<li>${l}</li>`).join('\n        ')}
      </ul>
    </section>

    <section class="takeaway">
      <h2>Takeaway</h2>
      <p>${demo.takeaway}</p>
    </section>

    <nav class="pager">
      ${prev ? `<a class="pager-prev" href="/demo/${prev.id}"><span>&larr; Previous</span><strong>${esc(prev.title)}</strong></a>` : '<span></span>'}
      ${next ? `<a class="pager-next" href="/demo/${next.id}"><span>Next &rarr;</span><strong>${esc(next.title)}</strong></a>` : '<span></span>'}
    </nav>

    <dialog id="source-dialog">
      <header><h3>Markup</h3><button type="button" id="source-close" aria-label="Close">&times;</button></header>
      <pre><code id="source-body"></code></pre>
    </dialog>`;

  return layout({
    title: `${demo.num}. ${demo.title} — fetchpriority-opportunity`,
    subtitle: demo.tagline,
    body,
    ctx,
    script: '/assets/demo.js',
    activeId: demo.id,
  });
}

function render404(ordered, ctx) {
  return layout({
    title: 'Not found — fetchpriority-opportunity',
    ctx,
    body: `<header class="demo-head"><p class="eyebrow">404</p><h1>No such demo</h1>
      <p class="lede">Pick one from the list on the left, or <a href="/">go back to the index</a>.</p></header>`,
  });
}

module.exports = { renderHub, renderDemo, render404, esc };
