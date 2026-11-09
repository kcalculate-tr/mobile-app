import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Easing as RNEasing } from 'react-native';
import {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

/**
 * Hareket sistemi — token'lar + hook'lar. TEK KAYNAK.
 *
 * TASARIM KURALI (değiştirilebilir motor): Ekranlar HİÇBİR ZAMAN doğrudan
 * animasyon kütüphanesini çağırmaz. Yalnızca bu dosyanın dışa verdiği hook'ları
 * kullanır (`useEnter`, `usePop`, `useFloat`, `useBreath`, `useSpringTo`) ve
 * token'ları okur. Motor (artık **Reanimated 4** + worklets) tamamen bu
 * dosyanın içinde kalır; hook imzaları değişmediği için hiçbir ekran dokunulmaz.
 *
 * MOTOR GEÇİŞİ (G3-S3): Önceki temel React Native `Animated` kullanıyordu; bu
 * oturumda hook'ların içi Reanimated'a taşındı. Her animasyon artık **UI
 * thread'de** (worklet) çalışır — JS thread bloklansa bile akıcı kalır. Hook'lar
 * `useAnimatedStyle` çıktısı döndürür; tüketici bileşenler `Animated.View`'ı
 * **react-native-reanimated**'tan alır (RN'in Animated.View'ı değil).
 *
 * Her değer token'dır: hareket dili hâlâ TEST aşamasında, bu yüzden tek yerden
 * ayarlanabilir olmalı.
 *
 * Azaltılmış hareket (useReducedMotion): tüm giriş/döngü animasyonlarının
 * karşılığı = yalnız opaklık + en fazla 8 px kayma, en fazla 200 ms. Haptik
 * AYNI kalır (dokunsal geri bildirim hareketten bağımsız erişilebilirlik).
 *
 * Kesilebilirlik: yay (`useSpringTo`) interrupt'ta mevcut hızı taşır
 * (`withSpring` doğası). Diğer hook'lar `cancelAnimation` ile mevcut kareden
 * yeni hedefe geçer (sıçrama yok).
 */

// ---------------------------------------------------------------------------
// TOKEN'LAR
// ---------------------------------------------------------------------------

/**
 * Süre bantları (ms) — FinMoTokens v2 TEK KAYNAK (`design/final/FinMoTokens.dc.html`):
 * `instant 100 · fast 200 · base 300 · slow 500 · story 900+`. Arası doldurulmaz.
 * Eski adlar (micro/standard/emphasis/heroMin/heroMax) v2 bandına EŞLENMİŞ TAKMA
 * ADLARDIR; imzalar değişmez, bu yüzden mevcut tüketiciler kırılmaz.
 */
export const DURATION = {
  /** 100 — deklanşör, kademe, dokunma geri bildirimi (v2). */
  instant: 100,
  /** 200 — crossfade, kaydet, sheet kapanış, durum değişimi (v2). */
  fast: 200,
  /** 300 — standart giriş/geçiş, liste öğesi, tab küçül/büyü (v2). */
  base: 300,
  /** 500 — ekran ölçeğinde hareket, sheet/modal açılış, odometre (v2). */
  slow: 500,
  /** 900 — "story": halka dolumu, iskelet nabzı, analiz, süzülme döngüsü (v2). */
  story: 900,
  // --- Eski adlar (takma ad → v2 bandı) ---
  /** @deprecated → instant (100). */
  micro: 100,
  /** @deprecated → base (300). */
  standard: 300,
  /** @deprecated → slow (500). */
  emphasis: 500,
  /** @deprecated → story (900). */
  heroMin: 900,
  /** @deprecated → story (900). FinMoTokens: 1100–1600 ms → story 900. */
  heroMax: 900,
} as const;

/**
 * Belirli jestlerin süreleri. v2 bandına oturtuldu (FinMoMap): giriş slow 500,
 * pop/kutlama base 300, logla izi slow 500; döngüler story 900+ üstü (süzülme
 * 3200 / eğim 4800 / parıltı 2400 — "story döngü"). Değerler token bandından seçilir.
 */
export const TIMING = {
  enter: 500, // slow
  pop: 300, // base (kutlama sıçraması bouncy yay ile)
  // G18-S4: FinMoTokens eşlemesi — 3200 · 4800 ms süzülme/eğim döngüsü → story 900
  // TEK SAHNE (sürekli döngü yok); 2400 parıltı → story 900 yarım nefes; 1100–1600 → story 900.
  float: 900, // story (tek sahne)
  tilt: 900, // story (tek sahne)
  glow: 900, // story (nefesin yarısı; yalnız yüklenirken döner)
  sweep: 900, // story (analiz/ışık bandı)
  logTrail: 500, // slow (tabak uçuşu)
  streak: 900, // story (seri anı)
  dailyRing: 900, // story (halka dolumu)
  loading: 900, // story (iskelet nabzı)
} as const;

/**
 * Yumuşama eğrileri — FinMoTokens v2 ÜÇ eğri:
 * - `standard` (0.2,0,0,1): yerinde değişim, döngü, hız sabit işler.
 * - `enter` (0.05,0.7,0.1,1): giriş (dışarıdan gelir, yumuşak oturur — aşma YOK;
 *    aşma artık yalnız `SPRING.bouncy` ödül anlarında).
 * - `exit` (0.3,0,0.8,0.15): çıkış (girişten KISA).
 * Eski adlar `move/out/in` v2 eğrilerine eşlenmiş takma adlardır.
 */
export const CURVE = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  enter: Easing.bezier(0.05, 0.7, 0.1, 1),
  exit: Easing.bezier(0.3, 0, 0.8, 0.15),
  // --- Eski adlar (takma ad) ---
  /** @deprecated → standard. */
  move: Easing.bezier(0.2, 0, 0, 1),
  /** @deprecated → exit. */
  out: Easing.bezier(0.3, 0, 0.8, 0.15),
  /** @deprecated → enter. */
  in: Easing.bezier(0.05, 0.7, 0.1, 1),
} as const;

