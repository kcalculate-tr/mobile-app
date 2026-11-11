// G28-S1 md.1 — Logla izi A (FinMoLogA) kök katmanı. Uygulama kökünde, gezinme kabının ÜSTÜNDE
// durur → Tara (tam ekran), Koç sohbeti, gönderi detayı gibi yığın ekranlarından da görünür.
//
// FinMoLogA tablosu:
//   · Uçuş: tabak küçülür ve Ana sayfa sekmesine uçar — slow 500 (TIMING.logTrail), konum
//     AI yayı 260/24, ölçek/opaklık enter eğrisi.
//   · Varış: "+1" rozeti (TabBarR3, bouncy base 300, en fazla 9+) + success haptik + toast
//     ("<Öğün>'ye loglandı · Geri al · Gör"; giriş base 300 / çıkış fast 200 — Toast).
//   · Art arda: her log ayrı uçuş ve +1.
//   · Geri al: kaydı siler (kaynağın `undo`'su), rozet −1; uçuş sürerken gelirse uçuş kesilir,
//     tabak 200 ms (fast, standard) solar, rozet artmaz.
//   · Azaltılmış hareket: uçuş YOK — rozet + toast 200 ms opaklık.
//
// G30-S1 md.1 — kare kare FinMoLogA (4400 ms döngü) karşılaştırması sonrası:
//   · Uçan kopya kaynağın GÖRÜNEN kutusundan, kaynakla aynı pikselle başlar (tam ekran fotoğrafta
//     `imageRect` kırpması; çıkartmada kalkış dönüşümü dahil) ve görsel yüklenmeden görünmez —
//     ekranda olunca `onStart` → kaynak ekran ANCAK o zaman kapanır.
//   · Konum VE ölçek aynı ilerlemeyle (AI yayı 260/24) — pano tek `transform`, tek eğri
//     cubic-bezier(.3,1.15,.4,1). Önceden ölçek ayrı enter eğrisindeydi.
//   · Opaklık uçuş boyunca 1, varışta (slow 500) ANINDA 0 — önceden %85'ten sonra solarak ikona
//     varmadan kayboluyordu.
//   · Hedef: Ana sayfa sekme ikonunun ÖLÇÜLMÜŞ merkezi (TabBarR3 görünümü), ölçek 0,08.
//   · Ana sayfa zaten görünürken rozet YOK (FinMoLogB: satır vurgusu + halka dolumu Tracker'da);
//     rozet Ana sayfa açılınca silinir (TabBarR3).
//   · Toast alttan girer (16 → 0, base 300 enter), çıkışta alta kayarak solar (fast 200 exit);
//     önceden kapanınca animasyonsuz kesiliyordu.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, DeviceEventEmitter, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StickerImage } from '../../lib/sticker/StickerImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CURVE, DURATION, SPRING, TIMING, haptic, useReducedMotion } from '../../core/design/motion';
import { Toast } from '../../core/design/components/Toast';
import { useTheme } from '../../core/design/ThemeProvider';
import { useT } from '../../core/i18n';
import { navigationRef } from '../../navigation/navigationRef';
import { LOG_FLIGHT_EVENT, LOG_UNDO_EVENT, type LogFlightPayload, type LogUndoPayload } from './logEvents';
import { emitLogBadge, isHomeVisible, measureHomeTabTarget } from './logTrace';
import { TAB_BAR_R3, tabBarBottomOffset } from './layout';

interface Flight {
  key: number;
  payload: LogFlightPayload;
  /** Kayıt kimliği (Geri al eşleşmesi). */
  id: string;
  target: { x: number; y: number };
  cancelled: boolean;
}

interface ToastState {
  id: string;
  message: string;
  undo: (() => void | Promise<void>) | null;
  /** false → çıkış animasyonu oynuyor, sonra kaldırılır. */
  visible: boolean;
}

/** FinMoLogA: uçuş sonu ölçeği (358 pt görsel → ~29 pt, sekme ikonu üstünde). */
export const FLY_END_SCALE = 0.08;
/** Görsel bu sürede yüklenmezse uçuş yine başlar (boş kutu riski < takılma). */
export const FLY_IMAGE_READY_TIMEOUT_MS = 200;
/** Uçuş başlangıç köşe yarıçapı (pano: kaynak görsel 16). */
export const FLY_RADIUS = 16;

