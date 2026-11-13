// G44-S1 — Kayıt akışı hareket yardımcıları: seçim hâli renk geçişi (160 ms, yay yok), basış geri bildirimi
// (0,98 + 120 ms geri dönüş), sayaç (≤ 600 ms ease-out), soru → soru yığın geçişi (native iOS push hissi:
// yeni içerik sağdan, eskisi %30 sola; 330 ms standart eğri) ve tek ekran içi push (E1 → E2).
// Azaltılmış harekette hepsi anlık. Onboarding 1–5 bu dosyayı KULLANMAZ.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CURVE, useReducedMotion } from '../../../core/design';
import { K_MOTION } from './theme';

// ─── Renk karışımı ────────────────────────────────────────────────────────────
type RGBA = [number, number, number, number];
const cache = new Map<string, RGBA>();

/** '#RGB' · '#RRGGBB' · 'rgb(…)' · 'rgba(…)' · 'transparent' → [r, g, b, a]. */
export function parseColor(c: string): RGBA {
  const hit = cache.get(c);
  if (hit) return hit;
  let out: RGBA = [0, 0, 0, 0];
  const s = c.trim().toLowerCase();
  if (s === 'transparent') out = [0, 0, 0, 0];
  else if (s.startsWith('#')) {
    const h = s.slice(1);
    const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    out = [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16), full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1];
  } else {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(',').map((x) => parseFloat(x));
      out = [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
    }
  }
  cache.set(c, out);
  return out;
}

/** a → b doğrusal karışım (t: 0..1). Uçlarda girdiyi aynen döndürür (test/anlık kare birebir). */
export function mixColor(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const x = parseColor(a);
  const y = parseColor(b);
  // Saydam uçta renk kanalı diğer uçtan alınır (gri geçiş olmasın).
  const xa = x[3] === 0 ? [y[0], y[1], y[2], 0] : x;
  const ya = y[3] === 0 ? [x[0], x[1], x[2], 0] : y;
  const r = Math.round(xa[0] + (ya[0] - xa[0]) * t);
  const g = Math.round(xa[1] + (ya[1] - xa[1]) * t);
  const bl = Math.round(xa[2] + (ya[2] - xa[2]) * t);
  const al = Math.round((xa[3] + (ya[3] - xa[3]) * t) * 1000) / 1000;
  return `rgba(${r},${g},${bl},${al})`;
}

// ─── Seçim hâli geçişi ────────────────────────────────────────────────────────
/**
 * Seçili ↔ seçilmemiş ilerlemesi (0..1), K_MOTION.select (160 ms) standart eğriyle; yay/zıplama yok.
 * Arka plan, kenar, ikon ve metin rengi aynı saatle karışır (requestAnimationFrame; yalnız değişen öğe yeniden
 * çizilir). Azaltılmış harekette anlık.
 */
export function useSelectTween(on: boolean, duration: number = K_MOTION.select): number {
  const reduced = useReducedMotion();
  const target = on ? 1 : 0;
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (reduced || cur.current === target) {
      cur.current = target;
      setV(target);
      return;
    }
    const from = cur.current;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - start) / duration);
      // standart (0.2, 0, 0, 1) yaklaşığı: ease-out kübik
      const e = 1 - Math.pow(1 - k, 3);
      const next = k >= 1 ? target : from + (target - from) * e;
      cur.current = next;
      setV(next);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced, duration]);
  return v;
}

// ─── Basış geri bildirimi ─────────────────────────────────────────────────────
/** Basılıyken 0,98 ölçek; bırakınca 120 ms'de geri döner (yay yok). Azaltılmış harekette ölçek yok. */
export function usePressScale() {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const onPressIn = () => {
    if (!reduced) s.value = withTiming(K_MOTION.pressScale, { duration: K_MOTION.pressIn, easing: CURVE.standard });
  };
  const onPressOut = () => {
    s.value = reduced ? 1 : withTiming(1, { duration: K_MOTION.pressOut, easing: CURVE.standard });
  };
  return { style, onPressIn, onPressOut };
}

/**
 * Pressable + basış ölçeği. `outer` ölçeklenen sarmalayıcının düzeni (flex/genişlik), `style` Pressable'ın
 * kendi görünümü. Pressable'ın onPressIn/onPressOut'u korunur.
 */
