// Yemeksepeti partner panel collector (partner-app.yemeksepeti.com).
(() => {
  const K = window.__kcal;
  const VOS = 'https://vos-api.eu.prd.portal.restaurant/v1/vendors';
  const VRS = 'https://vrs-api.eu.prd.portal.restaurant/v1';
  const GQL = 'https://vagw-api.eu.prd.portal.restaurant/query';
  const S = window.__kcalYsSession || (window.__kcalYsSession = K.makeSession(/portal\.restaurant/, /^authorization$/i));

  const LIST_ORDERS = 'query ListOrders($params: ListOrdersReq!) { orders { listOrders(input: $params) { nextPageToken orders { orderId vendorId orderStatus placedTimestamp subtotal billableStatus deliveryType billing { commissionAmount netRevenue } orderIssuesDetails { orderIssue metadata { reason amount deduction fee avoidableWaitTime } } totalFeesAndDeductions } } } }';

  const brandOf = (name) => /kcal/i.test(name) ? 'kcalculate' : /tera/i.test(name) ? 'terabowl' : /breaking/i.test(name) ? 'breakingfast' : null;
  const branchOf = (addr) => /basın|basin|karabağlar|karabaglar/i.test(addr) ? 'basin' : /mansuro|bayrakl/i.test(addr) ? 'bayrakli' : null;

  // vendor codes + brand/branch from the panel's persisted store (no PII: only name + area)
  function vendors() {
    const found = {};
    const walk = (o, d = 0) => {
      if (d > 12 || !o) return;
      if (typeof o === 'string') { if (/^[[{]/.test(o)) { try { walk(JSON.parse(o), d + 1); } catch (e) { /* skip */ } } return; }
      if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1)); return; }
      if (typeof o === 'object') {
        const code = Object.values(o).find((v) => typeof v === 'string' && /^YS_TR;[a-z0-9]{4}$/.test(v));
        if (code && typeof o.name === 'string' && o.address) { const addr = JSON.stringify(o.address); found[code] = { code, brand: brandOf(o.name), branch: branchOf(addr) }; }
        Object.values(o).forEach((v) => walk(v, d + 1));
      }
    };
    for (const k of Object.keys(localStorage)) walk(localStorage.getItem(k));
    return Object.values(found);
  }

  async function collect({ mode = 'weekly' } = {}) {
    const run = K.newRun('yemeksepeti', mode);
    if (!S.ready()) { run.errors.push({ where: 'session', message: 'Oturum başlığı yakalanamadı: panelde bir menüye tıklayıp tekrar deneyin (oturum düşmüş olabilir).' }); return run; }
    const V = vendors(); run.vendors = V;
    const to = K.localDay(-1); const from = mode === 'full' ? K.addDays(to, -364) : K.addDays(to, -13);
    run.range = { from, to };
    const months = K.monthWindows(from, to); const days = K.daysBetween(from, to);
    const post = (url, body) => S.fetchJson(url, { method: 'POST', body });

    window.__kcalProg = { vendor: 0, of: V.length, step: '' };
    for (const v of V) {
      window.__kcalProg.vendor++;
      try { await collectVendor(v); } catch (e) { run.errors.push({ where: `${v.code} (mağaza atlandı)`, message: String(e && e.message || e) }); }
    }
    const rn = await post(VRS + '/ratings', { global_vendor_codes: V.map((v) => v.code) }); run.ratings_now = rn.status === 200 ? rn.json : null;
    return run;

    async function collectVendor(v) {
      const d = run.data[v.code] = { vendor: v };
      const g = [v.code];
      // daily-breakdown reports, one call per month
      for (const [key, path, extra] of [['performance', '/reports/performance', { precision: 'DAY' }], ['offline_duration', '/reports/offline_duration', { precision: 'DAY' }], ['order_rejection', '/reports/order_rejection', { precision: 'DAY' }], ['prep_time', '/reports/prep_time', { precision: 'DAY' }], ['contact_rate', '/reports/contact-rate', { precision: 'DAY' }]]) {
        window.__kcalProg.step = key;
        d[key] = await K.pool(months, async ([s, e]) => { const r = await post(VOS + path, Object.assign({ global_vendor_codes: g, from: s, to: e }, extra)); if (r.status !== 200) K.err(run, `${v.code} ${key} ${s}`, r); return { from: s, to: e, resp: r.status === 200 ? r.json : null }; }, 2);
      }
      // reports without a daily breakdown: one call per day (from = to)
      for (const [key, path] of [['customer_conversion', '/reports/customer_conversion'], ['customer_retention', '/reports/customer_retention'], ['dishes', '/reports/dishes']]) {
        window.__kcalProg.step = key;
        d[key] = await K.pool(days, async (day) => { const r = await post(VOS + path, { global_vendor_codes: g, from: day, to: day }); if (r.status !== 200) K.err(run, `${v.code} ${key} ${day}`, r); return { day, resp: r.status === 200 ? r.json : null }; }, 4, 60);
      }
      const rh = await post(VRS + '/ratings/history', { global_vendor_code: v.code, from, to, granularity: 'DAY' }); d.ratings_history = rh.status === 200 ? rh.json : null; if (rh.status !== 200) K.err(run, `${v.code} ratings_history`, rh);
      // reviews: monthly windows, 200 per page (each month fits in one page)
      d.reviews = [];
      for (const [s, e] of months) {
        const r = await post(VRS + '/reviews', { global_vendor_codes: g, include_stats: false, pagination: { perPage: 200 }, filter: { ratingMin: 1, ratingMax: 5, hasText: false, startDate: K.dayStartUtc(s), endDate: K.dayEndUtc(e) } });
        if (r.status !== 200) { K.err(run, `${v.code} reviews ${s}`, r); continue; }
        if (r.json.hasNext) run.notes.push(`${v.code} reviews ${s}: 200'den fazla yorum, sayfa kesildi`);
        for (const x of r.json.reviews || []) d.reviews.push(K.pick(x, ['id', 'orderId', 'date', 'rating', 'text', 'reply', 'product_ratings', 'isAutoGenerated']));
      }
      // order list (≤ 1 month per query, paged)
      d.orders = [];
      for (const [s, e] of months) {
        let token = null;
        for (let page = 0; page < 200; page++) {
          const pagination = token ? { pageSize: 50, pageToken: token } : { pageSize: 50 };
          const r = await post(GQL, { query: LIST_ORDERS, variables: { params: { pagination, timeFrom: K.dayStartUtc(s), timeTo: K.dayEndUtc(e), globalVendorCodes: [{ globalEntityId: 'YS_TR', vendorId: v.code.split(';')[1] }], useRefundStreamIssueSource: false } } });
          const l = r.json && r.json.data && r.json.data.orders && r.json.data.orders.listOrders;
          if (!l) { K.err(run, `${v.code} ListOrders ${s}`, r); break; }
          const batch = l.orders || [];
          d.orders.push(...batch);
          if (!l.nextPageToken || !batch.length) break; token = l.nextPageToken; await K.sleep(120);
        }
      }
      // promotions (joker + other deals)
      d.deals = [];
      for (const onlyJoker of [true, false]) {
        const r = await post('https://vfd-offer-api.eu.prd.portal.restaurant/v1/global-entity/YS_TR/deals/search', { criteria: { vendorCodes: [v.code.split(';')[1]], startDate: K.addDays(to, -400), endDate: K.addDays(to, 200), includeCofundedDeal: true, includeMembershipDeal: true, includeJokerDeal: true, includePlatformEventDeal: true, includeBoostedDeal: true, includeDeliveryFeeDeal: true, onlyJokerDeal: onlyJoker, onlyBoostedDeal: false }, outputFormat: { pageSize: 500, pageOffset: 0, sortByField: 'startDate', sortOrder: 'desc' } });
        if (r.status !== 200) { K.err(run, `${v.code} deals`, r); continue; }
        for (const x of r.json.data || []) d.deals.push(Object.assign(K.pick(x, ['id', 'label', 'title', 'status', 'startDate', 'endDate', 'cancelledAt', 'customerTargeting', 'dealTemplateId', 'isRecurring']), { discount: JSON.stringify(x.tieredDiscountRewardBehavior || x.discountPercentageRewardBehavior || x.discountAmountRewardBehavior || null).slice(0, 300) }));
      }
      // check: panel KPI total for the last 7 days (single range call)
      const c7f = K.addDays(K.localDay(), -7), c7t = K.localDay(-1);
      const ck = await post(VOS + '/reports/performance', { global_vendor_codes: g, from: c7f, to: c7t, precision: 'DAY' });
      run.checks[v.code] = { from: c7f, to: c7t, panel_orders: ck.status === 200 ? (ck.json.data || []).reduce((a, x) => a + Number(x.orderCount || 0), 0) : null };
    }
  }
  K.collectors.yemeksepeti = collect;
})();
