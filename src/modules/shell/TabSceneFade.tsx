// G18-S4 md.1 — Sekme değişimi (FinMoTokens premium geçiş seti, satır 1):
// "fast 200 · standard · içerik crossfade; her sekmenin kaydırma konumu korunur".
//
// R3 Tab.Navigator'ın `screenLayout`u — her sekme sahnesini sarar. Sekme odağa
// gelince içerik PREMIUM.tab (fast 200 · standard) ile 0 → 1 opaklıkta belirir.
// Sekmeler mount'ta kalır (bottom-tabs varsayılanı) → kaydırma konumu korunur;
// yalnız opaklık değişir (yer değiştirme/ölçek yok → azaltılmış harekette de aynı
// 200 ms opaklık, FinMoTokens "Azaltılmış" kuralı).
//
// 24.09.2026 notu (AppNavigator): navigatörün kendi `animation: 'fade' | 'shift'`
// seçenekleri, ilerleme değeri activityState/donma ile aynı değeri paylaştığı için
// ekranı görünmez bırakabiliyordu. Burada animasyon navigatörden BAĞIMSIZ (Reanimated,
// UI thread) ve yalnız odak olayına bağlı; ilk mount'ta animasyon yok (opaklık 1).
import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { PREMIUM } from '../../core/design/motion';

export function TabSceneFade({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();
  const opacity = useSharedValue(1);
  const wasFocused = useRef(focused);

  useEffect(() => {
    // Yalnız odak KAZANIMINDA (başka sekmeden gelince) çapraz solma; ilk açılışta yok.
    if (focused && !wasFocused.current) {
      opacity.value = 0;
      opacity.value = withTiming(1, { duration: PREMIUM.tab.duration, easing: PREMIUM.tab.curve });
    }
    wasFocused.current = focused;
  }, [focused, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

/** `Tab.Navigator screenLayout` için. */
export function tabSceneLayout({ children }: { children: React.ReactElement }): React.ReactElement {
  return <TabSceneFade>{children}</TabSceneFade>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
