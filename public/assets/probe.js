/*
 * probe.js — the in-page measurement harness for a specimen.
 *
 * Appended to the document only after the `load` event, so it can never
 * influence the loading behaviour it is reporting on. It reads Navigation and
 * Resource Timing, renders a waterfall into the page, and publishes the result
 * to the demo pages via localStorage + BroadcastChannel.
 */
(function () {
  'use strict';

  var meta = function (n) {
    var el = document.querySelector('meta[name="' + n + '"]');
    return el ? el.content : '';
  };

  var SPECIMEN = meta('fpo-specimen');
  var LABEL = meta('fpo-label');
  var DEMO = meta('fpo-demo');
  var SUBJECT = meta('fpo-subject') || 'hero';
  var round = function (n) { return Math.round(n); };

  /* ------------------------------------------------------------- LCP --- */

  var lcp = null;
  try {
    var po = new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      var last = entries[entries.length - 1];
      if (last) lcp = { time: last.startTime, url: last.url || '', size: last.size || 0 };
    });
    po.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) { /* not supported */ }

  /* ------------------------------------------------------- collection --- */

  function collect() {
    var nav = performance.getEntriesByType('navigation')[0] || {};
    var paints = {};
    performance.getEntriesByType('paint').forEach(function (p) { paints[p.name] = p.startTime; });

    var resources = performance
      .getEntriesByType('resource')
      .filter(function (r) {
        // Only the resources the specimen itself declared — never the probe.
        return r.name.indexOf('/r/') !== -1;
      })
      .map(function (r) {
        var u = new URL(r.name);
        var id = u.searchParams.get('id') || u.pathname;
        var kind = u.pathname.replace('/r/', '');
        // connectStart/requestStart are 0 for cross-origin responses without
        // Timing-Allow-Origin; this server always sends it, but guard anyway.
        var hasDetail = r.requestStart > 0;
        return {
          id: id,
          kind: kind,
          crossOrigin: u.origin !== location.origin,
          initiator: r.initiatorType,
          start: r.startTime,
          connectStart: r.connectStart || 0,
          connectEnd: r.connectEnd || 0,
          requestStart: hasDetail ? r.requestStart : r.startTime,
          responseStart: r.responseStart || 0,
          responseEnd: r.responseEnd,
          duration: r.duration,
          transferSize: r.transferSize || 0,
          encodedBodySize: r.encodedBodySize || 0,
          renderBlocking: r.renderBlockingStatus || 'unknown',
          detailed: hasDetail,
        };
      })
      .sort(function (a, b) { return a.start - b.start; });

    // Duplicate URLs are the tell for a preload that was not reused.
    var seen = {};
    var duplicates = 0;
    performance.getEntriesByType('resource').forEach(function (r) {
      if (r.name.indexOf('/r/') === -1) return;
      if (seen[r.name]) duplicates++;
      seen[r.name] = true;
    });

    var images = resources.filter(function (r) { return r.kind === 'img'; });
    // The "subject" is the image the demo is actually about, named by the
    // specimen in a <meta> tag. Falls back to the first image on the page.
    var subject = null;
    for (var i = 0; i < images.length; i++) {
      if (images[i].id === SUBJECT) { subject = images[i]; break; }
    }
    if (!subject && images.length) subject = images[0];

    return {
      specimen: SPECIMEN,
      label: LABEL,
      demo: DEMO,
      at: Date.now(),
      nav: {
        responseEnd: nav.responseEnd || 0,
        domInteractive: nav.domInteractive || 0,
        domContentLoadedEventEnd: nav.domContentLoadedEventEnd || 0,
        loadEventEnd: nav.loadEventEnd || 0,
      },
      paints: paints,
      lcp: lcp,
      exec: (window.__execLog || []).slice(),
      duplicates: duplicates,
      marks: (window.__marks || []).slice(),
      subject: subject ? { id: subject.id, start: subject.start, requestStart: subject.requestStart, responseEnd: subject.responseEnd } : null,
      firstImageStart: images.length ? images[0].start : null,
      lastImageEnd: images.length ? Math.max.apply(null, images.map(function (i) { return i.responseEnd; })) : null,
      totalBytes: resources.reduce(function (a, r) { return a + r.transferSize; }, 0),
      resources: resources,
    };
  }

  /* ---------------------------------------------------------- publish --- */

  function publish(data) {
    try { localStorage.setItem('fpo:result:' + SPECIMEN, JSON.stringify(data)); } catch (e) {}
    try { new BroadcastChannel('fpo').postMessage({ type: 'result', data: data }); } catch (e) {}
    try { if (window.opener) window.opener.postMessage({ type: 'fpo-result', data: data }, location.origin); } catch (e) {}
  }

  /* ----------------------------------------------------------- render --- */

  var CSS =
    '#fpo-probe{margin:44px 0 0;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#dbe3f0}' +
    '#fpo-probe h2{font:600 12px/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#7c8aa5;margin:0 0 14px}' +
    '#fpo-probe .sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px;margin-bottom:18px}' +
    '#fpo-probe .sum div{background:#121826;border:1px solid #212a3b;border-radius:9px;padding:9px 11px}' +
    '#fpo-probe .sum dt{color:#7c8aa5;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 3px}' +
    '#fpo-probe .sum dd{margin:0;font-size:17px;font-variant-numeric:tabular-nums;color:#e8eefb}' +
    '#fpo-probe .sum dd small{font-size:11px;color:#7c8aa5;margin-left:2px}' +
    '#fpo-probe table{width:100%;border-collapse:collapse}' +
    '#fpo-probe th{text-align:left;font:600 10.5px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;' +
      'color:#7c8aa5;padding:0 8px 7px;border-bottom:1px solid #212a3b;white-space:nowrap}' +
    '#fpo-probe td{padding:7px 8px;border-bottom:1px solid #171e2b;font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '#fpo-probe td.name{white-space:normal;min-width:140px}' +
    '#fpo-probe .kind{display:inline-block;font-size:10px;padding:1px 6px;border-radius:99px;border:1px solid #2c3648;margin-left:6px}' +
    '#fpo-probe .k-img{color:#7fd1ae;border-color:#22503f;background:#10241d}' +
    '#fpo-probe .k-css{color:#8ab4ff;border-color:#26406e;background:#111a2c}' +
    '#fpo-probe .k-js{color:#f5b971;border-color:#5c421f;background:#241a0f}' +
    '#fpo-probe .xo{color:#c79bf0;border-color:#4a2f6b;background:#1c1329}' +
    '#fpo-probe .bar{position:relative;height:15px;min-width:220px;background:#101623;border-radius:4px;overflow:hidden}' +
    '#fpo-probe .bar span{position:absolute;top:0;height:100%}' +
        '#fpo-probe .track{width:100%}' +
    '#fpo-probe .marks{position:relative;height:30px;margin-bottom:2px}' +
    '#fpo-probe .mark{position:absolute;top:0;height:29px;border-left:1px dashed #4b5b7a}' +
    '#fpo-probe .mark b{position:absolute;font-size:9.5px;color:#8ea0c0;font-weight:500;white-space:nowrap}' +
    '#fpo-probe .mark.r b{right:4px}#fpo-probe .mark:not(.r) b{left:4px}' +
    '#fpo-probe .fine{color:#7c8aa5;margin-top:12px;font-size:11.5px;line-height:1.6}' +
    '#fpo-probe .back{display:inline-block;margin-top:16px;color:#8ab4ff}';

  function bytes(n) {
    if (!n) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' kB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  function render(d) {
    var scale = Math.max(
      d.nav.loadEventEnd,
      d.lcp ? d.lcp.time : 0,
      d.resources.reduce(function (m, r) { return Math.max(m, r.responseEnd); }, 0)
    ) * 1.04 || 1;
    var pct = function (t) { return (t / scale) * 100; };

    var rows = d.resources
      .map(function (r) {
        var stall = Math.max(0, r.requestStart - r.start);
        var ttfb = Math.max(0, (r.responseStart || r.requestStart) - r.requestStart);
        var dl = Math.max(0, r.responseEnd - (r.responseStart || r.requestStart));
        var kindClass = r.kind === 'img' ? 'k-img' : r.kind === 'css' ? 'k-css' : 'k-js';
        return (
          '<tr>' +
          '<td class="name">' + r.id +
            '<span class="kind ' + kindClass + '">' + r.kind + '</span>' +
            (r.crossOrigin ? '<span class="kind xo">cross-origin</span>' : '') +
          '</td>' +
          '<td>' + round(r.start) + '</td>' +
          '<td>' + round(stall) + '</td>' +
          '<td>' + round(ttfb) + '</td>' +
          '<td>' + round(dl) + '</td>' +
          '<td>' + round(r.responseEnd) + '</td>' +
          '<td>' + bytes(r.transferSize) + '</td>' +
          '<td class="track"><div class="bar">' +
            '<span style="left:' + pct(r.start) + '%;width:' + Math.max(0.4, pct(stall)) + '%;background:#3a4a68"></span>' +
            '<span style="left:' + pct(r.requestStart) + '%;width:' + Math.max(0.4, pct(ttfb)) + '%;background:#4d5f86"></span>' +
            '<span style="left:' + pct(r.responseStart || r.requestStart) + '%;width:' + Math.max(0.6, pct(dl)) + '%;background:#5b8cff"></span>' +
          '</div></td>' +
          '</tr>'
        );
      })
      .join('');

    var marks = [
      { t: d.nav.domInteractive, l: 'domInteractive' },
      { t: d.lcp ? d.lcp.time : 0, l: 'LCP' },
      { t: d.nav.loadEventEnd, l: 'load' },
    ].filter(function (m) { return m.t > 0; });

    var sum = function (label, value, unit) {
      return '<div><dt>' + label + '</dt><dd>' + value + (unit ? '<small>' + unit + '</small>' : '') + '</dd></div>';
    };

    var execRows = d.exec.length
      ? d.exec.map(function (e) { return e.id + ' @ ' + e.at + 'ms'; }).join(' &middot; ')
      : 'none';
    var markRows = d.marks.length
      ? d.marks.map(function (m) { return m.name + ' @ ' + m.at + 'ms'; }).join(' &middot; ')
      : 'none';

    var el = document.createElement('section');
    el.id = 'fpo-probe';
    el.innerHTML =
      '<h2>Measurements</h2>' +
      '<dl class="sum">' +
        sum('domInteractive', round(d.nav.domInteractive), 'ms') +
        sum('LCP', d.lcp ? round(d.lcp.time) : '—', d.lcp ? 'ms' : '') +
        sum(d.subject ? d.subject.id + ' requested' : 'First image starts',
            d.subject ? round(d.subject.requestStart) : '—', 'ms') +
        sum('Last image done', d.lastImageEnd == null ? '—' : round(d.lastImageEnd), 'ms') +
        sum('load', round(d.nav.loadEventEnd), 'ms') +
        sum('Requests', d.resources.length, d.duplicates ? ' +' + d.duplicates + ' dup' : '') +
        sum('Transferred', bytes(d.totalBytes), '') +
      '</dl>' +
      '<table><thead><tr>' +
        '<th>Resource</th><th>Start</th><th>Queued</th><th>TTFB</th><th>Download</th><th>End</th><th>Size</th>' +
        '<th style="width:42%">' +
          '<div class="marks">' + marks.map(function (m, i) {
            var p = pct(m.t);
            return '<i class="mark' + (p > 72 ? ' r' : '') + '" style="left:' + p + '%">' +
              '<b style="top:' + (i % 3) * 10 + 'px">' + m.l + '</b></i>';
          }).join('') + '</div>' +
        '</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="fine">All times in milliseconds from navigation start. <b>Start</b> is when the request was ' +
      'created; <b>Queued</b> is the gap before it went on the wire — connection setup plus any time the ' +
      'scheduler held it back. Script execution: ' + execRows + '. Parser marks: ' + markRows + '.</p>' +
      '<a class="back" href="/demo/' + d.demo + '">&larr; Back to the demo</a>';

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    (document.querySelector('.wrap') || document.body).appendChild(el);
  }

  /* Give LCP and any trailing responses a beat to settle, then report once. */
  setTimeout(function () {
    var data = collect();
    publish(data);
    render(data);
  }, 400);
})();
