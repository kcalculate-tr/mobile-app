// G34-S1 md.5 · Tur 26o 04 "Oluştur (plandan)" — G33 "Planı benim için oluştur" formu kişisel
// plandan okur: hedef ve tercihler burada YENİDEN SORULMAZ (özet + "Düzenle" → Planı düzenle).
// Plan yoksa form yerine akışa yönlendiren kart.
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../core/design/components/AppText';
import { useT } from '../../../core/i18n';
import { effectiveTargets, type PpSaved } from '../types';
import { GLASS, PpButton, usePp } from './parts';

export function PersonalPlanFormSummary({ saved, onEdit }: { saved: PpSaved; onEdit: () => void }) {
  const i18n = useT();
  const P = usePp();
  const t = effectiveTargets(saved);
  const a = saved.answers;
  const rows: [string, string][] = [
    [i18n.t('pp.form_diet'), i18n.t(`pp.diet_${a.diet}`)],
    [i18n.t('pp.form_meals'), i18n.t('pp.mine_meals_v', { main: a.meals.main, snack: a.meals.snack })],
    [i18n.t('pp.form_allergy'), a.allergens.length ? a.allergens.map((x) => i18n.t(`pp.al_${x}`)).join(', ') : i18n.t('pp.form_none')],
  ];
  return (
    <View testID="pp-form-summary" style={{ marginTop: 16 }}>
      <View style={styles.head}>
        <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700', flex: 1 }} accessibilityRole="header">
          {i18n.t('pp.form_from_plan')}
        </AppText>
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={i18n.t('pp.edit_a11y', { label: i18n.t('pp.form_from_plan') })} hitSlop={6} style={styles.edit} testID="pp-form-edit">
          <AppText textRole="helper" style={{ color: P.ink, textDecorationLine: 'underline' }}>
            {i18n.t('pp.edit')}
          </AppText>
        </Pressable>
      </View>
      <View style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.tile, { backgroundColor: P.field }]} accessible accessibilityLabel={`${i18n.t('pp.edit_kcal')} ${t.calories} ${i18n.t('pp.kcal')}`}>
            <Image source={GLASS.flame} style={{ width: 18, height: 22 }} resizeMode="contain" />
            <View>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.edit_kcal')}
              </AppText>
              <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                {t.calories} {i18n.t('pp.kcal')}
              </AppText>
            </View>
          </View>
          <View style={[styles.tile, { backgroundColor: P.field }]} accessible accessibilityLabel={`${i18n.t('pp.protein')} ${t.protein} ${i18n.t('pp.g')}`}>
            <Image source={GLASS.trophy} style={{ width: 20, height: 18 }} resizeMode="contain" />
            <View>
              <AppText textRole="helper" style={{ color: P.sec }}>
                {i18n.t('pp.protein')}
              </AppText>
              <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
                {t.protein} {i18n.t('pp.g')}
              </AppText>
            </View>
          </View>
        </View>
        {rows.map(([k, v]) => (
          <View key={k} style={[styles.row, { borderTopColor: P.line }]} accessible accessibilityLabel={`${k}, ${v}`}>
            <AppText textRole="helper" style={{ color: P.sec, flex: 1 }}>
              {k}
            </AppText>
            <AppText textRole="helper" style={{ color: P.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>
              {v}
            </AppText>
          </View>
        ))}
      </View>
      <AppText textRole="helper" style={{ color: P.sec, marginTop: 8 }}>
        {i18n.t('pp.form_note')}
      </AppText>
    </View>
  );
}

export function PersonalPlanNeeded({ onCreate }: { onCreate: () => void }) {
  const i18n = useT();
  const P = usePp();
  return (
    <View style={[styles.card, { backgroundColor: P.surface, borderColor: P.surfaceEdge, marginTop: 16, alignItems: 'center', gap: 10 }]} testID="pp-form-needed">
      <Image source={GLASS.trophy} style={{ width: 64, height: 56 }} resizeMode="contain" />
      <AppText textRole="bodySm" style={{ color: P.ink, textAlign: 'center' }}>
        {i18n.t('pp.plan_form_need')}
      </AppText>
      <PpButton label={i18n.t('pp.plan_form_need_cta')} onPress={onCreate} style={{ alignSelf: 'stretch' }} testID="pp-form-create" />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  edit: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 6 },
});