/**
 * Yay aileleri. İki ürün + sheet. `useNativeDriver` için RN spring `stiffness`
 * yerine bu değerleri kullanır; RN Animated.spring stiffness/damping/mass'i
 * doğrudan kabul eder.
 */
export const SPRING = {
  /** Kcalculate AI (260/24) — sheet, push/pop, modal, yer değiştirme (v2). */
  ai: { stiffness: 260, damping: 24, mass: 1 },
  /** eatkcal (200/28) — sepet, ödeme, teslim (v2). */
  eat: { stiffness: 200, damping: 28, mass: 1 },
  /** bouncy (220/14) — YALNIZ küçük ödüller: ✓, rozet, kaydet, beğen sayacı (v2). */
  bouncy: { stiffness: 220, damping: 14, mass: 1 },
  /** @deprecated → ai. Sheet, FinMoMap'te AI yayını kullanır. */
  sheet: { stiffness: 260, damping: 24, mass: 1 },
} as const;

/**
 * Sıralı giriş (stagger) gecikmeleri (ms). FinMoTokens "Liste girişi": kademe
 * instant 100 · yalnız ilk 4 öğe · toplam ≤ 500 ms (40 ms kademe → instant 100).
 */
export const STAGGER = {
  /** Liste öğeleri — yalnız ilk 4 öğe sıralanır, gerisi 4. ile birlikte gelir. */
  list: 100,
  listMaxItems: 4,
  /** Etiket/rozet grubu. */
  label: 100,
  /** Günlük halkanın dallara ayrılması. */
  ringSplit: 100,
  /** Tarama köşelerinin belirmesi. */
  scanCorners: 100,
} as const;

