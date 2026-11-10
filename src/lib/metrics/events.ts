// G19-S3 — Olay sözlüğü (tek kaynak). İstemci `track(name, props)` YALNIZ
// buradaki adları ve buradaki prop beyaz listesini kabul eder.
//
// Sözleşme: D-S1 (`night19/data`) `public.analytics_event_names` tablosu.
// Buradaki her ad o tabloya `supabase/migrations/20261109110000_g19_s3_event_names.sql`
// ile de yazılır (test: metricsDictionary.test.ts iki listeyi eşler).
//
// Kurallar
//  • Ad biçimi: ^[a-z][a-z0-9_]{1,63}$ (sunucu CHECK ile aynı).
//  • `props`: beyaz liste. Listede olmayan anahtar SESSİZCE düşer
//    (sanitize.ts). Kişisel veri (ad, e-posta, telefon, adres, konum, kart,
//    serbest metin not, başka kullanıcının kimliği/handle'ı) için anahtar YOK.
//  • `meta`: yalnız reklam olayları Meta SDK'ya gider (ATT + uygulama içi rıza
//    açıksa; bkz. consent.ts). Diğer olaylar yalnız Supabase'e yazılır.
//  • `attribution: true`: olaya ilk/son dokunma (kaynak, kampanya) eklenir
//    (sipariş hunisi).
//  • `aliasOf`: aynı anlamın ikinci adı (D-S1'deki alias_of ile aynı yön).
//    İstemci alias'ı DEĞİL kanonik adı yazar; alias yalnız sözlükte durur.
//  • `source: 'server'`: istemci yazmaz (veritabanı tetikleyicisi yazar);
//    `track()` tipi bu adları kabul etmez.

export type PropKind =
  | 'id' // kısa kimlik: ürün/sipariş/afiş no (≤ 64, [A-Za-z0-9_.:-])
  | 'code' // kupon/saha/kampanya kodu (büyük harfe çevrilir, ≤ 32)
  | 'text' // kısa etiket: kategori, marka, ekran adı (≤ 64, PII deseni düşer)
  | 'url' // uygulama içi yönlendirme/derin bağlantı (≤ 200, sorgu dizesi atılır)
  | 'number'
  | 'boolean'
  | readonly string[]; // sabit değer kümesi (enum)

export type EventCategory = 'lifecycle' | 'tracking' | 'social' | 'commerce' | 'marketing';

export type MetaAdapter =
  | 'viewContent'
  | 'addToCart'
  | 'initiateCheckout'
  | 'purchase'
  | 'completeRegistration';

export interface EventDef {
  readonly category: EventCategory;
  readonly tr: string;
  readonly en: string;
  readonly props: Readonly<Record<string, PropKind>>;
  readonly source?: 'client' | 'server';
  readonly meta?: MetaAdapter;
  readonly attribution?: boolean;
  readonly aliasOf?: string;
  readonly kpi?: boolean;
}

const SIGNUP_METHODS = ['apple', 'google', 'email', 'phone', 'unknown'] as const;
const SCAN_VIA = ['camera', 'gallery', 'queue', 'legacy', 'voice'] as const;
// G19-S4: G19-S2 kaynaklarıyla birleşik tek liste (logSource.ts aynı kümeyi üretir).
const LOG_SOURCES = ['scan', 'manual', 'order', 'pantry', 'kesfet', 'day_card', 'quick', 'barcode'] as const;
// G21-S1 md.2: barkod (Open Food Facts) sonucu bulunamama nedenleri.
const BARCODE_MISS = ['missing', 'no_kcal', 'timeout', 'network', 'http', 'offline'] as const;
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const SHARE_TARGETS = ['post', 'day', 'meal', 'product', 'app', 'report', 'streak'] as const;
const UI = ['ek_v2', 'legacy', 'fin'] as const;

// Sipariş hunisi olaylarına eklenen kaynak alanları (attribution.ts doldurur).
export const ATTRIBUTION_PROPS = {
  channel: ['app'] as const,
  ft_source: 'text',
  ft_medium: 'text',
  ft_campaign: 'text',
  lt_source: 'text',
  lt_medium: 'text',
  lt_campaign: 'text',
  lt_code: 'code',
  lt_age_h: 'number',
} as const satisfies Record<string, PropKind>;

