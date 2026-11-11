// G33-S1 md.6 — Ekle sayfası (FinPlanAdd): Tarif / eatkcal / Kendi öğünüm sekmeleri. Ücretsiz.
// eatkcal yalnız İzmir: İzmir dışında "eatkcal şimdilik yalnız İzmir'de" + Tariflere geç.
// Hareket: sheet 330 enter / 220 exit (Sheet bileşeni, AI yayı), segment değişince liste 220 crossfade.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { AppText, PLAN_MOTION, REDUCED, Sheet, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { MagnifyingGlass, Plus, Info } from '../../../components/icons';
import { formatPrice } from '../../../lib/money';
import type { EatkcalOption, PlanItem, RecipeInfo, Slot } from '../types';
import { eatkcalItem, localId, recipeItem } from '../generate';
import { GLASS, MiniChip, Thumb, usePlanTones } from './parts';
import { Image } from 'react-native';

type Tab = 'recipe' | 'eatkcal' | 'custom';

export function AddSheet({
  visible,
  slot,
  date,
  dateLabel,
  recipes,
  eatkcal,
  izmir,
  lang,
  onClose,
  onAdd,
}: {
  visible: boolean;
  slot: Slot;
  date: string;
  dateLabel: string;
  recipes: readonly RecipeInfo[];
  eatkcal: readonly EatkcalOption[];
  izmir: boolean;
  lang: 'tr' | 'en';
  onClose: () => void;
  onAdd: (it: PlanItem) => void;
}) {
  const c = usePlanTones();
  const { t: tr } = useT();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<Tab>('recipe');
  const [q, setQ] = useState('');
  useEffect(() => {
    if (visible) {
      setQ('');
      setTab('recipe');
    }
  }, [visible, slot, date]);

  const norm = (s: string) => s.toLocaleLowerCase(lang === 'en' ? 'en' : 'tr');
  const recipeList = useMemo(() => {
    const qq = norm(q.trim());
    const list = qq ? recipes.filter((r) => norm(lang === 'en' ? r.nameEn : r.nameTr).includes(qq)) : recipes.filter((r) => r.slot === slot);
    return list.slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, q, slot, lang]);
  const eatList = useMemo(() => {
    const qq = norm(q.trim());
    return (qq ? eatkcal.filter((o) => norm(o.name).includes(qq)) : eatkcal).slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eatkcal, q]);

  const slotTo = tr(`plan.slot_to.${slot}`);
  const enter = reduced ? FadeIn.duration(REDUCED.duration) : FadeIn.duration(PLAN_MOTION.segment);
  const exit = reduced ? FadeOut.duration(REDUCED.duration) : FadeOut.duration(PLAN_MOTION.segment);

  return (
    <Sheet visible={visible} onClose={onClose} title={tr('plan.add_title', { slot: slotTo })} testID="plan-add-sheet" scroll maxHeightRatio={0.86}>
      <AppText style={[styles.sub, { color: c.sec }]}>{dateLabel}</AppText>
      <View style={[styles.seg, { backgroundColor: c.nested }]} accessibilityRole="tablist">
        {(['recipe', 'eatkcal', 'custom'] as Tab[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => {
              haptic('selection');
              setTab(k);
              setQ('');
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === k }}
            style={[styles.segBtn, tab === k ? { backgroundColor: c.card } : null]}
            testID={`plan-add-tab-${k}`}
          >
            <AppText style={[styles.segText, { color: c.ink }]}>{tr(k === 'recipe' ? 'plan.tab_recipe' : k === 'eatkcal' ? 'plan.tab_eatkcal' : 'plan.tab_custom')}</AppText>
          </Pressable>
        ))}
      </View>

      <Animated.View key={tab} entering={enter} exiting={exit} style={styles.body}>
        {tab === 'recipe' ? (
          <>
            <Search value={q} onChange={setQ} placeholder={tr('plan.search_recipe')} />
            <View style={[styles.list, { backgroundColor: c.card }]}>
              {recipeList.length ? (
                recipeList.map((r, i) => (
                  <Row
                    key={r.key}
                    first={i === 0}
                    name={lang === 'en' ? r.nameEn : r.nameTr}
                    chips={[`${r.macros.kcal} kcal`, `P ${Math.round(r.macros.protein)} g`]}
                    onAdd={() => onAdd(recipeItem(r, date, slot, 1, lang))}
                  />
                ))
              ) : (
                <AppText style={[styles.empty, { color: c.sec }]}>{tr('plan.no_results')}</AppText>
              )}
            </View>
          </>
        ) : null}

        {tab === 'eatkcal' ? (
          izmir ? (
            <>
              <Search value={q} onChange={setQ} placeholder={tr('plan.search_eatkcal')} />
              <View style={styles.noteRow}>
                <Info size={14} color={c.sec} />
                <AppText style={[styles.note, { color: c.sec }]}>{tr('plan.eatkcal_note')}</AppText>
              </View>
              <View style={[styles.list, { backgroundColor: c.card }]}>
                {eatList.length ? (
                  eatList.map((o, i) => (
                    <Row
                      key={o.id}
                      first={i === 0}
                      name={o.name}
                      chips={[`${Math.round(o.kcal)} kcal`, `P ${Math.round(o.protein)} g`]}
                      lime
                      price={o.price != null ? formatPrice(o.price) : null}
                      onAdd={() => onAdd(eatkcalItem(o, date, slot))}
                    />
                  ))
                ) : (
                  <AppText style={[styles.empty, { color: c.sec }]}>{tr('plan.no_results')}</AppText>
                )}
              </View>
            </>
          ) : (
            <View style={[styles.izmir, { backgroundColor: c.card }]} testID="plan-add-izmir">
              <View style={[styles.izmirGlass, { backgroundColor: c.nested }]}>
                <Image source={GLASS.bowl} style={styles.izmirImg} resizeMode="contain" />
              </View>
              <AppText style={[styles.izmirTitle, { color: c.ink }]} accessibilityRole="header">
                {tr('plan.izmir_title')}
              </AppText>
              <AppText style={[styles.izmirBody, { color: c.sec }]}>{tr('plan.izmir_body')}</AppText>
              <Pressable onPress={() => setTab('recipe')} accessibilityRole="button" style={[styles.blackBtn, { backgroundColor: c.chipSel }]}>
                <AppText style={[styles.blackBtnText, { color: c.chipSelInk }]}>{tr('plan.izmir_cta')}</AppText>
              </Pressable>
            </View>
          )
        ) : null}

        {tab === 'custom' ? <CustomForm onSave={(v) => onAdd({ id: localId('custom'), date, slot, source: 'custom', refId: null, name: v.name, portion: 1, kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat, loggedId: null, price: null })} /> : null}
      </Animated.View>
    </Sheet>
  );
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder: string }) {
  const c = usePlanTones();
  return (
    <View style={[styles.search, { backgroundColor: c.nested }]}>
      <MagnifyingGlass size={18} color={c.sec} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.sec}
        style={[styles.searchInput, { color: c.ink }]}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        testID="plan-add-search"
      />
    </View>
  );
}

