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

/** Süre bantları (ms). Arası doldurulmaz; yeni süre eklemeden önce bant seç. */
export const DURATION = {
  /** 120 — dokunma geri bildirimi, küçük sıçrama. */
  micro: 120,
  /** 280 — standart giriş/çıkış, durum değişimi, liste öğesi. */
  standard: 280,
  /** 420 — vurgu: ekran ölçeğinde hareket, ilerleme dolumu. */
  emphasis: 420,
  /** 900 — hero alt sınır (günlük halka gövdesi). */
  heroMin: 900,
  /** 1400 — hero üst sınır (seri anı, ışık bandı). Günde en fazla 1 kez/olay. */
  heroMax: 1400,
} as const;

/** Belirli jestlerin süreleri (Claude Design test panolarından). */
export const TIMING = {
  enter: 500,
  pop: 360,
  float: 3200,
  tilt: 4800,
  glow: 2400,
  sweep: 700,
  logTrail: 600,
  streak: 1400,
  dailyRing: 900,
  loading: 1200,
} as const;

/**
 * Yumuşama eğrileri.
 * - `enter`: cubic-bezier(0.34,1.56,0.64,1) — hafif aşma (overshoot), canlı giriş.
 * - `move`: döngüsel gidip-gelme (süzülme/eğim/parıltı).
 * - `out` / `in`: tek yönlü çıkış/giriş.
 */
export const CURVE = {
  enter: Easing.bezier(0.34, 1.56, 0.64, 1),
  move: Easing.inOut(Easing.ease),
  out: Easing.out(Easing.cubic),
  in: Easing.in(Easing.cubic),
} as const;

/**
 * Yay aileleri. İki ürün + sheet. `useNativeDriver` için RN spring `stiffness`
 * yerine bu değerleri kullanır; RN Animated.spring stiffness/damping/mass'i
 * doğrudan kabul eder.
 */
export const SPRING = {
  /** Kcalculate AI — biraz daha sıkı/çevik. */
  ai: { stiffness: 260, damping: 24, mass: 1 },
  /** eatkcal — biraz daha yumuşak. */
  eat: { stiffness: 200, damping: 28, mass: 1 },
  /** Alttan açılan sayfa (sheet). */
  sheet: { stiffness: 300, damping: 30, mass: 0.8 },
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

/** Haptik sözlüğü — hangi olayda hangi dokunsal. */
export const HAPTIC = {
  /** Gezinme / durum değişimi. */
  selection: 'selection',
  /** Log / geri bildirim. */
  light: 'light',
  /** Çekim (pull/drag). */
  medium: 'medium',
  /** Yalnız hero kutlaması. Günde en fazla 3. */
  success: 'success',
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

/** Azaltılmış hareket sınırları. */
export const REDUCED = {
  duration: 200,
  maxShift: 8,
} as const;

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

export type HapticKind = 'selection' | 'light' | 'medium' | 'success';

/**
 * Haptik tetikle. Hata/uyarı haptiği YOK (sözlükte yer almaz, çağrılırsa
 * sessizce yok sayılır). success günde 3 ile sınırlı.
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
