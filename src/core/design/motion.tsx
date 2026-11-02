import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Hareket sistemi — token'lar + hook'lar. TEK KAYNAK.
 *
 * TASARIM KURALI (değiştirilebilir motor): Ekranlar HİÇBİR ZAMAN doğrudan
 * `Animated` çağırmaz. Yalnızca bu dosyanın dışa verdiği hook'ları kullanır
 * (`useEnter`, `usePop`, `useFloat`, `useBreath`, `useSpringTo`) ve token'ları
 * okur (`MOTION`). Motor (bugün React Native Animated) tamamen bu dosyanın
 * içinde kalır; ileride Reanimated'a geçilirse yalnızca burası değişir, hiçbir
 * ekran dokunulmaz. Reanimated kararı İLTER'DE — bu gece paket kurulmadı.
 *
 * Her değer token'dır: hareket dili hâlâ TEST aşamasında, bu yüzden tek yerden
 * ayarlanabilir olmalı.
 *
 * Azaltılmış hareket (useReducedMotion): tüm giriş/döngü animasyonlarının
 * karşılığı = yalnız opaklık + en fazla 8 px kayma, en fazla 200 ms. Haptik
 * AYNI kalır (dokunsal geri bildirim hareketten bağımsız erişilebilirlik).
 *
 * Native driver: yalnız `opacity` ve `transform` (scale/rotate/translate)
 * animasyonları var; hepsi native-driver uyumlu (JS thread'i bloklamaz).
 * strokeDashoffset / SVG path çizimi gibi JS-thread animasyonları BURADA YOK —
 * rapordaki "Reanimated gerektirenler" listesine bak.
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

const DEG = (d: number) => `${d}deg`;

export interface EnterControls {
  /** <Animated.View style={[...]}> içine konur. */
  style: {
    opacity: Animated.Value;
    transform: ({ scale: Animated.Value } | { rotate: Animated.AnimatedInterpolation<string> })[];
  };
  /** Animasyonu baştan oynat (kesilebilir — çağrıldığında mevcut değerden gider). */
  play: () => void;
}

/**
 * Giriş: scale 0.85→1, rotate −6°→0, opacity 0→1, 500 ms, enter eğrisi.
 * Azaltılmışta: yalnız opacity 0→1 (+ 8 px yok çünkü girişte kayma şart değil),
 * 200 ms. Mount'ta otomatik oynar. `play()` yeniden tetikler.
 */
export function useEnter(opts?: { autoplay?: boolean; delay?: number }): EnterControls {
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current; // 0 = başlangıç, 1 = yerinde
  const autoplay = opts?.autoplay ?? true;
  const delay = opts?.delay ?? 0;

  const run = () => {
    p.stopAnimation(() => {
      Animated.timing(p, {
        toValue: 1,
        duration: reduced ? REDUCED.duration : TIMING.enter,
        delay,
        easing: reduced ? CURVE.out : CURVE.enter,
        useNativeDriver: true,
      }).start();
    });
  };

  useEffect(() => {
    p.setValue(0);
    if (autoplay) run();
    // reduced değişiminde de doğru süreyle yeniden kurulsun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const scale = p.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.85, 1] });
  const rotate = p.interpolate({
    inputRange: [0, 1],
    outputRange: [reduced ? DEG(0) : DEG(-6), DEG(0)],
  });

  return {
    style: { opacity: p, transform: [{ scale: scale as unknown as Animated.Value }, { rotate }] },
    play: run,
  };
}

export interface PopControls {
  style: { transform: { scale: Animated.Value }[] };
  /** Kutlama sıçraması + success haptik (hero). */
  pop: () => void;
}

/**
 * Pop (kutlama): scale 1→1.08→1, 360 ms + success haptik.
 * Azaltılmışta: sıçrama yok, yalnız success haptik (haptik aynı kalır kuralı).
 */
export function usePop(): PopControls {
  const reduced = useReducedMotion();
  const s = useRef(new Animated.Value(1)).current;

  const pop = () => {
    haptic('success');
    if (reduced) return;
    Animated.sequence([
      Animated.timing(s, {
        toValue: 1.08,
        duration: TIMING.pop / 2,
        easing: CURVE.out,
        useNativeDriver: true,
      }),
      Animated.timing(s, {
        toValue: 1,
        duration: TIMING.pop / 2,
        easing: CURVE.in,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return { style: { transform: [{ scale: s }] }, pop };
}

/**
 * Süzülme (float): translateY ±4 px, 3.2 s ease-in-out, sonsuz. İsteğe bağlı
 * eğim (tilt): rotate ±2°, 4.8 s. Azaltılmışta: hiç döngü yok (sabit durur).
 */
export function useFloat(opts?: { tilt?: boolean; amplitude?: number }): {
  style: {
    transform: (
      | { translateY: Animated.AnimatedInterpolation<number> }
      | { rotate: Animated.AnimatedInterpolation<string> }
    )[];
  };
} {
  const reduced = useReducedMotion();
  const amp = opts?.amplitude ?? 4;
  const f = useRef(new Animated.Value(0)).current;
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(f, { toValue: 1, duration: TIMING.float / 2, easing: CURVE.move, useNativeDriver: true }),
        Animated.timing(f, { toValue: 0, duration: TIMING.float / 2, easing: CURVE.move, useNativeDriver: true }),
      ]),
    );
    loop.start();
    let tiltLoop: Animated.CompositeAnimation | undefined;
    if (opts?.tilt) {
      tiltLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(t, { toValue: 1, duration: TIMING.tilt / 2, easing: CURVE.move, useNativeDriver: true }),
          Animated.timing(t, { toValue: 0, duration: TIMING.tilt / 2, easing: CURVE.move, useNativeDriver: true }),
        ]),
      );
      tiltLoop.start();
    }
    return () => {
      loop.stop();
      tiltLoop?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, opts?.tilt]);

  const translateY = f.interpolate({ inputRange: [0, 1], outputRange: [-amp, amp] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: [DEG(-2), DEG(2)] });
  const transform: (
    | { translateY: Animated.AnimatedInterpolation<number> }
    | { rotate: Animated.AnimatedInterpolation<string> }
  )[] = [{ translateY }];
  if (opts?.tilt) transform.push({ rotate });
  return { style: { transform } };
}

/**
 * Nefes (breath / parıltı): opacity 0.5→0.9, 2.4 s, sonsuz. GlowDot ve
 * "yükleniyor" göstergesi bunu kullanır. Azaltılmışta: sabit tam opaklıkta
 * durur (göz yormayan tek kare).
 */
export function useBreath(opts?: { min?: number; max?: number; period?: number }): {
  style: { opacity: Animated.Value | Animated.AnimatedInterpolation<number> };
} {
  const reduced = useReducedMotion();
  const b = useRef(new Animated.Value(0)).current;
  const min = opts?.min ?? 0.5;
  const max = opts?.max ?? 0.9;
  const period = opts?.period ?? TIMING.glow;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(b, { toValue: 1, duration: period / 2, easing: CURVE.move, useNativeDriver: true }),
        Animated.timing(b, { toValue: 0, duration: period / 2, easing: CURVE.move, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, period]);

  if (reduced) {
    return { style: { opacity: new Animated.Value(max) } };
  }
  const opacity = b.interpolate({ inputRange: [0, 1], outputRange: [min, max] });
  return { style: { opacity } };
}

export interface SpringToControls {
  value: Animated.ValueXY;
  style: { transform: { translateX: Animated.Value }[] | { translateY: Animated.Value }[] };
  /**
   * Hedefe yay çizerek git + varışta light haptik. Kesilebilir: tekrar
   * çağrılırsa mevcut hızdan yeni hedefe gider.
   * NOT: Bu yalnız DÜZ çizgide yay hareketidir. "Logla izi"nin KAVİSLİ yolu
   * (öğe küçülüp hedefe yay çizerek gider) JS-thread path gerektirir →
   * Reanimated. Burada düz yaklaşımı veriyoruz; kavis rapordaki listede.
   */
  springTo: (to: { x: number; y: number }, family?: keyof typeof SPRING) => void;
}

/**
 * Bir öğeyi yay ile bir konuma taşır (ör. "logla izi"nin düz karşılığı).
 * Azaltılmışta: en fazla 8 px kayma + 200 ms, yay yok.
 */
export function useSpringTo(): SpringToControls {
  const reduced = useReducedMotion();
  const xy = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const springTo: SpringToControls['springTo'] = (to, family = 'ai') => {
    if (reduced) {
      const clamp = (n: number) => Math.max(-REDUCED.maxShift, Math.min(REDUCED.maxShift, n));
      Animated.timing(xy, {
        toValue: { x: clamp(to.x), y: clamp(to.y) },
        duration: REDUCED.duration,
        easing: CURVE.out,
        useNativeDriver: true,
      }).start(() => haptic('light'));
      return;
    }
    Animated.spring(xy, {
      toValue: to,
      ...SPRING[family],
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) haptic('light');
    });
  };

  return {
    value: xy,
    style: { transform: [{ translateX: xy.x }, { translateY: xy.y }] as any },
    springTo,
  };
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