/** Haptik sözlüğü — FinMoTokens v2 (hangi olayda hangi dokunsal). */
export const HAPTIC = {
  /** sekme, çip, öğün seçici, segmented. */
  selection: 'selection',
  /** beğen, kaydet, takip, sepete ekle, geri al, sheet detent, çek-yenile eşiği. */
  light: 'light',
  /** Tara deklanşörü. */
  medium: 'medium',
  /** loglandı, ödeme, seri, ilk öğün, koleksiyon — günde en fazla 3. */
  success: 'success',
  /** YALNIZ hata titreşimi (form alanı). */
  warning: 'warning',
} as const;

/**
 * Geçiş (transition) token'ları — ekran, sheet, toast, sekme, liste öğesi.
 * Her biri {duration, curve, ...}; motor bunları uygular. Ekranlar bu
 * token'lara göre kendi hook'unu çağırır; süre/eğri burada değişir.
 */
export const TRANSITION = {
  /** Ekranlar arası itme/çekme — push base 300 enter · geri base 300 exit. */
  screen: { duration: DURATION.base, curve: CURVE.enter, slide: 16 },
  /** Alttan açılan sayfa: açılış base 300 · scrim aynı sürede. */
  sheet: { spring: SPRING.sheet, backdropDuration: DURATION.base },
  /** Bildirim (toast): giriş base 300 · çıkış fast 200 · 4 s. */
  toast: { inDuration: DURATION.base, outDuration: DURATION.fast, offset: 24, hold: 4000 },
  /** Sekme geçişi: içerik crossfade fast 200 · standard. */
  tab: { duration: DURATION.fast, curve: CURVE.standard },
  /** Liste öğesi girişi: fast 200 enter · kademe instant 100. */
  listItem: { duration: DURATION.fast, curve: CURVE.enter, stagger: STAGGER.list },
} as const;

/** Azaltılmış hareket sınırları. Son durum 200 ms opaklık; yer değiştirme/ölçek yok. */
export const REDUCED = {
  duration: 200,
  maxShift: 8,
} as const;

// ---------------------------------------------------------------------------
// FinMoMap — UYGULAMA GENELİ GEÇİŞ YAPILANDIRMALARI (v2)
// Ekran/sheet/modal gibi gezinme düzeyi hareketler. Navigatör ve BottomSheet
// bu token'ları okur; süre/eğri burada değişir, ekranlar dokunulmaz.
// ---------------------------------------------------------------------------

/** Alttan açılan sayfa — iki ürün ayrı (FinMoMap: AI 260/24 · eatkcal 200/28). */
export const SHEET = {
  /**
   * Kcalculate AI sheet: açılış base 300 enter · kapanış fast 200 exit · scrim aynı
   * sürede 0→0.4. FinMoTokens: "push/pop ve Kcalculate sheet'leri yay değil, süre
   * tokeni" → `spring: null` (zamanlı).
   */
  ai: {
    openDuration: DURATION.base,
    closeDuration: DURATION.fast,
    scrimTo: 0.4,
    spring: null,
    detentHaptic: 'light' as HapticKind,
  },
  /** eatkcal sheet: açılış eatkcal 200/28 yayı · scrim base 300 · kapanış fast 200. */
  eat: {
    openDuration: DURATION.base,
    closeDuration: DURATION.fast,
    scrimTo: 0.4,
    spring: SPRING.eat,
    detentHaptic: 'light' as HapticKind,
  },
} as const;

/** Tam ekran modal: sheet ile aynı — açılış base 300 (y 100%→0) enter · kapanış fast 200 exit. */
export const MODAL = {
  openDuration: DURATION.base,
  closeDuration: DURATION.fast,
  spring: null,
} as const;

/** Ekranlar arası push/pop (FinMoMap) — parmağa bağlı, her an kesilebilir (native stack). */
export const SCREEN = {
  /** Push: yeni ekran base 300 (x %100→0), eski ekran −%30; enter. */
  push: { duration: DURATION.base, curve: CURVE.enter, prevShift: -0.3 },
  /** Pop / geri: ekran base 300 (0→%100); exit. Kenardan parmakla sürülür. */
  pop: { duration: DURATION.base, curve: CURVE.exit },
} as const;

