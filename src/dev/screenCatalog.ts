// G14-S1 — Ekran vitrini kataloğu: Final panosu → uygulama ekranı + durum.
//
// YALNIZ __DEV__. `kcal://dev/screen/<Pano>` (ör. `kcal://dev/screen/FinEkCart-Dark`)
// açıldığında VitrinGate bu tablodan hedefi çözer ve ilgili ekranı mock veriyle,
// doğru bayraklarla ve doğru durumla (boş, hata, yükleniyor, EN, Dark) açar.
//
// Bu dosya SAF veridir (React Native import'u yok) → birim testinde doğrulanır
// (her Final panosunun bir kaydı var mı, URL ayrıştırma, -Dark çözümü).
//
// Üretim paketine GİRMEZ: App.tsx bu klasörü yalnız `if (__DEV__) require(...)`
// ile yükler; Metro üretimde `__DEV__=false` sabitini katlayıp dalı atar
// (kanıt: src/dev/__tests__/vitrinTreeShake.test.ts + G14-S1-LOG).

import type { FlagKey } from '../core/flags/registry';

export type VitrinScheme = 'light' | 'dark';
export type VitrinLang = 'tr' | 'en';
export type VitrinAuth = 'user' | 'guest';

/**
 * Veri durumu — vitrinState.ts bunu uygular:
 *  - default : mock veri dolu
 *  - empty   : mock istemciler boş liste döner, yerel depolar boş
 *  - loading : ağ/mocks hiç dönmez (iskelet kalır)
 *  - error   : ağ/mocks hata atar
 *  - offline : ağ "Network request failed" ile düşer
 */
export type VitrinDataState = 'default' | 'empty' | 'loading' | 'error' | 'offline';

export interface RouteSpec {
  name: string;
  params?: Record<string, unknown>;
  /** İç içe gezgin için başlangıç durumu (ör. Tabs → KesfetTab). */
  state?: { routes: RouteSpec[] };
}

export type VitrinTarget =
  /** Gerçek AppNavigator'ı bu rota yığınıyla açar. */
  | { kind: 'route'; routes: RouteSpec[] }
  /** vitrinScreens.tsx'teki bir bileşen/sahne (sheet, overlay, alt ekran). */
  | { kind: 'component'; key: string; props?: Record<string, unknown> }
  /** Hareket panosu: son kareyi veren sahne (component) — zamanlama kodda token'la doğrulanır. */
  | { kind: 'motion'; key: string; props?: Record<string, unknown> };

export interface CatalogEntry {
  pano: string;
  area: string;
  target: VitrinTarget;
  data: VitrinDataState;
  flags: FlagKey[];
  lang: VitrinLang;
  auth: VitrinAuth;
  /** iOS Dynamic Type — betik `simctl ui content_size` ile uygular. */
  textSize?: 'large' | 'extra-extra-large' | 'accessibility-extra-large';
  /** R3 sekme çubuğu daralma değeri (0 tam, 0.5 orta, 1 küçük). */
  collapse?: number;
  /** Sahne içi ayrıntı (ör. açık sheet, kaydırılmış). vitrinScreens yorumlar. */
  scene?: string;
  /** Final'de `-Dark` görseli var mı. */
  hasDark: boolean;
  note?: string;
  /**
   * G15 — çok kareli panolar (ör. FinComments 1·2·3): `FinComments~2` ya da
   * `FinComments~2-Dark` istenirse bu kareye ait alanlar kaydın üstüne yazılır.
   * allPanoNames'e GİRMEZ (Final görsel listesiyle birebir eşleşme korunur).
   */
  frames?: Record<number, Partial<Pick<CatalogEntry, 'target' | 'scene' | 'data' | 'collapse'>>>;
}

export interface ResolvedEntry extends CatalogEntry {
  /** İstenen ad (ör. `FinFeed-Dark`). */
  requested: string;
  scheme: VitrinScheme;
  /** Çok kareli panoda istenen kare (1 = varsayılan). */
  frame?: number;
}

/** Final'deki bütün yeni yüzeyler: hepsi AÇIK (Final = bayraklar açık hâli). */
export const FINAL_FLAGS: FlagKey[] = [
  'yeni_kabuk',
  'yeni_onboarding',
  'yeni_siparis',
  'kesfet',
  'kesfet_takip',
  'kesfet_video',
  'kesfet_paylasim',
  'kesfet_yorum',
  'ai_tarama',
  'gun_halkasi',
  'etkinlik',
  'sosyal_bildirim',
  'paylasim_karti',
  'su_takibi',
];

/** Final'de -Dark görseli OLMAYAN panolar (design/final/png). */
const NO_DARK = new Set<string>([
  'FinComponents',
  // G18-S3: ölçü karşılaştırma panosu (yalnız Light).
  'FinEkProductCompare',
  'FinScanOffline',
  'FinStressDark',
  'FinStressEN',
  'FinStressLong',
  'FinStressXL',
  // G18-S1 (Tur 26): yalnız açık tema panoları.
  'FinOnbWelcomeB',
  'FinOnbWelcomeC',
  'FinOnbWelcomeEN',
]);

type Partial2 = Partial<Omit<CatalogEntry, 'pano' | 'area' | 'target' | 'hasDark'>>;

