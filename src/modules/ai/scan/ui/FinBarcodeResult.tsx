/**
 * G21-S1 md.2 — Barkod sonucu (Open Food Facts). YENİ PANO YOK: mevcut Tara sonuç
 * ekranının (FinPhotoResult · FinCollectCut tek öğe düzeni) barkod kipi — üstte ürün
 * görseli + kapat X (sağ) + ad hapı, altta sheet: "Barkod sonucu", düzenlenebilir ad,
 * marka, 100 g başına değerler (kcal · P · K · Y), porsiyon (gram + ½·1·1½), toplam,
 * lime "{Öğün}'e logla ⌄" (aynı MealMenuPopover) ve küçük kaynak satırı
 * "Veri: Open Food Facts" (ODbL atfı).
 *
 * Kaydetme ScanScreen'de mevcut yol (`saveAiScanEstimate`, source='barcode'); AI hakkı
 * TÜKETMEZ. Burada yalnız düzeltme hesabı (barcodeEstimate) yapılır.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, haptic, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { CaretDown, Check, X } from '../../../../components/icons';
import type { ClientMealType } from '../../../../core/meal/mealType';
import type { ScanEstimate } from '../types';
import { barcodeEstimate, type OffPer100 } from '../barcode/off';
import { MealMenuPopover } from '../../../gun/home/MealMenuPopover';
import type { Rect } from '../../../gun/home/popoverGeometry';

const PORTIONS = [0.5, 1, 1.5];
const MEAL_CYCLE: ClientMealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface BarcodeResultProduct {
  code: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  per100: OffPer100;
  /** serving_quantity (g) — yoksa 100 g. */
  servingGrams: number | null;
}

function tokens(isDark: boolean) {
  return isDark
    ? { photo: '#2C2C2E', sheet: '#1C1C1E', glass: 'rgba(28,28,30,0.72)', line: '#2C2C2E', line2: '#48484A', field: '#2C2C2E' }
    : { photo: '#D3D6DA', sheet: '#FFFFFF', glass: 'rgba(255,255,255,0.86)', line: '#E9EBEE', line2: '#C3C7CC', field: '#FFFFFF' };
}