/**
 * React Native `Animated` tüketicileri için AYNI üç eğri. Reanimated
 * `Easing.bezier` RN Animated'a verilemez; aynı kontrol noktaları RN Easing ile
 * ayrıca dışa verilir. Tek kaynak: FinMoTokens.
 */
export const RN_CURVE = {
  standard: RNEasing.bezier(0.2, 0, 0, 1),
  enter: RNEasing.bezier(0.05, 0.7, 0.1, 1),
  exit: RNEasing.bezier(0.3, 0, 0.8, 0.15),
  /** eatkcal yayı 200/28'in zamanlı (CSS) karşılığı — FinMoTokens eatkcal satırı. Yalnız eatkcal. */
  eat: RNEasing.bezier(0.25, 0.9, 0.3, 1),
  /** Azaltılmış hareket: 200 ms düz opaklık (FinMoTokens "Azaltılmış hareket"). */
  linear: RNEasing.linear,
} as const;

/**
 * PREMIUM GEÇİŞ SETİ — FinMoTokens "Premium geçiş seti" (9 satır) + FinMoMap.
 * Uygulamadaki her geçiş bu satırlardan biridir; satırı olmayan şey hareket etmez.
 * Ekranlar süre/eğri/yay YAZMAZ, buradan okur (bkz. `noLocalMotionTokens` testi).
 */
export const PREMIUM = {
  /** Sekme değişimi — içerik crossfade fast 200 · standard; kaydırma konumu korunur. */
  tab: { duration: DURATION.fast, curve: CURVE.standard, haptic: 'selection' as HapticKind },
  /** Sayfa push/geri — base 300 enter · base 300 exit; parmakla sürülür, kesilebilir. */
  push: { enter: DURATION.base, exit: DURATION.base, enterCurve: CURVE.enter, exitCurve: CURVE.exit },
  /** Sheet — base 300 enter · fast 200 exit; eatkcal yay 200/28; scrim aynı sürede. */
  sheet: { enter: DURATION.base, exit: DURATION.fast, eatSpring: SPRING.eat, scrimTo: 0.4 },
  /** Liste girişi — fast 200 enter · kademe instant 100 · ilk 4 öğe · kayma ≤ 8 · toplam ≤ 500. */
  list: {
    duration: DURATION.fast,
    curve: CURVE.enter,
    stagger: DURATION.instant,
    maxItems: 4,
    shift: 8,
    totalMax: DURATION.slow,
  },
  /** Basma — instant 100 · ölçek 0.98 · bırakınca AI 260/24 yayla geri döner. */
  press: { duration: DURATION.instant, scale: 0.98, curve: CURVE.standard, release: SPRING.ai },
  /** Yükleniyor → içerik — fast 200 crossfade · aynı yerleşim. */
  load: { duration: DURATION.fast, curve: CURVE.standard },
  /** Tara sonucu — kart AI 260/24 yayla oturur, ardından halka slow 500. */
  scanResult: { spring: SPRING.ai, ring: DURATION.slow },
  /** Kutlama — story 900 tek sahne; tekrar ya da döngü yok. */
  celebrate: { duration: DURATION.story },
  /** Hata — mesaj ilgili alanın altında fast 200 (opaklık + y 4→0) · kenar fast 200 · uyarı haptiği · sallama yok. */
  error: { duration: DURATION.fast, curve: CURVE.standard, shift: 4, haptic: 'warning' as HapticKind },
  /** FinMoShake — YALNIZ form alanı doğrulama hatası: ±8 bir kez, base 300 standard + uyarı haptiği. */
  shake: { duration: DURATION.base, amplitude: 8, haptic: 'warning' as HapticKind },
} as const;

