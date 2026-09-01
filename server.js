#!/usr/bin/env node
'use strict';

/*
 * fetchpriority-opportunity
 * ------------------------------------------------------------------
 * A small dependency-free server that hosts a series of demos about
 * resource priority on the web: fetchpriority, preload, preconnect,
 * render-blocking scripts and Chromium's "Tight mode".
 *
 * Two origins are started:
 *   http://localhost:PORT       the "site"
 *   http://127.0.0.1:CDN_PORT   a separate origin used as an image CDN,
 *                               with a simulated connection setup cost so
 *                               that `preconnect` has something to save.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const { specimens } = require('./specimens');
const { demos, byId, ordered } = require('./demos');
const { renderHub, renderDemo, render404 } = require('./views');

const PORT = Number(process.env.PORT || 8080);
const CDN_PORT = Number(process.env.CDN_PORT || 8081);
const CDN_HOST = process.env.CDN_HOST || '127.0.0.1';
/* Simulated TCP+TLS handshake cost on the CDN origin, in ms. This is what
 * `preconnect` is able to move off the critical path. */
const CDN_CONNECT_DELAY = Number(process.env.CDN_CONNECT_DELAY || 250);

const CDN_ORIGIN = `http://${CDN_HOST}:${CDN_PORT}`;

/* ---------------------------------------------------------------- PNG ---
 * Just enough of a PNG encoder to emit a colourful, weakly-compressible
 * image of an arbitrary size, so downloads take a realistic amount of time.
 */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

const imageCache = new Map();

/* Renders a diagonal gradient in `hue`, dithered with pseudo-random noise so
 * the deflate stream stays big, plus `marks` white squares so each image in a
 * waterfall is identifiable on screen. */
