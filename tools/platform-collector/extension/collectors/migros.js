// Migros Yemek restaurant panel collector (restoran.migrosonline.com). Same-origin /rest API.
(() => {
  const K = window.__kcal;
  const S = window.__kcalMgSession || (window.__kcalMgSession = K.makeSession(/\/rest\//, /^(authorization|x-reid)$/i));
  const STORES = [
    { id: '23000000175425', grp: 47682, brand: 'kcalculate', branch: 'basin' }, { id: '23000000220838', grp: 78807, brand: 'breakingfast', branch: 'basin' }, { id: '23000000157620', grp: 36661, brand: 'terabowl', branch: 'basin' },
    { id: '23000000222370', grp: 47682, brand: 'kcalculate', branch: 'bayrakli' }, { id: '23000000222332', grp: 78807, brand: 'breakingfast', branch: 'bayrakli' }, { id: '23000000222220', grp: 36661, brand: 'terabowl', branch: 'bayrakli' },
  ];
  const pad = (n) => String(n).padStart(2, '0');
  const localStamp = (ms) => { const d = new Date(ms + 3 * 3600e3); return `${d.toISOString().slice(0, 10)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`; };

  async function collect({ mode = 'weekly' } = {}) {
    const run = K.newRun('migros', mode);
    const call = (u, body) => S.fetchJson(u, body ? { method: 'POST', body } : {});
    // which stores does this login see?
    const probe = await call('/rest/Order/PassiveOrdersV2', { storeIds: STORES.map((s) => Number(s.id)), offset: 0, limit: 1 });
    if (probe.status === 401) { run.errors.push({ where: 'session', message: 'Oturum düşmüş veya başlık yakalanmadı (401). Panelde bir menüye tıklayıp tekrar deneyin.' }); return run; }
    // a store is "visible" to this login if its statistics endpoint answers successfully
    const stores = [];
    for (const s of STORES) { const r = await call(`/rest/Store/GetStatistics/${s.id}/Monthly`); if (r.json && r.json.success) stores.push(s); await K.sleep(100); }
    run.stores = stores;
    const to = K.localDay(-1); const from = mode === 'full' ? K.addDays(to, -364) : K.addDays(to, -13); run.range = { from, to };

    for (const s of stores) {
      try { await collectStore(s); } catch (e) { run.errors.push({ where: `${s.id} (mağaza atlandı)`, message: String(e && e.message || e) }); }
    }
    const sdg = await call('/rest/StarDiscount'); run.star_discount_program = sdg.json && sdg.json.data;
    return run;

    async function collectStore(s) {
      const d = run.data[s.id] = { store: s };
      for (const p of ['Daily', 'Weekly', 'Monthly']) { const r = await call(`/rest/Store/GetStatistics/${s.id}/${p}`); d[p.toLowerCase()] = r.json && r.json.success ? r.json.data : null; if (!(r.json && r.json.success)) K.err(run, `${s.id} stats ${p}`, r); await K.sleep(150); }
      const c = await call(`/rest/Feedback/GetFeedbacksStoreCounts?storeId=${s.id}&storeGroupId=${s.grp}`); d.feedback_counts = c.json && c.json.data;
      d.feedbacks = [];
      for (let off = 0; off < 5000; off += 50) {
        const r = await call('/rest/Feedback/GetFeedBacks', { storeId: Number(s.id), storeGroupId: s.grp, startDate: `${from} 00:00:00`, endDate: localStamp(Date.now() - 120000), offset: off, limit: 50 });
        if (!(r.json && r.json.success)) { K.err(run, `${s.id} feedbacks`, r); break; }
        const it = r.json.data.items || []; d.feedbacks.push(...it.map((x) => K.pick(x, ['id', 'orderId', 'createdAt', 'score', 'comment', 'answer', 'answerStatus'])));
        if (!it.length || d.feedbacks.length >= r.json.data.count) break; await K.sleep(150);
      }
      // past orders (panel keeps ~30 days); PII dropped here
      d.orders = [];
      for (let off = 0; off < 3000; off += 30) {
        const r = await call('/rest/Order/PassiveOrdersV2', { storeIds: [Number(s.id)], offset: off, limit: 30 });
        if (!(r.json && r.json.success)) { K.err(run, `${s.id} orders off=${off}`, r); break; }
        const os = (r.json.data || []).flatMap((x) => x.activeOrderDetailsDTOS || []);
        d.orders.push(...os.map((o) => Object.assign(K.pick(o, ['id', 'createdAt', 'status', 'cancelled', 'cancelReason', 'totalPrice', 'discountedPrice', 'restaurantDiscountedPrice', 'migrosDiscountedPrice', 'paymentType', 'deliveryProvider', 'hasStarDiscount', 'hasTierBasedDeepDiscount']), { products: (o.products || []).map((p) => ({ name: p.name, price: p.price, amount: p.amount })) })));
        if (os.length < 30) break; await K.sleep(150);
      }
      const sd = await call(`/rest/StarDiscount/${s.id}`); d.star_discount = sd.json && sd.json.data;
      for (const kind of ['Active', 'Expired']) { const r = await call(`/rest/RestaurantCoupon/${kind}?restaurantId=${s.id}`); d['coupons_' + kind.toLowerCase()] = r.json && r.json.data; }
      // check: panel daily card total for last 7 days vs orders list
      const c7f = K.addDays(K.localDay(), -7), c7t = K.localDay(-1);
      const toIso = (t) => { const m = String(t).match(/^(\d{2})\.(\d{2})\.(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
      run.checks[s.id] = { from: c7f, to: c7t, panel_orders: (d.daily || []).filter((x) => { const t = toIso(x.dateText); return t && t >= c7f && t <= c7t; }).reduce((a, x) => a + x.orderCount, 0) };
    }
  }
  K.collectors.migros = collect;
})();
