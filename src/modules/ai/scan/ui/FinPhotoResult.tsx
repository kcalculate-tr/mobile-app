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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText, CURVE, DURATION, ProgressRing, REDUCED, SPRING, haptic, useReducedMotion, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { CoachScanButton } from '../../../coach/ui/entries';
import { KeyboardLiftView } from '../../../../core/design/components/KeyboardLiftView';
import { BookmarkSimple, CalendarPlus, CaretDown, Check, Microphone, Plus, Trash, X } from '../../../../components/icons';
import { RollingNumber } from '../../../gun/ui';
import type { NumLang } from '../../../gun/motion';
import type { ClientMealType } from '../../../../core/meal/mealType';
import type { ScanEstimate } from '../types';
import { computeAdjusted, manualRow, productRow, rowKcal, rowsFromEstimate, type AdjustRow } from '../adjust';
import { getKesfetClient, type ProductSearchItem } from '../../../kesfet';
import { useOrientTarget } from '../../../onboarding/first/orient/useOrientTarget'; // G18-S1 temas: Orient2
import { MealMenuPopover } from '../../../gun/home/MealMenuPopover'; // G18-S5 temas (md.8): S2 FinMoPopover
import type { Rect } from '../../../gun/home/popoverGeometry';

const PORTIONS = [0.5, 1, 1.5];
const MEAL_CYCLE: ClientMealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const SCAN_D =
  'M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8 M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8 M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16 M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16 M16.92 11.13A5 5 0 1 1 13.71 7.3A2.6 2.6 0 0 0 16.92 11.13Z';
const BARS_D = 'M4 6h16 M4 12h10 M4 18h6';

type Row = AdjustRow;

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