function makePng({ w, h, hue, noise, grain, marks }) {
  const key = [w, h, hue, noise, grain, marks].join(':');
  if (imageCache.has(key)) return imageCache.get(key);

  const stride = 1 + w * 3;
  const raw = Buffer.alloc(h * stride);
  let seed = (hue * 2654435761) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) >>> 24);

  for (let y = 0; y < h; y++) {
    const row = y * stride;
    raw[row] = 0; // filter type: none
    for (let x = 0; x < w; x++) {
      const t = (x / w) * 0.6 + (y / h) * 0.4;
      const [r, g, b] = hslToRgb(hue + t * 55, 0.62, 0.34 + t * 0.34);
      // Noise is what makes the deflate stream large. Applying it to only
      // every `grain`-th pixel gives fine control over the payload size.
      const n = noise && (x + y * 3) % grain === 0 ? (rnd() % noise) - noise / 2 : 0;
      const o = row + 1 + x * 3;
      raw[o] = Math.max(0, Math.min(255, r + n));
      raw[o + 1] = Math.max(0, Math.min(255, g + n));
      raw[o + 2] = Math.max(0, Math.min(255, b + n));
    }
  }

  // Index markers: `marks` white squares along the top-left.
  const size = Math.max(12, Math.round(h * 0.07));
  const pad = Math.round(size * 0.6);
  for (let i = 0; i < marks; i++) {
    for (let y = pad; y < pad + size && y < h; y++) {
      for (let x = pad + i * (size + pad); x < pad + i * (size + pad) + size && x < w; x++) {
        const o = y * stride + 1 + x * 3;
        raw[o] = raw[o + 1] = raw[o + 2] = 245;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  imageCache.set(key, png);
  return png;
}

/* ------------------------------------------------------------ sending ---
 * Every generated resource supports two knobs:
 *   ttfb  ms to wait before the response starts (server think time)
 *   dur   ms to spread the body over (transfer time)
 */

function sendTimed(req, res, { status = 200, headers, body, ttfb = 0, dur = 0 }) {
  const finish = () => {
    if (res.writableEnded) return;
    res.writeHead(status, {
      'content-length': String(body.length),
      'cache-control': 'no-store, must-revalidate',
      ...headers,
    });
    if (req.method === 'HEAD') return res.end();
    if (!dur || body.length === 0) return res.end(body);

    const steps = Math.max(2, Math.min(40, Math.round(dur / 25)));
    const chunkSize = Math.ceil(body.length / steps);
    let offset = 0;
    const tick = setInterval(() => {
      if (res.writableEnded || res.destroyed) return clearInterval(tick);
      res.write(body.subarray(offset, offset + chunkSize));
      offset += chunkSize;
      if (offset >= body.length) {
        clearInterval(tick);
        res.end();
      }
    }, dur / steps);
    res.on('close', () => clearInterval(tick));
  };
  if (ttfb > 0) setTimeout(finish, ttfb);
  else finish();
}

const num = (v, dflt, max) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return dflt;
  return max === undefined ? n : Math.min(n, max);
};

/* --------------------------------------------------------- resources ---- */

function serveResource(req, res, url, isCdn) {
  const q = url.searchParams;
  // A socket opened early (by preconnect) has already served out its
  // simulated handshake by the time a request arrives on it; a cold socket
  // pays the whole cost now.
  const connectWait = Math.max(0, (req.socket.__readyAt || 0) - Date.now());
  const ttfb = num(q.get('ttfb'), 0, 10000) + connectWait;
  const dur = num(q.get('dur'), 0, 10000);
  const id = (q.get('id') || 'r').slice(0, 40);

  // The CDN closes each connection after responding. Without this, Chrome
  // keeps sockets alive *across navigations*, so the "cold" baseline run of
  // the preconnect demo silently reuses a socket warmed by the previous run
  // and the comparison shows nothing.
  const cors = isCdn
    ? { 'access-control-allow-origin': '*', 'timing-allow-origin': '*', connection: 'close' }
    : { 'timing-allow-origin': '*' };

  if (url.pathname === '/r/css') {
    const hue = num(q.get('hue'), 210, 360);
    const bg = q.get('bg'); // optionally reference a background image from CSS
    const body = Buffer.from(
      `/* ${id}.css - served with ttfb=${ttfb}ms dur=${dur}ms */\n` +
        `:root { --demo-accent-${id}: hsl(${hue} 70% 55%); }\n` +
        `.stylesheet-${id} { border-left: 4px solid hsl(${hue} 70% 55%); }\n` +
        (bg ? `.css-background { background-image: url("${bg}"); background-size: cover; }\n` : '') +
        `/* padding */\n` + `/* ${'-'.repeat(600)} */\n`.repeat(24),
      'utf8'
    );
    return sendTimed(req, res, { headers: { 'content-type': 'text/css; charset=utf-8', ...cors }, body, ttfb, dur });
  }

  if (url.pathname === '/r/js') {
    const label = q.get('label') || id;
    const body = Buffer.from(
      `/* ${id}.js - served with ttfb=${ttfb}ms dur=${dur}ms */\n` +
        `(function () {\n` +
        `  var t = Math.round(performance.now());\n` +
        `  (window.__execLog = window.__execLog || []).push({ id: ${JSON.stringify(label)}, at: t });\n` +
        `  if (window.console && console.info) console.info('[exec] ' + ${JSON.stringify(label)} + ' @ ' + t + 'ms');\n` +
        `})();\n` +
        `/* padding */\n` + `/* ${'-'.repeat(600)} */\n`.repeat(20),
      'utf8'
    );
    return sendTimed(req, res, { headers: { 'content-type': 'text/javascript; charset=utf-8', ...cors }, body, ttfb, dur });
  }

  if (url.pathname === '/r/img') {
    const w = num(q.get('w'), 1200, 2400);
    const h = num(q.get('h'), 675, 1600);
    const hue = num(q.get('hue'), 210, 360);
    const noise = num(q.get('noise'), 26, 255);
    const grain = Math.max(1, num(q.get('grain'), 6, 64));
    const marks = num(q.get('marks'), 1, 8);
    const body = makePng({ w: Math.max(8, w), h: Math.max(8, h), hue, noise, grain, marks });
    return sendTimed(req, res, { headers: { 'content-type': 'image/png', ...cors }, body, ttfb, dur });
  }

  if (url.pathname === '/r/json') {
    const body = Buffer.from(JSON.stringify({ id, ttfb, dur, at: Date.now() }), 'utf8');
    return sendTimed(req, res, { headers: { 'content-type': 'application/json', ...cors }, body, ttfb, dur });
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('unknown resource\n');
}

/* ----------------------------------------------------------- statics ---- */

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.html': 'text/html; charset=utf-8',
};

function serveStatic(req, res, url) {
  const rel = url.pathname.replace(/^\/+/, '');
  const file = path.join(__dirname, 'public', rel);
  if (!file.startsWith(path.join(__dirname, 'public') + path.sep)) {
    res.writeHead(403).end('forbidden');
    return true;
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const body = fs.readFileSync(file);
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
    'content-length': String(body.length),
  });
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}

