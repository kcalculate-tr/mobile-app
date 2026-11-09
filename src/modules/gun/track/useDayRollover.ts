// G19-S2 md.1/md.2 — Açık ekranın günü ve tazeliği.
//  · Gece yarısı (İstanbul) geçince `onNewDay(newKey)` çağrılır: zamanlayıcı
//    bir sonraki gece yarısına (+1 sn pay) kurulur.
//  · Uygulama ön plana dönünce: gün değiştiyse `onNewDay`, değişmediyse
//    `onResume` (çoklu cihaz tutarlılığı — başka cihazdaki kayıt görünür). Arka
//    planda zamanlayıcı JS'te çalışmayabilir; bu yüzden ön plan kontrolü şart.
//  · `enabled=false` → hiçbir dinleyici/zamanlayıcı kurulmaz (bayrak kapalı).
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { dayKey, msUntilNextDay } from './dayClock';

/** Ön plana dönüşte iki yenileme arası en az (çok kısa geçişlerde istek yağmuru yok). */
export const RESUME_MIN_GAP_MS = 15_000;

export function useDayRollover(opts: {
  enabled: boolean;
  onNewDay: (key: string) => void;
  onResume?: () => void;
}): string {
  const { enabled } = opts;
  const [key, setKey] = useState(() => dayKey());
  const keyRef = useRef(key);
  const cb = useRef(opts);
  cb.current = opts;
  const lastResume = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = (fromResume: boolean) => {
      const k = dayKey();
      if (k !== keyRef.current) {
        keyRef.current = k;
        setKey(k);
        cb.current.onNewDay(k);
      } else if (fromResume) {
        const now = Date.now();
        if (now - lastResume.current >= RESUME_MIN_GAP_MS) {
          lastResume.current = now;
          cb.current.onResume?.();
        }
      }
    };
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        check(false);
        arm();
      }, msUntilNextDay() + 1000);
    };
    arm();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        check(true);
        arm();
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [enabled]);

  return key;
}
