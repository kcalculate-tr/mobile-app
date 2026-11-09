// D-S1 PGlite — bölüm 4: olay sözlüğü, analytics_events yazım düzeltmeleri, admin_kpi.
// d_s1.check.mjs tarafından yüklenir (tek başına çalışmaz).
// Beklenen sayılar aşağıdaki tohum verisinden ELLE hesaplandı (yorumlarda).
export default async function (db, { check, expectError, asRole, upsert, row, ids }) {
  const { U_ADMIN, U_USER, U_OTHER, B_MERKEZ, B_SUBE } = ids;

  console.log('\n[4a] Olay sözlüğü');
  const n = (await db.query(`select count(*)::int c, count(*) filter (where is_kpi)::int k from public.analytics_event_names`)).rows[0];
  check('sözlük ≥ 25 olay (2 koşuda çift yok)', n.c >= 25, JSON.stringify(n));
  const tr = (await db.query(`select count(*)::int c from public.analytics_event_names where description_tr = '' or description_en = ''`)).rows[0].c;
  check('her olayda TR + EN açıklama', tr === 0);
  const client = (await db.query(`select array_agg(name order by name) a from public.analytics_event_names`)).rows[0].a;
  const used = ['payment_failed', 'payment_attempt', 'remove_from_cart', 'product_view', 'payment_success', 'payment_pending',
    'order_review_submitted', 'cart_view', 'begin_checkout', 'welcome_view', 'welcome_skip_click', 'welcome_login_click',
    'reorder_from_order_detail', 'reorder_from_home', 'reorder_from_empty_cart', 'home_view', 'banner_view', 'banner_click',
    'announcement_strip_click', 'add_to_cart', 'purchase', 'order_delivered'];
  const missing = used.filter((u) => !client.includes(u));
  check('istemcide/sunucuda kullanılan tüm adlar sözlükte', missing.length === 0, missing.join());
  const planned = ['app_open', 'signup', 'onb_step', 'scan_start', 'scan_success', 'log_meal', 'share', 'follow', 'checkout_start', 'pay_success', 'coupon_apply', 'saha_code_apply', 'first_touch'];
  check('G19-S3 planlı adlar sözlükte', planned.every((p) => client.includes(p)), planned.filter((p) => !client.includes(p)).join());
  await expectError(db, 'sözlük ad kuralı', `insert into public.analytics_event_names (name, category, description_tr, description_en) values ('Bad Name','x','a','b')`, [], /check/);

  console.log('\n[4b] analytics_events yazım düzeltmeleri (A1–A5)');
  const ins = (rows) => db.query(`insert into public.analytics_events (user_id, anon_id, session_id, event_name, props, platform, app_version, created_at)
      select (r->>'user_id')::uuid, r->>'anon_id', r->>'session_id', r->>'event_name', coalesce(r->'props', '{}'), r->>'platform', r->>'app_version',
             coalesce((r->>'created_at')::timestamptz, now())
        from jsonb_array_elements($1::jsonb) r`, [JSON.stringify(rows)]);
  await asRole(db, 'authenticated', U_USER, () => ins([
    { user_id: U_USER, anon_id: 'dev1', session_id: 's1', event_name: '  Add_To_Cart ', props: { product_id: 5, email: 'a@b.c', phone: '05321112233', latitude: 41 } },
    { user_id: U_OTHER, anon_id: 'dev1', session_id: 's0', event_name: 'cart_view', props: { item_count: 1 } },   // A1: eski hesabın kuyruğu
    { user_id: U_USER, anon_id: 'dev1', session_id: 's1', event_name: 'home_view', created_at: '2030-01-01T00:00:00Z' },
    { user_id: U_USER, anon_id: 'dev1', session_id: 's1', event_name: 'banner_view', props: [1, 2] },
    { user_id: U_USER, anon_id: 'dev1', session_id: 's1', event_name: 'big_props', props: { blob: 'x'.repeat(9000) } },
  ]));
  const got = (await db.query(`select event_name, user_id, props, created_at from public.analytics_events where anon_id = 'dev1' order by id`)).rows;
  check('A1 toplu insert takılmadı (5 satır)', got.length === 5, String(got.length));
  check('A4 ad trim + küçük harf', got[0].event_name === 'add_to_cart');
  check('A3 kişisel anahtarlar silindi, diğerleri kaldı', JSON.stringify(got[0].props) === '{"product_id":5}', JSON.stringify(got[0].props));
  check('A1 başka kullanıcının user_id\'si NULL + işaret', got[1].user_id === null && got[1].props._user_mismatch === true);
  check('A2 gelecek tarih now()', new Date(got[2].created_at).getTime() < Date.now() + 600_000 && got[2].props._ts_clamped === true);
  check('nesne olmayan props sarıldı', JSON.stringify(got[3].props) === '{"_value":[1,2]}');
  check('8 KB üstü props kırpıldı', got[4].props._truncated === true);
  await asRole(db, 'anon', null, () => ins([{ user_id: U_USER, anon_id: 'dev2', event_name: 'app_open' }]));
  const an = (await db.query(`select user_id, props from public.analytics_events where anon_id = 'dev2'`)).rows[0];
  check('anon başkası adına yazamaz (user_id NULL)', an.user_id === null && an.props._user_mismatch === true);
  await asRole(db, 'authenticated', U_USER, () =>
    expectError(db, 'A5 istemci olayları okuyamaz', `select * from public.analytics_events`, [], /permission/));
  await asRole(db, 'authenticated', U_USER, () =>
    expectError(db, 'A5 istemci güncelleyemez', `update public.analytics_events set event_name = 'x'`, [], /permission/));
  await db.exec(`insert into public.analytics_events (user_id, event_name, props, created_at) values ('${U_USER}', 'purchase', '{"order_id": 1}', '2020-01-01T00:00:00Z')`);
  const srv = (await db.query(`select created_at from public.analytics_events where event_name = 'purchase' and props->>'order_id' = '1'`)).rows[0];
  check('sunucu yazımında saat kırpılmaz', new Date(srv.created_at).getUTCFullYear() === 2020);
  await db.exec(`delete from public.analytics_events where anon_id in ('dev1','dev2') or (event_name = 'purchase' and props->>'order_id' = '1')`);

  console.log('\n[4c] admin_kpi — tohum verisi');
  await seedKpi(db, { upsert, row, U_ADMIN, U_USER, U_OTHER, B_MERKEZ, B_SUBE });
  const kpi = async (from, to, branch = null) => (await asRole(db, 'authenticated', U_ADMIN, () =>
    db.query(`select public.admin_kpi($1::date, $2::date, $3::uuid) k`, [from, to, branch]))).rows[0].k;

  const k = await kpi('2026-10-01', '2026-10-03');
  // Sayılanlar: orders o1 200, o2 100, o3 300, o8 90 (TY eşleşmesiz), o9 120 · adisyo a1 150, a2 60, a3 80 (TY-77), a7 40
  check('toplam sipariş 9 (tüm kanallar, çift sayım yok)', k.totals.orders === 9, JSON.stringify(k.totals));
  check('ciro 1140', Number(k.totals.revenue) === 1140);
  check('sepet ort. 126.67', Number(k.totals.avg_basket) === 126.67);
  check('günlük 3/3/3', JSON.stringify(k.orders_daily.map((d) => d.orders)) === '[3,3,3]', JSON.stringify(k.orders_daily));
  check('günlük ciro 390/460/290', JSON.stringify(k.orders_daily.map((d) => Number(d.revenue))) === '[390,460,290]');
  check('gün sınırı İstanbul (00:30 İst dahil, ertesi gün hariç)', k.orders_daily[0].orders === 3);
  const ch = Object.fromEntries(k.channels.map((c) => [c.channel, c]));
  check('kanal: app 4 / 720', ch.app?.orders === 4 && Number(ch.app.revenue) === 720, JSON.stringify(k.channels));
  check('kanal: trendyol_go 2 (orders + adisyo, eşleşen dışlandı)', ch.trendyol_go?.orders === 2 && Number(ch.trendyol_go.revenue) === 170);
  check('kanal: yemeksepeti 1, salon 1, telefon 1, getir (iptal) yok',
    ch.yemeksepeti?.orders === 1 && ch.salon?.orders === 1 && ch.telefon?.orders === 1 && !ch.getir);
  check('kanal payı toplamı 1', Math.abs(k.channels.reduce((s, c) => s + Number(c.order_share), 0) - 1) < 0.001);
  check('müşteri: 1 yeni + 1 tekrar', k.customers.new === 1 && k.customers.returning === 1, JSON.stringify(k.customers));
  check('tutma D1 2/1', k.retention.d1.cohort === 2 && k.retention.d1.retained === 1, JSON.stringify(k.retention));
  check('tutma D7 2/1', k.retention.d7.cohort === 2 && k.retention.d7.retained === 1);
  check('tutma D30 2/1', k.retention.d30.cohort === 2 && k.retention.d30.retained === 1);
  check('DAU 2/1/0', JSON.stringify(k.active.dau_daily.map((d) => d.dau)) === '[2,1,0]', JSON.stringify(k.active));
  check('WAU 3, MAU 4', k.active.wau === 3 && k.active.mau === 4);
  check('tarama: 1 Eki 4 tarama / 2 kişi, toplam 4', k.scans.daily[0].scans === 4 && k.scans.daily[0].users === 2 && k.scans.total === 4, JSON.stringify(k.scans));
  check('Keşfet: 3 gönderi / 2 kişi, 1 gün kartı, 2 paylaşım olayı',
    k.explore.posts === 3 && k.explore.posting_users === 2 && k.explore.day_shares === 1 && k.explore.share_events === 2, JSON.stringify(k.explore));
  check('kupon: HOSGELDIN 1 sipariş / 200 / indirim 20 / ilk sipariş 1',
    k.coupons.length === 1 && k.coupons[0].code === 'HOSGELDIN' && Number(k.coupons[0].revenue) === 200 && Number(k.coupons[0].discount) === 20 && k.coupons[0].first_orders === 1,
    JSON.stringify(k.coupons));
  check('saha kodu: SAHA-ALI 1 sipariş / 300, olay 2 (1 başarılı)',
    k.saha.codes.length === 1 && k.saha.codes[0].code === 'SAHA-ALI' && k.saha.apply_events === 2 && k.saha.apply_ok === 1, JSON.stringify(k.saha));
  check('kupon olayı 1/1', k.coupon_events.apply_events === 1 && k.coupon_events.apply_ok === 1);
  check('hedef 150: 0 gün', k.target.daily_orders === 150 && k.target.days_hit === 0 && Number(k.target.avg_progress) === 0.02, JSON.stringify(k.target));
  check('bilinmeyen olay adı görünür', k.tracking.unknown.some((u) => u.name === 'weird_event'), JSON.stringify(k.tracking));

  const km = await kpi('2026-10-01', '2026-10-03', B_MERKEZ);
  // Merkez: o1 200, o2 100, o9 120, a1 150, a3 80, a7 40
  check('şube süzgeci (merkez) 6 / 690', km.totals.orders === 6 && Number(km.totals.revenue) === 690, JSON.stringify(km.totals));
  check('şube süzgeci kullanıcı metriklerini etkilemez', km.active.mau === 4);

  await db.exec(`update public.app_settings set value = '{"daily_orders": 3}' where key = 'kpi_targets'`);
  const k3 = await kpi('2026-10-01', '2026-10-03');
  check('hedef ayardan: 3/gün → 3 gün tuttu', k3.target.daily_orders === 3 && k3.target.days_hit === 3);
  await db.exec(`update public.app_settings set value = '{"daily_orders": 150}' where key = 'kpi_targets'`);

  console.log('\n[4d] admin_kpi yetki');
  await asRole(db, 'authenticated', U_USER, () =>
    expectError(db, 'admin olmayan → 42501', `select public.admin_kpi('2026-10-01', '2026-10-03')`, [], /yetki yok/));
  await asRole(db, 'anon', null, () =>
    expectError(db, 'anon çağıramaz', `select public.admin_kpi('2026-10-01', '2026-10-03')`, [], /permission/));
  await asRole(db, 'authenticated', U_ADMIN, () =>
    expectError(db, 'ters aralık → 22023', `select public.admin_kpi('2026-10-03', '2026-10-01')`, [], /geçersiz/));
  await db.exec(`set role service_role; select set_config('request.jwt.claims', '{"role":"service_role"}', false);`);
  const ks = (await db.query(`select public.admin_kpi('2026-10-01', '2026-10-03') k`)).rows[0].k;
  await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  check('service_role çağırabilir', ks.totals.orders === 9);
  await asRole(db, 'authenticated', U_ADMIN, () =>
    expectError(db, 'görünümler istemciye kapalı', `select * from public.kpi_orders_unified`, [], /permission/));
}

