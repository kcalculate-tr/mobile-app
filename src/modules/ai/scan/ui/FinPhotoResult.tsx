/**
 * G12-S4 / G15-S2 — Tarama sonucu (FinPhotoR1 / FinPhotoEN / FinCollectCut).
 *
 * Final düzeni (G15-S2): üstte çekilen foto (geri 44 + "✓ N öğe bulundu"
 * hapı), altında sheet — "Tahmini toplam" + büyük kcal, Makrolar (halka ⇄
 * çubuk), öğe satırları (ad · kcal · çöp; gram alanı + ½·1·1½), "Eksik besin
 * ekle" (mevcut ürün araması, search_products), altta lime "{Öğün}'e logla ⌄"
 * ve kayıttan sonra mürekkep toast "✓ {Öğün}'e loglandı · Geri al · Gör".
 *
 * Kaydetme HER ZAMAN `saveAiScanEstimate`'i çağırır (ScanScreen) — burada yeni
 * kaydetme mantığı YOK; yalnız gram/porsiyon/eksik besin düzeltmesi hesaplanır.
 */
import React, { useEffect, useMemo, useState } from 'react';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText, ProgressRing, REDUCED, SPRING, haptic, useReducedMotion, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { BookmarkSimple, CalendarPlus, CaretDown, Check, Plus, Trash, X } from '../../../../components/icons';
import { RollingNumber } from '../../../gun/ui';
import type { NumLang } from '../../../gun/motion';
import type { ClientMealType } from '../../../../core/meal/mealType';
import type { ScanEstimate, ScanIngredient } from '../types';
import { getKesfetClient, type ProductSearchItem } from '../../../kesfet';

const PORTIONS = [0.5, 1, 1.5];
const MEAL_CYCLE: ClientMealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const SCAN_D =
  'M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8 M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8 M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16 M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16 M16.92 11.13A5 5 0 1 1 13.71 7.3A2.6 2.6 0 0 0 16.92 11.13Z';
const BARS_D = 'M4 6h16 M4 12h10 M4 18h6';

type Row = {
  name: string;
  baseGrams: number;
  baseKcal: number | null;
  grams: number;
  portion: number;
  removed: boolean;
  /** Eksik besin (ürün araması): 100 g başına makro → kesin makro katkısı. */
  per100?: { kcal: number; p: number; c: number; f: number };
};

function tokens(isDark: boolean) {
  return isDark
    ? { photo: '#2C2C2E', sheet: '#1C1C1E', glass: 'rgba(28,28,30,0.72)', line: '#2C2C2E', line2: '#48484A', track: '#2C2C2E', field: '#2C2C2E' }
    : { photo: '#D3D6DA', sheet: '#FFFFFF', glass: 'rgba(255,255,255,0.86)', line: '#E9EBEE', line2: '#C3C7CC', track: '#E3E5E9', field: '#FFFFFF' };
}

/** G17-S2 md.2 (FinMoScan "sonuç sheet'i"): alttan AI 260/24 yayıyla yerleşir. */
export const SHEET_ENTER_SHIFT = 320;
function useSheetEnter() {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = reduced ? withTiming(1, { duration: REDUCED.duration }) : withSpring(1, SPRING.ai);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return useAnimatedStyle(() =>
    reduced
      ? { opacity: v.value }
      : {
          opacity: interpolate(v.value, [0, 0.25], [0, 1], 'clamp'),
          transform: [{ translateY: interpolate(v.value, [0, 1], [SHEET_ENTER_SHIFT, 0]) }],
        },
  );
}

function rowKcal(r: Row): number {
  if (r.per100) return (r.per100.kcal * r.grams) / 100;
  if (r.baseKcal == null || r.baseGrams <= 0) return 0;
  return (r.baseKcal * r.grams) / r.baseGrams;
}

