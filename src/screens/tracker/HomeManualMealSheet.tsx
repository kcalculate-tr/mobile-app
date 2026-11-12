// HomeManualMealSheet — G15-S2 m.3: yeni kabukta "Kalori Ekle" (elle giriş)
// modalının Final dili (FinAddSheet sheet'i: 28 üst köşe, tutamaç, kapat 44,
// "Öğün" çipleri, beyaz kart, siyah 52'lik "…'e logla").
//
// MANTIK AYNI: TrackerScreen'in mevcut mealForm durumu (öğün, kcal, not) ve
// handleSaveMealLog kaydı kullanılır; yalnız görünüm yeni. Bayrak kapalıyken
// TrackerScreen eski Modal'ı çizer (bugünküyle bayt bayt aynı).
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useManualAppear } from './useManualAppear';

import { AppText, Chip, haptic, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { X } from '../../components/icons';
import { KeyboardLiftView } from '../../core/design/components/KeyboardLiftView';

export type ManualMealType = 'kahvalti' | 'ogle' | 'aksam' | 'atistirma';
const MEALS: { key: ManualMealType; slot: 'breakfast' | 'lunch' | 'dinner' | 'snack' }[] = [
  { key: 'kahvalti', slot: 'breakfast' },
  { key: 'ogle', slot: 'lunch' },
  { key: 'aksam', slot: 'dinner' },
  { key: 'atistirma', slot: 'snack' },
];

export function HomeManualMealSheet({
  visible,
  mealType,
  calories,
  note,
  saving,
  onMealType,
  onCalories,
  onNote,
  onSave,
  onClose,
}: {
  visible: boolean;
  mealType: ManualMealType;
  calories: string;
  note: string;
  saving: boolean;
  onMealType: (m: ManualMealType) => void;
  onCalories: (v: string) => void;
  onNote: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const { t: tt } = useT();
  const insets = useSafeAreaInsets();
  const slot = MEALS.find((m) => m.key === mealType)?.slot ?? 'lunch';
  const card = t.isDark ? '#1C1C1E' : '#FFFFFF';
  const sheetBg = t.isDark ? '#000000' : '#F3F4F6';
  const disabled = !calories || saving;
  // G22-S1 md.2 (İlter): aşağıdan KAYMA YOK — zemin 0→0,4 + katman opaklık 0→1, ölçek 0,96→1
  // (base 300 enter); kapanış tersi (fast 200 exit); azaltılmışta yalnız opaklık.
  const appear = useManualAppear(visible);

  return (
    <Modal visible={appear.mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* G21-S1 md.10: KAV (Android'de davranışsız) yerine ortak KeyboardLiftView. */}
      <View style={styles.fill}>
        <Animated.View style={[styles.scrim, appear.scrimStyle]} testID="manual-meal-scrim">
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={tt('common.close')} />
        </Animated.View>
        <KeyboardLiftView testID="manual-meal-lift">
        <Animated.View
          accessibilityViewIsModal
          testID="manual-meal-sheet"
          style={[styles.sheet, { backgroundColor: sheetBg, paddingBottom: Math.max(24, insets.bottom + 12) }, appear.sheetStyle]}
        >
          <View style={[styles.handle, { backgroundColor: t.isDark ? '#48484A' : '#C3C7CC' }]} />
          <View style={styles.topRow}>
            <View style={styles.titleCol}>
              <AppText textRole="section" accessibilityRole="header">
                {tt('gun.manual_title')}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {tt('gun.manual_sub')}
              </AppText>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={tt('common.close')} style={styles.close}>
              <X size={22} color={t.color.ink} />
            </Pressable>
          </View>

          <AppText variant="caption" tone="secondary" style={styles.label}>
            {tt('gun.manual_meal')}
          </AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {MEALS.map((m) => (
              <Chip
                key={m.key}
                label={tt(`meal.${m.slot}`)}
                selected={mealType === m.key}
                onPress={() => {
                  haptic('selection');
                  onMealType(m.key);
                }}
              />
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: card }]}>
            <AppText variant="caption" tone="secondary">
              kcal
            </AppText>
            <TextInput
              value={calories}
              onChangeText={onCalories}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={t.color.secondary}
              maxLength={5}
              autoFocus
              accessibilityLabel="kcal"
              style={[styles.kcalInput, { color: t.color.ink }]}
            />
          </View>
          <View style={[styles.card, styles.noteCard, { backgroundColor: card }]}>
            <TextInput
              value={note}
              onChangeText={onNote}
              placeholder={tt('gun.manual_note_ph')}
              placeholderTextColor={t.color.secondary}
              maxLength={80}
              style={[styles.noteInput, { color: t.color.ink }]}
            />
          </View>

          <Pressable
            onPress={() => {
              haptic('light');
              onSave();
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            style={[styles.save, { backgroundColor: t.color.ink, opacity: disabled ? 0.4 : 1 }]}
          >
            {saving ? (
              <ActivityIndicator color={t.color.bg} />
            ) : (
              <AppText style={[styles.saveText, { color: t.color.bg }]}>{tt(`gun.log_to_${slot}`)}</AppText>
            )}
          </Pressable>
        </Animated.View>
        </KeyboardLiftView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: 8 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  titleCol: { flex: 1, paddingTop: 8, gap: 2 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: 16, marginBottom: 8, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card: { marginTop: 14, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  noteCard: { marginTop: 8, paddingVertical: 4 },
  kcalInput: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 32, paddingVertical: 4 },
  noteInput: { minHeight: 44, fontSize: 15 },
  save: { marginTop: 16, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 15, fontWeight: '600' },
});