const toText = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 10) / 10) : '0');
const parseNum = (v: string, max: number) => {
  const n = Number(String(v).replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
};

export default function FinBarcodeResult({
  product,
  mealType,
  saving,
  saved,
  onChangeMealType,
  onSave,
  onClose,
}: {
  product: BarcodeResultProduct;
  mealType: ClientMealType;
  saving: boolean;
  saved: boolean;
  onChangeMealType: (next: ClientMealType) => void;
  onSave: (estimate: Omit<ScanEstimate, 'isEstimate'>) => void;
  /** Kapat X — kameraya (barkod moduna) döner. */
  onClose: () => void;
}) {
  const t = useTheme();
  const k = tokens(t.isDark);
  const { t: tr, lang } = useT();
  const insets = useSafeAreaInsets();

  const baseGrams = product.servingGrams && product.servingGrams > 0 ? product.servingGrams : 100;
  const [name, setName] = useState(product.name);
  const [kcal, setKcal] = useState(toText(product.per100.kcal));
  const [p, setP] = useState(toText(product.per100.p));
  const [c, setC] = useState(toText(product.per100.c));
  const [f, setF] = useState(toText(product.per100.f));
  const [grams, setGrams] = useState(baseGrams);
  const [portion, setPortion] = useState(1);
  const [menuAnchor, setMenuAnchor] = useState<Rect | null>(null);
  const pillRef = useRef<View | null>(null);

  const per100 = useMemo<OffPer100>(
    () => ({ kcal: parseNum(kcal, 900), p: parseNum(p, 100), c: parseNum(c, 100), f: parseNum(f, 100) }),
    [kcal, p, c, f],
  );
  const estimate = useMemo(() => barcodeEstimate(name || product.name, per100, grams), [name, product.name, per100, grams]);
  const canSave = estimate.kcal > 0 && grams > 0 && !saving && !saved;

  const slot = mealType === 'breakfast' || mealType === 'lunch' || mealType === 'dinner' ? mealType : 'snack';
  const cycleMeal = () => {
    haptic('selection');
    if (menuAnchor) return;
    const node = pillRef.current;
    if (!node || typeof node.measureInWindow !== 'function') {
      const idx = MEAL_CYCLE.indexOf(mealType);
      onChangeMealType(MEAL_CYCLE[(idx + 1) % MEAL_CYCLE.length]);
      return;
    }
    node.measureInWindow((x, y, width, height) => setMenuAnchor({ x, y, width, height }));
  };
  const pickPortion = (v: number) => {
    setPortion(v);
    setGrams(Math.round(baseGrams * v));
  };

  const field = (label: string, value: string, set: (v: string) => void, unit: string, testID: string) => (
    <View style={styles.valCol}>
      <AppText tone="secondary" style={styles.valLabel} numberOfLines={1}>
        {label}
      </AppText>
      <View style={[styles.valBox, { borderColor: k.line2, backgroundColor: k.field }]}>
        <TextInput
          value={value}
          onChangeText={set}
          keyboardType="decimal-pad"
          maxLength={5}
          editable={!saved}
          selectTextOnFocus
          accessibilityLabel={`${label} · ${tr('ai_scan.barcode_per100')}`}
          testID={testID}
          style={[styles.valInput, { color: t.color.ink }]}
        />
        <AppText tone="secondary" style={styles.unit}>
          {unit}
        </AppText>
      </View>
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: k.photo }]} testID="fin-barcode-result">
      <View style={[styles.photo, { paddingTop: insets.top + 56 }]}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.productImg} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : null}
      </View>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={tr('common.close')}
        style={[styles.back, { top: insets.top + 6, backgroundColor: k.glass }]}
      >
        <X size={20} color={t.color.ink} />
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { backgroundColor: t.color.bg }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetPad}
          >
            <AppText tone="secondary" style={styles.cap}>
              {tr('ai_scan.barcode_result')}
            </AppText>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={80}
              editable={!saved}
              accessibilityLabel={tr('ai_scan.barcode_name')}
              placeholder={tr('ai_scan.barcode_name')}
              placeholderTextColor={t.color.secondary}
              testID="fin-barcode-name"
              style={[styles.nameInput, { color: t.color.ink, borderBottomColor: k.line }]}
            />
            {product.brand ? (
              <AppText tone="secondary" style={styles.cap} numberOfLines={1}>
                {product.brand}
              </AppText>
            ) : null}

            <AppText style={styles.h3}>{tr('ai_scan.barcode_per100')}</AppText>
            <View style={styles.valRow}>
              {field(tr('ai_scan.barcode_kcal'), kcal, setKcal, 'kcal', 'fin-barcode-kcal')}
              {field(tr('ai_scan.macro_protein'), p, setP, 'g', 'fin-barcode-p')}
              {field(tr('ai_scan.macro_carbs'), c, setC, 'g', 'fin-barcode-c')}
              {field(tr('ai_scan.macro_fat'), f, setF, 'g', 'fin-barcode-f')}
            </View>

            <AppText style={styles.h3}>{tr('ai_scan.barcode_portion')}</AppText>
            <View style={styles.itemRow}>
              <View style={[styles.gramBox, { borderColor: k.line2, backgroundColor: k.field }]}>
                <TextInput
                  value={String(Math.round(grams))}
                  onChangeText={(v) => {
                    const n = Number(v.replace(/[^0-9]/g, ''));
                    setGrams(Number.isFinite(n) ? Math.min(n, 2000) : 0);
                    setPortion(0);
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  editable={!saved}
                  selectTextOnFocus
                  accessibilityLabel={tr('ai_scan.grams_of', { name: name || product.name })}
                  testID="fin-barcode-grams"
                  style={[styles.gramInput, { color: t.color.ink }]}
                />
                <AppText tone="secondary" style={styles.unit}>
                  g
                </AppText>
              </View>
              <View style={styles.portions} accessibilityRole="radiogroup" accessibilityLabel={tr('ai_scan.barcode_portion')}>
                {PORTIONS.map((v) => {
                  const on = portion === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => {
                        haptic('selection');
                        pickPortion(v);
                      }}
                      disabled={saved}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[styles.portion, on ? { backgroundColor: t.color.ink, borderColor: t.color.ink } : { borderColor: k.line2 }]}
                    >
                      <AppText style={[styles.portionText, { color: on ? t.color.bg : t.color.ink }]}>
                        {lang === 'en' ? String(v) : v === 0.5 ? '½' : v === 1 ? '1' : '1½'}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <AppText style={styles.total} testID="fin-barcode-total">
              {`${estimate.kcal} kcal, P ${estimate.protein_g} g, K ${estimate.carbs_g} g, Y ${estimate.fat_g} g`}
            </AppText>
          </ScrollView>

          <View style={[styles.bottom, { paddingBottom: Math.max(12, insets.bottom + 4) }]}>
            <MealMenuPopover
              anchor={menuAnchor}
              meal={slot}
              portion={portion || 1}
              onPickMeal={(m) => onChangeMealType(m)}
              onPickPortion={pickPortion}
              onClosed={() => setMenuAnchor(null)}
            />
            <View
              ref={pillRef}
              collapsable={false}
              style={[styles.logPill, { backgroundColor: t.color.accent, opacity: saving || (!canSave && !saved) ? 0.6 : 1 }]}
            >
              <Pressable
                onPress={() => {
                  if (!canSave) return;
                  haptic('light');
                  onSave(estimate);
                }}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSave, busy: saving }}
                style={styles.logMain}
                testID="fin-barcode-log"
              >
                {saving ? <ActivityIndicator color={t.color.onAccent} /> : saved ? <Check size={18} color={t.color.onAccent} weight="bold" /> : null}
                <AppText tone="onAccent" style={styles.logText} numberOfLines={1}>
                  {saved ? tr(`gun.logged_${slot}`) : tr(`gun.log_to_${slot}`)}
                </AppText>
              </Pressable>
              <View style={styles.logDivider} />
              <Pressable
                onPress={cycleMeal}
                disabled={saving || saved}
                accessibilityRole="button"
                accessibilityLabel={tr('gun.change_meal', { meal: tr(`meal.${slot}`) })}
                accessibilityState={{ expanded: menuAnchor != null }}
                style={styles.logCaret}
              >
                <CaretDown size={16} color={t.color.onAccent} weight="bold" />
              </Pressable>
            </View>
            {/* ODbL atfı — Open Food Facts verisi. */}
            <AppText tone="secondary" style={styles.source} testID="fin-barcode-source">
              {tr('ai_scan.barcode_source')}
            </AppText>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  photo: { height: '38%', alignItems: 'center', justifyContent: 'center', paddingBottom: 24 },
  productImg: { width: '56%', height: '100%' },
  back: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '34%', justifyContent: 'flex-end' },
  sheet: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  sheetPad: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 12, gap: 4 },
  cap: { fontSize: 13, lineHeight: 18 },
  nameInput: { fontSize: 22, fontWeight: '700', paddingVertical: 6, borderBottomWidth: 1 },
  h3: { marginTop: 14, marginBottom: 6, fontSize: 15, fontWeight: '700' },
  valRow: { flexDirection: 'row', gap: 8 },
  valCol: { flex: 1, gap: 4 },
  valLabel: { fontSize: 12 },
  valBox: { height: 44, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  valInput: { flex: 1, fontSize: 15, paddingVertical: 0, minWidth: 0 },
  unit: { fontSize: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gramBox: { width: 104, height: 44, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  gramInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  portions: { flexDirection: 'row', gap: 6 },
  portion: { minWidth: 44, height: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  portionText: { fontSize: 13, fontWeight: '600' },
  total: { marginTop: 14, fontSize: 15, fontWeight: '600' },
  bottom: { paddingHorizontal: 16, paddingTop: 8 },
  logPill: { height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center' },
  logMain: { flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logText: { fontSize: 15, fontWeight: '700' },
  logDivider: { width: 1, height: 22, backgroundColor: 'rgba(10,10,10,0.28)' },
  logCaret: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  source: { marginTop: 8, fontSize: 11, textAlign: 'center' },
});