import { ScanNoteRow } from './ScanNote';
import StickerLift, { LIFT_CHIP_DELAY_MS } from './StickerLift';
import type { Sticker } from '../../../../lib/sticker/subjectLift';
import { SCROLL_KEYBOARD } from '../../../../core/design/keyboard';

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
  plateRef,
  photoRef,
  sticker = null,
  stickerRef,
  onAddToPlan,
  onSaveMeal,
  match = null,
  note,
  source = 'photo',
  transcript,
}: {
  /** G22-S1 md.1: FinPhotoR1 `source=voice` — üstte foto yerine "Sesle eklendi" + söylenen metin. */
  source?: 'photo' | 'voice';
  transcript?: string;
  /** G18-S4 md.5: çekimdeki isteğe bağlı not — sheet'te küçük satır. */
  note?: string;
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
  /** G28-S1 md.1: tabak görünümü — Logla izi uçuşu buradan başlar (ölçülür). */
  plateRef?: React.RefObject<View | null>;
  /** G30-S1 md.1: tam ekran fotoğraf kabı (kompakt sonuç) — uçan kopya bu kutudan kırpılır. */
  photoRef?: React.RefObject<View | null>;
  /** G29-S1 md.1: cihazda üretilen çıkartma (yoksa normal fotoğraf). */
  sticker?: Sticker | null;
  /** G29-S1 md.1: çıkartma görünümü — varsa Logla izi buradan başlar. */
  stickerRef?: React.RefObject<View | null>;
}) {
  const t = useTheme();
  const orientLog = useOrientTarget('log'); // G18-S1 temas: Orient2 (Tara sonucu · logla)
  // G18-S5 md.8: "logla ⌄" çentiği S2'nin yerinde menüsünü (FinMoPopover) açar. Ölçüm ref'i
  // oryantasyon hedefiyle aynı düğüm (iki ref'e de yazılır).
  const pillRef = useRef<View | null>(null);
  const orientRef = orientLog.ref;
  const setPillRef = useCallback(
    (n: View | null) => {
      pillRef.current = n;
      if (orientRef) (orientRef as React.MutableRefObject<View | null>).current = n;
    },
    [orientRef],
  );
  const [menuAnchor, setMenuAnchor] = useState<Rect | null>(null);
  const [platePortion, setPlatePortion] = useState(1);
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
  // G29-S1 md.1 (FinMoSticker): çıkartma varsa eşleşme hapı kalkıştan sonra girer (800 ms, base 300,
  // enter, aşağıdan 6); azaltılmışta yalnız opaklık 200. Çıkartma yoksa hap hemen görünür (bugünkü gibi).
  const reducedMotion = useReducedMotion();
  const [fill, setFill] = useState<{ width: number; height: number } | null>(null);
  const chip = useSharedValue(sticker ? 0 : 1);
  const chipAnimated = useRef(false);
  useEffect(() => {
    if (!sticker || chipAnimated.current) return;
    chipAnimated.current = true;
    chip.value = reducedMotion
      ? withDelay(LIFT_CHIP_DELAY_MS, withTiming(1, { duration: REDUCED.duration }))
      : withDelay(LIFT_CHIP_DELAY_MS, withTiming(1, { duration: DURATION.base, easing: CURVE.enter }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sticker]);
  const chipStyle = useAnimatedStyle(() =>
    reducedMotion ? { opacity: chip.value } : { opacity: chip.value, transform: [{ translateY: 6 * (1 - chip.value) }] },
  );

  const [rows, setRows] = useState<Row[]>(() => rowsFromEstimate(estimate));

  // G19-S1 md.3: tek hesap (adjust.ts) — öğe başına makro, gram, porsiyon, silme,
  // eksik besin (arama/elle). Hiç öğe yoksa menüdeki porsiyon bütün tabağa uygulanır.
  const adjusted = useMemo(() => computeAdjusted(estimate, rows, platePortion), [rows, estimate, platePortion]);

  const slot = mealType === 'breakfast' || mealType === 'lunch' || mealType === 'dinner' ? mealType : 'snack';
  const cycleMeal = () => {
    haptic('selection');
    if (menuAnchor) return;
    const node = pillRef.current;
    if (!node || typeof node.measureInWindow !== 'function') {
      // Ölçülemezse eski davranış: sıradaki öğün.
      const idx = MEAL_CYCLE.indexOf(mealType);
      onChangeMealType(MEAL_CYCLE[(idx + 1) % MEAL_CYCLE.length]);
      return;
    }
    node.measureInWindow((x, y, width, height) => setMenuAnchor({ x, y, width, height }));
  };
  // Menüdeki porsiyon = bütün tabak; satır porsiyon çipleriyle aynı hesap (gram = taban × p).
  const pickPlatePortion = (p: number) => {
    setPlatePortion(p);
    setRows((prev) => prev.map((r) => (r.removed ? r : { ...r, portion: p, grams: r.baseGrams * p })));
  };
  const menuEl = (
    <MealMenuPopover
      anchor={menuAnchor}
      meal={slot}
      portion={platePortion}
      onPickMeal={(m) => onChangeMealType(m)}
      onPickPortion={pickPlatePortion}
      onClosed={() => setMenuAnchor(null)}
    />
  );
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
  const voice = source === 'voice';
  if (estimate.ingredients.length <= 1 && !voice) {
    return (
      <View
        ref={photoRef}
        collapsable={false}
        style={[styles.fill, { backgroundColor: '#2A2622' }]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0 && (!fill || fill.width !== width || fill.height !== height)) setFill({ width, height });
        }}
      >
        {photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        {/* G29-S1 md.1: çıkartma fotoğrafın üstünde kalkar (yoksa hiç çizilmez → normal fotoğraf). */}
        {photoUri && sticker ? <StickerLift sticker={sticker} container={fill} reduced={reducedMotion} stickerRef={stickerRef} /> : null}
        {/* G28-S1 md.1: tabak bölgesi (görünmez) — Logla izi uçuşunun başlangıcı. */}
        <View ref={plateRef} collapsable={false} pointerEvents="none" style={[styles.plateArea, { top: insets.top + 72 }]} />
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={tr('common.close')}
          accessibilityHint={tr('ai_scan.retry')}
          style={[styles.back, { top: insets.top + 6, backgroundColor: k.glass }]}
        >
          <X size={20} color={t.color.ink} />
        </Pressable>
        <Animated.View style={[styles.cutChipWrap, chipStyle]} pointerEvents="none">
          <View style={[styles.cutChip, { backgroundColor: k.glass }]}>
            <AppText style={styles.foundText} numberOfLines={1}>
              {match != null ? tr('ai_scan.match_chip', { name: adjusted.name, pct: match }) : adjusted.name}
            </AppText>
          </View>
        </Animated.View>
        <Animated.View style={[styles.cutSheet, { backgroundColor: t.color.bg, paddingBottom: Math.max(16, insets.bottom + 8) }, sheetIn]}>
          <AppText tone="secondary" style={styles.cap}>
            {tr('ai_scan.photo_result')}
          </AppText>
          {/* G28-S1 md.4: ekrandaki ad = Logla'nın yazdığı ad (adjusted.name, tek kaynak). */}
          <AppText textRole="screenTitle" numberOfLines={2}>
            {adjusted.name}
          </AppText>
          <AppText tone="secondary" style={styles.cap}>
            {`${adjusted.kcal} kcal, P ${adjusted.protein_g} g, K ${adjusted.carbs_g} g, Y ${adjusted.fat_g} g`}
          </AppText>
          {menuEl}
          <View {...orientLog} ref={setPillRef} collapsable={false} style={[styles.logPill, styles.cutPill, { backgroundColor: t.color.accent, opacity: saving ? 0.6 : 1 }]}>
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
              accessibilityState={{ expanded: menuAnchor != null }}
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
    <View style={[styles.fill, { backgroundColor: voice ? t.color.bg : k.photo }]}>
      {voice ? (
        // G22-S1 md.1 — FinScanVoiceResult: "🎤 Sesle eklendi" + söylenen metin. Tara modal olduğu için
        // gezinme kuralı (G17 md.7): kapat X SAĞDA (tasarımdaki sol geri oku yerine; foto sonucu ile aynı).
        <View style={[styles.voiceHead, { paddingTop: insets.top + 6 }]} testID="fin-photo-voice-head">
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={tr('common.close')}
            accessibilityHint={tr('voice.result_back')}
            style={[styles.voiceBack, { backgroundColor: k.sheet }]}
          >
            <X size={20} color={t.color.ink} />
          </Pressable>
          <View style={[styles.voiceChip, { backgroundColor: k.sheet }]}>
            <Microphone size={14} color={t.color.ink} weight="bold" />
            <AppText style={styles.foundText}>{tr('voice.result_chip')}</AppText>
          </View>
          {transcript ? (
            <AppText tone="secondary" style={styles.voiceQuote} numberOfLines={3}>
              {`“${transcript}”`}
            </AppText>
          ) : null}
        </View>
      ) : (
      <View style={styles.photo} ref={plateRef} collapsable={false}>
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
      )}

      <Animated.View style={[styles.sheet, { backgroundColor: k.sheet }, sheetIn]}>
        <View style={[styles.handle, { backgroundColor: k.line2 }]} />
        <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
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
            <ScanNoteRow note={note} />
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
            {/* G24-S1 (FinPhotoR1 Tur 26k): ikincil Koç girişi — sessiz çerçeve, asla lime değil; sohbet
                bu öğün ekli açılır. `koc` kapalı / coach-chat yok → çizilmez. */}
            <CoachScanButton meal={{ name: adjusted.name, kcal: adjusted.kcal, protein: adjusted.protein_g, carbs: adjusted.carbs_g, fat: adjusted.fat_g }} />
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
        {menuEl}
        <View {...orientLog} ref={setPillRef} collapsable={false} style={[styles.logPill, { backgroundColor: t.color.accent, opacity: saving ? 0.6 : 1 }]}>
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
            accessibilityState={{ expanded: menuAnchor != null }}
            style={styles.logCaret}
          >
            <CaretDown size={16} color={t.color.onAccent} weight="bold" />
          </Pressable>
        </View>
      </View>

      <MissingFoodSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onPick={(row) => {
          setAdding(false);
          setRows((prev) => [...prev, row]);
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

/**
 * "Eksik besin ekle" — mevcut ürün araması (search_products, salt okuma) +
 * G19-S1 md.3: ELLE ekleme (ad = arama metni, kcal zorunlu, gram isteğe bağlı).
 */
function MissingFoodSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (row: AdjustRow) => void;
}) {
  const t = useTheme();
  const k = tokens(t.isDark);
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ProductSearchItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [kcalText, setKcalText] = useState('');
  const [gramsText, setGramsText] = useState('');
  const [invalid, setInvalid] = useState(false);
  // Yarış: yavaş eski arama yanıtı yeni sorgunun sonuçlarını ezmesin.
  const seq = useRef(0);

  useEffect(() => {
    if (visible) return;
    seq.current += 1;
    setQ('');
    setItems([]);
    setBusy(false);
    setManual(false);
    setKcalText('');
    setGramsText('');
    setInvalid(false);
  }, [visible]);

  const search = async (text: string) => {
    setQ(text);
    const my = ++seq.current;
    if (text.trim().length < 2) {
      setItems([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const res = await getKesfetClient().searchProducts({ q: text.trim(), limit: 12 });
      if (my === seq.current) setItems(res.items ?? []);
    } catch {
      if (my === seq.current) setItems([]);
    } finally {
      if (my === seq.current) setBusy(false);
    }
  };

  const submitManual = () => {
    const row = manualRow(q, kcalText, gramsText);
    if (!row) {
      setInvalid(true);
      haptic('warning');
      return;
    }
    haptic('light');
    onPick(row);
  };

  const name = q.replace(/\s+/g, ' ').trim();

  return (
    // G21-S1 md.10: KAV (Android'de davranışsız) yerine ortak KeyboardLiftView;
    // statusBarTranslucent → Modal koordinatı = ekran koordinatı (kaldırma ölçümü).
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.mfFill}>
        <Pressable style={styles.mfScrim} onPress={onClose} />
        <KeyboardLiftView limitHeight style={styles.mfLift} testID="scan-missing-lift">
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
            onChangeText={(v) => {
              setInvalid(false);
              if (manual) setQ(v);
              else void search(v);
            }}
            autoFocus
            maxLength={60}
            placeholder={tr('ai_scan.search_food')}
            placeholderTextColor={t.color.secondary}
            accessibilityLabel={manual ? tr('ai_scan.manual_name') : tr('ai_scan.search_food')}
            style={[styles.mfInput, { borderColor: k.line2, color: t.color.ink }]}
          />
          {manual ? (
            <View style={styles.mfManual} testID="scan-missing-manual">
              <View style={styles.mfManualRow}>
                <TextInput
                  value={kcalText}
                  onChangeText={(v) => {
                    setInvalid(false);
                    setKcalText(v.replace(/[^0-9]/g, ''));
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder={tr('ai_scan.manual_kcal')}
                  placeholderTextColor={t.color.secondary}
                  accessibilityLabel={tr('ai_scan.manual_kcal')}
                  style={[styles.mfInput, styles.mfHalf, { borderColor: invalid ? t.color.danger : k.line2, color: t.color.ink }]}
                />
                <TextInput
                  value={gramsText}
                  onChangeText={(v) => {
                    setInvalid(false);
                    setGramsText(v.replace(/[^0-9]/g, ''));
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder={tr('ai_scan.manual_grams')}
                  placeholderTextColor={t.color.secondary}
                  accessibilityLabel={tr('ai_scan.manual_grams')}
                  style={[styles.mfInput, styles.mfHalf, { borderColor: k.line2, color: t.color.ink }]}
                />
              </View>
              {invalid ? (
                <AppText style={[styles.cap, { color: t.color.danger }]} accessibilityLiveRegion="polite">
                  {tr('ai_scan.manual_invalid')}
                </AppText>
              ) : null}
              <Pressable
                onPress={submitManual}
                accessibilityRole="button"
                style={[styles.mfAdd, { backgroundColor: t.color.ink }]}
                testID="scan-missing-manual-add"
              >
                <AppText style={[styles.btnText, { color: t.color.bg }]}>{tr('ai_scan.manual_add')}</AppText>
              </Pressable>
            </View>
          ) : (
            <ScrollView {...SCROLL_KEYBOARD} style={styles.mfList}>
              {busy ? <ActivityIndicator style={{ marginTop: 12 }} color={t.color.ink} /> : null}
              {items.map((p) => (
                <Pressable key={p.id} onPress={() => onPick(productRow(p))} accessibilityRole="button" style={[styles.mfRow, { borderTopColor: k.line }]}>
                  <AppText style={styles.itemName} numberOfLines={1}>
                    {p.name}
                  </AppText>
                  <AppText tone="secondary" style={styles.cap}>
                    {tr('ai_scan.per_100g', { kcal: Math.round(p.kcal) })}
                  </AppText>
                </Pressable>
              ))}
              {name.length >= 2 && !busy ? (
                <Pressable
                  onPress={() => setManual(true)}
                  accessibilityRole="button"
                  style={[styles.mfRow, styles.mfManualLink, { borderTopColor: k.line }]}
                  testID="scan-missing-manual-open"
                >
                  <Plus size={16} color={t.color.ink} />
                  <AppText style={styles.itemName} numberOfLines={1}>
                    {tr('ai_scan.add_manual', { name })}
                  </AppText>
                </Pressable>
              ) : null}
            </ScrollView>
          )}
        </View>
        </KeyboardLiftView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // G28-S1 md.1: tam ekran fotoğrafın ortasındaki tabak karesi (uçuş başlangıcı).
  plateArea: { position: 'absolute', alignSelf: 'center', width: '64%', aspectRatio: 1 },
  fill: { flex: 1 },
  photo: { height: 360 },
  voiceHead: { paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  voiceBack: { alignSelf: 'flex-end', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  voiceChip: { alignSelf: 'flex-start', minHeight: 32, borderRadius: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  voiceQuote: { fontSize: 15, lineHeight: 21 },
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
  mfLift: { maxHeight: '80%' },
  mfSheet: { flexShrink: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingHorizontal: 16 },
  mfHead: { flexDirection: 'row', alignItems: 'center' },
  mfTitle: { flex: 1 },
  mfClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  mfInput: { marginTop: 8, height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  mfList: { marginTop: 8, flexShrink: 1 },
  mfRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, minHeight: 44 },
  mfManualLink: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mfManual: { marginTop: 4, gap: 8 },
  mfManualRow: { flexDirection: 'row', gap: 8 },
  mfHalf: { flex: 1 },
  mfAdd: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
