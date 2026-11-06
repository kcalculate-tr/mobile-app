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
];

/** Final'de -Dark görseli OLMAYAN panolar (design/final/png). */
const NO_DARK = new Set<string>([
  'FinComponents',
  'FinScanOffline',
  'FinStressDark',
  'FinStressEN',
  'FinStressLong',
  'FinStressXL',
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
/** Keşfet sekmesi (yeni kabuk) + isteğe bağlı vitrin parametreleri. */
const kes = (params?: Record<string, unknown>): RouteSpec[] => tab('KesfetTab', { asTab: true, ...params });
const ek = (name: string, params?: Record<string, unknown>): RouteSpec[] => [
  { name: 'Tabs', state: { routes: [{ name: 'Home' }] } },
  { name, params },
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

  // ── Takibe başla ───────────────────────────────────────────────────────────
  ['FinTbGoal', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbGoal' } }])],
  ['FinTbPace', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbPace' } }]), { scene: 'draft' }],
  ['FinTbAbout', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbAbout' } }]), { scene: 'draft' }],
  ['FinTbActivity', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbActivity' } }]), { scene: 'draft' }],
  ['FinTbResult', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbResult' } }]), { scene: 'draft' }],
  ['FinTbHow', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbResult', params: { vitrinHow: true } } }]), { scene: 'draft' }],
  ['FinTbFirst', 'takibe', route([{ name: 'TakibeBasla', params: { screen: 'TbFirst' } }]), { scene: 'draft' }],

  // ── Ana sayfa (Tracker, yeni kabuk) ────────────────────────────────────────
  ['FinHomeR3', 'ana', route(tab('Tracker')), { scene: 'meals' }],
  ['FinHomeEmptyR1', 'ana', route(tab('Tracker')), { data: 'empty' }],
  ['FinHomeDelivered', 'ana', route(tab('Tracker')), { scene: 'delivered' }],
  ['FinHomeEN', 'ana', route(tab('Tracker')), { lang: 'en', scene: 'meals' }],
  ['FinHomeXL', 'ana', route(tab('Tracker')), { textSize: 'accessibility-extra-large', scene: 'meals' }],
  ['FinHomeLogBefore', 'ana', route(tab('Tracker')), { scene: 'meals' }],
  ['FinHomeLogFlow', 'ana', route(tab('Tracker')), { scene: 'meals' }],
  ['FinHomeLogMerged', 'ana', route(tab('Tracker')), { scene: 'meals' }],

  // ── Keşfet ─────────────────────────────────────────────────────────────────
  // G15-S3: Keşfet sahneleri Final örnek içeriğiyle (vitrinKesfet.ts). `vitrin*` rota
  // parametreleri yalnız vitrinin açtığı ara durumlar içindir (üretimde hiç verilmez).
  ['FinFeed', 'kesfet', route(kes({ vitrinXray: true }))],
  ['FinFeedScrollR3', 'kesfet', route(kes({ vitrinScroll: true })), { collapse: 1, scene: 'scrolled' }],
  ['FinFeedTip', 'kesfet', route(kes()), { scene: 'tip' }],
  ['FinFollowingEmpty', 'kesfet', route(kes({ initialTab: 'following' })), { data: 'default', scene: 'following' }],
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
    route([...kes(), { name: 'Composer', params: { vitrinKind: 'serbest' } }]),
    {
      scene: 'compose',
      frames: {
        2: { target: route([...kes(), { name: 'Composer', params: { vitrinKind: 'ogun' } }]) },
        3: { target: route([...kes(), { name: 'Composer', params: { vitrinKind: 'etkinlik' } }]) },
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
  ['FinPostMenu', 'kesfet', comp('postMenu', { step: 'menu' })],
  ['FinPostMenuBlock', 'kesfet', comp('postMenu', { step: 'block' })],
  ['FinReport', 'kesfet', comp('postMenu', { step: 'report' })],
  ['FinReportDone', 'kesfet', comp('postMenu', { step: 'reportDone' })],
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
  ['FinPhotoR1', 'tara', comp('photoResult')],
  ['FinPhotoEN', 'tara', comp('photoResult'), { lang: 'en' }],
  ['FinScanError', 'tara', comp('scanError', { kind: 'unrecognized' })],
  ['FinErrFailed', 'tara', comp('scanError', { kind: 'failed' })],
  ['FinErrOffline', 'tara', comp('scanError', { kind: 'offline' })],
  ['FinErrLimit', 'tara', comp('scanLimit')],
  ['FinScanOffline', 'tara', route(tab('Tracker')), { scene: 'scanOffline' }],

  // ── Profil ─────────────────────────────────────────────────────────────────
  ['FinPrProfile', 'profil', route(tab('Profile'))],
  ['FinProfilePublic', 'profil', comp('profileSub', { sub: 'public' })],
  ['FinBadges', 'profil', comp('profileSub', { sub: 'badges' })],
  ['FinPrivacy', 'profil', comp('privacySheet')],
  ['FinPrivacySettings', 'profil', comp('profileSub', { sub: 'privacy' })],
  ['FinPrProgress', 'profil', comp('profileSub', { sub: 'progress' })],
  ['FinPrMacro', 'profil', comp('profileSub', { sub: 'macro' })],
  ['FinPrMacroWhat', 'profil', comp('profileSub', { sub: 'macro', what: true })],
  ['FinPrMacroHistoryEmpty', 'profil', comp('profileSub', { sub: 'macro' }), { data: 'empty' }],
  ['FinPrPersonal', 'profil', comp('profileSub', { sub: 'personal' })],
  ['FinPrCards', 'profil', route([...tab('Profile'), { name: 'ProfileSavedCards' }]), { note: 'KİMSE ekranı (SavedCards) — yalnız karşılaştırılır' }],
  ['FinPrNotify', 'profil', comp('profileSub', { sub: 'notify' })],
  ['FinPrSecurity', 'profil', comp('profileSub', { sub: 'security' })],
  ['FinPrAgreements', 'profil', comp('profileSub', { sub: 'agreements' })],
  ['FinPrSupport', 'profil', comp('profileSub', { sub: 'support' })],
  ['FinPrFeedback', 'profil', comp('profileSub', { sub: 'feedback' })],

  // ── eatkcal ────────────────────────────────────────────────────────────────
  ['FinCityR1', 'eatkcal', route(ek('EkCityGate')), { scene: 'city' }],
  ['FinWaitlistR1', 'eatkcal', route(ek('EkCityGate')), { scene: 'waitlist' }],
  ['FinEatBerlin', 'eatkcal', route(ek('EkCityGate')), { scene: 'berlin' }],
  ['FinEkHome', 'eatkcal', route(tab('Home'))],
  ['FinEkHomeSkeleton', 'eatkcal', route(tab('Home')), { data: 'loading' }],
  ['FinEkStore', 'eatkcal', route(ek('EkStore', { brandKey: 'kcal' }))],
  ['FinEkReviews', 'eatkcal', route(ek('EkStore', { brandKey: 'kcal' })), { scene: 'reviews' }],
  ['FinEkProduct', 'eatkcal', route(ek('EkProduct', { productId: '__first__' }))],
  ['FinEkProductScroll', 'eatkcal', route(ek('EkProduct', { productId: '__first__' })), { scene: 'scrolled' }],
  ['FinEkCart', 'eatkcal', route(ek('EkCart')), { scene: 'cart' }],
  ['FinEkCartEmpty', 'eatkcal', route(ek('EkCart')), { data: 'empty' }],
  ['FinEkCartSkeleton', 'eatkcal', route(ek('EkCart')), { data: 'loading', scene: 'cart' }],
  ['FinEkCheckout', 'eatkcal', route(ek('EkCheckout')), { scene: 'cart' }],
  ['FinEkCheckoutPayWait', 'eatkcal', route(ek('EkCheckout')), { scene: 'payWait' }],
  ['FinEkCheckoutPayFail', 'eatkcal', route(ek('EkCheckout')), { scene: 'payFail' }],
  ['FinEkCheckoutPayUnknown', 'eatkcal', route(ek('EkCheckout')), { scene: 'payUnknown' }],
  ['FinEkAddress', 'eatkcal', route(ek('EkAddressAdd'))],
  ['FinEkAddressNoPerm', 'eatkcal', route(ek('EkAddressAdd')), { scene: 'noPerm' }],
  ['FinEkAddressNoMap', 'eatkcal', route(ek('EkAddressAdd')), { scene: 'noMap' }],
  ['FinEkAddresses', 'eatkcal', route(ek('EkAddresses')), { scene: 'addresses' }],
  ['FinEkAddressesEmpty', 'eatkcal', route(ek('EkAddresses')), { data: 'empty' }],
  ['FinEkOrders', 'eatkcal', route(ek('EkOrders')), { scene: 'orders' }],
  ['FinEkOrdersEmpty', 'eatkcal', route(ek('EkOrders')), { data: 'empty' }],
  ['FinEkOrdersFilterEmpty', 'eatkcal', route(ek('EkOrders')), { scene: 'filterEmpty' }],
  ['FinEkOrderDetail', 'eatkcal', route(ek('EkOrderDetail', { orderId: 1 })), { scene: 'orders' }],
  ['FinEkInfo', 'eatkcal', comp('ekInfo')],
  ['FinEkErrors', 'eatkcal', comp('ekErrors')],

  // ── Giriş / tanıtım ────────────────────────────────────────────────────────
  ['FinSignupAI', 'giris', comp('signupAI'), { auth: 'guest' }],
  ['FinSignupEat', 'giris', comp('signupEat'), { auth: 'guest' }],
  ['FinIntro', 'giris', route(tab('Tracker')), { scene: 'intro' }],
  ['FinIntroOrder', 'giris', route(tab('Tracker')), { scene: 'introOrder' }],

  // ── Kutlama / koleksiyon ───────────────────────────────────────────────────
  ['FinCelebrate', 'kutlama', comp('celebrate', { kind: 'first' })],
  ['FinCelebStreak3', 'kutlama', comp('celebrate', { kind: 'streak3' })],
  ['FinCelebStreak7', 'kutlama', comp('celebrate', { kind: 'streak7' })],
  ['FinSheetNotify', 'kutlama', comp('notifySheet')],
  ['FinCollectCut', 'kutlama', comp('photoResult', { reduced: true })],
  ['FinCollectWon', 'kutlama', comp('collectWon')],
  ['FinCollectGrid', 'kutlama', comp('profileSub', { sub: 'collection' })],
  ['FinCollectEntry', 'kutlama', route(tab('Profile'))],

  // ── Stres (kabul testi) ────────────────────────────────────────────────────
  ['FinStressLong', 'stres', route(ek('EkCheckout')), { scene: 'cartLong' }],
  ['FinStressXL', 'stres', route(ek('EkCheckout')), { textSize: 'accessibility-extra-large', scene: 'cart' }],
  ['FinStressEN', 'stres', route(ek('EkCheckout')), { lang: 'en', scene: 'cart' }],
  ['FinStressDark', 'stres', comp('ekErrors'), { note: 'scheme=dark; durum matrisi panosu' }],

  // ── Bileşenler ─────────────────────────────────────────────────────────────
  ['FinComponents', 'bilesen', comp('components')],

  // ── Hareket (son kare; zamanlama kodda token'la doğrulanır) ───────────────
  ['FinMoTokens', 'hareket', motion('tokens')],
  ['FinMoMap', 'hareket', motion('tokens')],
  ['FinMoLogA', 'hareket', route(tab('Tracker')), { scene: 'meals' }],
  ['FinMoLogB', 'hareket', route(tab('Tracker')), { scene: 'meals' }],
  ['FinMoRing', 'hareket', route(tab('Tracker')), { scene: 'meals' }],
  ['FinMoStreak', 'hareket', comp('celebrate', { kind: 'streak3' })],
  ['FinMoScan', 'hareket', comp('photoResult')],
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
 * `kcal://dev/screen/FinFeed`, `exp+kcal://dev/screen/FinFeed`,
 * `kcal:///dev/screen/FinFeed?x=1` → `FinFeed`. Eşleşmezse null.
 */
export function parseVitrinUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /dev\/screen\/([A-Za-z0-9~-]+)/.exec(url);
  return m ? m[1] : null;
}
