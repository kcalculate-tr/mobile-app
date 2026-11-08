// D-S1 — adisyo-orders saf fonksiyon birim testleri.
// Çalıştırma: deno test supabase/tests/adisyo_orders.test.ts
// (Ağ / DB yok; yalnız _shared/adisyo-orders.ts.)
import {
  foldTr,
  normalizeChannel,
  parseAdisyoDate,
  retryDelayMinutes,
  stableStringify,
  toAdisyoOrderRow,
} from "../functions/_shared/adisyo-orders.ts";

function eq(actual: unknown, expected: unknown, msg = "") {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  beklenen: ${e}\n  gelen:    ${a}`);
}

Deno.test("foldTr: Türkçe karakter sadeleştirme", () => {
  eq(foldTr("İPTAL Edildi"), "iptal edildi");
  eq(foldTr("Çağrı Merkezi"), "cagri merkezi");
  eq(foldTr("GETİR Yemek"), "getir yemek");
});

Deno.test("normalizeChannel: pazar yeri adları", () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ externalAppName: "Yemeksepeti" }, "yemeksepeti"],
    [{ externalAppName: "Yemek Sepeti" }, "yemeksepeti"],
    [{ salesChannelName: "YemekSepeti Paket" }, "yemeksepeti"],
    [{ externalAppName: "Banabi" }, "yemeksepeti"],
    [{ externalAppName: "Trendyol Yemek" }, "trendyol_go"],
    [{ externalAppName: "Trendyol Go" }, "trendyol_go"],
    [{ salesChannelName: "TRENDYOL" }, "trendyol_go"],
    [{ externalAppName: "Getir" }, "getir"],
    [{ externalAppName: "GetirYemek" }, "getir"],
    [{ salesChannelName: "Getir Çarşı" }, "getir"],
    [{ externalAppName: "Migros Yemek" }, "migros"],
    [{ externalAppName: "MigrosYemek" }, "migros"],
    [{ salesChannelName: "Migros Hemen" }, "migros"],
  ];
  for (const [input, want] of cases) eq(normalizeChannel(input), want, JSON.stringify(input));
});

Deno.test("normalizeChannel: salon / telefon / uygulama / diger", () => {
  eq(normalizeChannel({ salesChannelName: "Salon" }), "salon");
  eq(normalizeChannel({ salesChannelName: "Masa Siparişi" }), "salon");
  eq(normalizeChannel({ salesChannelName: "Gel Al" }), "salon");
  eq(normalizeChannel({ salesChannelName: "Restoran" }), "salon");
  eq(normalizeChannel({ salesChannelName: "Telefon" }), "telefon");
  eq(normalizeChannel({ salesChannelName: "Paket Servis" }), "telefon");
  eq(normalizeChannel({ salesChannelName: "WhatsApp" }), "telefon");
  eq(normalizeChannel({ externalAppName: "KCAL Mobil Uygulama" }), "app");
  eq(normalizeChannel({ externalAppName: "eatkcal" }), "app");
  eq(normalizeChannel({ salesChannelName: "Bilinmeyen Kanal" }), "diger");
  eq(normalizeChannel({ salesChannelName: "Bilinmeyen", tableName: "Masa 4" }), "salon");
  // Öncelik: externalAppName pazar yeri ise salesChannelName "Paket" olsa da pazar yeri
  eq(normalizeChannel({ externalAppName: "Yemeksepeti", salesChannelName: "Paket Servis" }), "yemeksepeti");
});

Deno.test("normalizeChannel: ad yoksa sipariş tipi", () => {
  eq(normalizeChannel({}), "diger");
  eq(normalizeChannel({ tableName: "Bahçe 2" }), "salon");
  eq(normalizeChannel({ orderTypeId: 1 }), "salon");
  eq(normalizeChannel({ orderTypeId: 2 }), "telefon");
  eq(normalizeChannel({ orderTypeId: "3" }), "salon");
  eq(normalizeChannel({ orderType: "Paket" }), "telefon");
  eq(normalizeChannel({ salesChannelName: "", externalAppName: null, orderTypeId: 2 }), "telefon");
});

Deno.test("parseAdisyoDate: ofsetsiz = İstanbul", () => {
  eq(parseAdisyoDate("2026-10-13T10:41:00"), "2026-10-13T07:41:00.000Z");
  eq(parseAdisyoDate("2026-10-13 10:41:00"), "2026-10-13T07:41:00.000Z");
  eq(parseAdisyoDate("13.10.2026 10:41"), "2026-10-13T07:41:00.000Z");
  eq(parseAdisyoDate("2026-10-13T07:41:00Z"), "2026-10-13T07:41:00.000Z");
  eq(parseAdisyoDate("2026-10-13T10:41:00+03:00"), "2026-10-13T07:41:00.000Z");
  eq(parseAdisyoDate("0001-01-01T00:00:00"), null);
  eq(parseAdisyoDate(null), null);
  eq(parseAdisyoDate("çöp"), null);
});

const SAMPLE = {
  status: 100,
  message: "ok",
  data: {
    id: 410200380,
    status: "Teslimatta",
    statusId: 5,
    customer: { name: "Ayşe Yılmaz", phone: "05321234567", address: "Moda Cad. 1" },
    customerId: 991,
    payments: [{ paymentMethodName: "Online Kredi Kartı", amount: 300 }],
    products: [
      { productName: "Tavuk Bowl", quantity: 2, unitPrice: 150, productUnitId: 77, productNote: "Zile basmayın 0532 123 45 67" },
      { productName: "Ayran", count: 1, totalPrice: 25 },
      { productName: "ayse@example.com", quantity: 1, unitPrice: 1 },
    ],
    orderNote: "Kapıda arayın 05321234567",
    orderType: "Paket",
    orderTypeId: 2,
    tableName: null,
    taxAmount: 30.5,
    discountAmount: "10,50",
    orderTotal: 325,
    orderNumber: "A-1024",
    insertDate: "2026-10-13T10:41:00",
    closedDate: null,
    preparedDate: "2026-10-13T10:55:00",
    restaurantKey: "rk-merkez",
    restaurantName: "KCAL Merkez",
    salesChannelName: "Paket Servis",
    externalAppName: "Yemeksepeti",
    confirmationCode: "YS-998877",
    orderCancelReason: null,
    customerLatitude: 40.98,
    customerLongitude: 29.02,
    deliveryUserName: "Kurye Mehmet",
    waiterName: "Garson Ali",
  },
};

Deno.test("toAdisyoOrderRow: alanlar + kişisel veri YOK", async () => {
  const row = await toAdisyoOrderRow(SAMPLE);
  if (!row) throw new Error("satır null");
  eq(row.adisyo_order_id, 410200380);
  eq(row.order_number, "A-1024");
  eq(row.channel, "yemeksepeti");
  eq(row.channel_raw, "Yemeksepeti / Paket Servis");
  eq(row.status_id, 5);
  eq(row.total, 325);
  eq(row.discount, 10.5);
  eq(row.tax, 30.5);
  eq(row.payment_method, "Online Kredi Kartı");
  eq(row.inserted_at, "2026-10-13T07:41:00.000Z");
  eq(row.prepared_at, "2026-10-13T07:55:00.000Z");
  eq(row.closed_at, null);
  eq(row.is_cancelled, false);
  eq(row.external_ref, "YS-998877");
  eq(row.restaurant_key, "rk-merkez");
  eq(row.items, [
    { name: "Tavuk Bowl", quantity: 2, unit_price: 150, product_id: 77 },
    { name: "Ayran", quantity: 1, unit_price: 25, product_id: null },
  ]);
  const s = JSON.stringify(row);
  for (const bad of ["Ayşe", "0532", "05321234567", "Moda", "40.98", "29.02", "Kurye", "Garson", "Kapıda", "Zile", "@example"]) {
    if (s.includes(bad)) throw new Error(`kişisel veri sızdı: ${bad}`);
  }
  if (!/^[0-9a-f]{64}$/.test(row.raw_hash)) throw new Error("raw_hash sha256 değil");
});

Deno.test("toAdisyoOrderRow: hash kararlı, değişiklikte farklı; zarfsız gövde", async () => {
  const a = await toAdisyoOrderRow(SAMPLE);
  const b = await toAdisyoOrderRow(JSON.parse(JSON.stringify(SAMPLE.data)));
  eq(a?.raw_hash, b?.raw_hash, "zarf/zarfsız aynı hash");
  // Yalnız kişisel alan değişirse hash DEĞİŞMEZ (saklanmadığı için)
  const c = await toAdisyoOrderRow({ ...SAMPLE.data, customer: { name: "Başka" } });
  eq(c?.raw_hash, a?.raw_hash, "kişisel alan hash'i etkilemez");
  const d = await toAdisyoOrderRow({ ...SAMPLE.data, statusId: 7, closedDate: "2026-10-13T11:20:00" });
  if (d?.raw_hash === a?.raw_hash) throw new Error("durum değişince hash değişmeli");
});

Deno.test("toAdisyoOrderRow: iptal + kimliksiz gövde", async () => {
  const r = await toAdisyoOrderRow({ ...SAMPLE.data, statusId: 9, orderCancelReason: "Müşteri vazgeçti" });
  eq(r?.is_cancelled, true);
  eq(r?.cancel_reason, "Müşteri vazgeçti");
  const p = await toAdisyoOrderRow({ ...SAMPLE.data, orderCancelReason: "Arayın 0532 111 22 33" });
  eq(p?.cancel_reason, "[gizlendi]", "telefonlu iptal nedeni gizlenir");
  eq(p?.is_cancelled, true);
  const s = await toAdisyoOrderRow({ ...SAMPLE.data, status: "İptal Edildi", statusId: null });
  eq(s?.is_cancelled, true);
  eq(await toAdisyoOrderRow({ products: [] }), null);
  eq((await toAdisyoOrderRow({ products: [] }, 55))?.adisyo_order_id, 55);
  eq(await toAdisyoOrderRow(null), null);
});

Deno.test("stableStringify + retryDelayMinutes", () => {
  eq(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
  eq([0, 1, 2, 5, 6, 20].map(retryDelayMinutes), [10, 20, 40, 320, 640, 720]);
});
