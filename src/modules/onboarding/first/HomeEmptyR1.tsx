// G18-S1 md.7 — FinHomeEmptyR1 boş hâl İÇERİĞİ (bileşenler burada; Ana sayfa
// yerleşimi/montajı S2 — FinHomeR3). Parçalar:
//   · HomeEmptyRing      — boş Gün halkası (152 · r70 · 12 pt). Hedef yoksa iz kesikli
//                          (4 8), cam damla küçük (44×59) + "Hedef belirlenmedi".
//   · HomeFirstMealCard  — "İlk öğününü ekle" + Tara (lime) · Elle gir (çerçeve).
//   · HomeEmptyToday     — "Henüz kayıt yok…" + TEK "Örnek öğün · Demo" kartı.
//                          Demo kart günlüğe/halkaya YAZILMAZ (yalnız görsel; hiçbir
//                          kayıt fonksiyonu çağrılmaz, dokunulamaz).
// Hareket yok (boşta döngü yok).
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '../../../core/design/components/AppText';
import { haptic } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { BRICOLAGE_SEMI, LIME, LIME_INK, useHomeTokens } from './homeTokens';

const SCAN_PATHS = [
  'M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8',
  'M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8',
  'M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16',
  'M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16',
  'M16.92 11.13A5 5 0 1 1 13.71 7.3A2.6 2.6 0 0 0 16.92 11.13Z',
];
const PENCIL_D =
  'M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z';

export function HomeEmptyRing({ hasTarget }: { hasTarget: boolean }) {
  const k = useHomeTokens();
  const i18n = useT();
  return (
    <View style={styles.ring} testID="fin-home-empty-ring">
      <Svg width={152} height={152} viewBox="0 0 152 152" style={StyleSheet.absoluteFill}>
        <Circle
          cx={76}
          cy={76}
          r={70}
          fill="none"
          stroke={k.track}
          strokeWidth={12}
          strokeDasharray={hasTarget ? undefined : '4 8'}
        />
      </Svg>
      <View style={styles.ringCore}>
        <Image
          source={require('../../../../assets/glass/drop.png')}
          style={hasTarget ? styles.dropBig : styles.dropSmall}
          resizeMode="contain"
        />
        {!hasTarget ? (
          <AppText style={[styles.noTarget, { color: k.sec }]}>{i18n.t('onboarding.home_empty.no_target')}</AppText>
        ) : null}
      </View>
    </View>
  );
}