const PAYMENT_PROPS = {
  order_id: 'id',
  price: 'number',
  payment_method: 'text',
} as const satisfies Record<string, PropKind>;

export const EVENTS = {
  // ── Yaşam döngüsü ───────────────────────────────────────────────────────
  app_open: {
    category: 'lifecycle', kpi: true,
    tr: 'Uygulama açıldı (soğuk/sıcak başlangıç)', en: 'App opened (cold/warm start)',
    props: { cold: 'boolean', first: 'boolean' },
  },
  first_touch: {
    category: 'lifecycle', kpi: true,
    tr: 'İlk açılış kaynağı (derin bağlantı / UTM / QR / saha kodu)',
    en: 'First-open attribution (deep link / UTM / QR / field code)',
    props: { source: 'text', medium: 'text', campaign: 'text', content: 'text', term: 'text', code: 'code', link: 'text' },
  },
  signup: {
    category: 'lifecycle', kpi: true, meta: 'completeRegistration',
    tr: 'Hesap oluşturuldu', en: 'Account created',
    props: { method: SIGNUP_METHODS },
  },
  login: {
    category: 'lifecycle',
    tr: 'Giriş yapıldı (anonim kimlik kullanıcıya bağlanır)', en: 'Logged in (anonymous id linked to user)',
    props: { method: SIGNUP_METHODS },
  },
  onb_step: {
    category: 'lifecycle',
    tr: 'Karşılama/kurulum adımı görüldü', en: 'Onboarding step viewed',
    props: { flow: ['first', 'takibe'] as const, step: 'text', index: 'number' },
  },
  welcome_view: {
    category: 'lifecycle', tr: 'Karşılama ekranı görüldü', en: 'Welcome screen viewed', props: {},
  },
  welcome_login_click: {
    category: 'lifecycle', tr: 'Karşılamada giriş tıklandı', en: 'Welcome login tapped', props: {},
  },
  welcome_skip_click: {
    category: 'lifecycle', tr: 'Karşılama atlandı', en: 'Welcome skipped', props: { source: 'text' },
  },

  // ── Takip (kcalculate) ─────────────────────────────────────────────────
  scan_open: {
    category: 'tracking', tr: 'Tara ekranı açıldı', en: 'Scan screen opened', props: { camera: ['live', 'fallback', 'legacy'] as const },
  },
  scan_capture: {
    category: 'tracking', aliasOf: 'scan_start',
    tr: 'Fotoğraf çekildi/seçildi, analiz başladı', en: 'Photo captured/picked, analysis started',
    props: { via: SCAN_VIA, has_hint: 'boolean', retry: 'boolean', offline: 'boolean' },
  },
  scan_start: {
    category: 'tracking', tr: 'AI yemek taraması başlatıldı', en: 'AI food scan started', props: { via: SCAN_VIA },
  },
  scan_success: {
    category: 'tracking', kpi: true,
    tr: 'AI taraması sonuç verdi', en: 'AI scan succeeded',
    props: { n_items: 'number', kcal: 'number', via: SCAN_VIA, cached: 'boolean' },
  },
  scan_fail: {
    category: 'tracking', aliasOf: 'scan_failed',
    tr: 'AI taraması başarısız', en: 'AI scan failed',
    props: { code: 'text', stage: 'text', via: SCAN_VIA },
  },
  scan_failed: {
    category: 'tracking', tr: 'AI taraması başarısız (eski ad)', en: 'AI scan failed (old name)', props: { reason: 'text' },
  },
  scan_limit: {
    category: 'tracking', tr: 'Günlük ücretsiz tarama hakkı bitti', en: 'Daily free scan limit reached',
    props: { via: SCAN_VIA },
  },
  scan_offline: {
    category: 'tracking', tr: 'Tarama çevrimdışı kuyruğa alındı', en: 'Scan queued offline', props: { pending: 'number' },
  },
  scan_log: {
    category: 'tracking', tr: 'Tarama sonucu güne kaydedildi', en: 'Scan result logged to the day',
    props: { n_items: 'number', kcal: 'number', edited: 'boolean', meal_type: 'text' },
  },
  // G21-S1 md.2 — barkod → Open Food Facts (AI hakkı tüketmez).
  barcode_scan: {
    category: 'tracking', tr: 'Barkod okundu (Tara)', en: 'Barcode read (Scan)', props: { offline: 'boolean' },
  },
  barcode_found: {
    category: 'tracking', tr: 'Barkodlu ürün Open Food Facts’te bulundu', en: 'Barcode product found on Open Food Facts',
    props: { cached: 'boolean', has_serving: 'boolean' },
  },
  barcode_not_found: {
    category: 'tracking', tr: 'Barkodlu ürün bulunamadı (yok / kcal yok / bağlantı)', en: 'Barcode product not found (missing / no kcal / connection)',
    props: { reason: BARCODE_MISS },
  },
  // G22-S1 md.1 — sesle ekleme (ses gönderilmez; yalnız uzunluk/dil).
  voice_start: {
    category: 'tracking', tr: 'Sesle ekleme: dinleme başladı', en: 'Voice add: listening started', props: { lang: ['tr', 'en'] },
  },
  voice_done: {
    category: 'tracking', tr: 'Sesle ekleme: metin analize gönderildi', en: 'Voice add: transcript sent to analysis', props: { chars: 'number' },
  },
  voice_empty: {
    category: 'tracking', tr: 'Sesle ekleme: konuşma duyulmadı', en: 'Voice add: no speech heard', props: {},
  },
  // G22-S1 md.4 — kcalAI abonelikleri.
  paywall_view: {
    category: 'commerce', tr: 'Abonelik ekranı görüntülendi', en: 'Paywall viewed',
    props: { from: ['limit_ai', 'limit_barcode', 'limit_voice', 'profile', 'pill', 'coach', 'other'] },
  },
  sub_purchase: {
    category: 'commerce', tr: 'Abonelik satın alma sonucu', en: 'Subscription purchase result',
    props: { product: 'id', result: ['success', 'cancelled', 'pending', 'error'] },
  },
  sub_restore: {
    category: 'commerce', tr: 'Satın alımları geri yükleme', en: 'Restore purchases', props: { result: ['restored', 'none', 'error'] },
  },
  barcode_limit: {
    category: 'tracking', tr: 'Günlük ücretsiz barkod hakkı bitti', en: 'Daily free barcode scans used up', props: {},
  },
  // G24-S1 — kcalAI Koç (sunucu satırları 20261111100100_g24_coach.sql).
  coach_open: {
    category: 'tracking', tr: 'kcalAI Koç açıldı', en: 'kcalAI Coach opened', props: { from: ['home', 'scan', 'profile', 'recipe', 'other'] },
  },
  coach_send: {
    category: 'tracking', tr: 'Koç’a mesaj gönderildi', en: 'Message sent to the Coach', props: { via: ['text', 'chip', 'voice'], kind: ['daily', 'trial'] },
  },
  coach_limit: {
    category: 'tracking', tr: 'Koç mesaj hakkı doldu', en: 'Coach message limit reached', props: { kind: ['daily', 'trial'] },
  },
  coach_upsell: {
    category: 'commerce', tr: '"Koç Balance’ta" sheet’i', en: '"Coach is on Balance" sheet', props: { action: ['view', 'plans', 'dismiss'] },
  },
  coach_feedback: {
    category: 'tracking', tr: 'Koç yanıtına geri bildirim', en: 'Feedback on a Coach reply', props: { value: ['up', 'down', 'clear'] },
  },
  log_add: {
    category: 'tracking', kpi: true, aliasOf: 'log_meal',
    tr: 'Öğün kaydedildi', en: 'Meal logged',
    props: { source: LOG_SOURCES, kcal: 'number', slot: SLOTS, offline: 'boolean' },
  },
  log_meal: {
    category: 'tracking', tr: 'Öğün kaydedildi (eski ad)', en: 'Meal logged (old name)', props: { source: LOG_SOURCES },
  },
  log_edit: {
    category: 'tracking', tr: 'Öğün kaydı düzenlendi', en: 'Meal log edited', props: { field: 'text', slot: SLOTS, factor: 'number' },
  },
  log_delete: {
    category: 'tracking', tr: 'Öğün kaydı silindi', en: 'Meal log deleted', props: { source: LOG_SOURCES, count: 'number', slot: SLOTS, undone: 'boolean' },
  },
  water_add: {
    category: 'tracking', aliasOf: 'log_water',
    tr: 'Su eklendi (negatif = geri al)', en: 'Water added (negative = undo)', props: { ml: 'number', total_ml: 'number', undo: 'boolean' },
  },
  log_water: {
    category: 'tracking', tr: 'Su kaydedildi (eski ad)', en: 'Water logged (old name)', props: { ml: 'number' },
  },
  activity_add: {
    category: 'tracking', aliasOf: 'log_activity',
    tr: 'Etkinlik/adım kaydedildi', en: 'Activity logged', props: { type: 'text', minutes: 'number', undo: 'boolean' },
  },
  log_activity: {
    category: 'tracking', tr: 'Etkinlik kaydedildi (eski ad)', en: 'Activity logged (old name)', props: { type: 'text', minutes: 'number' },
  },
  streak_day: {
    category: 'tracking', tr: 'Seri bir gün uzadı', en: 'Streak extended by a day', props: { days: 'number' },
  },
  ring_complete: {
    category: 'tracking', tr: 'Gün halkası tamamlandı', en: 'Day ring completed', props: { ring: 'text', kcal: 'number', target: 'number' },
  },

  // ── Sosyal (Keşfet) ────────────────────────────────────────────────────
  share: {
    category: 'social', kpi: true,
    tr: 'Paylaşım yapıldı (gönderi / gün kartı / ürün)', en: 'Content shared (post / day card / product)',
    props: { target: SHARE_TARGETS, surface: 'text' },
  },
  follow: {
    category: 'social', tr: 'Kullanıcı takip edildi / bırakıldı', en: 'User followed / unfollowed',
    props: { on: 'boolean', state: 'text', surface: 'text' },
  },

  // ── Ticaret (eatkcal) ──────────────────────────────────────────────────
  home_view: { category: 'commerce', tr: 'Ana sayfa görüldü', en: 'Home viewed', props: {} },
  banner_view: {
    category: 'commerce', tr: 'Afiş görüldü', en: 'Banner viewed', props: { banner_id: 'id', source: 'text' },
  },
  banner_click: {
    category: 'commerce', tr: 'Afiş tıklandı', en: 'Banner tapped',
    props: { banner_id: 'id', deeplink: 'url', source: 'text' },
  },
  announcement_strip_click: {
    category: 'commerce', tr: 'Duyuru şeridi tıklandı', en: 'Announcement strip tapped',
    props: { strip_id: 'id', deeplink: 'url' },
  },
  product_view: {
    category: 'commerce', kpi: true, meta: 'viewContent',
    tr: 'Ürün görüldü', en: 'Product viewed',
    props: { product_id: 'id', product_name: 'text', price: 'number', category: 'text', brand: 'text', ui: UI },
  },
  add_to_cart: {
    category: 'commerce', kpi: true, meta: 'addToCart',
    tr: 'Sepete eklendi', en: 'Added to cart',
    props: { product_id: 'id', price: 'number', quantity: 'number', brand: 'text', category: 'text' },
  },
  remove_from_cart: {
    category: 'commerce', tr: 'Sepetten çıkarıldı', en: 'Removed from cart',
    props: { product_id: 'id', price: 'number', quantity: 'number', reason: 'text' },
  },
  cart_view: {
    category: 'commerce', tr: 'Sepet görüldü', en: 'Cart viewed', props: { item_count: 'number', total: 'number', ui: UI },
  },
  begin_checkout: {
    category: 'commerce', kpi: true, meta: 'initiateCheckout', attribution: true,
    tr: 'Ödemeye geçildi', en: 'Checkout started',
    props: { price: 'number', num_items: 'number', coupon_id: 'id', ui: UI, ...ATTRIBUTION_PROPS },
  },
  checkout_start: {
    category: 'commerce', aliasOf: 'begin_checkout',
    tr: 'Ödemeye geçildi (yeni ad)', en: 'Checkout started (new name)', props: {},
  },
  payment_attempt: {
    category: 'commerce', tr: 'Ödeme denendi', en: 'Payment attempted', props: { ...PAYMENT_PROPS },
  },
  payment_pending: {
    category: 'commerce', tr: 'Ödeme beklemede (3D vb.)', en: 'Payment pending (3DS etc.)', props: { ...PAYMENT_PROPS },
  },
  payment_success: {
    category: 'commerce', meta: 'purchase', attribution: true,
    tr: 'Ödeme başarılı (istemci)', en: 'Payment succeeded (client)',
    props: { ...PAYMENT_PROPS, ...ATTRIBUTION_PROPS },
  },
  pay_success: {
    category: 'commerce', aliasOf: 'payment_success',
    tr: 'Ödeme başarılı (yeni ad)', en: 'Payment succeeded (new name)', props: {},
  },
  payment_failed: {
    category: 'commerce', tr: 'Ödeme başarısız', en: 'Payment failed', props: { ...PAYMENT_PROPS, reason: 'text' },
  },
  reorder_from_home: {
    category: 'commerce', tr: 'Ana sayfadan tekrar sipariş', en: 'Reorder from home', props: { order_id: 'id', added: 'number' },
  },
  reorder_from_order_detail: {
    category: 'commerce', tr: 'Sipariş detayından tekrar sipariş', en: 'Reorder from order detail',
    props: { order_id: 'id', added: 'number', ui: UI },
  },
  reorder_from_empty_cart: {
    category: 'commerce', tr: 'Boş sepetten tekrar sipariş', en: 'Reorder from empty cart',
    props: { order_id: 'id', added: 'number' },
  },
  order_review_submitted: {
    category: 'commerce', tr: 'Sipariş değerlendirildi', en: 'Order review submitted',
    props: { order_id: 'id', rating: 'number', item_votes: 'number' },
  },

  // ── Pazarlama ──────────────────────────────────────────────────────────
  coupon_apply: {
    category: 'marketing', kpi: true,
    tr: 'Kupon kodu uygulandı', en: 'Coupon code applied',
    props: { code: 'code', ok: 'boolean', reason: 'text', discount: 'number' },
  },
  saha_code_apply: {
    category: 'marketing', kpi: true,
    tr: 'Saha (satış temsilcisi) kodu uygulandı', en: 'Field-sales code applied',
    props: { code: 'code', ok: 'boolean', reason: 'text', discount: 'number', from_link: 'boolean' },
  },

  // ── Sunucu (istemci YAZMAZ) ────────────────────────────────────────────
  purchase: {
    category: 'commerce', source: 'server', kpi: true,
    tr: 'Satın alma (sunucu: onaylı + ödenmiş sipariş)', en: 'Purchase (server: confirmed + paid order)',
    props: { order_id: 'id', price: 'number', branch_id: 'id' },
  },
  order_delivered: {
    category: 'commerce', source: 'server', kpi: true,
    tr: 'Sipariş teslim edildi (sunucu)', en: 'Order delivered (server)',
    props: { order_id: 'id', branch_id: 'id' },
  },
} as const satisfies Record<string, EventDef>;

