// Getir Yemek restaurant panel collector (restoran.getiryemek.com). History only:
// Getir orders moved to the Trendyol GO panel on 2026-09-01, so this runs once and is frozen.
(() => {
  const K = window.__kcal;
  const B = 'https://food-panel-backend.getirapi.com/restaurants/';
  const FREEZE_FROM = '2025-10-23', FREEZE_TO = '2026-08-31';
  // the analytics "Authorization" header belongs to rudderstack; the panel API uses token/restaurantid/panel-*
  const S = window.__kcalGySession || (window.__kcalGySession = K.makeSession(/food-panel-backend/, /^(token|restaurantid|panel-page|panel-version)$/i, { useXhr: true }));
  const brandOf = (n) => /kcal/i.test(n) ? 'kcalculate' : /tera/i.test(n) ? 'terabowl' : /breaking/i.test(n) ? 'breakingfast' : null;
  const branchOf = (n) => /basın|basin|karabağlar/i.test(n) ? 'basin' : /mansuro|bayrakl/i.test(n) ? 'bayrakli' : null;

  function restaurants() {
    const found = {};
    const walk = (o, d = 0) => { if (d > 10 || !o) return; if (typeof o === 'string') { if (/^[[{]/.test(o)) { try { walk(JSON.parse(o), d + 1); } catch (e) { /* skip */ } } return; } if (Array.isArray(o)) return o.forEach((x) => walk(x, d + 1)); if (typeof o === 'object') { const id = o.id || o._id; const nm = o.name; if (typeof id === 'string' && /^[0-9a-f]{24}$/.test(id) && typeof nm === 'string' && /,/.test(nm) && brandOf(nm)) found[id] = { id, brand: brandOf(nm), branch: branchOf(nm) }; Object.values(o).forEach((v) => walk(v, d + 1)); } };
    for (const st of [localStorage, sessionStorage]) for (const k of Object.keys(st)) walk(st.getItem(k));
    return Object.values(found);
  }

  async function collect({ mode = 'full' } = {}) {
    const run = K.newRun('getir', 'frozen'); run.range = { from: FREEZE_FROM, to: FREEZE_TO };
    if (!S.ready()) { run.errors.push({ where: 'session', message: 'Oturum başlığı yakalanamadı: panelde Yorumlar menüsüne tıklayıp tekrar deneyin.' }); return run; }
    const R = restaurants(); run.stores = R;
    const call = (u, method = 'GET', body = null, rid = null) => S.fetchJson(u, { method, body, extra: rid ? { restaurantid: rid } : {} });
    for (const r0 of R) {
      const H = B + r0.id; const d = run.data[r0.id] = { store: r0 };
      d.daily_financial = await K.pool(K.daysBetween(FREEZE_FROM, FREEZE_TO), async (day) => { const r = await call(H + '/statistics/financial-status', 'POST', { startDate: K.dayStartUtc(day), endDate: K.dayEndUtc(day), comparisonType: 5 }, r0.id); if (r.status !== 200) K.err(run, `${r0.id} fin ${day}`, r); return { day, resp: r.status === 200 ? { revenue: r.json.revenue, orderCount: r.json.orderCount, averageBasketSize: r.json.averageBasketSize, lastUpdateDate: r.json.lastUpdateDate } : null }; }, 1, 1100); // Getir allows ~1 request/second
      for (const [k, p] of [['ratings', '/ratings'], ['order_performance', '/statistics/order-performance'], ['menu', '/statistics/menu']]) { const r = await call(H + p, 'GET', null, r0.id); d[k] = r.status === 200 ? r.json : null; if (r.status !== 200) K.err(run, `${r0.id} ${k}`, r); await K.sleep(1100); }
      d.reviews = [];
      for (let skip = 0; skip < 5000; skip += 100) { const r = await call(H + '/reviews', 'POST', { filters: { status: [100, 101, 102, 201, 302] }, sort: { field: 'reviewDate', type: -1 }, pagination: { skip, limit: 100 } }, r0.id); if (r.status !== 200) { K.err(run, `${r0.id} reviews`, r); break; } const it = r.json.reviews || []; d.reviews.push(...it.map((x) => ({ id: x.id, rating: (x.ratings || {}).restaurantRating, comment: (x.comments || {}).restaurantComment || null, status: x.status, relativeDate: (x.formattedReviewDate || {}).tr }))); if (!it.length || d.reviews.length >= r.json.totalReviewCount) break; await K.sleep(1100); }
    }
    return run;
  }
  K.collectors.getir = collect;
})();