function html(res, body, status = 200) {
  const buf = Buffer.from(body, 'utf8');
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store, must-revalidate',
    'content-length': String(buf.length),
  });
  res.end(buf);
}

/* ------------------------------------------------------------ routing --- */

const ctx = { CDN_ORIGIN, PORT, CDN_PORT, CDN_CONNECT_DELAY };

function siteHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/r/')) return serveResource(req, res, url, false);
  if (url.pathname.startsWith('/assets/')) {
    if (serveStatic(req, res, url)) return;
    res.writeHead(404).end('not found');
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    return html(res, renderHub(ordered, ctx));
  }

  if (url.pathname.startsWith('/demo/')) {
    const id = decodeURIComponent(url.pathname.slice('/demo/'.length)).replace(/\/$/, '');
    const demo = byId.get(id);
    if (!demo) return html(res, render404(ordered, ctx), 404);
    return html(res, renderDemo(demo, ordered, ctx));
  }

  if (url.pathname.startsWith('/specimen/')) {
    const id = decodeURIComponent(url.pathname.slice('/specimen/'.length)).replace(/\/$/, '');
    const spec = specimens[id];
    if (!spec) return html(res, render404(ordered, ctx), 404);
    const doc = spec.html(ctx);
    if (url.searchParams.get('raw') === '1') {
      const buf = Buffer.from(doc, 'utf8');
      res.writeHead(200, {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': String(buf.length),
      });
      return res.end(buf);
    }
    return html(res, doc);
  }

  if (url.pathname === '/api/specimens') {
    const body = JSON.stringify(
      Object.fromEntries(Object.entries(specimens).map(([k, v]) => [k, { title: v.title, summary: v.summary }]))
    );
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(body);
  }

  return html(res, render404(ordered, ctx), 404);
}

function cdnHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || CDN_HOST}`);
  if (process.env.CDN_TRACE) {
    const wait = Math.max(0, (req.socket.__readyAt || 0) - Date.now());
    console.log(`[cdn] request ${url.pathname}${url.search.slice(0, 40)} t=${Date.now() % 100000} wait=${wait}ms`);
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'timing-allow-origin': '*',
    });
    return res.end();
  }
  if (url.pathname.startsWith('/r/')) return serveResource(req, res, url, true);
  res.writeHead(404, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
  res.end('cdn: unknown resource\n');
}

const site = http.createServer(siteHandler);

const cdn = http.createServer(cdnHandler);
/* Simulate the cost of opening a connection to a third-party origin.
 *
 * Pausing the socket does not work here: Node's HTTP parser consumes the
 * handle directly and reads straight past it. Instead every socket records
 * the moment it is considered "ready", and a request that arrives before then
 * is held until it is. A cold connection therefore pays the full handshake,
 * while a socket opened early by `preconnect` has already paid it and answers
 * immediately -- which is exactly the behaviour the hint exists to produce.
 *
 * The one fidelity loss is that the cost surfaces as TTFB rather than in the
 * connect phase of the waterfall. */
if (CDN_CONNECT_DELAY > 0) {
  cdn.on('connection', (socket) => {
    socket.__readyAt = Date.now() + CDN_CONNECT_DELAY;
    if (process.env.CDN_TRACE) console.log(`[cdn] connection opened  t=${Date.now() % 100000}`);
  });
}
cdn.keepAliveTimeout = 30000;
site.keepAliveTimeout = 30000;

site.listen(PORT, () => {
  cdn.listen(CDN_PORT, CDN_HOST, () => {
    const line = '─'.repeat(64);
    console.log(`\n${line}`);
    console.log('  fetchpriority-opportunity — resource priority demos');
    console.log(line);
    console.log(`  site  →  http://localhost:${PORT}/`);
    console.log(`  cdn   →  ${CDN_ORIGIN}/   (${CDN_CONNECT_DELAY}ms simulated connect)`);
    console.log(`  ${ordered.length} demos, ${Object.keys(specimens).length} specimen pages`);
    console.log(`${line}\n`);
  });
});