export type EventName = keyof typeof EVENTS;

type Defs = typeof EVENTS;
type IsServer<N extends EventName> = Defs[N] extends { source: 'server' } ? true : false;
type IsAlias<N extends EventName> = Defs[N] extends { aliasOf: string } ? (keyof Defs[N]['props'] extends never ? true : false) : false;

/** İstemcinin yazabildiği adlar: sunucu olayları ve prop'suz alias'lar hariç. */
export type ClientEventName = {
  [N in EventName]: IsServer<N> extends true ? never : IsAlias<N> extends true ? never : N;
}[EventName];

type KindValue<K> = K extends 'number'
  ? number
  : K extends 'boolean'
    ? boolean
    : K extends 'id'
      ? string | number
      : K extends readonly (infer U)[]
      ? U
      : string;

export type PropsOf<N extends EventName> = {
  -readonly [P in keyof Defs[N]['props']]?: KindValue<Defs[N]['props'][P]> | null | undefined;
};

export function isEventName(name: string): name is EventName {
  return Object.prototype.hasOwnProperty.call(EVENTS, name);
}

export function eventDef(name: string): EventDef | null {
  return isEventName(name) ? (EVENTS[name] as EventDef) : null;
}

export function isClientEvent(name: string): boolean {
  const d = eventDef(name);
  if (!d || d.source === 'server') return false;
  if (d.aliasOf && Object.keys(d.props).length === 0) return false;
  return true;
}

export const EVENT_NAMES = Object.keys(EVENTS) as EventName[];
