// G18-S4 md.1 — Sekme değişimi (FinMoTokens premium geçiş seti, satır 1):
// "fast 200 · standard · içerik crossfade; her sekmenin kaydırma konumu korunur".
//
// R3 Tab.Navigator'ın `screenLayout`u — her sekme sahnesini sarar. Sekme SEÇİLİNCE içerik
// PREMIUM.tab (fast 200 · standard) ile 0 → 1 opaklıkta belirir. Sekmeler mount'ta kalır
// (bottom-tabs varsayılanı) → kaydırma konumu korunur; yalnız opaklık değişir (yer
// değiştirme/ölçek yok → azaltılmış harekette de aynı 200 ms opaklık, FinMoTokens kuralı).
//
// 24.09.2026 notu (AppNavigator): navigatörün kendi `animation: 'fade' | 'shift'`
// seçenekleri, ilerleme değeri activityState/donma ile aynı değeri paylaştığı için
// ekranı görünmez bırakabiliyordu. Burada animasyon navigatörden BAĞIMSIZ (Reanimated,
// UI thread); ilk mount'ta animasyon yok (opaklık 1).
//
// G30-S1 md.3 — "YANIP SÖNME" KÖK NEDENİ: önceden tetik `useIsFocused()` idi. React Navigation'da
// bir ekran ancak ÜST navigatörü de odaktaysa "focused" sayılır → kök yığına herhangi bir ekran
// (Profil alt sayfaları, Tara, Koç, Keşfet gönderisi, ödeme…) itilince etkin sekme "odak kaybı",
// geri dönünce "odak kazanımı" yaşıyor ve içerik 0'a çekilip 200 ms'de geri geliyordu. Geri
// düğmesinde pop sırasında alttaki sayfa boş görünüyor, kenardan kaydırarak geri dönüşte ise
// içerik tam görünürken jest bitince bir anda kaybolup beliriyordu. Artık tetik YALNIZ sekme
// navigatörünün kendi seçimi (etkin sekme anahtarı) — üst yığının odak değişimi yok sayılır.
import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useNavigationState, useRoute } from '@react-navigation/native';
import { PREMIUM } from '../../core/design/motion';

/** Solma YALNIZ sekme seçilmemişken seçilince (başka sekmeden gelince); ilk açılışta ve üst yığın dönüşünde yok. */
export function shouldFadeOnSelect(wasSelected: boolean, selected: boolean): boolean {
  return selected && !wasSelected;
}

/** Sekme navigatörü durumundan etkin sekmenin anahtarı. */
export function activeTabKey(state: { index?: number; routes?: { key: string }[] } | undefined | null): string | null {
  const routes = state?.routes;
  if (!routes?.length) return null;
  return routes[state?.index ?? 0]?.key ?? null;
}

export function TabSceneFade({ children }: { children: React.ReactNode }) {
  const route = useRoute();
  // Bu bağlamın navigasyon durumu = sekme navigatörünün durumu (screenLayout rota bağlamında).
  const activeKey = useNavigationState((s) => activeTabKey(s as never));
  const selected = activeKey == null ? true : activeKey === route.key;
  const opacity = useSharedValue(1);
  const wasSelected = useRef(selected);

  useEffect(() => {
    if (shouldFadeOnSelect(wasSelected.current, selected)) {
      opacity.value = 0;
      opacity.value = withTiming(1, { duration: PREMIUM.tab.duration, easing: PREMIUM.tab.curve });
    }
    wasSelected.current = selected;
  }, [selected, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

/** `Tab.Navigator screenLayout` için. */
export function tabSceneLayout({ children }: { children: React.ReactElement }): React.ReactElement {
  return <TabSceneFade>{children}</TabSceneFade>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
