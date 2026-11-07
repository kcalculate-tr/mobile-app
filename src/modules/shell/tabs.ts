// Yeni kabuk sekme çözümü — SAF mantık (G11-S2).
//
// RN/import'suz tutulur ki `npm run test:unit` (tsx --test, Node) içinde
// doğrudan koşsun. TabBarR3 ve AppNavigator yalnız buradaki fonksiyonları
// kullanır — sekme listesi, açılış sekmesi ve Tara görünürlüğü tek yerde.
//
// Rota ADLARI mevcut navigatörle AYNIdır (Tracker/KesfetTab/Home/Profile), böylece
// var olan `navigate('Tracker'|'Home'|...)` çağrıları iki kabukta da çalışır.

export type ShellTabRoute = 'Tracker' | 'KesfetTab' | 'Home' | 'Profile';
export type ShellTabKind = 'home' | 'explore' | 'eat' | 'profile';

export interface ShellTabDef {
  /** Bottom-tab rota adı. */
  route: ShellTabRoute;
  /** Çizilecek ikon türü (TabBarR3 ikon seti). */
  kind: ShellTabKind;
  /** i18n anahtarı — `shell` ad alanı altında. */
  labelKey: string;
  /** Oturum yoksa basışta Login kapısı açılır mı. */
  requiresAuth: boolean;
}

/** TabBarR3'ün yapısını belirleyen bayraklar. */
export interface ShellFlags {
  kesfet: boolean;
  ai_tarama: boolean;
}

/**
 * Görünür sekmeler, tasarım sırasıyla: Ana sayfa (Tracker) · Keşfet (KesfetTab) ·
 * eatkcal (Home) · Profil (Profile). `kesfet` kapalıyken Keşfet sekmesi YOK.
 * Ana sayfa/Keşfet/Profil oturum ister; eatkcal istemez.
 */
export function resolveShellTabs(flags: Pick<ShellFlags, 'kesfet'>): ShellTabDef[] {
  const tabs: ShellTabDef[] = [
    { route: 'Tracker', kind: 'home', labelKey: 'shell.tab.home', requiresAuth: true },
  ];
  if (flags.kesfet) {
    tabs.push({
      route: 'KesfetTab',
      kind: 'explore',
      labelKey: 'shell.tab.explore',
      requiresAuth: true,
    });
  }
  tabs.push({ route: 'Home', kind: 'eat', labelKey: 'shell.tab.eat', requiresAuth: false });
  tabs.push({ route: 'Profile', kind: 'profile', labelKey: 'shell.tab.profile', requiresAuth: true });
  return tabs;
}

/** Ayrık "Tara" dairesi yalnız `ai_tarama` açıkken görünür. */
export function shouldShowScan(flags: Pick<ShellFlags, 'ai_tarama'>): boolean {
  return !!flags.ai_tarama;
}

/**
 * Açılış (initial) sekmesi — G17-S1 md.4 (İlter telefon testi, 7 Kas):
 *   · oturum var (yeni/eski, sipariş geçmişi olan/olmayan) → Tracker (Ana sayfa)
 *   · oturum yok                                          → Home (eatkcal; oturumsuz gezilebilen tek sekme)
 * Eski kural (sipariş geçmişi varsa eatkcal) kalktı: mevcut müşteri sipariş
 * geçmişinden SESSİZCE tanınır (IntroOverlay "Siparişe devam" kartı), açılış
 * sekmesi değişmez. `hasOrderHistory` imza uyumu için kabul edilir, etkisizdir.
 * Yalnız yeni kabuk (TabNavigatorR3) kullanır → bayrak kapalı yol aynı.
 */
export function resolveInitialShellTab(opts: {
  session: boolean;
  hasOrderHistory?: boolean;
}): ShellTabRoute {
  return opts.session ? 'Tracker' : 'Home';
}

/** Oturum açıldıktan sonra gidilecek sekme: yeni kabukta Ana sayfa (Tracker). */
export function postAuthShellTab(newShell: boolean): 'Tracker' | 'Home' {
  return newShell ? 'Tracker' : 'Home';
}

/**
 * Bugünkü (bayrak KAPALI) kabuğun sekme anlık görüntüsü — ad/etiket/sıra.
 * Kaynak: `src/navigation/AppNavigator.tsx` TabNavigator sırası +
 * `src/navigation/CustomTabBar.tsx` TAB_CONFIG. Parite testi (item 9) bunu
 * gerçek CustomTabBar render'ıyla karşılaştırır; biri değişirse test düşer.
 */
export interface LegacyTabSnapshot {
  route: string;
  /** Görünür etiket (gizli/FAB sekmede boş). */
  label: string;
  /** Sekme çubuğunda düğmesi yok mu (Cart = orta FAB). */
  hidden: boolean;
}

export const LEGACY_TABS: LegacyTabSnapshot[] = [
  { route: 'Home', label: 'Anasayfa', hidden: false },
  { route: 'Tracker', label: 'Kcalculate', hidden: false },
  { route: 'Cart', label: '', hidden: true },
  { route: 'Subscriptions', label: 'Macro', hidden: false },
  { route: 'Profile', label: 'Hesabım', hidden: false },
];