/**
 * Uçuş dönüşümü — ilerleme `m` (AI yayı, 0 → 1) konum VE ölçeği birlikte sürer (pano tek
 * transform). m = 1'de kopya merkezi hedefte, ölçek FLY_END_SCALE. Yay hafif taşar (≈ %3) →
 * ölçek 0,08'in biraz altına iner; sıfır/negatif olmasın.
 */
export function flightTransform(
  m: number,
  r: { x: number; y: number; w: number; h: number },
  target: { x: number; y: number },
): { tx: number; ty: number; scale: number } {
  'worklet';
  return {
    tx: (target.x - (r.x + r.w / 2)) * m,
    ty: (target.y - (r.y + r.h / 2)) * m,
    scale: Math.max(0.02, 1 + (FLY_END_SCALE - 1) * m),
  };
}

function homeVisibleNow(): boolean {
  try {
    if (!navigationRef.isReady()) return false;
    return isHomeVisible(navigationRef.getRootState() as never);
  } catch {
    return false;
  }
}

/** Sekme çubuğu görünür mü (kök rota Tabs)? Değilse toast ekran altına iner. */
function tabsOnTop(): boolean {
  try {
    if (!navigationRef.isReady()) return true;
    const s = navigationRef.getRootState();
    return s?.routes?.[s.index ?? 0]?.name === 'Tabs';
  } catch {
    return true;
  }
}