export function PressScale({ outer, style, onPressIn, onPressOut, children, ...rest }: Omit<PressableProps, 'style' | 'children'> & { outer?: StyleProp<ViewStyle>; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const p = usePressScale();
  return (
    <Animated.View style={[outer, p.style]}>
      <Pressable
        {...rest}
        onPressIn={(e) => {
          if (!rest.disabled) p.onPressIn();
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          p.onPressOut();
          onPressOut?.(e);
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─── Sayaç ────────────────────────────────────────────────────────────────────
/** 0 → hedef, en çok K_MOTION.count (600 ms) ease-out. Azaltılmış harekette anlık. */
export function useKCount(target: number, run = true, duration: number = K_MOTION.count): number {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced || !run ? target : 0);
  useEffect(() => {
    if (reduced || !run) {
      setV(target);
      return;
    }
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(target * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, reduced, duration]);
  return v;
}

// ─── Yığın geçişi (tek rota içinde) ──────────────────────────────────────────
/** Standart eğri (0.2, 0, 0, 1) — core motion token'ı. */
const PUSH_EASE = CURVE.standard;
const PARALLAX = 0.3;

type Layer = { key: string; node: React.ReactNode };

/**
 * Soru → soru: native iOS yığın geçişi hissi. İleri: yeni içerik sağdan tam genişlikte kayar, eskisi %30 sola
 * çekilip ilk yarıda kaybolur (arka plan + üst çubuk + düğme sabit kalır, iOS gezinme çubuğu gibi). Geri: tersi
 * (giden sağa tam çıkar, önceki %30 soldan gelir). 330 ms, standart eğri. Giden katman dokunulmaz ve ekran
 * okuyucudan gizlidir. Azaltılmışta anlık değişim.
 */
export function StackSwap({ k, dir, children, style }: { k: string; dir: 1 | -1; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const { width: W } = useWindowDimensions();
  const committed = useRef<Layer>({ key: k, node: children });
  const [out, setOut] = useState<{ layer: Layer; dir: 1 | -1 } | null>(null);

  // Bu çizimde adım değiştiyse giden katman = son işlenen adım (ref çizimde DEĞİŞTİRİLMEZ).
  const pending = committed.current.key !== k ? { layer: committed.current, dir } : null;
  const shown = reduced ? null : (pending ?? out);
  const outLayer = shown && shown.layer.key !== k ? shown : null;

  // Her çizimden sonra: son işlenen adımı güncelle; adım değiştiyse giden katmanı başlat (setOut yalnız adım
  // değişiminde → döngü yok).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const prev = committed.current;
    committed.current = { key: k, node: children };
    if (prev.key !== k) setOut(reduced ? null : { layer: prev, dir });
  });

  useEffect(() => {
    if (!out) return;
    const id = setTimeout(() => setOut(null), K_MOTION.push + 40);
    return () => clearTimeout(id);
  }, [out]);

  return (
    <View style={[{ flex: 1 }, style]}>
      {outLayer ? (
        <Slide key={outLayer.layer.key} role="out" dir={outLayer.dir} W={W} reduced={reduced} style={[StyleSheet.absoluteFill, outLayer.dir === -1 ? { zIndex: 2 } : null]}>
          {outLayer.layer.node}
        </Slide>
      ) : null}
      <Slide key={k} role={outLayer ? 'in' : 'rest'} dir={outLayer ? outLayer.dir : dir} W={W} reduced={reduced} style={{ flex: 1 }}>
        {children}
      </Slide>
    </View>
  );
}

/** Katman: `in` ilk karede ekran dışından başlar (yeni bağlanır → parlama yok); `out` mevcut konumundan çıkar. */
function Slide({ role, dir, W, reduced, style, children }: { role: 'in' | 'out' | 'rest'; dir: 1 | -1; W: number; reduced: boolean; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const startIn = role === 'in' && !reduced;
  const x = useSharedValue(startIn ? (dir === 1 ? W : -W * PARALLAX) : 0);
  const o = useSharedValue(startIn && dir === -1 ? 0 : 1);
  useEffect(() => {
    if (reduced) {
      x.value = 0;
      o.value = 1;
      return;
    }
    const cfg = { duration: K_MOTION.push, easing: PUSH_EASE };
    if (role === 'in') {
      x.value = withTiming(0, cfg);
      // Geri: alttaki önceki adım, üstteki giden katman çekilirken belirir.
      if (dir === -1) o.value = withTiming(1, { duration: K_MOTION.pushFadeIn, easing: PUSH_EASE });
    } else if (role === 'out') {
      if (dir === 1) {
        x.value = withTiming(-W * PARALLAX, cfg);
        o.value = withTiming(0, { duration: K_MOTION.pushFadeOut, easing: PUSH_EASE });
      } else {
        x.value = withTiming(W, cfg);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateX: x.value }] }));
  const hidden = role === 'out';
  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'auto'}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={hidden}
      style={[style, st]}
    >
      {children}
    </Animated.View>
  );
}

/** Tek ekran içi push (E1 → E2): `k` değişince içerik sağdan (ileri) / soldan (geri) gelir. Azaltılmışta anlık. */
export function PushIn({ k, dir = 1, children, style }: { k: string; dir?: 1 | -1; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const { width: W } = useWindowDimensions();
  const x = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      x.value = 0;
      return;
    }
    x.value = dir === 1 ? W : -W * PARALLAX;
    x.value = withTiming(0, { duration: K_MOTION.push, easing: PUSH_EASE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View style={[{ flex: 1 }, st, style]}>{children}</Animated.View>;
}