function route(routes: RouteSpec[]): VitrinTarget {
  return { kind: 'route', routes };
}
function comp(key: string, props?: Record<string, unknown>): VitrinTarget {
  return { kind: 'component', key, props };
}
function motion(key: string, props?: Record<string, unknown>): VitrinTarget {
  return { kind: 'motion', key, props };
}
const tab = (name: string, params?: Record<string, unknown>): RouteSpec[] => [
  { name: 'Tabs', state: { routes: [{ name, params }] } },
];
const HOME_VITRIN = { vitrinOpenAuto: true, vitrinHour: 9 };
/** G18-S1 — Onboarding iç ekranı. */
const onb = (screen: string, params?: Record<string, unknown>): RouteSpec[] => [
  { name: 'Onboarding', params: { screen, params } },
];
/**
 * G16-S2 — Profil alt ekranı GERÇEK kabukta (Profil sekmesi içinde, TabBarR3 ile):
 * `<Pano>~2`. Alt ekranda tab bar gizli, altta yalnız güvenli alan olmalı.
 */
const inProfileTab = (sub: string) => ({ frames: { 2: { target: route(tab('Profile', { vitrinSub: sub })) } } });
/** G15-S3 — FinCompose kareleri: Final'deki örnek metin/medya/kart (yalnız vitrin). */
const PH_URI = 'https://example.invalid/vitrin-placeholder.jpg';
const COMPOSE_PREFILL = {
  serbest: {
    body: 'Kordon’da sabah koşusu, deniz yine çok güzeldi.',
    photos: [
      { uri: PH_URI, width: 1080, height: 1350 },
      { uri: `${PH_URI}?2`, width: 1080, height: 1350 },
    ],
  },
  ogun: {
    body: 'Bugünkü öğle: tavuk, kinoa ve avokado.',
    photos: [{ uri: '__vitrinPhoto:tavukKinoa', width: 1080, height: 1350 }],
    meal: { name: 'Tavuk kinoa bowl', kcal: 540, protein_g: 42, carbs_g: 48, fat_g: 18, photo_url: '__vitrinPhoto:thTavukKinoa' },
  },
  etkinlik: {
    body: 'Kordon’da 45 dakika.',
    activity: { type: 'kosu', minutes: 45, distanceKm: 8.2 },
  },
};
/** Keşfet sekmesi (yeni kabuk) + isteğe bağlı vitrin parametreleri. */
const kes = (params?: Record<string, unknown>): RouteSpec[] => tab('KesfetTab', { asTab: true, ...params });
const ek = (name: string, params?: Record<string, unknown>): RouteSpec[] => [
  { name: 'Tabs', state: { routes: [{ name: 'Home' }] } },
  { name, params },
];

/** G15-S5 FinPrCards örneği: iki kart, ilki varsayılan (Final "Kart •••• [son 4]"). */
const VITRIN_CARDS = [
  { id: 'vc1', last4: '4242', brand: null, bank_name: null, card_alias: null, is_default: true, created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'vc2', last4: '1881', brand: null, bank_name: null, card_alias: null, is_default: false, created_at: '2026-01-02T00:00:00.000Z' },
];

/** G18-S3: Final'de EN (+Dark) karşılığı olan eatkcal panoları (`<Pano>EN`). */
const EK_EN = [
  'FinCityR1', 'FinWaitlistR1', 'FinWaitlistAdd', 'FinWaitlistSuggest', 'FinEatBerlin',
  'FinEkHome', 'FinEkHomeSkeleton', 'FinEkStore', 'FinEkReviews',
  'FinEkProduct', 'FinEkProductScroll', 'FinEkProductSelected', 'FinEkProductAdded',
  'FinEkCart', 'FinEkCartEmpty', 'FinEkCartSkeleton',
  'FinEkCheckout', 'FinEkCheckoutPayWait', 'FinEkCheckoutPayFail', 'FinEkCheckoutPayUnknown',
  'FinEkAddress', 'FinEkAddressNoPerm', 'FinEkAddressNoMap', 'FinEkAddresses', 'FinEkAddressesEmpty',
  'FinEkOrders', 'FinEkOrdersEmpty', 'FinEkOrdersFilterEmpty', 'FinEkOrderDetail', 'FinEkOrderSuccess',
  'FinEkInfo', 'FinEkErrors',
] as const;

/** G18-S5: Keşfet/Gün/Tara/kabuk EN panoları (`<EN pano>`, `<taban pano>`). */
const OTHER_EN: Array<[string, string]> = [
  ...[
    'FinActivityCard', 'FinAddSheet', 'FinAddToast', 'FinComments', 'FinCompose', 'FinDetail',
    'FinFeed', 'FinFeedScrollR3', 'FinFeedTip', 'FinNotifications', 'FinPostMenuBlock', 'FinPostMenu',
    'FinPosting', 'FinProfilePublic', 'FinRecipe', 'FinReportDone', 'FinReport', 'FinReportNotice',
    'FinRules', 'FinSerbest', 'FinStreak', 'FinTracker', 'FinTrackerEmpty', 'FinVideo',
  ].map((b): [string, string] => [`${b}EN`, b]),
  ['FinTabBarEN-rest', 'FinTabBar-rest'],
  ['FinTabBarEN-mid', 'FinTabBar-mid'],
  ['FinTabBarEN-min', 'FinTabBar-min'],
];