/** Liste girişi gecikmesi: yalnız ilk 4 öğe kademelenir (≤ 300 ms) → toplam ≤ 500 ms. */
export function listEnterDelay(index: number): number {
  'worklet';
  const slot = Math.min(Math.max(index, 0), PREMIUM.list.maxItems - 1);
  return slot * PREMIUM.list.stagger;
}

/**
 * ESKİ (1.0.7) RN Animated hareket değerleri — YALNIZ bayrak kapalı yolun
 * ekranları kullanır (`src/constants/motion.ts` bunları aynen yeniden dışa verir).
 * Değerler 1.0.7 ile bayt bayt aynıdır; bayrak kapalı = bugünkü uygulama.
 * Yeni (Final) kod bunları KULLANMAZ. G-TEMİZLİK ile silinir.
 */
export const LEGACY_MOTION = {
  DURATION: { instant: 100, fast: 200, base: 300, slow: 500, pulse: 900, sweep: 1400 },
  EASING: {
    standard: RNEasing.bezier(0.2, 0, 0, 1),
    enter: RNEasing.bezier(0.05, 0.7, 0.1, 1),
    exit: RNEasing.bezier(0.3, 0, 0.8, 0.15),
    move: RNEasing.bezier(0.2, 0, 0, 1),
  },
  SPRING: {
    press: { speed: 20, bounciness: 0 },
    enter: { speed: 14, bounciness: 8 },
  },
  PRESS_SCALE: 0.97,
} as const;

/**
 * FinMoMap satırları — TEK KAYNAK kayıt tablosu. Vitrin "Hareket haritası"
 * (G12-S1 madde 8) bu listeyi gezip her satır için bir tetik düğmesi çizer.
 * `token`: ilgili süre/yay özeti (pano metni). `lime`/`reduced`: harita sütunları.
 */
export interface MotionMapRow {
  id: string;
  /** Pano etiketi (TR). */
  label: string;
  /** Süre + eğri/yay özeti (FinMoMap satırından). */
  token: string;
  haptic: HapticKind | null;
  /** Azaltılmış harekette lime nokta çekilir mi / görünür mü. */
  lime: boolean;
  /** Azaltılmış hareket karşılığı. */
  reduced: string;
}

export const MOTION_MAP: readonly MotionMapRow[] = [
  { id: 'tab', label: 'Sekme değişimi', token: 'içerik crossfade fast 200 · standard · kaydırma konumu korunur', haptic: 'selection', lime: false, reduced: '200 ms opaklık · içerik geçişsiz' },
  { id: 'jelly', label: 'Ana sayfa ↔ eatkcal (jöle nokta)', token: 'kayma base 300 · uzama 1→1.6→1 fast 200 · AI 260/24', haptic: 'selection', lime: false, reduced: '200 ms opaklık' },
  { id: 'push', label: 'Push (yeni ekran)', token: 'base 300 enter · x %100→0, eski −%30 · parmakla sürülür', haptic: null, lime: false, reduced: '200 ms opaklık' },
  { id: 'pop', label: 'Pop / geri', token: 'base 300 exit · 0→%100 · kesilebilir', haptic: null, lime: false, reduced: '200 ms opaklık' },
  { id: 'sheetAi', label: 'AI sheet (Kcalculate AI)', token: 'açılış base 300 enter · kapanış fast 200 exit · scrim aynı sürede 0→0.4', haptic: 'light', lime: false, reduced: '200 ms opaklık' },
  { id: 'sheetEat', label: 'eatkcal sheet', token: 'açılış eatkcal 200/28 · scrim base 300 · kapanış fast 200', haptic: 'light', lime: false, reduced: '200 ms opaklık' },
  { id: 'modal', label: 'Tam ekran modal', token: 'açılış base 300 (y %100→0) enter · kapanış fast 200 exit', haptic: null, lime: false, reduced: '200 ms opaklık' },
  { id: 'tabbar', label: 'Tab bar küçül / büyü', token: 'rest → mid → min base 300 · standard', haptic: null, lime: false, reduced: '200 ms opaklık' },
  { id: 'header', label: 'Büyük başlık daralması', token: 'kaydırmaya bağlı · bitişte base 300 · standard', haptic: null, lime: false, reduced: '200 ms opaklık' },
  { id: 'skeleton', label: 'İskelet → içerik', token: 'iskelet nabzı story 900 · içerik base 300 · satır arası instant 100 · enter', haptic: null, lime: false, reduced: 'iskelet sabit · içerik 200 ms opaklık' },
  { id: 'listAdd', label: 'Liste ekleme', token: 'satır base 300 (y 8→0 + opaklık) · komşular base 300 · enter', haptic: null, lime: false, reduced: '200 ms opaklık' },
  { id: 'toast', label: 'Toast', token: 'giriş base 300 · çıkış fast 200 · 4 s · enter/exit', haptic: null, lime: false, reduced: '200 ms opaklık' },
] as const;