async function seedKpi(db, { upsert, row, U_ADMIN, U_USER, U_OTHER, B_MERKEZ, B_SUBE }) {
  // İstanbul = UTC+3. Aralık 1–3 Ekim 2026.
  await db.exec(`
    insert into public.profiles (id, created_at) values
      ('${U_USER}',  '2026-10-01T07:00:00Z'),
      ('${U_ADMIN}', '2026-10-02T07:00:00Z'),
      ('${U_OTHER}', '2026-09-20T07:00:00Z');
    insert into public.campaigns (title, code, source) values ('Hoş geldin', 'HOSGELDIN', null), ('Saha Ali', 'SAHA-ALI', 'saha');
    insert into public.orders (created_at, status, payment_status, total_amount, discount_amount, branch_id, user_id, coupon_code, source, external_code) values
      ('2026-10-01T09:00:00Z', 'delivered', 'paid',    200, 20, '${B_MERKEZ}', '${U_USER}',  'hosgeldin', 'app', null),   -- o1
      ('2026-10-02T09:00:00Z', 'confirmed', 'paid',    100,  0, '${B_MERKEZ}', '${U_USER}',  null,        'app', null),   -- o2
      ('2026-10-02T10:00:00Z', 'on_way',    'paid',    300,  0, '${B_SUBE}',   '${U_OTHER}', 'SAHA-ALI',  'app', null),   -- o3
      ('2026-09-20T10:00:00Z', 'delivered', 'paid',     50,  0, '${B_SUBE}',   '${U_OTHER}', null,        'app', null),   -- o4 (aralık dışı, ilk sipariş)
      ('2026-10-01T10:00:00Z', 'pending',   'pending', 999,  0, '${B_MERKEZ}', '${U_USER}',  null,        'app', null),   -- o5 ödenmemiş
      ('2026-10-01T11:00:00Z', 'cancelled', 'paid',    999,  0, '${B_MERKEZ}', '${U_USER}',  null,        'app', null),   -- o6 iptal
      ('2026-10-03T09:00:00Z', 'preparing', 'paid',     80,  0, '${B_MERKEZ}', null,         null, 'trendyolgo', 'TY-77'), -- o7 adisyo a3 ile aynı
      ('2026-10-03T10:00:00Z', 'preparing', 'paid',     90,  0, '${B_SUBE}',   null,         null, 'trendyolgo', 'TY-88'); -- o8
    insert into public.orders (created_at, status, payment_status, total_amount, branch_id, user_id, source, adisyo_order_id) values
      ('2026-10-03T11:00:00Z', 'delivered', 'paid', 120, '${B_MERKEZ}', '${U_USER}', 'app', 7005);                          -- o9
  `);
  const A = (over) => row({ items: [], external_ref: null, discount: 0, ...over });
  await upsert(db, A({ adisyo_order_id: 7001, channel: 'yemeksepeti', total: 150, inserted_at: '2026-10-01T08:00:00Z', restaurant_key: 'rk-merkez', raw_hash: 'k1' }));
  await upsert(db, A({ adisyo_order_id: 7002, channel: 'salon', total: 60, inserted_at: '2026-10-02T08:00:00Z', restaurant_key: 'rk-sube', raw_hash: 'k2' }));
  await upsert(db, A({ adisyo_order_id: 7003, channel: 'trendyol_go', total: 80, inserted_at: '2026-10-03T08:00:00Z', restaurant_key: 'rk-merkez', external_ref: 'TY-77', raw_hash: 'k3' }));
  await upsert(db, A({ adisyo_order_id: 7004, channel: 'getir', total: 70, inserted_at: '2026-10-03T08:00:00Z', restaurant_key: 'rk-merkez', is_cancelled: true, raw_hash: 'k4' }));
  await upsert(db, A({ adisyo_order_id: 7005, channel: 'diger', total: 120, inserted_at: '2026-10-03T11:00:00Z', restaurant_key: 'rk-merkez', raw_hash: 'k5' }));
  await upsert(db, A({ adisyo_order_id: 7006, channel: 'salon', total: 33, inserted_at: '2026-10-03T21:30:00Z', restaurant_key: 'rk-merkez', raw_hash: 'k6' })); // 4 Eki 00:30 İst
  await upsert(db, A({ adisyo_order_id: 7007, channel: 'telefon', total: 40, inserted_at: '2026-09-30T21:30:00Z', restaurant_key: 'rk-merkez', raw_hash: 'k7' })); // 1 Eki 00:30 İst

  await db.exec(`
    insert into public.analytics_events (user_id, anon_id, event_name, props, created_at) values
      ('${U_USER}', 'dU', 'app_open',  '{}', '2026-10-01T08:00:00Z'),
      ('${U_USER}', 'dU', 'home_view', '{}', '2026-10-01T09:00:00Z'),
      (null,        'x1', 'app_open',  '{}', '2026-10-01T09:30:00Z'),
      ('${U_USER}', 'dU', 'app_open',  '{}', '2026-10-02T08:00:00Z'),
      ('${U_USER}', 'dU', 'share',     '{"target":"post"}', '2026-10-02T09:00:00Z'),
      ('${U_USER}', 'dU', 'share',     '{"target":"day"}',  '2026-10-02T09:05:00Z'),
      ('${U_USER}', 'dU', 'saha_code_apply', '{"code":"SAHA-ALI","ok":true}',  '2026-10-02T09:10:00Z'),
      ('${U_USER}', 'dU', 'saha_code_apply', '{"code":"SAHA-XX","ok":false}',  '2026-10-02T09:11:00Z'),
      ('${U_USER}', 'dU', 'coupon_apply',    '{"code":"HOSGELDIN","ok":true}', '2026-10-02T09:12:00Z'),
      ('${U_USER}', 'dU', 'weird_event',     '{}', '2026-10-02T09:13:00Z'),
      ('${U_OTHER}', 'dO', 'app_open', '{}', '2026-09-28T08:00:00Z'),
      (null,         'x2', 'app_open', '{}', '2026-09-10T08:00:00Z'),
      (null,         'x3', 'app_open', '{}', '2026-09-01T08:00:00Z'),
      ('${U_USER}',  'dU', 'app_open', '{}', '2026-10-08T08:00:00Z'),
      ('${U_ADMIN}', 'dA', 'app_open', '{}', '2026-11-01T08:00:00Z');
    insert into public.ai_scan_usage (user_id, day, used) values
      ('${U_USER}', '2026-10-01', 3), ('${U_OTHER}', '2026-10-01', 1), ('${U_USER}', '2026-10-02', 0);
    insert into public.posts (author_id, status, published_at) values
      ('${U_USER}', 'published', '2026-10-02T09:00:00Z'), ('${U_USER}', 'published', '2026-10-02T10:00:00Z'),
      ('${U_OTHER}', 'published', '2026-10-02T11:00:00Z'), ('${U_OTHER}', 'hidden', '2026-10-02T12:00:00Z');
    insert into public.day_shares (user_id, consumption_id, created_at) values ('${U_USER}', gen_random_uuid(), '2026-10-03T09:00:00Z');
  `);
}