export default function FinPhotoResult({
  estimate,
  photoUri,
  mealType,
  saving,
  saved,
  lang,
  onChangeMealType,
  onSave,
  onRetry,
  onUndo,
  onView,
  reducedVariant: _reduced,
  onAddToPlan,
  onSaveMeal,
  match = null,
}: {
  /** "Planıma ekle" — yerel plan hatırlatması; izin yoksa false. */
  onAddToPlan?: (adjusted: Omit<ScanEstimate, 'isEstimate'>) => Promise<boolean>;
  /** "Bu öğünü kaydet" — tabak koleksiyonuna. */
  onSaveMeal?: (adjusted: Omit<ScanEstimate, 'isEstimate'>) => Promise<void>;
  /** Tek tabak sonucu: menüyle eşleşme yüzdesi (yoksa null → gösterilmez). */
  match?: number | null;
  estimate: Omit<ScanEstimate, 'isEstimate'>;
  photoUri: string | null;
  mealType: ClientMealType;
  saving: boolean;
  saved: boolean;
  lang: NumLang;
  onChangeMealType: (next: ClientMealType) => void;
  onSave: (adjusted: Omit<ScanEstimate, 'isEstimate'>) => void;
  /** Geri (sol üst) — yeniden çek. */
  onRetry: () => void;
  /** Kayıttan sonra toast "Geri al". */
  onUndo?: () => void;
  /** Kayıttan sonra toast "Gör" (Ana sayfa). */
  onView?: () => void;
  reducedVariant?: boolean;
}) {
  const t = useTheme();
  const k = tokens(t.isDark);
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const [bars, setBars] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toastHidden, setToastHidden] = useState(false);
  const [planDone, setPlanDone] = useState<null | 'ok' | 'denied'>(null);
  const [savedMeal, setSavedMeal] = useState(false);
  // G17-S2 md.2: sonuç sheet'i AI 260/24 yayıyla yerleşir; azaltılmışta 200 ms opaklık.
  const sheetIn = useSheetEnter();

  const [rows, setRows] = useState<Row[]>(() =>
    estimate.ingredients.map((ing: ScanIngredient) => ({
      name: ing.name,
      baseGrams: ing.grams,
      baseKcal: ing.kcal ?? null,
      grams: ing.grams,
      portion: 1,
      removed: false,
    })),
  );

  const baseKcalSum = useMemo(
    () => estimate.ingredients.reduce((s, i) => s + (i.kcal ?? 0), 0),
    [estimate.ingredients],
  );

  const adjusted = useMemo(() => {
    const scanned = rows.filter((r) => !r.removed && !r.per100);
    const extra = rows.filter((r) => !r.removed && r.per100);
    const scannedKcal = scanned.reduce((s, r) => s + rowKcal(r), 0);
    const scale = baseKcalSum > 0 ? scannedKcal / baseKcalSum : 1;
    const ex = extra.reduce(
      (a, r) => ({
        kcal: a.kcal + rowKcal(r),
        p: a.p + ((r.per100?.p ?? 0) * r.grams) / 100,
        c: a.c + ((r.per100?.c ?? 0) * r.grams) / 100,
        f: a.f + ((r.per100?.f ?? 0) * r.grams) / 100,
      }),
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
    return {
      ...estimate,
      kcal: Math.max(0, Math.round(estimate.kcal * scale + ex.kcal)),
      protein_g: Math.max(0, Math.round(estimate.protein_g * scale + ex.p)),
      carbs_g: Math.max(0, Math.round(estimate.carbs_g * scale + ex.c)),
      fat_g: Math.max(0, Math.round(estimate.fat_g * scale + ex.f)),
      ingredients: rows
        .filter((r) => !r.removed)
        .map((r) => ({ name: r.name, grams: Math.round(r.grams), kcal: Math.round(rowKcal(r)) })),
    };
  }, [rows, baseKcalSum, estimate]);

  const slot = mealType === 'breakfast' || mealType === 'lunch' || mealType === 'dinner' ? mealType : 'snack';
  const cycleMeal = () => {
    haptic('selection');
    const idx = MEAL_CYCLE.indexOf(mealType);
    onChangeMealType(MEAL_CYCLE[(idx + 1) % MEAL_CYCLE.length]);
  };
  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const count = rows.filter((r) => !r.removed).length;

  const kc = adjusted.kcal || 1;
  const shares = [
    { key: 'p', label: tr('ai_scan.macro_protein'), g: adjusted.protein_g, share: (adjusted.protein_g * 4) / kc, color: t.color.ink },
    { key: 'c', label: tr('ai_scan.macro_carbs'), g: adjusted.carbs_g, share: (adjusted.carbs_g * 4) / kc, color: t.color.secondary },
    { key: 'f', label: tr('ai_scan.macro_fat'), g: adjusted.fat_g, share: (adjusted.fat_g * 9) / kc, color: k.line2 },
  ];

  // G15-S2 (FinCollectCut): tek tabak tanındıysa (≤1 öğe) kompakt sonuç —
  // tam ekran foto + tabak adı hapı + "Fotoğraf sonucu" sheet'i + lime logla.
  // Eşleşme yüzdesi verisi yok → hapta yalnız ad (uydurma yok).
  if (estimate.ingredients.length <= 1) {
    return (
      <View style={[styles.fill, { backgroundColor: '#2A2622' }]}>
        {photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={tr('common.close')}
          accessibilityHint={tr('ai_scan.retry')}
          style={[styles.back, { top: insets.top + 6, backgroundColor: k.glass }]}
        >
          <X size={20} color={t.color.ink} />
        </Pressable>
        <View style={styles.cutChipWrap} pointerEvents="none">
          <View style={[styles.cutChip, { backgroundColor: k.glass }]}>
            <AppText style={styles.foundText} numberOfLines={1}>
              {match != null ? tr('ai_scan.match_chip', { name: estimate.name, pct: match }) : estimate.name}
            </AppText>
          </View>
        </View>
        <Animated.View style={[styles.cutSheet, { backgroundColor: t.color.bg, paddingBottom: Math.max(16, insets.bottom + 8) }, sheetIn]}>
          <AppText tone="secondary" style={styles.cap}>
            {tr('ai_scan.photo_result')}
          </AppText>
          <AppText textRole="screenTitle" numberOfLines={2}>
            {estimate.name}
          </AppText>
          <AppText tone="secondary" style={styles.cap}>
            {`${adjusted.kcal} kcal, P ${adjusted.protein_g} g, K ${adjusted.carbs_g} g, Y ${adjusted.fat_g} g`}
          </AppText>
          <View style={[styles.logPill, styles.cutPill, { backgroundColor: t.color.accent, opacity: saving ? 0.6 : 1 }]}>
            <Pressable
              onPress={() => {
                haptic('light');
                onSave(adjusted);
              }}
              disabled={saving || saved}
              accessibilityRole="button"
              style={styles.logMain}
            >
              {saving ? <ActivityIndicator color={t.color.onAccent} /> : saved ? <Check size={18} color={t.color.onAccent} weight="bold" /> : null}
              <AppText tone="onAccent" style={styles.cutLogText} numberOfLines={1}>
                {saved ? tr(`gun.logged_${slot}`) : tr(`gun.log_to_${slot}`)}
              </AppText>
            </Pressable>
            <View style={styles.logDivider} />
            <Pressable
              onPress={cycleMeal}
              disabled={saving || saved}
              accessibilityRole="button"
              accessibilityLabel={tr('gun.change_meal', { meal: tr(`meal.${slot}`) })}
              style={styles.logCaret}
            >
              <CaretDown size={16} color={t.color.onAccent} weight="bold" />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: k.photo }]}>
      <View style={styles.photo}>
        {photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={tr('common.close')}
          accessibilityHint={tr('ai_scan.retry')}
          style={[styles.back, { top: insets.top + 6, backgroundColor: k.glass }]}
        >
          <X size={20} color={t.color.ink} />
        </Pressable>
        <View style={[styles.found, { backgroundColor: k.glass }]}>
          <Check size={14} color={t.color.ink} weight="bold" />
          <AppText style={styles.foundText}>{tr('ai_scan.items_found', { count })}</AppText>
        </View>
      </View>

      <Animated.View style={[styles.sheet, { backgroundColor: k.sheet }, sheetIn]}>
        <View style={[styles.handle, { backgroundColor: k.line2 }]} />
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
          <View style={styles.pad}>
            <AppText tone="secondary" style={styles.cap}>
              {tr('ai_scan.estimate_total')}
            </AppText>
            <View style={styles.totalRow}>
              <RollingNumber value={adjusted.kcal} lang={lang} fontSize={48} weight="700" color={t.color.ink} />
              <AppText tone="secondary" style={styles.kcalUnit}>
                kcal
              </AppText>
            </View>
            <AppText tone="secondary" style={styles.cap}>
              {tr('ai_scan.grams_hint')}
            </AppText>
          </View>

          <View style={[styles.section, { borderTopColor: k.line }]}>
            <View style={styles.macroHead}>
              <AppText style={styles.h3}>{tr('ai_scan.macros')}</AppText>
              <Pressable
                onPress={() => setBars((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={tr('ai_scan.macros_toggle')}
                style={[styles.toggle, { borderColor: k.line }]}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  {bars ? (
                    <Circle cx={12} cy={12} r={7} stroke={t.color.ink} strokeWidth={1.75} />
                  ) : (
                    <Path d={BARS_D} stroke={t.color.ink} strokeWidth={1.75} strokeLinecap="round" />
                  )}
                </Svg>
              </Pressable>
            </View>
            {bars ? (
              <View style={styles.barsWrap}>
                <View style={[styles.barTrack, { backgroundColor: k.track }]}>
                  {shares.map((m) => (
                    <View key={m.key} style={{ flex: Math.max(m.share, 0.001), backgroundColor: m.color }} />
                  ))}
                </View>
                <View style={styles.barLegend}>
                  {shares.map((m) => (
                    <View key={m.key} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                      <AppText style={styles.legendText}>{`${m.label} ${m.g} g`}</AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.rings}>
                {shares.map((m) => (
                  <View key={m.key} style={styles.ringCol}>
                    <ProgressRing progress={Math.min(m.share, 1)} size={56} strokeWidth={3} color={t.color.ink} trackColor={k.track} />
                    <AppText tone="secondary" style={styles.ringLabel}>
                      {m.label}
                    </AppText>
                    <AppText style={styles.ringVal}>{`${m.g} g`}</AppText>
                  </View>
                ))}
              </View>
            )}
          </View>

          {rows.map((row, i) =>
            row.removed ? null : (
              <View key={`${row.name}-${i}`} style={[styles.item, { borderTopColor: k.line }]}>
                <View style={styles.itemHead}>
                  <AppText style={styles.itemName} numberOfLines={1}>
                    {row.name}
                  </AppText>
                  <AppText style={styles.itemKcal}>{`${Math.round(rowKcal(row))} kcal`}</AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tr('ai_scan.remove_item', { name: row.name })}
                    hitSlop={10}
                    onPress={() => update(i, { removed: true })}
                    style={styles.trash}
                  >
                    <Trash size={18} color={t.color.secondary} />
                  </Pressable>
                </View>
                <View style={styles.itemRow}>
                  <View style={[styles.gramBox, { borderColor: k.line2, backgroundColor: k.field }]}>
                    <TextInput
                      value={String(Math.round(row.grams))}
                      onChangeText={(v) => {
                        const n = Number(v.replace(/[^0-9]/g, ''));
                        update(i, { grams: Number.isFinite(n) ? n : 0, portion: 0 });
                      }}
                      keyboardType="number-pad"
                      maxLength={4}
                      accessibilityLabel={tr('ai_scan.grams_of', { name: row.name })}
                      style={[styles.gramInput, { color: t.color.ink }]}
                    />
                    <AppText tone="secondary" style={styles.gramUnit}>
                      g
                    </AppText>
                  </View>
                  <View style={styles.portions} accessibilityRole="radiogroup" accessibilityLabel={tr('ai_scan.portion_group', { name: row.name })}>
                    {PORTIONS.map((p) => {
                      const on = row.portion === p;
                      return (
                        <Pressable
                          key={p}
                          onPress={() => {
                            haptic('selection');
                            update(i, { portion: p, grams: row.baseGrams * p });
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          style={[
                            styles.portion,
                            on ? { backgroundColor: t.color.ink, borderColor: t.color.ink } : { borderColor: k.line2 },
                          ]}
                        >
                          <AppText style={[styles.portionText, { color: on ? t.color.bg : t.color.ink }]}>
                            {lang === 'en' ? String(p) : p === 0.5 ? '½' : p === 1 ? '1' : '1½'}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            ),
          )}

          <View style={styles.pad}>
            <Pressable
              onPress={() => setAdding(true)}
              accessibilityRole="button"
              style={[styles.addMissing, { borderColor: k.line2 }]}
            >
              <Plus size={18} color={t.color.ink} />
              <AppText style={styles.btnText}>{tr('ai_scan.add_missing')}</AppText>
            </Pressable>
            {onAddToPlan || onSaveMeal ? (
              <View style={styles.actionRow}>
                {onAddToPlan ? (
                  <ActionBtn
                    icon={<CalendarPlus size={18} color={t.color.ink} />}
                    label={planDone === 'ok' ? tr('ai_scan.plan_added') : planDone === 'denied' ? tr('ai_scan.plan_denied') : tr('ai_scan.add_to_plan')}
                    done={planDone === 'ok'}
                    line={k.line2}
                    onPress={async () => {
                      if (planDone === 'ok') return;
                      haptic('light');
                      setPlanDone((await onAddToPlan(adjusted)) ? 'ok' : 'denied');
                    }}
                  />
                ) : null}
                {onSaveMeal ? (
                  <ActionBtn
                    icon={<BookmarkSimple size={18} color={t.color.ink} weight={savedMeal ? 'fill' : 'regular'} />}
                    label={savedMeal ? tr('ai_scan.meal_saved') : tr('ai_scan.save_meal')}
                    done={savedMeal}
                    line={k.line2}
                    onPress={async () => {
                      if (savedMeal) return;
                      haptic('light');
                      await onSaveMeal(adjusted);
                      setSavedMeal(true);
                    }}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </Animated.View>

      {saved && !toastHidden ? (
        <View style={[styles.toast, { bottom: Math.max(16, insets.bottom + 8) + 64, backgroundColor: t.color.ink }]}>
          <Check size={16} color={t.color.bg} weight="bold" />
          <AppText style={[styles.toastText, { color: t.color.bg }]} numberOfLines={1}>
            {tr(`gun.logged_${slot}`)}
          </AppText>
          {onUndo ? (
            <Pressable onPress={onUndo} accessibilityRole="button" style={styles.toastAct}>
              <AppText style={[styles.toastUndo, { color: t.color.bg }]}>{tr('gun.undo')}</AppText>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              setToastHidden(true);
              onView?.();
            }}
            accessibilityRole="button"
            style={[styles.toastSee, { backgroundColor: t.color.accent }]}
          >
            <AppText style={[styles.toastSeeText, { color: t.color.onAccent }]}>{tr('gun.view')}</AppText>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.bottom, { backgroundColor: k.sheet, borderTopColor: k.line, paddingBottom: Math.max(16, insets.bottom + 4) }]}>
        <View style={[styles.logPill, { backgroundColor: t.color.accent, opacity: saving ? 0.6 : 1 }]}>
          <Pressable
            onPress={() => {
              haptic('light');
              onSave(adjusted);
            }}
            disabled={saving || saved}
            accessibilityRole="button"
            style={styles.logMain}
          >
            {saving ? (
              <ActivityIndicator color={t.color.onAccent} />
            ) : (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d={SCAN_D} stroke={t.color.onAccent} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
            <AppText tone="onAccent" style={styles.logText} numberOfLines={1}>
              {tr(`gun.log_to_${slot}`)}
            </AppText>
          </Pressable>
          <View style={styles.logDivider} />
          <Pressable
            onPress={cycleMeal}
            disabled={saving || saved}
            accessibilityRole="button"
            accessibilityLabel={tr('gun.change_meal', { meal: tr(`meal.${slot}`) })}
            style={styles.logCaret}
          >
            <CaretDown size={16} color={t.color.onAccent} weight="bold" />
          </Pressable>
        </View>
      </View>

      <MissingFoodSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onPick={(p) => {
          setAdding(false);
          setRows((prev) => [
            ...prev,
            {
              name: p.name,
              baseGrams: 100,
              baseKcal: p.kcal,
              grams: 100,
              portion: 1,
              removed: false,
              per100: { kcal: p.kcal, p: p.protein_g, c: p.carbs_g, f: p.fat_g },
            },
          ]);
        }}
      />
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  done,
  line,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  line: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: done }}
      style={[styles.actionBtn, { borderColor: line }]}
    >
      {done ? <Check size={16} weight="bold" /> : icon}
      <AppText style={styles.btnText} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** "Eksik besin ekle" — mevcut ürün araması (search_products, salt okuma). */
function MissingFoodSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (p: ProductSearchItem) => void;
}) {
  const t = useTheme();
  const k = tokens(t.isDark);
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ProductSearchItem[]>([]);
  const [busy, setBusy] = useState(false);

  const search = async (text: string) => {
    setQ(text);
    if (text.trim().length < 2) {
      setItems([]);
      return;
    }
    setBusy(true);
    try {
      const res = await getKesfetClient().searchProducts({ q: text.trim(), limit: 12 });
      setItems(res.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.mfFill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.mfScrim} onPress={onClose} />
        <View style={[styles.mfSheet, { backgroundColor: k.sheet, paddingBottom: Math.max(16, insets.bottom + 8) }]}>
          <View style={[styles.handle, { backgroundColor: k.line2 }]} />
          <View style={styles.mfHead}>
            <AppText textRole="sheetTitle" style={styles.mfTitle}>
              {tr('ai_scan.add_missing')}
            </AppText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('common.close')} style={styles.mfClose}>
              <X size={22} color={t.color.ink} />
            </Pressable>
          </View>
          <TextInput
            value={q}
            onChangeText={search}
            autoFocus
            placeholder={tr('ai_scan.search_food')}
            placeholderTextColor={t.color.secondary}
            style={[styles.mfInput, { borderColor: k.line2, color: t.color.ink }]}
          />
          <ScrollView style={styles.mfList} keyboardShouldPersistTaps="handled">
            {busy ? <ActivityIndicator style={{ marginTop: 12 }} color={t.color.ink} /> : null}
            {items.map((p) => (
              <Pressable key={p.id} onPress={() => onPick(p)} accessibilityRole="button" style={[styles.mfRow, { borderTopColor: k.line }]}>
                <AppText style={styles.itemName} numberOfLines={1}>
                  {p.name}
                </AppText>
                <AppText tone="secondary" style={styles.cap}>
                  {tr('ai_scan.per_100g', { kcal: Math.round(p.kcal) })}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  photo: { height: 360 },
  // G17-S1 md.7: Tara modalı → kapat X SAĞDA (sol geri oku yok).
  back: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  found: { position: 'absolute', left: 16, bottom: 16, height: 32, borderRadius: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  foundText: { fontSize: 13, fontWeight: '600' },
  sheet: { flex: 1, marginTop: -16, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: 8 },
  pad: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  cap: { fontSize: 13, lineHeight: 18 },
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 2 },
  kcalUnit: { fontSize: 15, marginBottom: 8 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, marginHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  macroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h3: { fontSize: 15, fontWeight: '600' },
  toggle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rings: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  ringCol: { alignItems: 'center', gap: 4, flex: 1 },
  ringLabel: { fontSize: 13, marginTop: 4 },
  ringVal: { fontSize: 13, fontWeight: '600' },
  barsWrap: { marginTop: 12, gap: 10 },
  barTrack: { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row', gap: 2 },
  barLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 13, fontWeight: '500' },
  item: { borderTopWidth: StyleSheet.hairlineWidth, marginHorizontal: 16, paddingVertical: 14, gap: 10 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { flex: 1, fontSize: 15, fontWeight: '600' },
  itemKcal: { fontSize: 15, fontWeight: '600' },
  trash: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gramBox: { width: 104, height: 44, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  gramInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  gramUnit: { fontSize: 13 },
  portions: { flexDirection: 'row', gap: 6 },
  portion: { minWidth: 44, height: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  portionText: { fontSize: 13, fontWeight: '600' },
  addMissing: { height: 48, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontSize: 14, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  toast: { position: 'absolute', left: 16, right: 16, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 6, gap: 8 },
  toastText: { flex: 1, fontSize: 14, fontWeight: '600' },
  toastAct: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  toastUndo: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  toastSee: { minWidth: 44, height: 40, borderRadius: 20, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  toastSeeText: { fontSize: 14, fontWeight: '600' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  logPill: { height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center' },
  logMain: { flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 17 },
  logDivider: { width: 1, height: 22, backgroundColor: 'rgba(10,10,10,0.28)' },
  logCaret: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  cutChipWrap: { position: 'absolute', left: 0, right: 0, bottom: 330, alignItems: 'center' },
  cutChip: { height: 32, borderRadius: 16, paddingHorizontal: 12, justifyContent: 'center', maxWidth: '86%' },
  cutSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 316, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 22, gap: 4 },
  cutPill: { marginTop: 'auto' },
  cutLogText: { fontSize: 15, fontWeight: '700' },
  mfFill: { flex: 1, justifyContent: 'flex-end' },
  mfScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  mfSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingHorizontal: 16, maxHeight: '80%' },
  mfHead: { flexDirection: 'row', alignItems: 'center' },
  mfTitle: { flex: 1 },
  mfClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  mfInput: { marginTop: 8, height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  mfList: { marginTop: 8 },
  mfRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, minHeight: 44 },
});
