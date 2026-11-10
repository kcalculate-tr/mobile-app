// G22-S1 md.2 — "Elle gir" belirme kancası: Modal kendi kayma animasyonu OLMADAN (animationType
// "none") açılır; zemin ve katman manualAppearSpec'e göre belirir/kaybolur. Kapanışta animasyon
// bitince Modal kaldırılır (mounted=false).
import { useEffect, useState } from 'react';
import { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CURVE, DURATION, REDUCED, useReducedMotion } from '../../core/design';
import { MANUAL_SCALE_FROM, MANUAL_SCRIM_OPACITY, manualAppearSpec } from './manualAppear';

const TOKENS = { base: DURATION.base, fast: DURATION.fast, reduced: REDUCED.duration };

export function useManualAppear(visible: boolean) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const scrim = useSharedValue(visible ? MANUAL_SCRIM_OPACITY : 0);
  const op = useSharedValue(visible ? 1 : 0);
  const sc = useSharedValue(visible || reduced ? 1 : MANUAL_SCALE_FROM);

  useEffect(() => {
    if (visible) setMounted(true);
    if (!visible && !mounted) return;
    const spec = manualAppearSpec(visible, reduced, TOKENS);
    const easing = CURVE[spec.curve];
    const cfg = { duration: spec.duration, easing };
    if (visible) {
      scrim.value = spec.scrim.from;
      op.value = spec.opacity.from;
      sc.value = spec.scale ? spec.scale.from : 1;
    }
    scrim.value = withTiming(spec.scrim.to, cfg);
    sc.value = spec.scale ? withTiming(spec.scale.to, cfg) : 1;
    op.value = withTiming(spec.opacity.to, cfg, (done) => {
      if (done && !visible) runOnJS(setMounted)(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value / MANUAL_SCRIM_OPACITY }));
  const sheetStyle = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));
  return { mounted: visible || mounted, scrimStyle, sheetStyle };
}