// ---------------------------------------------------------------------------
// HAPTİK YARDIMCISI
// ---------------------------------------------------------------------------

// Hero (success) haptiği günde en fazla 3. Takvim günü değişince sıfırlanır.
let successCount = 0;
let successDay = -1;

function todayIndex(): number {
  // RN runtime'da Date mevcut. Gün indeksi = epoch gününe göre.
  return Math.floor(Date.now() / 86_400_000);
}

export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning';

/**
 * Haptik tetikle. `warning` YALNIZ hata titreşiminde (FinMoTokens v2). success
 * günde 3 ile sınırlı; warning sınırsız ama tek olayda bir kez çağrılmalı.
 */
export function haptic(kind: HapticKind): void {
  try {
    switch (kind) {
      case 'selection':
        Haptics.selectionAsync();
        break;
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'success': {
        const day = todayIndex();
        if (day !== successDay) {
          successDay = day;
          successCount = 0;
        }
        if (successCount >= 3) return;
        successCount += 1;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      }
    }
  } catch {
    // Haptik desteklenmiyorsa (simülatör/web) sessizce geç.
  }
}

// ---------------------------------------------------------------------------
// AZALTILMIŞ HAREKET
// ---------------------------------------------------------------------------

/**
 * Azaltılmış hareketi ZORLAMAK için (yalnız VİTRİN/test). Üretimde kullanılmaz;
 * değer verilmezse sistem ayarı geçerlidir. Vitrin bununla açık/koyu gibi
 * "azaltılmış" halini de OS ayarına dokunmadan yan yana gösterir.
 */
const ReducedMotionOverride = createContext<boolean | null>(null);

export function ReducedMotionProvider({
  value,
  children,
}: {
  value: boolean | null;
  children: React.ReactNode;
}) {
  return <ReducedMotionOverride.Provider value={value}>{children}</ReducedMotionOverride.Provider>;
}

/**
 * Telefonun "hareketi azalt" ayarını izler. Değişince yeniden render eder.
 * ReducedMotionProvider ile bir alt ağaçta zorlanabilir (vitrin).
 */
