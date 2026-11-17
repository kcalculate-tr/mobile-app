// G59-S1 — Reduce Transparency (cam yüzeyler düz #1C1C1E olur; tasarım `prefers-reduced-transparency`).
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceTransparency(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((v) => {
        if (alive) setOn(!!v);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', (v: boolean) => setOn(!!v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return on;
}
