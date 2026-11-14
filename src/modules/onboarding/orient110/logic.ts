// G54-S1 md.3 — 1.1.0 oryantasyonu SAF mantığı (RN/ağ importu YOK → node:test).
//
// Kural (`yeni_kayit` açıkken; `yeni_onboarding` bayrağından BAĞIMSIZ): oturumu açık her kullanıcı 1.1.0 ile uygulamaya
// ilk girişinde BİR KEZ oryantasyon görür — güncelleyen eski müşteri de, yeni kayıt olan da.
//  · "Görüldü" işareti HESAP bazında: `profiles.onboarding_state.orient_v110_seen_at` + cihaz yedeği
//    (`@kcal_orient_v110:<uid>`). Hesap değişince yeni hesap için yeniden değerlendirilir.
//  · Ne zaman: Ana sayfa odaktayken (hedef kaydı) ve başka bir katman (T1 / tebrik / izin sayfası / AuthSheet) açık
//    değilken (overlayGate sayacı 0, kök yığında Ana sayfanın üstünde rota yok).
//  · İçerik: (1) "Yeni Kcalculate" tanıtımı — YALNIZ eski müşteri (bu cihazda onboarding 1–5'i görmeden giriş yapan);
//    (2) uygulama içi 4 ipucu — herkes.

export type Orient110Tip = 'scan' | 'home' | 'kesfet' | 'eatkcal';
export const ORIENT110_TIPS: readonly Orient110Tip[] = ['scan', 'home', 'kesfet', 'eatkcal'];
export const ORIENT110_INTRO_PAGES = 4;
export const ORIENT110_META_KEY = 'orient_v110_seen_at';
export const ORIENT110_DEVICE_PREFIX = '@kcal_orient_v110';

export function orientDeviceKey(userId: string): string {
  return `${ORIENT110_DEVICE_PREFIX}:${userId}`;
}

/** profiles.onboarding_state içinde hesap işareti var mı. */
export function accountOrientSeen(state: unknown): boolean {
  if (!state || typeof state !== 'object') return false;
  const v = (state as Record<string, unknown>)[ORIENT110_META_KEY];
  return typeof v === 'string' && v.length > 0;
}

export interface Orient110Ctx {
  /** `yeni_kayit` bayrağı. */
  flag: boolean;
  session: boolean;
  /** Hesap + cihaz işareti okundu mu. */
  decided: boolean;
  seen: boolean;
}

/** Saf: bu hesap için oryantasyon gösterilecek mi (zamanlama ayrı: `canStartNow`). */
export function shouldOrient(c: Orient110Ctx): boolean {
  return c.flag && c.session && c.decided && !c.seen;
}

/** Saf: şimdi başlayabilir mi — Ana sayfa odakta (hedef kayıtlı) ve başka katman yok. */
export function canStartNow(i: { homeReady: boolean; overlays: number; celebrating: boolean }): boolean {
  return i.homeReady && i.overlays === 0 && !i.celebrating;
}

/** Saf: tanıtım (4 sayfa) gösterilsin mi — bu cihazda onboarding 1–5 görülmediyse (eski müşteri). */
export function needsIntro(i: { sawOnboardingOnDevice: boolean }): boolean {
  return !i.sawOnboardingOnDevice;
}

export type Orient110Phase = { kind: 'idle' } | { kind: 'intro'; page: number } | { kind: 'tip'; tip: Orient110Tip } | { kind: 'done' };

/** Saf: bir sonraki ipucu — yalnız hedefi ekranda kayıtlı olanlar, sırayla; yoksa null (tur biter). */
export function nextTip(after: Orient110Tip | null, available: ReadonlySet<Orient110Tip>): Orient110Tip | null {
  const start = after == null ? 0 : ORIENT110_TIPS.indexOf(after) + 1;
  for (let i = start; i < ORIENT110_TIPS.length; i++) {
    const t = ORIENT110_TIPS[i];
    if (available.has(t)) return t;
  }
  return null;
}

/** Saf: başlangıç evresi. */
export function startPhase(intro: boolean, available: ReadonlySet<Orient110Tip>): Orient110Phase {
  if (intro) return { kind: 'intro', page: 0 };
  const t = nextTip(null, available);
  return t ? { kind: 'tip', tip: t } : { kind: 'done' };
}

/** Saf: "İleri"/"Devam" sonrası evre. */
export function advance(p: Orient110Phase, available: ReadonlySet<Orient110Tip>): Orient110Phase {
  if (p.kind === 'intro') {
    if (p.page < ORIENT110_INTRO_PAGES - 1) return { kind: 'intro', page: p.page + 1 };
    const t = nextTip(null, available);
    return t ? { kind: 'tip', tip: t } : { kind: 'done' };
  }
  if (p.kind === 'tip') {
    const t = nextTip(p.tip, available);
    return t ? { kind: 'tip', tip: t } : { kind: 'done' };
  }
  return p;
}

/** Ölçüm `step` değeri: tanıtım sayfası `intro_1..4`, ipucu adı. */
export function stepName(p: Orient110Phase): string | null {
  if (p.kind === 'intro') return `intro_${p.page + 1}`;
  if (p.kind === 'tip') return p.tip;
  return null;
}

/** Ana sayfa ipucu varyantı: profilsizse "Planını oluştur" kartı, profilliyse halka. */
export function homeTipKey(hasProfile: boolean): 'home_card' | 'home_ring' {
  return hasProfile ? 'home_ring' : 'home_card';
}