export function useReducedMotion(): boolean {
  const override = useContext(ReducedMotionOverride);
  const [osReduced, setOsReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setOsReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setOsReduced(v),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return override ?? osReduced;
}

// ---------------------------------------------------------------------------
// HOOK'LAR (motor içeride kalır)
// ---------------------------------------------------------------------------

/** useAnimatedStyle çıktısı — doğrudan <Animated.View style={[...]}> içine konur. */
export type MotionStyle = ReturnType<typeof useAnimatedStyle>;

export interface EnterControls {
  /** react-native-reanimated'ın <Animated.View> style'ına verilir. */
  style: MotionStyle;
  /** Animasyonu baştan oynat (kesilebilir — mevcut kareden sıfırlanıp gider). */
  play: () => void;
}

/**
 * Giriş: scale 0.85→1, rotate −6°→0, opacity 0→1, 500 ms, enter eğrisi.
 * Azaltılmışta: yalnız opacity 0→1 (girişte kayma şart değil), 200 ms.
 * Mount'ta otomatik oynar. `play()` baştan yeniden tetikler.
 */
export function useEnter(opts?: { autoplay?: boolean; delay?: number }): EnterControls {
  const reduced = useReducedMotion();
  const p = useSharedValue(0); // 0 = başlangıç, 1 = yerinde
  const autoplay = opts?.autoplay ?? true;
  const delay = opts?.delay ?? 0;

  const run = useCallback(() => {
    cancelAnimation(p);
    p.value = 0;
    const timing = withTiming(1, {
      duration: reduced ? REDUCED.duration : TIMING.enter,
      easing: reduced ? CURVE.out : CURVE.enter,
    });
    p.value = delay > 0 ? withDelay(delay, timing) : timing;
  }, [reduced, delay, p]);

  useEffect(() => {
    if (autoplay) run();
    else p.value = 0;
    // reduced değişiminde doğru süreyle yeniden kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const style = useAnimatedStyle(() => {
    const scale = reduced ? 1 : interpolate(p.value, [0, 1], [0.85, 1]);
    const rotate = reduced ? 0 : interpolate(p.value, [0, 1], [-6, 0]);
    return { opacity: p.value, transform: [{ scale }, { rotate: `${rotate}deg` }] };
  });

  return { style, play: run };
}

export interface PopControls {
  style: MotionStyle;
  /** Kutlama sıçraması + success haptik (hero). */
  pop: () => void;
}

/**
 * Pop (kutlama): scale 1→1.08→1, 360 ms + success haptik.
 * Azaltılmışta: sıçrama yok, yalnız success haptik (haptik aynı kalır kuralı).
 */
export function usePop(): PopControls {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);

  const pop = useCallback(() => {
    haptic('success');
    if (reduced) return;
    cancelAnimation(s);
    // FinMoTokens: küçük ödül → instant 100 çıkış + bouncy 220/14 yayla oturma.
    s.value = withSequence(
      withTiming(1.08, { duration: DURATION.instant, easing: CURVE.standard }),
      withSpring(1, SPRING.bouncy),
    );
  }, [reduced, s]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return { style, pop };
}

/**
 * Süzülme (float): translateY ±4 px, 3.2 s ease-in-out, sonsuz. İsteğe bağlı
 * eğim (tilt): rotate ±2°, 4.8 s. Azaltılmışta: hiç döngü yok (sabit durur).
 */
export function useFloat(opts?: { tilt?: boolean; amplitude?: number }): { style: MotionStyle } {
  const reduced = useReducedMotion();
  const amp = opts?.amplitude ?? 4;
  const tilt = opts?.tilt ?? false;
  const f = useSharedValue(0);
  const tv = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(f);
      f.value = withTiming(0, { duration: REDUCED.duration });
      cancelAnimation(tv);
      tv.value = withTiming(0, { duration: REDUCED.duration });
      return;
    }
    // G18-S4 (FinMoTokens eşlemesi): süzülme/eğim döngüsü → story 900 TEK SAHNE,
    // sürekli döngü yok (boşta tekrar eden animasyon yok). Nesne üstten gelip
    // ortada (0) durur.
    f.value = 0;
    f.value = withTiming(0.5, { duration: TIMING.float, easing: CURVE.enter });
    if (tilt) {
      tv.value = 0;
      tv.value = withTiming(0.5, { duration: TIMING.tilt, easing: CURVE.enter });
    }
    return () => {
      cancelAnimation(f);
      cancelAnimation(tv);
    };
  }, [reduced, tilt, amp, f, tv]);

  const style = useAnimatedStyle(() => {
    const translateY = interpolate(f.value, [0, 1], [-amp, amp]);
    if (tilt) {
      const rotate = `${interpolate(tv.value, [0, 1], [-2, 2])}deg`;
      return { transform: [{ translateY }, { rotate }] };
    }
    return { transform: [{ translateY }] };
  });

  return { style };
}

