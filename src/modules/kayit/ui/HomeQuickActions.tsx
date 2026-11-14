// G49-S1 md.3 — "Neler yapabilirsin" hızlı eylemleri (YALNIZ profilsiz Ana sayfa, plan kartının hemen altında).
// Kompakt kart: cam nesne + kısa başlık + tek satır alt metin. Gezinme kuralı çağıranda (TrackerScreen):
// Tara · Etkinlik G47 profil kapısından geçer (dokununca kayıt akışı; bitince dokunulan eyleme dönülür),
// Paylaş Keşfet kuralıyla (oturum yoksa AuthSheet). Giriş: 8 pt yukarı + fade 220 ms, kademe 50 ms (toplam 150);
// basışta 0,98. Azaltılmış harekette yalnız opaklık (REDUCED.duration). Dokunma alanı ≥ 44 pt (kart ≥ 88 pt).
// G51-S1 md.1: lime kare zemindeki çizgi ikonlar yerine uygulamanın cam nesneleri (assets/glass, ~52 pt, zeminsiz,
// açık + koyu temada aynı PNG, diğer kullanımlar gibi düz Image): Tara = kamera · Paylaş = kase · Etkinlik = ayak izi.
// G51-S1 md.2: "Koç'a sor" ızgaradan çıktı (yerine ızgaranın altında mevcut CoachHomeCard). Izgara Tara + Paylaş
// (+ `etkinlik` açıksa Etkinlik): çiftler yan yana, tek kalan kart tam genişlik satır.
import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { AppText } from '../../../core/design/components/AppText';
import { HOME_GATE_MOTION, REDUCED, haptic, useReducedMotion } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { track } from '../../../lib/analytics';
import { BRICOLAGE_SEMI, useHomeTokens } from '../../onboarding/first/homeTokens';
import { devFrozenAt, frozenEnter } from './homeGateDev';

import type { QuickAction } from '../quickActions';

export type { QuickAction };
export const QUICK_ACTIONS: readonly QuickAction[] = ['scan', 'share', 'activity'];

/** Cam nesneler (sözlük: kase = öğün · ayak izi = etkinlik; kamera = tarama, Paywall'daki AI tarama nesnesi). */
export const QUICK_GLASS: Record<QuickAction, ImageSourcePropType> = {
  scan: require('../../../../assets/glass/camera.png'),
  share: require('../../../../assets/glass/bowl.png'),
  activity: require('../../../../assets/glass/foot.png'),
};
export const QUICK_GLASS_SIZE = 52;

/** Çiftler yan yana; tek kalan kart (3. kart ya da tek kart) tam genişlik satır. */
export function quickRows<T>(list: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
  return rows;
}

function ActionCard({ action, index, onPress }: { action: QuickAction; index: number; onPress: () => void }) {
  const k = useHomeTokens();
  const { t } = useT();
  const reduced = useReducedMotion();
  const frozen = devFrozenAt();
  const o = useSharedValue(frozen != null ? frozenEnter(frozen, index) : 0);
  useEffect(() => {
    const M = HOME_GATE_MOTION;
    if (frozen != null) return;
    if (reduced) o.value = withTiming(1, { duration: REDUCED.duration });
    else o.value = withDelay(index * M.actStagger, withTiming(1, { duration: M.actEnter, easing: M.actCurve }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const enter = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: reduced ? 0 : (1 - o.value) * HOME_GATE_MOTION.actShift }],
  }));
  const title = t(`kayit.gate.act_${action}`);
  const sub = t(`kayit.gate.act_${action}_sub`);
  return (
    <Animated.View style={[styles.cell, enter]}>
      <Pressable
        testID={`home-quick-${action}`}
        onPress={() => {
          haptic('light');
          track('home_plan_card_tap', { action });
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${sub}`}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: k.card, borderColor: k.line, transform: [{ scale: pressed ? HOME_GATE_MOTION.pressScale : 1 }] },
        ]}
      >
        <View style={styles.top}>
          <Image
            testID={`home-quick-${action}-glass`}
            source={QUICK_GLASS[action]}
            style={styles.glass}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          {/* G50 md.1/6b: kalan tarama hakkı rozeti (kota okunamazsa yok). */}
          {/* G54-S1 md.8: tarama rozeti kaldırıldı. */}
        </View>
        <AppText maxFontSizeMultiplier={1.3} style={[styles.title, { color: k.text }]}>
          {title}
        </AppText>
        <AppText maxFontSizeMultiplier={1.3} style={[styles.sub, { color: k.sec }]}>
          {sub}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

/** `actions`: gösterilecek eylemler (özelliği kapalı olan çağıranda çıkarılır); sıra sabit. */
export function HomeQuickActions({
  actions = QUICK_ACTIONS,
  onAction,
}: {
  actions?: readonly QuickAction[];
  onAction: (a: QuickAction) => void;
  /** G50 md.1/6b: "Tabağını tara" kartında kalan tarama rozeti (null → gizli). */
}) {
  const k = useHomeTokens();
  const { t } = useT();
  const list = QUICK_ACTIONS.filter((a) => actions.includes(a));
  if (list.length === 0) return null;
  const rows = quickRows(list);
  return (
    <View style={styles.section} testID="home-quick-actions">
      <AppText accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.h2, { color: k.text }]}>
        {t('kayit.gate.actions_title')}
      </AppText>
      <View style={styles.grid}>
        {rows.map((row, r) => (
          <View key={r} style={styles.row} testID={`home-quick-row-${r}`}>
            {row.map((a) => (
              <ActionCard key={a} action={a} index={list.indexOf(a)} onPress={() => onAction(a)} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 20 },
  h2: { fontFamily: BRICOLAGE_SEMI, fontSize: 20, lineHeight: 26, marginBottom: 10 },
  grid: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
  card: { flex: 1, minHeight: 104, borderRadius: 20, borderWidth: 1, padding: 14, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  // Ek RN gölgesi YOK: cam PNG'lerin kendi yumuşak kenar ışığı var ve uygulamadaki diğer kullanımlar (Paywall,
  // kişisel plan, öğün yuvaları) da düz Image (G51 LOG › KARAR).
  glass: { width: QUICK_GLASS_SIZE, height: QUICK_GLASS_SIZE },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, lineHeight: 20 },
  sub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, lineHeight: 17 },
});
