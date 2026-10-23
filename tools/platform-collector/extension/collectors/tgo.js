// Trendyol GO / Uber Eats partner panel collector (partner.tgoyemek.com).
(() => {
  const K = window.__kcal;
  const API = 'https://api.tgoapis.com';
  const MET = (id) => `${API}/localcommerce-seller-partnerbff-service/analytics/metric/${id}`;
  const REV = `${API}/localcommerce-spm-seller-center-meal-bff-service/reviews/restaurants`;
  const ORD = `${API}/order-meal-seller-order-gw-service/sellers`;
  const S = window.__kcalTgoSession || (window.__kcalTgoSession = K.makeSession(/tgoapis/, /^(authorization|x-.*|storefront.*|agentname|.*token.*)$/i, { perService: true, baseRe: /^(authorization|x-(header|banner|child)-version)$/i }));

  // known stores (supplier = brand account). Extend here if a branch is added.
  const STORES = [
    { id: '336068', supplier: '1078227', brand: 'kcalculate', branch: 'basin' }, { id: '468410', supplier: '1078227', brand: 'kcalculate', branch: 'bayrakli' },
    { id: '456386', supplier: '6725507', brand: 'terabowl', branch: 'basin' }, { id: '468415', supplier: '6725507', brand: 'terabowl', branch: 'bayrakli' },
    { id: '293817', supplier: '989799', brand: 'breakingfast', branch: 'basin' }, { id: '468407', supplier: '989799', brand: 'breakingfast', branch: 'bayrakli' },
  ];
  const supplierOnPage = () => { const m = document.body.innerText.match(/CARİ[^\d]*(\d{5,})/i); return m ? m[1] : null; };

  const pkg = (x, appGroup) => Object.assign(K.pick(x, ['orderId', 'orderParentId', 'orderCode', 'createdDate', 'cancelDate', 'orderStatus', 'totalPrice', 'totalDiscountPrice', 'deliveryType', 'overdueOrder', 'testPackage', 'cancellationReasonText', 'totalDeliveryPrice', 'isFlashSale']), {
    appGroup,
    badges: x.orderBadges || null,
    payment: x.orderPayment ? x.orderPayment.paymentType : null,
    discount: x.discountDistribution || null,
    lines: (x.orderLines || []).map((l) => ({ name: l.name, price: l.price, unitPrice: l.unitPrice, qty: (l.orderLineItems || []).length || 1, status: (l.orderLineItems || []).map((i) => i.status).filter(Boolean).join(',') || null })),
  });

  async function collect({ mode = 'weekly', marketReport = null, onlyStores = null, skipAdverts = false, adsOnly = false } = {}) {
    const run = K.newRun('trendyolgo', mode);
    if (!S.ready()) { run.errors.push({ where: 'session', message: 'Oturum başlığı yakalanamadı: panelde bir menüye tıklayıp tekrar deneyin (oturum düşmüş olabilir).' }); return run; }
    const sup = supplierOnPage(); const stores = STORES.filter((s) => (!sup || s.supplier === sup) && (!onlyStores || onlyStores.includes(s.id))); run.stores = stores; run.supplier = sup;
    const to = K.localDay(-1); const from = mode === 'full' ? K.addDays(to, -364) : K.addDays(to, -13);
    const aFrom = mode === 'full' ? K.addDays(to, -119) : from; // analytics keeps ~90 days
    run.range = { from, to, analytics_from: aFrom };
    // headers are chosen per API service by the session (see common.js)
    const get = (u) => S.fetchJson(u);
    // ads are listed for the store selected in the panel: run on /advert-management/ with that store selected
    if (adsOnly) { const f = document.body.innerText.match(/CARİ\s*\/\s*RESTORAN ID\s*(\d+)\s*\/\s*(\d+)/i); const sel = STORES.find((x) => f && x.id === f[2]) || stores[0]; run.stores = []; run.ads_store = sel && sel.id; if (sel) await collectAdverts(sel); return run; }

    window.__kcalProg = { store: 0, of: stores.length, step: '' };
    for (const s of stores) {
      window.__kcalProg.store++;
      try { await collectStore(s); } catch (e) { run.errors.push({ where: `${s.id} (mağaza atlandı)`, message: String(e && e.message || e) }); }
    }
    if (!skipAdverts) { const f = document.body.innerText.match(/CARİ\s*\/\s*RESTORAN ID\s*(\d+)\s*\/\s*(\d+)/i); const sel = stores.find((x) => f && x.id === f[2]); if (sel) await collectAdverts(sel); }
    if (marketReport) run.market_report = marketReport;
    return run;

    async function collectStore(s) {
      const d = run.data[s.id] = { store: s, daily: {}, snapshot: {} };
      for (const mt of ['DAILY_SALES_METRIC', 'DAILY_OPERATION_METRIC', 'DAILY_CUSTOMER_METRIC']) {
        window.__kcalProg.step = mt;
        d.daily[mt] = await K.pool(K.windows(aFrom, to, 7), async ([a, b]) => { const r = await get(`${MET(s.id)}?metricType=${mt}&startDate=${a}&endDate=${b}&dateType=DAILY`, s.id); if (r.status !== 200) K.err(run, `${s.id} ${mt} ${a}`, r); return { from: a, to: b, resp: r.status === 200 ? r.json.data : null }; }, 2);
      }
      for (const [mt, dt] of [['HOURLY_SALES_METRIC', 'DAILY'], ['HOURLY_UPTIME_METRIC', 'DAILY'], ['DAILY_SALES_CONVERSION_METRIC', 'DAILY'], ['DAILY_MOST_REFUND_PRODUCT_METRIC', 'DAILY'], ['DAILY_REFUND_SUMMARY_METRIC', 'DAILY'], ['DAILY_MOST_CANCELLATION_PRODUCT_METRIC', 'DAILY'], ['DAILY_UPTIME_SUMMARY_METRIC', 'DAILY'], ['DAILY_CANCELLATION_SUMMARY_METRIC', 'DAILY'], ['DAILY_CUSTOMER_SEGMENT_METRIC', 'MONTHLY'], ['DAILY_CUSTOMER_PRODUCT_REVIEW_METRIC', 'MONTHLY'], ['DAILY_CUSTOMER_COMPLAINT_METRIC', 'MONTHLY']]) {
        const extra = /HOURLY_SALES|CONVERSION/.test(mt) ? `&startDate=${K.addDays(K.localDay(), -6)}&endDate=${K.localDay()}` : '';
        const r = await get(`${MET(s.id)}?metricType=${mt}&dateType=${dt}${extra}`, s.id); d.snapshot[mt] = r.status === 200 ? r.json.data : null; if (r.status !== 200) K.err(run, `${s.id} ${mt}`, r); await K.sleep(120);
      }
      const st = await get(`${REV}/${s.id}/stats`, s.id); d.review_stats = st.status === 200 ? st.json : null;
      const ps = await get(`${REV}/${s.id}/product-scores`, s.id); d.product_scores = ps.status === 200 ? ps.json : null;
      d.reviews = [];
      for (let page = 1; page < 200; page++) {
        const r = await get(`${REV}/${s.id}/filter?startDate=${K.dayStartMs(from)}&size=100&page=${page}&sortBy=createdDate_desc&withHasActiveComplaint=true`, s.id);
        if (r.status !== 200) { K.err(run, `${s.id} reviews p${page}`, r); break; }
        for (const x of r.json.content || []) d.reviews.push({ reviewId: x.reviewId, createdDate: x.createdDate, score: x.customerScore, comment: (x.customerComment || {}).text || null, commentStatus: (x.customerComment || {}).status || null, answer: (x.restaurantAnswer || {}).text || null, answerDate: (x.restaurantAnswer || {}).createdDate || null, deliveryType: x.deliveryType, hasActiveComplaint: x.hasActiveComplaint, orderParentId: (x.orderInfo || {}).orderParentId });
        if (!(r.json.content || []).length || page >= (r.json.totalPages || 0)) break; await K.sleep(150);
      }
      // order history: delivered + cancelled, split by app (Trendyol vs GetirYemek="Galaxy")
      d.packages = [];
      for (const [appName, group] of [['TrendyolGo,Trendyol', 'trendyol'], ['Galaxy', 'getir']]) {
        for (const status of ['Delivered', 'Cancelled']) {
          for (let page = 1; page < 400; page++) {
            const r = await get(`${ORD}/packages/stores/${s.id}/filter?status=${status}&appName=${encodeURIComponent(appName)}&page=${page}&size=50&startDate=${K.dayStartMs(from)}&endDate=${K.dayStartMs(K.addDays(to, 1)) - 1}`, s.id);
            if (r.status !== 200) { K.err(run, `${s.id} packages ${status} ${group} p${page}`, r); break; }
            for (const x of r.json.content || []) d.packages.push(pkg(x, group));
            if ((r.json.content || []).length < 50) break; await K.sleep(120);
          }
        }
        // cancellation reasons
        for (let page = 1; page < 100; page++) {
          const r = await get(`${ORD}/cancelled/stores/filter?status=Cancelled&storeIds=${s.id}&supplierId=${s.supplier}&appName=${encodeURIComponent(appName)}&page=${page}&size=50&startDate=${K.dayStartMs(from)}`, s.id);
          if (r.status !== 200) { K.err(run, `${s.id} cancelled ${group}`, r); break; }
          for (const x of r.json.content || []) (d.cancelled || (d.cancelled = [])).push(pkg(x, group));
          if ((r.json.content || []).length < 50) break; await K.sleep(120);
        }
      }
      // check: panel KPI for last 7 days (the "Son 7 Gün" card)
      const c7f = K.addDays(K.localDay(), -7), c7t = K.localDay(-1);
      const ck = await get(`${MET(s.id)}?metricType=DAILY_SALES_METRIC&startDate=${c7f}&endDate=${c7t}&dateType=DAILY`, s.id);
      run.checks[s.id] = { from: c7f, to: c7t, panel_orders: ck.status === 200 && ck.json.data ? ck.json.data.metrics.countCompletedOrder.totalValue : null };
    }
    // ads (supplier level, all branches)
    // ads are listed per store (x-store-id)
    async function collectAdverts(s) {
    run.adverts = run.adverts || [];
    for (let page = 1; page < 30; page++) {
      const r = await get(`${API}/localcommerce-ads-partner-bff-service/adverts?name=&status=&startAt=&endAt=&page=${page}&pageSize=50&sort=&order=asc`, s.id);
      if (r.status !== 200) { K.err(run, `${s.id} adverts`, r); break; }
      for (const a of r.json.content || []) run.adverts.push(Object.assign(K.pick(a, ['id', 'name', 'type', 'status', 'budgetType', 'startAt', 'endAt', 'actualEndAt', 'createdAt']), { store_id: s.id, stats: Object.fromEntries((a.statistics || []).map((x) => [x.key, x.values])) }));
      if (page >= (r.json.totalPages || 0)) break;
    }
    }
  }

  // "Pazar Raporu" has no separate endpoint; read it from the performance page text (if shown).
  function readMarketReport() {
    const t = document.body.innerText; const i = t.indexOf('Pazar Raporu'); if (i < 0) return null;
    const seg = t.slice(i, i + 1500); // "38,555 TL" (comma = thousands) or "1.234,5" (Turkish) or "7%"
    const num = (s) => { if (s == null) return null; let v = String(s).replace(/[^\d,.-]/g, ''); if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) v = v.replace(/,/g, ''); else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(v)) v = v.replace(/\./g, '').replace(',', '.'); else v = v.replace(',', '.'); return v === '' ? null : Number(v); };
    // rows look like "Toplam Ciro<i>\t5,340 TL\t27,240 TL\t▼ %80 altında"
    const row = (label) => { const line = seg.split('\n').find((l) => l.startsWith(label)); if (!line) return null; const p = line.split('\t'); return p.length >= 3 ? { restaurant: num(p[1]), market: num(p[2]) } : null; };
    // the panel shows the *selected* store (footer "CARİ / RESTORAN ID 1078227 / 468410"), not the id in the URL
    const f = t.match(/CARİ\s*\/\s*RESTORAN ID\s*(\d+)\s*\/\s*(\d+)/i);
    return { store_id: f && f[2], supplier_id: f && f[1], read_at: new Date().toISOString(), note: 'Son tamamlanan hafta; panelde seçili şube', revenue: row('Toplam Ciro'), orders: row('Sipariş Sayısı'), visitors: row('Ziyaretçi Sayısı'), conversion: row('Siparişe Dönüşüm Oranı'), promo_ratio: row('Promosyonlu Sipariş Oranı') };
  }
  K.collectors.trendyolgo = collect;
  K.readTgoMarketReport = readMarketReport;
})();
