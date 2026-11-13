// G42-S1 md.2 — Sol kenardan kaydırarak geri (sistem geri hareketi). react-native-gesture-handler bu
// projede yüklü değil (yeni paket yasak) → PanResponder; Android donanım geri tuşu BackHandler ile.
import { useEffect, useRef } from 'react';
import { BackHandler, PanResponder, type GestureResponderHandlers } from 'react-native';

export function useEdgeBack(onBack: (() => void) | null, width = 390): GestureResponderHandlers {
  const cb = useRef(onBack);
  cb.current = onBack;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!cb.current) return false;
      cb.current();
      return true;
    });
    return () => sub.remove();
  }, []);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (e, g) => !!cb.current && e.nativeEvent.pageX - g.dx < 28 && g.dx > 10 && Math.abs(g.dy) < 24,
      onPanResponderRelease: (_e, g) => {
        if (g.dx > width * 0.3 || g.vx > 0.7) cb.current?.();
      },
    }),
  ).current;
  return pan.panHandlers;
}
