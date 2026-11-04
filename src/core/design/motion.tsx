import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
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
  /** story 900+ üst ucu (uzun döngü/analiz). */
  heroMax: 1400,
} as const;

/**
 * Belirli jestlerin süreleri. v2 bandına oturtuldu (FinMoMap): giriş slow 500,
 * pop/kutlama base 300, logla izi slow 500; döngüler story 900+ üstü (süzülme
 * 3200 / eğim 4800 / parıltı 2400 — "story döngü"). Değerler token bandından seçilir.
 */
export const TIMING = {
  enter: 500, // slow
  pop: 300, // base (kutlama sıçraması bouncy yay ile)
  float: 3200, // story döngü (süzülme)
  tilt: 4800, // story döngü (eğim)
  glow: 2400, // story döngü (parıltı/nefes)
  sweep: 1400, // story+ (analiz/ışık bandı)
  logTrail: 500, // slow (tabak uçuşu)
  streak: 1400, // story+ (seri anı)
  dailyRing: 900, // story (halka dolumu)
  loading: 1200, // story+ (yükleniyor nabzı)
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

/** Sıralı giriş (stagger) gecikmeleri (ms). */
export const STAGGER = {
  /** Liste öğeleri — en fazla 6 öğe sıralanır, gerisi birlikte gelir. */
  list: 40,
  listMaxItems: 6,
  /** Etiket/rozet grubu. */
  label: 90,
  /** Günlük halkanın dallara ayrılması. */
  ringSplit: 60,
  /** Tarama köşelerinin belirmesi. */
  scanCorners: 30,
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
  /** Ekranlar arası itme/çekme. */
  screen: { duration: DURATION.standard, curve: CURVE.out, slide: 16 },
  /** Alttan açılan sayfa: spring ile yukarı. */
  sheet: { spring: SPRING.sheet, backdropDuration: DURATION.standard },
  /** Bildirim (toast): yukarıdan iner, bekler, çıkar. */
  toast: { inDuration: DURATION.standard, outDuration: DURATION.micro + 80, offset: 24 },
  /** Sekme geçişi: çapraz solma. */
  tab: { duration: DURATION.micro + 40, curve: CURVE.move },
  /** Liste öğesi ekleme/silme. */
  listItem: { duration: DURATION.standard, curve: CURVE.out, stagger: STAGGER.list },
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
  /** Kcalculate AI sheet: açılış slow 500 · kapanış fast 200 · scrim 0→0.4. */
  ai: {
    openDuration: DURATION.slow,
    closeDuration: DURATION.fast,
    scrimTo: 0.4,
    spring: SPRING.ai,
    detentHaptic: 'light' as HapticKind,
  },
  /** eatkcal sheet: aynı süreler, eatkcal yayı. */
  eat: {
    openDuration: DURATION.slow,
    closeDuration: DURATION.fast,
    scrimTo: 0.4,
    spring: SPRING.eat,
    detentHaptic: 'light' as HapticKind,
  },
} as const;

/** Tam ekran modal: açılış slow 500 (y 100%→0) · kapanış fast 200 · AI yayı. */
export const MODAL = {
  openDuration: DURATION.slow,
  closeDuration: DURATION.fast,
  spring: SPRING.ai,
} as const;

/** Ekranlar arası push/pop (FinMoMap). */
export const SCREEN = {
  /** Push: yeni ekran base 300 (x %100→0), eski ekran −%30; AI yayı. */
  push: { duration: DURATION.base, curve: CURVE.enter, prevShift: -0.3 },
  /** Pop / geri: ekran fast 200 (0→%100); exit eğrisi. */
  pop: { duration: DURATION.fast, curve: CURVE.exit },
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
  { id: 'tab', label: 'Sekme değişimi', token: 'içerik anında · ikon 0.9→1 fast 200 · standard', haptic: 'selection', lime: false, reduced: '200 ms opaklık · içerik geçişsiz' },
  { id: 'jelly', label: 'Ana sayfa ↔ eatkcal (jöle nokta)', token: 'kayma base 300 · uzama 1→1.6→1 fast 200 · AI 260/24', haptic: 'selection', lime: false, reduced: '200 ms opaklık' },
  { id: 'push', label: 'Push (yeni ekran)', token: 'base 300 · x %100→0, eski −%30 · AI 260/24', haptic: null, lime: false, reduced: '200 ms opaklık' },
  { id: 'pop', label: 'Pop / geri', token: 'fast 200 · 0→%100 · exit', haptic: null, lime: false, reduced: '200 ms opaklık' },
  { id: 'sheetAi', label: 'AI sheet (Kcalculate AI)', token: 'açılış slow 500 · kapanış fast 200 · scrim 0→0.4 · AI 260/24', haptic: 'light', lime: false, reduced: '200 ms opaklık' },
  { id: 'sheetEat', label: 'eatkcal sheet', token: 'açılış slow 500 · kapanış fast 200 · scrim 0→0.4 · eatkcal 200/28', haptic: 'light', lime: false, reduced: '200 ms opaklık' },
  { id: 'modal', label: 'Tam ekran modal', token: 'açılış slow 500 (y %100→0) · kapanış fast 200 · AI 260/24', haptic: null, lime: false, reduced: '200 ms opaklık' },
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
    s.value = withSequence(
      withTiming(1.08, { duration: TIMING.pop / 2, easing: CURVE.out }),
      withTiming(1, { duration: TIMING.pop / 2, easing: CURVE.in }),
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
    // withRepeat(…, -1, true) = 0→1→0 yoyo (sonsuz).
    f.value = withRepeat(withTiming(1, { duration: TIMING.float / 2, easing: CURVE.move }), -1, true);
    if (tilt) {
      tv.value = withRepeat(withTiming(1, { duration: TIMING.tilt / 2, easing: CURVE.move }), -1, true);
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
export function useBreath(opts?: { min?: number; max?: number; period?: number }): BreathControls {
  const reduced = useReducedMotion();
  const min = opts?.min ?? 0.5;
  const max = opts?.max ?? 0.9;
  const period = opts?.period ?? TIMING.glow;
  const b = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(b);
      b.value = 1; // → max opaklık (sabit)
      return;
    }
    b.value = withRepeat(withTiming(1, { duration: period / 2, easing: CURVE.move }), -1, true);
    return () => cancelAnimation(b);
  }, [reduced, period, b]);

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