export interface BreathControls {
  style: MotionStyle;
  /** Ham ilerleme (0..1) SharedValue — aynı nefesi birden çok görünümde kullanmak için. */
  progress: SharedValue<number>;
  min: number;
  max: number;
}

/**
 * Nefes (breath / parıltı): opacity 0.5→0.9, 2.4 s, sonsuz. GlowDot ve
 * "yükleniyor" göstergesi bunu kullanır. Azaltılmışta: sabit tam opaklıkta
 * durur (göz yormayan tek kare). `progress` ile aynı nefes birden çok görünüme
 * (ör. GlowDot halo + nokta) UI thread'de verilebilir.
 */
export function useBreath(opts?: {
  min?: number;
  max?: number;
  period?: number;
  /** false → tek nefes (0→1, story 900) ve durur. Boşta duran nesneler (cam hale) için. */
  loop?: boolean;
}): BreathControls {
  const reduced = useReducedMotion();
  const min = opts?.min ?? 0.5;
  const max = opts?.max ?? 0.9;
  const period = opts?.period ?? TIMING.glow;
  const loop = opts?.loop ?? true;
  const b = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(b);
      b.value = 1; // → max opaklık (sabit)
      return;
    }
    // Nefesin her yarısı `period` (varsayılan story 900). Döngü YALNIZ yüklenirken/
    // işlem sürerken (iskelet nabzı, analiz); boşta duran nesne `loop: false`.
    const half = withTiming(1, { duration: period, easing: CURVE.standard });
    b.value = loop ? withRepeat(half, -1, true) : half;
    return () => cancelAnimation(b);
  }, [reduced, period, loop, b]);

  const style = useAnimatedStyle(() => ({
    opacity: reduced ? max : interpolate(b.value, [0, 1], [min, max]),
  }));

  return { style, progress: b, min, max };
}

export interface SpringToControls {
  style: MotionStyle;
  /**
   * Hedefe yay çizerek git + varışta light haptik. Kesilebilir: tekrar
   * çağrılırsa mevcut HIZDAN (velocity carry) yeni hedefe gider (withSpring doğası).
   * NOT: Bu DÜZ çizgide yay hareketidir. "Logla izi"nin KAVİSLİ yolu artık
   * ayrı bir UI-thread bileşeninde (LogTrail) worklet ile çiziliyor.
   */
  springTo: (to: { x: number; y: number }, family?: keyof typeof SPRING) => void;
}

/**
 * Bir öğeyi yay ile bir konuma taşır (ör. "logla izi"nin düz karşılığı).
 * Azaltılmışta: en fazla 8 px kayma + 200 ms, yay yok.
 */
export function useSpringTo(): SpringToControls {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const springTo = useCallback<SpringToControls['springTo']>(
    (to, family = 'ai') => {
      if (reduced) {
        const clamp = (n: number) => Math.max(-REDUCED.maxShift, Math.min(REDUCED.maxShift, n));
        x.value = withTiming(clamp(to.x), { duration: REDUCED.duration, easing: CURVE.out });
        y.value = withTiming(clamp(to.y), { duration: REDUCED.duration, easing: CURVE.out }, (fin) => {
          if (fin) runOnJS(haptic)('light');
        });
        return;
      }
      const sp = SPRING[family];
      x.value = withSpring(to.x, sp);
      y.value = withSpring(to.y, sp, (fin) => {
        if (fin) runOnJS(haptic)('light');
      });
    },
    [reduced, x, y],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return { style, springTo };
}

/**
 * Yükleniyor göstergesi için yardımcı kural: göstergeyi YALNIZCA 400 ms'yi
 * aşan beklemelerde göster (kısa beklemede titreme olmasın). Bir boolean
 * "shouldShow" döndürür.
 */
export function useDelayedPending(pending: boolean, thresholdMs = 400): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!pending) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), thresholdMs);
    return () => clearTimeout(t);
  }, [pending, thresholdMs]);
  return show;
}
