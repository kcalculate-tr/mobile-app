// G42-S1 md.9 — Ana sayfa "Planını geliştir" kartının YERİ (içerik ayrı tur). Yalnız `yeni_kayit` + `kisisel_plan`
// açıkken ve kişisel plan YOKKEN görünür (B yolu: kısa profil tamam → tam plan buradan başlar). Bayraklardan
// biri kapalıyken null; `yeni_kayit` açıkken G34 HomePlanCard bu yere devreder (çift kart yok).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, haptic } from '../../core/design';
import { useT } from '../../core/i18n';
import { useFeature } from '../../core/flags';
import { CaretRight } from '../../components/icons';
import { usePersonalPlanEntry, useOpenPersonalPlan } from '../personalPlan/ui/entries';
import { usePp } from '../personalPlan/ui/parts';

export function PlanImproveSlot() {
  const yeniKayit = useFeature('yeni_kayit');
  const { enabled, hasPlan, loaded } = usePersonalPlanEntry();
  const open = useOpenPersonalPlan();
  const { t } = useT();
  const P = usePp();
  if (!yeniKayit || !enabled || !loaded || hasPlan) return null;
  return (
    <Pressable
      testID="kayit-plan-improve"
      onPress={() => {
        haptic('light');
        open('home');
      }}
      accessibilityRole="button"
      accessibilityLabel={`${t('kayit.home.improve_title')}. ${t('kayit.home.improve_sub')}`}
      style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}
    >
      <View style={{ flex: 1 }}>
        <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
          {t('kayit.home.improve_title')}
        </AppText>
        <AppText textRole="helper" style={{ color: P.sec, marginTop: 2 }}>
          {t('kayit.home.improve_sub')}
        </AppText>
      </View>
      <CaretRight size={18} color={P.sec} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, borderWidth: 1, padding: 16, marginHorizontal: 16, marginTop: 12, minHeight: 64 },
});
