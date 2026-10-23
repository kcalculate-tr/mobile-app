// KCAL platform collector — shared helpers. Runs in the panel page (MAIN world).
// Read-only: only GET/POST "list/report" calls; never sends anything that changes panel state.
// Session headers are kept inside closures and are never written to output.
(() => {
  if (window.__kcal && window.__kcal.version === 4) return;
  const TZ_OFFSET_MS = 3 * 3600 * 1000; // Europe/Istanbul (UTC+3, no DST)

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // yyyy-mm-dd of "now" in Istanbul, shifted by n days
  const localDay = (n = 0) => new Date(Date.now() + TZ_OFFSET_MS + n * 864e5).toISOString().slice(0, 10);
  const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const daysBetween = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };
  // [from,to] split into windows of at most `size` days
  const windows = (from, to, size) => { const out = []; for (let s = from; s <= to; s = addDays(s, size)) { const e = addDays(s, size - 1); out.push([s, e < to ? e : to]); } return out; };
  const monthWindows = (from, to) => {
    const out = []; let s = from;
    while (s <= to) { const d = new Date(s + 'T00:00:00Z'); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10); out.push([s, last < to ? last : to]); s = addDays(last, 1); }
    return out;
  };
  // local day boundaries as UTC ISO strings
  const dayStartUtc = (d) => new Date(Date.parse(d + 'T00:00:00Z') - TZ_OFFSET_MS).toISOString();
  const dayEndUtc = (d) => new Date(Date.parse(d + 'T23:59:59.999Z') - TZ_OFFSET_MS).toISOString();
  const dayStartMs = (d) => Date.parse(d + 'T00:00:00Z') - TZ_OFFSET_MS;

  // run async jobs with limited concurrency
  async function pool(items, worker, concurrency = 3, delay = 120) {
    const results = new Array(items.length); let i = 0;
    const run = async () => { while (i < items.length) { const k = i++; try { results[k] = await worker(items[k], k); } catch (e) { results[k] = { __error: String(e && e.message || e) }; } await sleep(delay + Math.random() * 80); } };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
    return results;
  }

  // Capture request headers the panel itself sends to `hostRe` (kept in closure).
  // Returns { ready(), headers names, fetchJson(url, opts) }.
  // perService: remember headers per API service (first path segment). Some services reject
  // headers the panel only sends to other services (CORS preflight), so each call reuses the
  // header set the panel itself used for that service; the newest Authorization always wins.
  function makeSession(hostRe, keepRe, { useXhr = false, perService = false, baseRe = /^authorization$/i } = {}) {
    const H = {}; const HS = {}; let withCreds = null; const origFetch = window.fetch.bind(window);
    const svcOf = (u) => { try { return new URL(u, location.href).pathname.split('/')[1] || ''; } catch (e) { return ''; } };
    const remember = (u, k, v) => { H[k] = v; if (perService) { const s = svcOf(u); (HS[s] = HS[s] || {})[k] = v; } };
    const headersFor = (u) => {
      if (!perService) return Object.assign({}, H);
      const auth = Object.keys(H).find((k) => /^authorization$/i.test(k));
      const svc = HS[svcOf(u)];
      const out = svc ? Object.assign({}, svc) : Object.fromEntries(Object.entries(H).filter(([k]) => baseRe.test(k)));
      if (auth) { for (const k of Object.keys(out)) if (/^authorization$/i.test(k)) delete out[k]; out[auth] = H[auth]; }
      return out;
    };
    const sh = XMLHttpRequest.prototype.setRequestHeader; const so = XMLHttpRequest.prototype.open; const ss = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__kurl = String(u); return so.apply(this, arguments); };
    XMLHttpRequest.prototype.setRequestHeader = function (k, v) { if (!this.__kmine && hostRe.test(this.__kurl || '') && keepRe.test(k)) remember(this.__kurl, k, v); return sh.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () { if (!this.__kmine && hostRe.test(this.__kurl || '')) withCreds = !!this.withCredentials; return ss.apply(this, arguments); };
    const wf = window.fetch;
    window.fetch = function (input, init) {
      try { const u = typeof input === 'string' ? input : input.url; if (hostRe.test(u)) { const h = (init && init.headers) || (input && input.headers) || {}; const e = h instanceof Headers ? [...h.entries()] : Object.entries(h); for (const [k, v] of e) if (keepRe.test(k)) remember(u, k, v); if (init && init.credentials) withCreds = init.credentials === 'include'; } } catch (e) { /* ignore */ }
      return wf.apply(this, arguments);
    };
    const call = (url, { method = 'GET', body = null, extra = {} } = {}) => {
      if (useXhr) return new Promise((res) => { const x = new XMLHttpRequest(); x.__kmine = true; x.open(method, url); x.withCredentials = !!withCreds; x.setRequestHeader('Accept', 'application/json'); if (body) x.setRequestHeader('Content-Type', 'application/json'); for (const [k, v] of Object.entries(Object.assign(headersFor(url), extra))) x.setRequestHeader(k, v); x.onload = () => { let j = null; try { j = JSON.parse(x.responseText); } catch (e) { /* not json */ } res({ status: x.status, json: j, text: j ? null : String(x.responseText).slice(0, 200) }); }; x.onerror = () => res({ status: 0, json: null, text: 'network error' }); x.send(body ? JSON.stringify(body) : null); });
      return origFetch(url, { method, credentials: withCreds ? 'include' : (withCreds === false ? 'omit' : 'same-origin'), headers: Object.assign({ Accept: 'application/json' }, body ? { 'Content-Type': 'application/json' } : {}, headersFor(url), extra), body: body ? JSON.stringify(body) : undefined })
        .then(async (r) => { const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { /* not json */ } return { status: r.status, json: j, text: j ? null : t.slice(0, 200) }; })
        .catch((e) => ({ status: 0, json: null, text: String(e) }));
    };
    // retry on 429/5xx and on "too many requests" answers that come back as 400 (Getir)
    const rateLimited = (r) => r.status === 400 && /çok fazla deneme|too many/i.test(r.text || JSON.stringify(r.json || ''));
    const fetchJson = async (url, opts) => { for (let a = 0; a < 6; a++) { const r = await call(url, opts); if (r.status === 429 || r.status >= 500 || r.status === 0 || rateLimited(r)) { await sleep(1500 * (a + 1)); continue; } return r; } return call(url, opts); };
    return { ready: () => Object.keys(H).length > 0, headerNames: () => Object.keys(H).map((k) => k.toLowerCase()), fetchJson, setHeader: (k, v) => { H[k] = v; } };
  }

  // pick only whitelisted keys (PII never leaves the page)
  const pick = (o, keys) => { const r = {}; if (!o) return r; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; };

  function newRun(platform, mode) {
    return { schema: 'kcal-platform-raw/v1', platform, mode, pulledAt: new Date().toISOString(), host: location.host, data: {}, errors: [], checks: {}, notes: [] };
  }
  const err = (run, where, r) => run.errors.push({ where, status: r && r.status, message: r ? (r.text || JSON.stringify(r.json && (r.json.errors || r.json.message || r.json.errorMessage) || '').slice(0, 300)) : 'no response' });

  function download(obj, filename) {
    const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    return blob.size;
  }

  window.__kcal = { version: 4, sleep, localDay, addDays, daysBetween, windows, monthWindows, dayStartUtc, dayEndUtc, dayStartMs, pool, makeSession, pick, newRun, err, download, collectors: {} };
})();