export function LogTraceHost() {
  const reduced = useReducedMotion();
  const i18n = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [toastBottom, setToastBottom] = useState(0);
  const seq = useRef(0);
  /** Rozeti artırılmış (varmış) kayıtlar — Geri al yalnız bunlarda rozeti düşürür. */
  const arrived = useRef(new Set<string>());
  /** Geri alınmış kayıtlar (ölçüm sürerken gelen Geri al için). */
  const undone = useRef(new Set<string>());

  const env = useRef({ reduced, winW, winH, insets });
  env.current = { reduced, winW, winH, insets };

  const fallbackTarget = useCallback(() => {
    const { winW: w, winH: h, insets: ins } = env.current;
    const containerW = w - 2 * TAB_BAR_R3.SIDE_INSET;
    const pillW = containerW - TAB_BAR_R3.SCAN_GAP - TAB_BAR_R3.SCAN_SIZE;
    const tabW = (pillW - 2 * TAB_BAR_R3.BUBBLE_PAD) / 4;
    const bottom = tabBarBottomOffset(ins.bottom);
    return {
      x: TAB_BAR_R3.SIDE_INSET + TAB_BAR_R3.BUBBLE_PAD + tabW / 2,
      y: h - bottom - TAB_BAR_R3.PILL_HEIGHT / 2,
    };
  }, []);

  const arrive = useCallback(
    (payload: LogFlightPayload, id: string) => {
      // G30-S1 md.1: Ana sayfa zaten ekrandaysa "+1" rozeti yok — geri bildirim satır vurgusu +
      // halka dolumu (FinMoLogB / FinMoRing, Tracker useHomeHighlight). Rozet "başka sekmeden".
      // HIG playing-haptics › "Use haptics consistently": o durumda success'i satır oturunca
      // useHomeHighlight çalar → burada çalınmaz (çift success yok).
      if (!homeVisibleNow()) {
        haptic('success');
        arrived.current.add(id);
        emitLogBadge(1);
      }
      const message = payload.mealLabel ? i18n.t('shell.logged', { meal: payload.mealLabel }) : i18n.t('shell.logged_generic');
      // HIG motion › "Make motion optional": sonuç VoiceOver'a da söylenir (iOS'ta
      // accessibilityLiveRegion yok; Android canlı bölge Toast'ta).
      try {
        AccessibilityInfo.announceForAccessibility?.(message);
      } catch {
        /* erişilebilirlik köprüsü yoksa sessiz */
      }
      if (payload.ownToast) return;
      const ins = env.current.insets;
      setToastBottom(
        tabsOnTop() ? tabBarBottomOffset(ins.bottom) + TAB_BAR_R3.PILL_HEIGHT + 8 : Math.max(16, ins.bottom + 8),
      );
      setToast({ id, message, undo: payload.undo ?? null, visible: true });
    },
    [i18n],
  );

  useEffect(() => {
    const onFlight = (raw: LogFlightPayload) => {
      seq.current += 1;
      const key = seq.current;
      const id = raw.id ?? `log-${key}`;
      const noOrigin = !(raw.w > 0 && raw.h > 0);
      if (env.current.reduced || noOrigin) {
        raw.onStart?.();
        arrive(raw, id);
        return;
      }
      // Hedef: sekme ikonunun gerçek konumu (ölçüm ~1 kare); olmazsa hesaplanan nokta.
      void measureHomeTabTarget()
        .catch(() => null)
        .then((measured) => {
          // Ölçüm sürerken Geri al geldiyse uçuş hiç başlamaz (rozet de artmaz).
          if (undone.current.has(id)) {
            raw.onStart?.();
            return;
          }
          const target = measured ?? fallbackTarget();
          setFlights((list) => [...list, { key, payload: raw, id, target, cancelled: false }]);
        });
    };
    const onUndo = ({ id }: LogUndoPayload) => {
      undone.current.add(id);
      // Uçuş sürüyorsa kesilir (tabak solar, rozet artmaz).
      setFlights((list) => list.map((f) => (f.id === id && !f.cancelled ? { ...f, cancelled: true } : f)));
      if (arrived.current.has(id)) {
        arrived.current.delete(id);
        emitLogBadge(-1);
      }
      setToast((t) => (t && t.id === id ? { ...t, visible: false } : t));
    };
    const a = DeviceEventEmitter.addListener(LOG_FLIGHT_EVENT, onFlight);
    const b = DeviceEventEmitter.addListener(LOG_UNDO_EVENT, onUndo);
    return () => {
      a.remove();
      b.remove();
    };
  }, [arrive, fallbackTarget]);

  /** Toast çıkışı animasyonlu (fast 200 exit), sonra kaldırılır. */
  const hideToast = useCallback(() => setToast((t) => (t ? { ...t, visible: false } : t)), []);
  useEffect(() => {
    if (!toast || toast.visible) return;
    const h = setTimeout(() => setToast((t) => (t && !t.visible ? null : t)), DURATION.base); // çıkış (fast 200) bittikten sonra
    return () => clearTimeout(h);
  }, [toast]);

  // FinMoLogA 3700 ms "Ana sayfa · rozet silinir": Ana sayfa sekmesi ekrana gelince (kök Tabs +
  // etkin sekme Tracker) rozet silinir (TabBarR3: fast 200 exit). Önceden yalnız "Gör" siliyordu.
  useEffect(() => {
    const check = () => {
      if (arrived.current.size === 0 || !homeVisibleNow()) return;
      arrived.current.clear();
      emitLogBadge('clear');
    };
    let unsub: (() => void) | undefined;
    try {
      unsub = navigationRef.addListener?.('state', check) as (() => void) | undefined;
    } catch {
      /* gezinme hazır değil */
    }
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const onToastUndo = useCallback(() => {
    const t = toast;
    if (!t?.undo) return;
    try {
      void Promise.resolve(t.undo()).catch(() => {});
    } catch {
      /* kaynak hatası kabuğu düşürmez */
    }
    DeviceEventEmitter.emit(LOG_UNDO_EVENT, { id: t.id } as LogUndoPayload);
    hideToast();
  }, [toast, hideToast]);

  const onToastView = useCallback(() => {
    hideToast();
    emitLogBadge('clear');
    arrived.current.clear();
    try {
      if (navigationRef.isReady()) (navigationRef as unknown as { navigate: (n: string, p?: object) => void }).navigate('Tabs', { screen: 'Tracker' });
    } catch {
      /* gezinme hazır değil */
    }
  }, [hideToast]);

  const accent = theme.isDark ? '#C6FF3A' : '#8AD400';

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} testID="log-trace-host">
      {flights.map((f) => (
        <FlightView
          key={f.key}
          flight={f}
          accent={accent}
          onArrive={() => arrive(f.payload, f.id)}
          onDone={() => setFlights((list) => list.filter((x) => x.key !== f.key))}
        />
      ))}
      {toast ? (
        <View style={[styles.toastRow, { bottom: toastBottom }]} pointerEvents="box-none">
          <Toast
            visible={toast.visible}
            from="bottom"
            message={toast.message}
            onUndo={toast.undo ? onToastUndo : undefined}
            onView={onToastView}
            onDismiss={hideToast}
            testID="log-trace-toast"
          />
        </View>
      ) : null}
    </View>
  );
}