function Row({ name, chips, onAdd, first, lime, price }: { name: string; chips: string[]; onAdd: () => void; first?: boolean; lime?: boolean; price?: string | null }) {
  const c = usePlanTones();
  const { t: tr } = useT();
  return (
    <View style={[styles.row, first ? null : { borderTopWidth: 1, borderTopColor: c.line }]}>
      <Thumb size={44} />
      <View style={styles.flex1}>
        <AppText style={[styles.rowName, { color: c.ink }]} numberOfLines={2}>
          {name}
        </AppText>
        <View style={styles.chipRow}>
          {lime ? <MiniChip text="eatkcal" lime /> : null}
          {chips.map((x) => (
            <MiniChip key={x} text={x} />
          ))}
        </View>
        {price ? <AppText style={[styles.price, { color: c.sec }]}>{price}</AppText> : null}
      </View>
      <Pressable
        onPress={() => {
          haptic('success');
          onAdd();
        }}
        accessibilityRole="button"
        accessibilityLabel={tr('plan.add_item_a11y', { name, kcal: chips[0] })}
        style={[styles.plus, { backgroundColor: c.lime }]}
        hitSlop={4}
      >
        <Plus size={18} color={c.onLime} weight="bold" />
      </Pressable>
    </View>
  );
}

function CustomForm({ onSave }: { onSave: (v: { name: string; kcal: number; protein: number; carbs: number; fat: number }) => void }) {
  const c = usePlanTones();
  const { t: tr } = useT();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [cb, setCb] = useState('');
  const [f, setF] = useState('');
  const n = (s: string) => {
    const v = Number(s.replace(',', '.'));
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };
  const kcalN = Math.round(n(kcal));
  const ok = name.trim().length > 0 && kcalN > 0 && kcalN <= 5000;
  const field = (label: string, v: string, set: (s: string) => void, ph?: string, numeric = true) => (
    <View style={styles.field}>
      <AppText style={[styles.fieldLabel, { color: c.sec }]}>{label}</AppText>
      <TextInput
        value={v}
        onChangeText={set}
        placeholder={ph}
        placeholderTextColor={c.sec}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        style={[styles.input, { backgroundColor: c.nested, color: c.ink }]}
        accessibilityLabel={label}
        maxLength={numeric ? 6 : 120}
      />
    </View>
  );
  return (
    <View style={styles.form} testID="plan-add-custom">
      {field(tr('plan.custom_name'), name, setName, tr('plan.custom_name_ph'), false)}
      {field(tr('plan.custom_kcal'), kcal, setKcal)}
      <View style={styles.formRow}>
        <View style={styles.flex1}>{field(tr('plan.custom_protein'), p, setP)}</View>
        <View style={styles.flex1}>{field(tr('plan.custom_carbs'), cb, setCb)}</View>
        <View style={styles.flex1}>{field(tr('plan.custom_fat'), f, setF)}</View>
      </View>
      <Pressable
        disabled={!ok}
        onPress={() => {
          haptic('success');
          onSave({ name: name.trim(), kcal: kcalN, protein: n(p), carbs: n(cb), fat: n(f) });
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ok }}
        style={[styles.save, { backgroundColor: c.lime, opacity: ok ? 1 : 0.5 }]}
        testID="plan-add-custom-save"
      >
        <AppText style={[styles.saveText, { color: c.onLime }]}>{tr('plan.custom_save')}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  sub: { fontSize: 13, marginTop: -6, marginBottom: 10 },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 3 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 14, fontWeight: '600' },
  body: { marginTop: 12, gap: 10 },
  search: { minHeight: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, minHeight: 44 },
  list: { borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  rowName: { fontSize: 15, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  price: { fontSize: 13, marginTop: 4 },
  plus: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 16, fontSize: 15, textAlign: 'center' },
  noteRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  note: { flex: 1, fontSize: 13, lineHeight: 18 },
  izmir: { borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
  izmirGlass: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  izmirImg: { width: 46, height: 32 },
  izmirTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  izmirBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  blackBtn: { marginTop: 6, minHeight: 44, borderRadius: 22, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  blackBtnText: { fontSize: 15, fontWeight: '700' },
  form: { gap: 10 },
  formRow: { flexDirection: 'row', gap: 8 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '500' },
  input: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, fontSize: 16 },
  save: { marginTop: 6, minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '700' },
});