export function HomeFirstMealCard({ onScan, onManual }: { onScan: () => void; onManual: () => void }) {
  const k = useHomeTokens();
  const i18n = useT();
  return (
    <View style={styles.pad} testID="fin-home-first-meal">
      <View
        accessibilityLabel={i18n.t('onboarding.home_empty.first_title')}
        style={[styles.card, { backgroundColor: k.card, borderColor: k.line }]}
      >
        <View style={{ gap: 4 }}>
          <AppText style={[styles.h2, { color: k.text }]} accessibilityRole="header">
            {i18n.t('onboarding.home_empty.first_title')}
          </AppText>
          <AppText style={[styles.p, { color: k.sec }]}>{i18n.t('onboarding.home_empty.first_sub')}</AppText>
        </View>
        <View style={styles.grid}>
          <Pressable
            onPress={() => {
              haptic('light');
              onScan();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.btn, { backgroundColor: LIME, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              {SCAN_PATHS.map((d) => (
                <Path key={d} d={d} stroke={LIME_INK} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </Svg>
            <AppText style={[styles.btnText, { color: LIME_INK }]}>{i18n.t('onboarding.home_empty.scan')}</AppText>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic('light');
              onManual();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.btn, styles.btnOutline, { borderColor: k.line2, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Svg width={18} height={18} viewBox="0 0 256 256">
              <Path d={PENCIL_D} fill={k.text} />
            </Svg>
            <AppText style={[styles.btnText, { color: k.text }]}>{i18n.t('onboarding.home_empty.manual')}</AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function HomeEmptyToday() {
  const k = useHomeTokens();
  const i18n = useT();
  return (
    <View style={[styles.today, { borderTopColor: k.line }]} testID="fin-home-empty-today">
      <AppText style={[styles.p, { color: k.sec }]}>{i18n.t('onboarding.home_empty.none')}</AppText>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={i18n.t('onboarding.home_empty.demo_a11y')}
        style={[styles.demo, { borderColor: k.line2 }]}
        testID="fin-home-demo"
      >
        <View style={styles.row8}>
          <AppText style={[styles.demoLabel, { color: k.text }]}>{i18n.t('onboarding.home_empty.demo_label')}</AppText>
          <View style={[styles.badge, { backgroundColor: k.ink }]}>
            <AppText style={[styles.badgeText, { color: k.onInk }]}>{i18n.t('onboarding.home_empty.demo_badge')}</AppText>
          </View>
        </View>
        <View style={styles.row12}>
          <View style={[styles.photo, { backgroundColor: k.ph }]}>
            <AppText style={[styles.photoText, { color: k.phText }]}>{i18n.t('onboarding.home_empty.demo_photo')}</AppText>
          </View>
          <View style={styles.flex}>
            <AppText style={[styles.name, { color: k.text }]}>{i18n.t('onboarding.home_empty.demo_name')}</AppText>
            <AppText style={[styles.small, { color: k.sec }]}>{i18n.t('onboarding.home_empty.demo_meal')}</AppText>
          </View>
          <AppText style={[styles.name, { color: k.text }]}>{i18n.t('onboarding.home_empty.demo_kcal')}</AppText>
        </View>
        <AppText style={[styles.small, { color: k.sec }]}>{i18n.t('onboarding.home_empty.demo_note')}</AppText>
      </View>
    </View>
  );
}

/** Vitrin/önizleme için üç parça bir arada (Ana sayfa montajı S2'de). */
export function HomeEmptyR1({
  hasTarget,
  onScan,
  onManual,
  between,
}: {
  hasTarget: boolean;
  onScan: () => void;
  onManual: () => void;
  /** İlk öğün kartının altına (ör. HomeOnboardingSlot). */
  between?: React.ReactNode;
}) {
  return (
    <View>
      <View style={styles.ringRow}>
        <HomeEmptyRing hasTarget={hasTarget} />
      </View>
      <HomeFirstMealCard onScan={onScan} onManual={onManual} />
      {between}
      <HomeEmptyToday />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { width: 152, height: 152 },
  ringRow: { paddingHorizontal: 16, paddingTop: 12 },
  ringCore: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dropBig: { width: 64, height: 86 },
  dropSmall: { width: 44, height: 59 },
  noTarget: { maxWidth: 100, textAlign: 'center', fontSize: 13, lineHeight: 16, fontFamily: 'PlusJakartaSans_600SemiBold' },
  pad: { paddingTop: 12, paddingHorizontal: 16 },
  card: { padding: 16, borderRadius: 20, borderWidth: 1, gap: 12 },
  h2: { fontFamily: BRICOLAGE_SEMI, fontSize: 20, lineHeight: 25 },
  p: { fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, minWidth: 0, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnOutline: { borderWidth: 1 },
  btnText: { fontFamily: BRICOLAGE_SEMI, fontSize: 17, lineHeight: 22 },
  today: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, gap: 12 },
  demo: { padding: 12, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', gap: 10 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row12: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  demoLabel: { fontSize: 13, lineHeight: 17, fontFamily: 'PlusJakartaSans_600SemiBold' },
  badge: { height: 22, paddingHorizontal: 8, borderRadius: 11, justifyContent: 'center' },
  badgeText: { fontSize: 13, lineHeight: 17, fontFamily: 'PlusJakartaSans_700Bold' },
  photo: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  photoText: { fontSize: 13, lineHeight: 17 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_500Medium' },
  small: { fontSize: 13, lineHeight: 17 },
});