function FlightView({
  flight,
  accent,
  onArrive,
  onDone,
}: {
  flight: Flight;
  accent: string;
  onArrive: () => void;
  onDone: () => void;
}) {
  const { x, y, w, h, imageUri, cutout, imageRect } = flight.payload;
  const radius = flight.payload.radius ?? FLY_RADIUS;
  const move = useSharedValue(0); // konum + ölçek (AI yayı, pano tek transform)
  const clock = useSharedValue(0); // varış saati: slow 500 (TIMING.logTrail)
  const shown = useSharedValue(0); // 0: görsel hazır değil / varıldı → görünmez
  const fade = useSharedValue(1); // Geri al: 200 ms solma
  const started = useRef(false);

  const start = useCallback(() => {
    if (started.current || flight.cancelled) return;
    started.current = true;
    // Bundan sonrası tamamen UI thread'de (Reanimated); JS yalnız varışta rozet/toast için.
    shown.value = 1;
    move.value = withSpring(1, SPRING.ai);
    // Saat görsel değil (yalnız varış anı) → eğrisi önemsiz; token eğrisi.
    clock.value = withTiming(1, { duration: TIMING.logTrail, easing: CURVE.standard }, (fin) => {
      if (!fin) return;
      shown.value = 0; // pano: varışta anında kaybolur (rozet aynı karede)
      runOnJS(onArrive)();
      runOnJS(onDone)();
    });
    // Kopya bu karede çiziliyor → kaynak ekran kapanabilir.
    requestAnimationFrame(() => {
      try {
        flight.payload.onStart?.();
      } catch {
        /* kaynak hatası kabuğu düşürmez */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Görsel yoksa (lime nokta) hemen; varsa yüklenince — en geç FLY_IMAGE_READY_TIMEOUT_MS.
    if (!imageUri) {
      start();
      return;
    }
    const t = setTimeout(start, FLY_IMAGE_READY_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flight.cancelled) return;
    // Varış geri çağrısı iptal (fin=false → rozet artmaz); konum olduğu yerde kalır.
    cancelAnimation(clock);
    cancelAnimation(move);
    if (!started.current) {
      started.current = true;
      flight.payload.onStart?.();
      onDone();
      return;
    }
    fade.value = withTiming(0, { duration: DURATION.fast, easing: CURVE.standard }, (fin) => {
      if (fin) runOnJS(onDone)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.cancelled]);

  const rect = { x, y, w, h };
  const target = flight.target;
  const style = useAnimatedStyle(() => {
    const t = flightTransform(move.value, rect, target);
    return {
      opacity: shown.value * fade.value,
      transform: [{ translateX: t.tx }, { translateY: t.ty }, { scale: t.scale }],
    };
  });

  const onImg = () => start();
  const cropStyle = imageRect
    ? { position: 'absolute' as const, left: imageRect.x - x, top: imageRect.y - y, width: imageRect.w, height: imageRect.h }
    : styles.flightImg;

  return (
    <Animated.View
      pointerEvents="none"
      testID={`log-flight-${flight.id}`}
      style={[
        styles.flight,
        cutout ? styles.flightCutout : { borderRadius: radius },
        { left: x, top: y, width: w, height: h },
        style,
      ]}
    >
      {imageUri && cutout ? (
        // G30-S1 md.2: çıkartma uçarken de beyaz konturlu (kırpılmaz, oran korunur).
        <StickerImage
          uri={imageUri}
          style={styles.flightImg}
          resizeMode="contain"
          size={Math.min(w, h)}
          onLoad={onImg}
          onError={onImg}
          testID={`log-flight-${flight.id}-sticker`}
        />
      ) : imageUri ? (
        <Image source={{ uri: imageUri }} style={cropStyle} resizeMode="cover" onLoad={onImg} onError={onImg} />
      ) : (
        <View style={[styles.flightDot, { backgroundColor: accent }]} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flight: { position: 'absolute', overflow: 'hidden', zIndex: 50 },
  flightImg: { width: '100%', height: '100%' },
  // G29-S1: çıkartma uçarken kırpılmaz / yuvarlanmaz (şeffaf kenarlar).
  flightCutout: { borderRadius: 0, overflow: 'visible' },
  flightDot: { flex: 1, borderRadius: 999 },
  toastRow: { position: 'absolute', left: 16, right: 16, zIndex: 60 },
});
