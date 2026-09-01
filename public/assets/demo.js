/* demo.js — drives a demo page: launching specimens, collecting their
 * self-reported measurements, and diffing them side by side. */
(function () {
  'use strict';

  var runs = Array.prototype.map.call(document.querySelectorAll('[data-specimen]'), function (el) {
    return el.getAttribute('data-specimen');
  });
  var results = {};
  var key = function (id) { return 'fpo:result:' + id; };

  /* ------------------------------------------------------------ utils --- */

  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var ms = function (n) { return n == null ? '—' : Math.round(n) + ' ms'; };
  var bytes = function (n) {
    if (!n) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' kB';
    return (n / 1048576).toFixed(2) + ' MB';
  };

  /* ---------------------------------------------------------- storage --- */

  function load() {
    runs.forEach(function (id) {
      try {
        var raw = localStorage.getItem(key(id));
        if (raw) results[id] = JSON.parse(raw);
      } catch (e) {}
    });
  }

  function accept(data) {
    if (!data || runs.indexOf(data.specimen) === -1) return;
    results[data.specimen] = data;
    paint();
  }

  try {
    var bc = new BroadcastChannel('fpo');
    bc.onmessage = function (e) { if (e.data && e.data.type === 'result') accept(e.data.data); };
  } catch (e) {}

  addEventListener('storage', function (e) {
    if (!e.key || e.key.indexOf('fpo:result:') !== 0 || !e.newValue) return;
    try { accept(JSON.parse(e.newValue)); } catch (err) {}
  });

  addEventListener('message', function (e) {
    if (e.origin === location.origin && e.data && e.data.type === 'fpo-result') accept(e.data.data);
  });

  /* ------------------------------------------------------------ paint --- */

  var METRICS = [
    { k: 'Subject image requested', get: function (d) { return d.subject ? d.subject.requestStart : null; }, fmt: ms, lower: true },
    { k: 'Subject image finished', get: function (d) { return d.subject ? d.subject.responseEnd : null; }, fmt: ms, lower: true },
    { k: 'domInteractive', get: function (d) { return d.nav.domInteractive; }, fmt: ms, lower: true },
    { k: 'Largest Contentful Paint', get: function (d) { return d.lcp ? d.lcp.time : null; }, fmt: ms, lower: true },
    { k: 'Last image finishes', get: function (d) { return d.lastImageEnd; }, fmt: ms, lower: true },
    { k: 'Images parsed', get: function (d) {
        var m = (d.marks || []).filter(function (x) { return x.name === 'images-parsed'; })[0];
        return m ? m.at : null;
      }, fmt: ms, lower: true },
    { k: 'Script executed', get: function (d) { return d.exec && d.exec.length ? d.exec[0].at : null; }, fmt: ms, lower: true },
    { k: 'load event', get: function (d) { return d.nav.loadEventEnd; }, fmt: ms, lower: true },
    { k: 'Requests', get: function (d) { return d.resources.length; }, fmt: String, lower: false },
    { k: 'Duplicated requests', get: function (d) { return d.duplicates; }, fmt: String, lower: true },
    { k: 'Transferred', get: function (d) { return d.totalBytes; }, fmt: bytes, lower: false },
  ];

  function paintCards() {
    runs.forEach(function (id) {
      var slot = document.querySelector('[data-result="' + id + '"]');
      if (!slot) return;
      var d = results[id];
      if (!d) { slot.innerHTML = '<p class="empty">Not run yet.</p>'; return; }
      var exec = d.exec && d.exec.length
        ? '<li><span>Script executed</span><b>' + esc(d.exec.map(function (e) { return e.id + ' @ ' + e.at + 'ms'; }).join(', ')) + '</b></li>'
        : '';
      slot.innerHTML =
        '<ul class="mini">' +
          '<li><span>' + (d.subject ? esc(d.subject.id) + ' requested' : 'First image') + '</span><b>' +
            ms(d.subject ? d.subject.requestStart : d.firstImageStart) + '</b></li>' +
          '<li><span>LCP</span><b>' + ms(d.lcp ? d.lcp.time : null) + '</b></li>' +
          '<li><span>domInteractive</span><b>' + ms(d.nav.domInteractive) + '</b></li>' +
          (d.duplicates ? '<li class="warn"><span>Duplicated requests</span><b>' + d.duplicates + '</b></li>' : '') +
          exec +
        '</ul>' +
        '<p class="ran">Ran ' + new Date(d.at).toLocaleTimeString() + '</p>';
    });
  }

  function paintCompare() {
    var have = runs.filter(function (id) { return results[id]; });
    var section = document.getElementById('compare');
    if (have.length < 2) { section.hidden = true; return; }
    section.hidden = false;

    var head = '<tr><th scope="col">Metric</th>' + have.map(function (id) {
      var el = document.querySelector('[data-specimen="' + id + '"] h3');
      return '<th scope="col">' + esc(el ? el.textContent : id) + '</th>';
    }).join('') + '<th scope="col">Δ</th></tr>';

    var body = METRICS.map(function (m) {
      var vals = have.map(function (id) { return m.get(results[id]); });
      var numeric = vals.filter(function (v) { return typeof v === 'number' && isFinite(v); });
      if (!numeric.length) return '';
      var best = m.lower ? Math.min.apply(null, numeric) : null;
      var spread = numeric.length > 1 ? Math.max.apply(null, numeric) - Math.min.apply(null, numeric) : 0;
      var cells = vals.map(function (v) {
        var isBest = m.lower && v === best && spread > 0;
        return '<td' + (isBest ? ' class="best"' : '') + '>' + m.fmt(v) + '</td>';
      }).join('');
      var delta = spread > 0 && m.fmt === ms ? '<td class="delta">' + ms(spread) + '</td>' : '<td class="delta">—</td>';
      return '<tr><th scope="row">' + m.k + '</th>' + cells + delta + '</tr>';
    }).join('');

    section.querySelector('table').innerHTML = '<thead>' + head + '</thead><tbody>' + body + '</tbody>';
  }

  function paint() { paintCards(); paintCompare(); }

  /* ------------------------------------------------------------- runs --- */

  function open(id) {
    var w = window.open('/specimen/' + id + '?t=' + Date.now(), 'fpo-' + id);
    if (w) w.focus();
    return w;
  }

  document.addEventListener('click', function (e) {
    var runBtn = e.target.closest('[data-run]');
    if (runBtn) { open(runBtn.getAttribute('data-run')); return; }

    var srcBtn = e.target.closest('[data-source]');
    if (srcBtn) { showSource(srcBtn.getAttribute('data-source')); return; }
  });

  var runAll = document.getElementById('run-all');
  if (runAll) {
    runAll.addEventListener('click', function () {
      runAll.disabled = true;
      runAll.textContent = 'Running…';
      var i = 0;
      (function next() {
        if (i >= runs.length) {
          runAll.disabled = false;
          runAll.textContent = 'Run all in sequence';
          window.focus();
          return;
        }
        open(runs[i++]);
        // Sequential, so the runs never contend for bandwidth with each other.
        setTimeout(next, 5200);
      })();
    });
  }

  var clear = document.getElementById('clear-results');
  if (clear) {
    clear.addEventListener('click', function () {
      runs.forEach(function (id) { try { localStorage.removeItem(key(id)); } catch (e) {} });
      results = {};
      paint();
    });
  }

  /* ----------------------------------------------------------- source --- */

  var dialog = document.getElementById('source-dialog');
  var sourceBody = document.getElementById('source-body');
  var closeBtn = document.getElementById('source-close');
  if (closeBtn) closeBtn.addEventListener('click', function () { dialog.close(); });
  if (dialog) {
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  }

  function highlight(src) {
    // Escape first, then decorate — never the other way round.
    return esc(src)
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<i class="c">$1</i>')
      .replace(/(&lt;\/?)([a-zA-Z][\w-]*)/g, '$1<i class="t">$2</i>')
      .replace(/([a-zA-Z-]+)=(&quot;[^&]*?&quot;)/g, '<i class="a">$1</i>=<i class="s">$2</i>');
  }

  function showSource(id) {
    sourceBody.innerHTML = '<span class="c">loading…</span>';
    dialog.showModal();
    fetch('/specimen/' + id + '?raw=1')
      .then(function (r) { return r.text(); })
      .then(function (t) {
        // The inline <style> is page furniture, not part of the demo.
        t = t.replace(/<style>[\s\S]*?<\/style>/, '<style>/* … specimen styling, elided … */</style>');
        sourceBody.innerHTML = highlight(t);
      })
      .catch(function () { sourceBody.textContent = 'Could not load the specimen source.'; });
  }

  load();
  paint();
})();
