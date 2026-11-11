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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CURVE, DURATION, SPRING, TIMING, haptic, useReducedMotion } from '../../core/design/motion';
import { Toast } from '../../core/design/components/Toast';
import { useTheme } from '../../core/design/ThemeProvider';
import { useT } from '../../core/i18n';
import { navigationRef } from '../../navigation/navigationRef';
import { LOG_FLIGHT_EVENT, LOG_UNDO_EVENT, type LogFlightPayload, type LogUndoPayload } from './logEvents';
import { emitLogBadge, getHomeTabTarget } from './logTrace';
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
      haptic('success');
      arrived.current.add(id);
      emitLogBadge(1);
      if (payload.ownToast) return;
      const ins = env.current.insets;
      setToastBottom(
        tabsOnTop() ? tabBarBottomOffset(ins.bottom) + TAB_BAR_R3.PILL_HEIGHT + 8 : Math.max(16, ins.bottom + 8),
      );
      setToast({
        id,
        message: payload.mealLabel ? i18n.t('shell.logged', { meal: payload.mealLabel }) : i18n.t('shell.logged_generic'),
        undo: payload.undo ?? null,
      });
    },
    [i18n],
  );

  useEffect(() => {
    const onFlight = (raw: LogFlightPayload) => {
      seq.current += 1;
      const id = raw.id ?? `log-${seq.current}`;
      const noOrigin = !(raw.w > 0 && raw.h > 0);
      if (env.current.reduced || noOrigin) {
        arrive(raw, id);
        return;
      }
      const target = getHomeTabTarget() ?? fallbackTarget();
      setFlights((list) => [...list, { key: seq.current, payload: raw, id, target, cancelled: false }]);
    };
    const onUndo = ({ id }: LogUndoPayload) => {
      // Uçuş sürüyorsa kesilir (tabak solar, rozet artmaz).
      setFlights((list) => list.map((f) => (f.id === id && !f.cancelled ? { ...f, cancelled: true } : f)));
      if (arrived.current.has(id)) {
        arrived.current.delete(id);
        emitLogBadge(-1);
      }
      setToast((t) => (t && t.id === id ? null : t));
    };
    const a = DeviceEventEmitter.addListener(LOG_FLIGHT_EVENT, onFlight);
    const b = DeviceEventEmitter.addListener(LOG_UNDO_EVENT, onUndo);
    return () => {
      a.remove();
      b.remove();
    };
  }, [arrive, fallbackTarget]);

  const onToastUndo = useCallback(() => {
    const t = toast;
    if (!t?.undo) return;
    try {
      void Promise.resolve(t.undo()).catch(() => {});
    } catch {
      /* kaynak hatası kabuğu düşürmez */
    }
    DeviceEventEmitter.emit(LOG_UNDO_EVENT, { id: t.id } as LogUndoPayload);
    setToast(null);
  }, [toast]);

  const onToastView = useCallback(() => {
    setToast(null);
    emitLogBadge('clear');
    arrived.current.clear();
    try {
      if (navigationRef.isReady()) (navigationRef as unknown as { navigate: (n: string, p?: object) => void }).navigate('Tabs', { screen: 'Tracker' });
    } catch {
      /* gezinme hazır değil */
    }
  }, []);

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
            visible
            message={toast.message}
            onUndo={toast.undo ? onToastUndo : undefined}
            onView={onToastView}
            onDismiss={() => setToast(null)}
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
  const { x, y, w, h } = flight.payload;
  const move = useSharedValue(0); // konum (AI yayı)
  const p = useSharedValue(0); // ölçek + opaklık (slow 500, enter)
  const fade = useSharedValue(1); // Geri al: 200 ms solma

  useEffect(() => {
    move.value = withSpring(1, SPRING.ai);
    p.value = withTiming(1, { duration: TIMING.logTrail, easing: CURVE.enter }, (fin) => {
      if (fin) {
        runOnJS(onArrive)();
        runOnJS(onDone)();
      }
    });
    // yalnız mount'ta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flight.cancelled) return;
    // Varış geri çağrısı iptal (fin=false → rozet artmaz); konum olduğu yerde kalır.
    cancelAnimation(p);
    cancelAnimation(move);
    fade.value = withTiming(0, { duration: DURATION.fast, easing: CURVE.standard }, (fin) => {
      if (fin) runOnJS(onDone)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.cancelled]);

  const style = useAnimatedStyle(() => {
    const dx = flight.target.x - (x + w / 2);
    const dy = flight.target.y - (y + h / 2);
    return {
      opacity: interpolate(p.value, [0, 0.85, 1], [1, 1, 0]) * fade.value,
      transform: [
        { translateX: dx * move.value },
        { translateY: dy * move.value },
        { scale: interpolate(p.value, [0, 1], [1, 0.08]) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      testID={`log-flight-${flight.id}`}
      style={[styles.flight, { left: x, top: y, width: w, height: h }, style]}
    >
      {flight.payload.imageUri ? (
        <Image source={{ uri: flight.payload.imageUri }} style={styles.flightImg} />
      ) : (
        <View style={[styles.flightDot, { backgroundColor: accent }]} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flight: { position: 'absolute', borderRadius: 16, overflow: 'hidden', zIndex: 50 },
  flightImg: { width: '100%', height: '100%' },
  flightDot: { flex: 1, borderRadius: 999 },
  toastRow: { position: 'absolute', left: 16, right: 16, zIndex: 60 },
});
