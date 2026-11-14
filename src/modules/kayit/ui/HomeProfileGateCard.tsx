// G47-S1 md.3 — Profil yokken Ana sayfa takip bölümünün (halka, makrolar, "Bugün", "İlk öğününü ekle") yerine tek kart:
// "Planını oluştur — günlük kalori hedefin ve takibin için 1 dakika" + lime "Başla" → kayıt akışı. Cam kupa = hedef.
// Ana sayfa kartlarıyla aynı yüzey (kişisel plan kartı ölçüleri); dokunma ≥ 44 pt, VoiceOver tek etiket + düğme.
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../core/design/components/AppText';
import { haptic } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { GLASS, usePp } from '../../personalPlan/ui/parts';

export function HomeProfileGateCard({ onStart }: { onStart: () => void }) {
  const { t } = useT();
  const P = usePp();
  return (
    <View testID="home-profile-gate" style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}>
      <View style={styles.row} accessible accessibilityLabel={`${t('kayit.gate.title')}. ${t('kayit.gate.sub')}`}>
        <Image source={GLASS.trophy} style={styles.glass} resizeMode="contain" />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText textRole="section" accessibilityRole="header" maxFontSizeMultiplier={1.3} style={{ color: P.ink }}>
            {t('kayit.gate.title')}
          </AppText>
          <AppText textRole="bodySm" maxFontSizeMultiplier={1.3} style={{ color: P.sec }}>
            {t('kayit.gate.sub')}
          </AppText>
        </View>
      </View>
      <Pressable
        testID="home-profile-gate-start"
        onPress={() => {
          haptic('light');
          onStart();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('kayit.gate.cta')}
        accessibilityHint={t('kayit.gate.sub')}
        style={({ pressed }) => [styles.cta, { backgroundColor: P.accent, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <AppText textRole="body" maxFontSizeMultiplier={1.3} style={{ color: P.onAccent, fontWeight: '800' }}>
          {t('kayit.gate.cta')}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 16, marginHorizontal: 16, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  glass: { width: 64, height: 56 },
  cta: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