const ENTRIES: Array<[string, string, VitrinTarget, Partial2?]> = [
  // ── Kabuk ──────────────────────────────────────────────────────────────────
  ['FinTabBar-rest', 'kabuk', route(tab('Tracker')), { collapse: 0 }],
  ['FinTabBar-mid', 'kabuk', route(tab('Tracker')), { collapse: 0.5 }],
  ['FinTabBar-min', 'kabuk', route(tab('Tracker')), { collapse: 1 }],

  // ── Onboarding (oturumsuz) ─────────────────────────────────────────────────
  ['FinOnbWelcome', 'onboarding', route([{ name: 'Onboarding', params: { screen: 'OnbWelcome' } }]), { auth: 'guest' }],
  ['FinOnbIntent', 'onboarding', route([{ name: 'Onboarding', params: { screen: 'OnbIntent' } }]), { auth: 'guest' }],
  ['FinOnbAccount', 'onboarding', route([{ name: 'Onboarding', params: { screen: 'OnbAccount', params: { intent: 'track' } } }]), { auth: 'guest' }],
  ['FinOnbNotify', 'onboarding', route([{ name: 'Onboarding', params: { screen: 'OnbNotify', params: { intent: 'track' } } }]), { auth: 'guest' }],
  ['FinOnbUnderage', 'onboarding', route([{ name: 'Onboarding', params: { screen: 'OnbUnderage' } }]), { auth: 'guest' }],
  // G18-S1 (Tur 26) — İlk 60 saniye. FinOpen panosu 2150 ms karesi (katman Karşılama'ya
  // eriyor); FinMoOpen storyboard kareleri `FinMoOpen~1..6` (150/600/1150/1650/1950/2300).
  ['FinOpen', 'onboarding', route(onb('OnbWelcome', { vitrinOpen: true, vitrinOpenAt: 2150 })), { auth: 'guest' }],
  [
    'FinMoOpen', 'hareket', route(onb('OnbWelcome', { vitrinOpen: true, vitrinOpenAt: 1650 })),
    {
      auth: 'guest',
      // ~7: canlı oynatma (dondurulmamış) — video kaydı için.
      frames: {
        ...Object.fromEntries(
          [150, 600, 1150, 1650, 1950, 2300].map((ms, i) => [i + 1, { target: route(onb('OnbWelcome', { vitrinOpen: true, vitrinOpenAt: ms })) }]),
        ),
        7: { target: route(onb('OnbWelcome', { vitrinOpen: true })) },
      },
    },
  ],
  ['FinOnbWelcomeB', 'onboarding', route(onb('OnbWelcome')), { auth: 'guest', flags: [...FINAL_FLAGS, 'onb_welcome_variant_b'] }],
  ['FinOnbWelcomeC', 'onboarding', route(onb('OnbWelcome')), { auth: 'guest', flags: [...FINAL_FLAGS, 'onb_welcome_variant_c'] }],
  ['FinOnbWelcomeEN', 'onboarding', route(onb('OnbWelcome')), { auth: 'guest', lang: 'en' }],
  ['FinOnbAccountEmail', 'onboarding', route(onb('OnbAccount', { intent: 'track', vitrinSheet: 'email' })), { auth: 'guest' }],
  ['FinOnbAccountKeyboard', 'onboarding', route(onb('OnbAccount', { intent: 'track', vitrinSheet: 'keyboard' })), { auth: 'guest' }],

  // ── Takibe başla ───────────────────────────────────────────────────────────
  ['FinTbGoal', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbGoal' } }])],
  ['FinTbPace', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbPace' } }]), { scene: 'draft' }],
  ['FinTbAbout', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbAbout' } }]), { scene: 'draft' }],
  ['FinTbActivity', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbActivity' } }]), { scene: 'draft' }],
  ['FinTbResult', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbResult' } }]), { scene: 'draft' }],
  ['FinTbHow', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbResult', params: { vitrinHow: true } } }]), { scene: 'draft' }],
  ['FinTbFirst', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbFirst' } }]), { scene: 'draft' }],

  // ── Ana sayfa (Tracker, yeni kabuk) ────────────────────────────────────────
  // G15-S2: vitrin* parametreleri (yalnız __DEV__) — Final'in ara durumları:
  // açık porsiyon menüsü (pano state editing:true), sabah selamı, teslim anı,
  // bekleyen-log damlası.
  ['FinHomeR3', 'ana', route(tab('Tracker', HOME_VITRIN)), { scene: 'meals' }],
  ['FinHomeEmptyR1', 'ana', route(tab('Tracker', { vitrinHour: 9, vitrinProfileCard: true })), { data: 'empty' }],
  // G18-S1: profil kartı (hedefi olmayan hesap) + oryantasyon ipuçları gerçek ekran üstünde.
  ['FinHomeProfileCard', 'ana', route(tab('Tracker', { ...HOME_VITRIN, vitrinProfileCard: true })), { scene: 'profileCard' }],
  ['FinOrient1', 'ana', route(tab('Tracker', { vitrinHour: 9 })), { data: 'empty', scene: 'orient1' }],
  ['FinOrient2', 'tara', comp('orientLog'), { scene: 'orient2' }],
  ['FinOrient3', 'ana', route(tab('Tracker', HOME_VITRIN)), { scene: 'orient3' }],
  ['FinOrient4', 'kesfet', route(tab('KesfetTab', { asTab: true })), { scene: 'orient4' }],
  ['FinHomeDelivered', 'ana', route(tab('Tracker', { ...HOME_VITRIN, vitrinDelivered: true })), { scene: 'delivered' }],
  ['FinHomeEN', 'ana', route(tab('Tracker', HOME_VITRIN)), { lang: 'en', scene: 'meals' }],
  ['FinHomeXL', 'ana', route(tab('Tracker', HOME_VITRIN)), { textSize: 'accessibility-extra-large', scene: 'meals' }],
  ['FinHomeLogBefore', 'ana', route(tab('Tracker', { ...HOME_VITRIN, vitrinPending: 'dinner' })), { scene: 'meals' }],
  ['FinHomeLogFlow', 'ana', route(tab('Tracker', { ...HOME_VITRIN, vitrinPending: 'dinner' })), { scene: 'meals' }],
  ['FinHomeLogMerged', 'ana', route(tab('Tracker', HOME_VITRIN)), { scene: 'meals' }],
  // G18-S2 — Tur 26c/26d: bölge hâlleri (pano kaydırma 1580), boş hâl EN, XL EN.
  ['FinHomeIzmir', 'ana', route(tab('Tracker', { ...HOME_VITRIN, vitrinScroll: 1580 })), { scene: 'izmir' }],
  ['FinHomeOutside', 'ana', route(tab('Tracker', { ...HOME_VITRIN, vitrinScroll: 1580 })), { scene: 'outside' }],
  ['FinHomeEmptyR1EN', 'ana', route(tab('Tracker', { vitrinHour: 9, vitrinProfileCard: true })), { data: 'empty', lang: 'en' }],
  ['FinHomeXLEN', 'ana', route(tab('Tracker', HOME_VITRIN)), { textSize: 'accessibility-extra-large', lang: 'en', scene: 'meals' }],

  // ── Keşfet ─────────────────────────────────────────────────────────────────
  // G15-S3: Keşfet sahneleri Final örnek içeriğiyle (vitrinKesfet.ts). `vitrin*` rota
  // parametreleri yalnız vitrinin açtığı ara durumlar içindir (üretimde hiç verilmez).
  ['FinFeed', 'kesfet', route(kes({ vitrinXray: true }))],
  ['FinFeedScrollR3', 'kesfet', route(kes({ vitrinScroll: 440 })), { collapse: 1, scene: 'scrolled' }],
  ['FinFeedTip', 'kesfet', route(kes({ vitrinScroll: 300 })), { scene: 'tip' }],
  ['FinFollowingEmpty', 'kesfet', route(kes({ initialTab: 'following' })), { data: 'default', scene: 'following' }],
  // G18-S4 md.4 — Sana Özel boş (gerçek içerik yok → başlangıç/üretici alanları gizli).
  ['FinFeedEmpty', 'kesfet', route(kes()), { data: 'empty' }],
  // G18-S4 — EN çekimleri (ORTAK #10: yeni ekranlar cihaz dili EN iken).
  ['FinFeedEmptyEN', 'kesfet', route(kes()), { data: 'empty', lang: 'en' }],
  ['FinFollowingEmptyEN', 'kesfet', route(kes({ initialTab: 'following' })), { data: 'default', scene: 'following', lang: 'en' }],
  ['FinDetail', 'kesfet', route([...kes(), { name: 'SharedPost', params: { postId: 'post-d1' } }]), { scene: 'detail' }],
  ['FinSerbest', 'kesfet', route(kes()), { scene: 'serbest' }],
  [
    'FinActivityCard',
    'kesfet',
    route(kes()),
    {
      scene: 'activity',
      frames: {
        2: { scene: 'didIt', target: route(kes({ vitrin: 'didIt' })) },
        3: { scene: 'didItToast', target: route(kes({ vitrin: 'didItToast' })) },
      },
    },
  ],
  [
    'FinVideo',
    'kesfet',
    route(kes()),
    { scene: 'video', frames: { 2: { scene: 'videoFull', target: route(kes({ vitrin: 'videoFull' })) } } },
  ],
  [
    'FinCompose',
    'kesfet',
    // Final örnek içerik: `__vitrinPhoto:<ad>` vitrinSetup'ta dev görsel URI'sine çevrilir.
    route([...kes(), { name: 'Composer', params: { vitrinKind: 'serbest', vitrinPrefill: COMPOSE_PREFILL.serbest } }]),
    {
      scene: 'compose',
      frames: {
        2: { target: route([...kes(), { name: 'Composer', params: { vitrinKind: 'ogun', vitrinPrefill: COMPOSE_PREFILL.ogun } }]) },
        3: { target: route([...kes(), { name: 'Composer', params: { vitrinKind: 'etkinlik', vitrinPrefill: COMPOSE_PREFILL.etkinlik } }]) },
      },
    },
  ],
  [
    'FinPosting',
    'kesfet',
    route(kes({ vitrin: 'posting' })),
    {
      scene: 'posting',
      frames: {
        2: { scene: 'reviewing', target: route(kes({ vitrin: 'reviewing' })) },
        3: { scene: 'published', target: route(kes({ vitrin: 'published' })) },
        4: { scene: 'rejected', target: route(kes({ vitrin: 'rejected' })) },
      },
    },
  ],
  ['FinRules', 'kesfet', comp('rulesSheet')],
  [
    'FinComments',
    'kesfet',
    route(kes({ vitrin: 'comments' })),
    {
      scene: 'activity',
      frames: {
        2: { target: route(kes({ vitrin: 'commentsMenu' })) },
        3: { scene: 'commentsEmpty', target: route(kes({ vitrin: 'comments' })) },
      },
    },
  ],
  ['FinNotifications', 'kesfet', route([...kes(), { name: 'KesfetNotifications' }]), { scene: 'notifications' }],
  ['FinAddSheet', 'kesfet', comp('addToDaySheet')],
  ['FinAddToast', 'kesfet', route(kes({ vitrin: 'addToast' }))],
  ['FinPostMenu', 'kesfet', route(kes({ vitrin: 'menu' }))],
  ['FinPostMenuBlock', 'kesfet', route(kes({ vitrin: 'block' }))],
  ['FinReport', 'kesfet', route(kes({ vitrin: 'report', vitrinNote: 'Günde 600 kcal öneriyor, tehlikeli.' }))],
  ['FinReportDone', 'kesfet', route(kes({ vitrin: 'reportDone' }))],
  ['FinReportNotice', 'kesfet', route([...kes(), { name: 'KesfetNotifications' }]), { scene: 'reportNotice' }],

  // ── Gün halkası / etkinlik ─────────────────────────────────────────────────
  ['FinGunView', 'gun', comp('gunViewer')],
  ['FinGunEnd', 'gun', comp('gunViewer', { end: true })],
  ['FinGunDone', 'gun', comp('gunViewer', { done: true })],
  ['FinGunEmpty', 'gun', comp('gunEmpty'), { data: 'empty' }],
  ['FinTracker', 'gun', route(tab('Tracker')), { scene: 'activity' }],
  ['FinTrackerEmpty', 'gun', route(tab('Tracker')), { data: 'empty', scene: 'activity' }],
  ['FinStreak', 'gun', route(tab('KesfetTab', { asTab: true })), { scene: 'streak' }],

  // ── Tara ───────────────────────────────────────────────────────────────────
  ['FinScanR2', 'tara', route([...tab('Tracker'), { name: 'AiScan' }])],
  ['FinScanR2EN', 'tara', route([...tab('Tracker'), { name: 'AiScan' }]), { lang: 'en' }],
  ['FinPhotoR1', 'tara', comp('photoResult')],
  ['FinPhotoEN', 'tara', comp('photoResult'), { lang: 'en' }],
  ['FinScanError', 'tara', comp('scanError', { kind: 'camera' })],
  ['FinErrFailed', 'tara', comp('scanError', { kind: 'failed' })],
  ['FinErrOffline', 'tara', comp('scanError', { kind: 'offline' })],
  ['FinErrLimit', 'tara', comp('scanError', { kind: 'limit' })],
  ['FinScanOffline', 'tara', route([{ name: 'AiScanOffline', params: { vitrinOffline: true } }]), { scene: 'scanOffline' }],

  // ── Profil ─────────────────────────────────────────────────────────────────
  ['FinPrProfile', 'profil', route(tab('Profile'))],
  ['FinProfilePublic', 'profil', comp('profileSub', { sub: 'public' })],
  ['FinBadges', 'profil', comp('profileSub', { sub: 'badges' }), inProfileTab('badges')],
  ['FinPrivacy', 'profil', comp('privacySheet')],
  ['FinPrivacySettings', 'profil', comp('profileSub', { sub: 'privacy' }), inProfileTab('privacy')],
  ['FinPrProgress', 'profil', comp('profileSub', { sub: 'progress' }), inProfileTab('progress')],
  ['FinPrMacro', 'profil', comp('profileSub', { sub: 'macro', mock: true })],
  ['FinPrMacroWhat', 'profil', comp('profileSub', { sub: 'macro', what: true, mock: true })],
  ['FinPrMacroHistoryEmpty', 'profil', comp('profileSub', { sub: 'macro', history: true })],
  ['FinPrPersonal', 'profil', comp('profileSub', { sub: 'personal' }), inProfileTab('personal')],
  // G15-S5: yeni_siparis açık → v2 EkSavedCardsScreen (servis çağrılmadan vitrin kartlarıyla).
  ['FinPrCards', 'profil', route([...tab('Profile'), { name: 'ProfileSavedCards', params: { vitrinCards: VITRIN_CARDS } }])],
  ['FinPrNotify', 'profil', comp('profileSub', { sub: 'notify' }), inProfileTab('notify')],
  ['FinPrSecurity', 'profil', comp('profileSub', { sub: 'security' }), inProfileTab('security')],
  ['FinPrAgreements', 'profil', comp('profileSub', { sub: 'agreements' }), inProfileTab('agreements')],
  ['FinPrSupport', 'profil', comp('profileSub', { sub: 'support' }), inProfileTab('support')],
  ['FinPrFeedback', 'profil', comp('profileSub', { sub: 'feedback' }), inProfileTab('feedback')],

  // ── eatkcal ────────────────────────────────────────────────────────────────
  // G15-S5: il kapısı eatkcal sekmesinde (sekme çubuğuyla); adım dev-only `vitrinGate` parametresi.
  ['FinCityR1', 'eatkcal', route(tab('Home')), { scene: 'city' }],
  ['FinWaitlistR1', 'eatkcal', route(tab('Home', { vitrinGate: 'waitlist', vitrinCity: 'istanbul' })), { scene: 'waitlist' }],
  // G18-S3 md.1: "Çok yakında" form sheet'leri (dev-only `vitrinSheet`).
  ['FinWaitlistAdd', 'eatkcal', route(tab('Home', { vitrinGate: 'waitlist', vitrinCity: 'istanbul', vitrinSheet: 'restaurant_add' })), { scene: 'waitlist' }],
  ['FinWaitlistSuggest', 'eatkcal', route(tab('Home', { vitrinGate: 'waitlist', vitrinCity: 'istanbul', vitrinSheet: 'restaurant_suggest' })), { scene: 'waitlist' }],
  ['FinEatBerlin', 'eatkcal', route(tab('Home', { vitrinGate: 'other', vitrinOtherCity: 'Berlin' })), { scene: 'berlin' }],
  // G18-S3: Final'de yüzen sepet çubuğu "Sepet (2)" → sepetli sahne.
  ['FinEkHome', 'eatkcal', route(tab('Home')), { scene: 'cart' }],
  ['FinEkHomeSkeleton', 'eatkcal', route(tab('Home')), { data: 'loading' }],
  // G15-S5: `__first__` → vitrinSetup gerçek menüdeki ilk marka anahtarını koyar.
  ['FinEkStore', 'eatkcal', route(ek('EkStore', { brandKey: '__first__' })), { scene: 'cart' }],
  ['FinEkReviews', 'eatkcal', route(ek('EkStore', { brandKey: '__first__', vitrinReviews: true, vitrinAggregate: { average: 4.7, count: 128, distribution: [96, 22, 6, 2, 2] }, vitrinSubScores: { taste: 4.8, delivery: 4.6, calorieFit: 4.9 } })), { scene: 'reviews' }],
  ['FinEkProduct', 'eatkcal', route(ek('EkProduct', { productId: '__first__' }))],
  ['FinEkProductScroll', 'eatkcal', route(ek('EkProduct', { productId: '__first__', vitrinScroll: true })), { scene: 'scrolled' }],
  // G18-S3 md.4 (Tur 26d/26e): tek alt katman hâlleri — seçim yapılmış / sepete eklendi ("Sepete git").
  ['FinEkProductSelected', 'eatkcal', route(ek('EkProduct', { productId: '__first__', vitrinState: 'selected' })), { scene: 'selected' }],
  ['FinEkProductAdded', 'eatkcal', route(ek('EkProduct', { productId: '__first__', vitrinState: 'added' })), { scene: 'added' }],
  ['FinEkProductCompare', 'eatkcal', route(ek('EkProduct', { productId: '__first__', vitrinScroll: true })), { scene: 'scrolled' }],
  ['FinMoProductBar', 'eatkcal', route(ek('EkProduct', { productId: '__first__', vitrinState: 'added' })), { scene: 'added' }],
  ['FinEkCart', 'eatkcal', route(ek('EkCart')), { scene: 'cart' }],
  ['FinEkCartEmpty', 'eatkcal', route(ek('EkCart')), { data: 'empty' }],
  ['FinEkCartSkeleton', 'eatkcal', route(ek('EkCart', { vitrinSkeleton: true })), { data: 'loading', scene: 'cart' }],
  ['FinEkCheckout', 'eatkcal', route(ek('EkCheckout')), { scene: 'cart' }],
  ['FinEkCheckoutPayWait', 'eatkcal', route(ek('EkCheckout', { vitrinPay: 'wait' })), { scene: 'payWait' }],
  ['FinEkCheckoutPayFail', 'eatkcal', route(ek('EkCheckout', { vitrinPay: 'fail' })), { scene: 'payFail' }],
  ['FinEkCheckoutPayUnknown', 'eatkcal', route(ek('EkCheckout', { vitrinPay: 'unknown' })), { scene: 'payUnknown' }],
  ['FinEkAddress', 'eatkcal', route(ek('EkAddressAdd', { vitrinForm: { district: 'Konak', neighborhood: 'Alsancak', street: 'Kıbrıs Şehitleri Cd.' } }))],
  ['FinEkAddressNoPerm', 'eatkcal', route(ek('EkAddressAdd', { vitrinPerm: 'denied', vitrinForm: { district: 'Konak', neighborhood: 'Alsancak', street: 'Kıbrıs Şehitleri Cd.' } })), { scene: 'noPerm' }],
  ['FinEkAddressNoMap', 'eatkcal', route(ek('EkAddressAdd', { vitrinMap: 'nomap', vitrinForm: { district: 'Konak' } })), { scene: 'noMap' }],
  ['FinEkAddresses', 'eatkcal', route(ek('EkAddresses')), { scene: 'addresses' }],
  ['FinEkAddressesEmpty', 'eatkcal', route(ek('EkAddresses')), { data: 'empty' }],
  ['FinEkOrders', 'eatkcal', route(ek('EkOrders')), { scene: 'orders' }],
  ['FinEkOrdersEmpty', 'eatkcal', route(ek('EkOrders')), { data: 'empty' }],
  ['FinEkOrdersFilterEmpty', 'eatkcal', route(ek('EkOrders', { vitrinFilter: 'cancelled' })), { scene: 'filterEmpty' }],
  ['FinEkOrderDetail', 'eatkcal', route(ek('EkOrderDetail', { orderId: 1 })), { scene: 'orders' }],
  ['FinEkInfo', 'eatkcal', comp('ekInfo')],
  ['FinEkErrors', 'eatkcal', comp('ekErrors')],
  // G18-S3 md.6: doğrulanmış sipariş kutlaması (dev-only `vitrinVerified`; sipariş VERİLMEZ).
  ['FinEkOrderSuccess', 'eatkcal', route(ek('OrderSuccess', { orderCode: 'KCAL-0000', vitrinVerified: true }))],

  // ── Giriş / tanıtım ────────────────────────────────────────────────────────
  ['FinSignupAI', 'giris', comp('signupAIV2', { step: 'welcome' }), { auth: 'guest' }],
  ['FinSignupEat', 'giris', comp('signupEatV2', { step: 'city' }), { auth: 'guest' }],
  ['FinSignupEatAddress', 'giris', comp('signupEatV2', { step: 'address' }), { auth: 'guest' }],
  ['FinSignupEatPhone', 'giris', comp('signupEatV2', { step: 'phone' }), { auth: 'guest' }],
  // G15-S1 Ek karar — v2 adımları (Final'de aynı panonun 2./3. paneli; ayrı çekim için).
  ['FinLoginEmail', 'giris', comp('loginV2', { step: 'email' }), { auth: 'guest' }],
  ['FinLoginCode', 'giris', comp('loginV2', { step: 'code' }), { auth: 'guest' }],
  ['FinSignupAIHandle', 'giris', comp('signupAIV2', { step: 'handle' }), { auth: 'guest' }],
  ['FinSignupAIProfile', 'giris', comp('signupAIV2', { step: 'profile' }), { auth: 'guest' }],
  ['FinIntro', 'giris', route(tab('Tracker')), { scene: 'intro' }],
  ['FinIntroOrder', 'giris', route(tab('Tracker')), { scene: 'introOrder' }],

  // ── Kutlama / koleksiyon ───────────────────────────────────────────────────
  ['FinCelebrate', 'kutlama', comp('celebrate', { kind: 'first' })],
  ['FinCelebStreak3', 'kutlama', comp('celebrate', { kind: 'streak3' })],
  ['FinCelebStreak7', 'kutlama', comp('celebrate', { kind: 'streak7' })],
  ['FinSheetNotify', 'kutlama', comp('notifySheet')],
  ['FinCelebrateProfile', 'kutlama', comp('celebrateProfile', { kcal: 2180 })],
  ['FinCollectCut', 'kutlama', comp('photoResult', { reduced: true })],
  ['FinCollectWon', 'kutlama', comp('collectWon')],
  ['FinCollectGrid', 'kutlama', comp('collectDetail')],
  ['FinCollectEntry', 'kutlama', route(tab('Profile'))],

  // ── Stres (kabul testi) ────────────────────────────────────────────────────
  ['FinStressLong', 'stres', comp('stress', { kind: 'long' })],
  ['FinStressXL', 'stres', comp('stress', { kind: 'xl' }), { textSize: 'accessibility-extra-large' }],
  ['FinStressEN', 'stres', comp('stress', { kind: 'en' }), { lang: 'en' }],
  ['FinStressDark', 'stres', comp('stress', { kind: 'dark' }), { note: 'scheme=dark; durum matrisi panosu' }],

  // ── Bileşenler ─────────────────────────────────────────────────────────────
  ['FinComponents', 'bilesen', comp('components')],

  // ── Hareket (son kare; zamanlama kodda token'la doğrulanır) ───────────────
  // G18-S4 md.3 — FinPush 4 şablon (üretim metinleri, dar/genişletilmiş/gizli).
  ['FinPush', 'bildirim', comp('pushPreview')],
  ['FinPushEN', 'bildirim', comp('pushPreview'), { lang: 'en' }],
  ['FinMoTokens', 'hareket', motion('tokens')],
  ['FinMoMap', 'hareket', motion('tokens')],
  ['FinMoLogA', 'hareket', route(tab('Tracker')), { scene: 'meals' }],
  ['FinMoLogB', 'hareket', route(tab('Tracker')), { scene: 'meals' }],
  ['FinMoRing', 'hareket', route(tab('Tracker')), { scene: 'meals' }],
  // G18-S2 — Ana sayfa odak (a), yerinde öğün menüsü, öne çıkanlar banner'ı.
  ['FinMoFocus', 'hareket', route(tab('Tracker', HOME_VITRIN)), { scene: 'meals' }],
  // Pano: Akşam boş yuvasının hapı görünür alanda, menü yukarı açık (kaydırma 980).
  ['FinMoPopover', 'hareket', route(tab('Tracker', { ...HOME_VITRIN, vitrinMealMenu: 'dinner', vitrinScroll: 980 })), { scene: 'meals' }],
  // Kare dizisi: aç (3,5 sn) → 2 sn açık → kapan (200 ms). `FinMoPopover~2` adıyla çağrılır.
  ['FinMoPopoverCycle', 'hareket', route(tab('Tracker', { ...HOME_VITRIN, vitrinMealMenu: 'dinner', vitrinScroll: 980, vitrinMenuCycle: true })), { scene: 'meals' }],
  // Pano: kullanıcı kaydırmış, 2. kart (Keşfet'te öne çıkan) etkin.
  ['FinMoBanner', 'hareket', route(tab('Tracker', { ...HOME_VITRIN, vitrinBanner: 1 })), { scene: 'meals' }],
  ['FinMoBannerEN', 'hareket', route(tab('Tracker', { ...HOME_VITRIN, vitrinBanner: 1 })), { scene: 'meals', lang: 'en' }],
  ['FinMoStreak', 'hareket', comp('celebrate', { kind: 'streak3' })],
  // G17-S2: canlı Tara → otomatik deklanşör → FinMoScan analiz katmanı → sonuç sheet'i.
  ['FinMoScan', 'hareket', route([...tab('Tracker'), { name: 'AiScan' }]), { scene: 'autoShutter' }],
  ['FinMoLike', 'hareket', comp('postCard', { variant: 'liked' })],
  ['FinMoLoad', 'hareket', route(tab('Home')), { data: 'loading' }],
  ['FinMoSheet', 'hareket', comp('addToDaySheet')],
  ['FinMoCart', 'hareket', route(ek('EkProduct', { productId: '__first__' }))],
  ['FinMoPay', 'hareket', route(ek('EkCheckout')), { scene: 'payWait' }],
  ['FinMoDeliver', 'hareket', route(tab('Tracker')), { scene: 'delivered' }],
  ['FinMoShake', 'hareket', comp('scanError', { kind: 'unrecognized' })],
  ['FinMoSticker', 'hareket', comp('collectWon')],
  ['FinMoCard', 'hareket', comp('postCard', { variant: 'meal' })],
  ['FinMoCollection', 'hareket', comp('profileSub', { sub: 'collection' })],
  ['FinMoLiquid', 'hareket', route(tab('Tracker')), { scene: 'meals' }],
  ['FinMoGlass', 'hareket', comp('celebrate', { kind: 'first' })],
];

function build(): Record<string, CatalogEntry> {
  const out: Record<string, CatalogEntry> = {};
  for (const [pano, area, target, extra] of ENTRIES) {
    out[pano] = {
      pano,
      area,
      target,
      data: 'default',
      flags: FINAL_FLAGS,
      lang: 'tr',
      auth: 'user',
      hasDark: !NO_DARK.has(pano) && !pano.startsWith('FinMo'),
      ...extra,
    };
  }
  // G18-S3 (Tur 26e): eatkcal EN panoları — aynı hedef, cihaz dili EN (+Dark).
  for (const base of EK_EN) {
    const e = out[base];
    if (e) out[`${base}EN`] = { ...e, pano: `${base}EN`, lang: 'en' };
  }
  // G18-S5: FinRecipe (Tur 26e "yeni") — SON_HAL İSTİSNA 4: "Haftanın tarifi" kartı ŞİMDİLİK
  // FinDetail'e açılır → uygulamadaki karşılık FinDetail (kabul tablosunda ayrı satır).
  if (out.FinDetail) out.FinRecipe = { ...out.FinDetail, pano: 'FinRecipe' };
  // G18-S5: S1–S4'ün almadığı Tur 26d/26e EN panoları — aynı hedef, cihaz dili EN (+Dark).
  for (const [en, base] of OTHER_EN) {
    const e = out[base];
    if (e) out[en] = { ...e, pano: en, lang: 'en' };
  }
  return out;
}

export const SCREEN_CATALOG: Readonly<Record<string, CatalogEntry>> = build();

/** Katalogdaki bütün pano adları (Light + varsa -Dark) — betik bu sırayla çeker. */
export function allPanoNames(): string[] {
  const names: string[] = [];
  for (const e of Object.values(SCREEN_CATALOG)) {
    names.push(e.pano);
    if (e.hasDark) names.push(`${e.pano}-Dark`);
  }
  return names;
}

/** `FinFeed-Dark` → FinFeed kaydı + scheme dark. Bilinmeyen ad → null. */
export function resolvePano(requested: string): ResolvedEntry | null {
  const name = requested.trim();
  const extra = resolveParity(name);
  if (extra) return extra;
  const isDark = name.endsWith('-Dark');
  const noDark = isDark ? name.slice(0, -'-Dark'.length) : name;
  const fm = /^(.*)~(\d+)$/.exec(noDark);
  const base = fm ? fm[1] : noDark;
  const frame = fm ? Number(fm[2]) : undefined;
  const entry = SCREEN_CATALOG[base];
  if (!entry) return null;
  if (isDark && !entry.hasDark) return null;
  if (frame != null && frame > 1 && !entry.frames?.[frame]) return null;
  const scheme: VitrinScheme = isDark || base === 'FinStressDark' ? 'dark' : 'light';
  const over = frame != null ? entry.frames?.[frame] ?? {} : {};
  return { ...entry, ...over, requested: name, scheme, frame };
}

/**
 * G16-S2 — Final panosu OLMAYAN iki kontrol sahnesi (allPanoNames'e girmez):
 *  - `Off-<Sekme>` (Tracker | Home | Profile | Cart | Subscriptions): BÜTÜN
 *    bayraklar varsayılanda (kapalı) — bugünkü 1.0.7 kabuğu; parite çekimi.
 *  - `Sub-<alt>` (personal, macro, cards…): Profil alt ekranı GERÇEK yeni kabukta
 *    (Profil sekmesi içinde, TabBarR3 ile) — alt ekranda bar gizli olmalı.
 */
const OFF_AREA: Record<string, string> = { Tracker: 'ana', Home: 'eatkcal', Profile: 'profil', Cart: 'eatkcal', Subscriptions: 'profil' };
function resolveParity(name: string): ResolvedEntry | null {
  // G18-S1 — `Part-HomeEmptyR1`: boş hâl içerik bileşenleri (Ana sayfa montajı S2) pano
  // konumlarında, ölçüm (ROI SSIM) için. Final panosu değil → allPanoNames'e girmez.
  if (name === 'Part-HomeEmptyR1' || name === 'Part-HomeEmptyR1-Dark') {
    const dark = name.endsWith('-Dark');
    return {
      pano: name, area: 'ana', target: comp('homeEmptyParts'), data: 'empty', flags: FINAL_FLAGS,
      lang: 'tr', auth: 'user', hasDark: true, requested: name, scheme: dark ? 'dark' : 'light',
    };
  }
  // G18-S1 (ORTAK #10) — `EN-<Pano>`: aynı pano cihaz dili EN iken (yeni ekranların EN çekimi).
  const en = /^EN-(.+)$/.exec(name);
  if (en) {
    const r = resolvePano(en[1]);
    return r ? { ...r, lang: 'en', requested: name } : null;
  }
  const off = /^Off-(Tracker|Home|Profile|Cart|Subscriptions)$/.exec(name);
  if (off) {
    return {
      pano: name, area: OFF_AREA[off[1]], target: route(tab(off[1])), data: 'default', flags: [],
      lang: 'tr', auth: 'user', hasDark: false, requested: name, scheme: 'light',
    };
  }
  // G17-S1 md.13 — `Route-<RootRota>`: Tabs (Ana sayfa) üstüne GERÇEK kök rota itilir,
  // bütün bayraklar açık → rota denetimi (eski bileşene düşen yol var mı).
  const rt = /^Route-([A-Za-z]+)$/.exec(name);
  if (rt) {
    const ROUTE_PARAMS: Record<string, Record<string, unknown>> = {
      ProductDetail: { productId: '__first__' },
      BrandLanding: { brandKey: 'kcal' },
      OrderDetail: { orderId: 1 },
      CategoryProducts: { categoryName: 'Bowl' },
      SharedProfile: { handle: 'deniz' },
    };
    return {
      pano: name, area: 'eatkcal',
      target: route([...tab('Tracker'), { name: rt[1], params: ROUTE_PARAMS[rt[1]] }]),
      data: 'default', flags: FINAL_FLAGS, lang: 'tr', auth: 'user', hasDark: false, requested: name, scheme: 'light',
    };
  }
  const sub = /^Sub-([a-zA-Z]+)$/.exec(name);
  if (sub) {
    return {
      pano: name, area: 'profil', target: route(tab('Profile', { vitrinSub: sub[1] })), data: 'default',
      flags: FINAL_FLAGS, lang: 'tr', auth: 'user', hasDark: false, requested: name, scheme: 'light',
    };
  }
  return null;
}

/**
 * `kcal://dev/screen/FinFeed`, `exp+kcal://dev/screen/FinFeed`,
 * `kcal:///dev/screen/FinFeed?x=1` → `FinFeed`. Eşleşmezse null.
 */
export function parseVitrinUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /dev\/screen\/([A-Za-z0-9~-]+)/.exec(url);
  return m ? m[1] : null;
}
