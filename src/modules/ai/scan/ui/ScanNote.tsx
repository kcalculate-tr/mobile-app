// G18-S4 md.5 (G17-S2 Ek 9) — Tara "Detay ekle": deklanşörün üstünde İSTEĞE BAĞLI
// hap → tek satır alan ("Belirtmek istediğin bir detay var mı?", yer tutucu
// "ör. kıymalı börek, 500 g", ≤ 160 karakter). Not analiz isteğine `hint` olarak
// gider; boşsa ekstra adım YOK (deklanşör = doğrudan analiz). Düzeltme / yeniden
// analiz hakkı YOK — not yalnız ilk analizle birlikte gider.
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, FinErrorReveal, fontFamily, haptic, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { Check, Plus, X } from '../../../../components/icons';
import { SCAN_NOTE_MAX } from '../scanNote';

export { SCAN_NOTE_MAX, normalizeScanNote } from '../scanNote';

type Tokens = { glass: string; ink: string };

/** Kapalı hâl: "Detay ekle" hapı; not varsa notun kendisi (✓ + tek satır). */
export function ScanNotePill({
  note,
  disabled,
  onOpen,
  k,
}: {
  note?: string;
  disabled?: boolean;
  onOpen: () => void;
  k: Tokens;
}) {
  const { t: tt } = useT();
  const has = !!note;
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onOpen();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={has ? tt('ai_scan.note_edit_a11y', { note }) : tt('ai_scan.note_add')}
      accessibilityHint={tt('ai_scan.note_question')}
      hitSlop={4}
      style={[styles.pill, { backgroundColor: k.glass }]}
      testID="fin-scan-note-pill"
    >
      {has ? <Check size={16} color={k.ink} weight="bold" /> : <Plus size={16} color={k.ink} weight="bold" />}
      <AppText style={[styles.pillText, { color: k.ink }]} numberOfLines={1}>
        {has ? note : tt('ai_scan.note_add')}
      </AppText>
    </Pressable>
  );
}

/**
 * Açık hâl: tek satır alan, klavyenin hemen üstünde. "Bitti"/klavye dönüşü kapatır;
 * X notu siler. Alan dışına dokunmak da kapatır (not korunur).
 */
export function ScanNoteField({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const { t: tt } = useT();
  const [kb, setKb] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, (e) => setKb(e.endCoordinates.height));
    const b = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="fin-scan-note-field">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={tt('common.close')}
      />
      <View style={[styles.fieldWrap, { bottom: kb + 12 }]}>
        <FinErrorReveal>
          <View style={[styles.field, { backgroundColor: t.color.surface }]}>
            <AppText style={[styles.label, { color: t.color.secondary }]}>{tt('ai_scan.note_question')}</AppText>
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                value={value}
                onChangeText={(v) => onChange(v.slice(0, SCAN_NOTE_MAX))}
                placeholder={tt('ai_scan.note_placeholder')}
                placeholderTextColor={t.color.secondary}
                maxLength={SCAN_NOTE_MAX}
                autoFocus
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={onClose}
                accessibilityLabel={tt('ai_scan.note_question')}
                style={[styles.input, { color: t.color.ink, fontFamily: fontFamily.bodyRegular }]}
                testID="fin-scan-note-input"
              />
              {value ? (
                <Pressable
                  onPress={() => onChange('')}
                  accessibilityRole="button"
                  accessibilityLabel={tt('ai_scan.note_clear')}
                  hitSlop={8}
                  style={styles.clear}
                >
                  <X size={18} color={t.color.secondary} />
                </Pressable>
              ) : null}
            </View>
            <AppText style={[styles.count, { color: t.color.secondary }]}>
              {`${value.length}/${SCAN_NOTE_MAX}`}
            </AppText>
          </View>
        </FinErrorReveal>
      </View>
    </View>
  );
}

/** Sonuç sheet'inde küçük satır: "Notun: …". */
export function ScanNoteRow({ note }: { note?: string }) {
  const t = useTheme();
  const { t: tt } = useT();
  if (!note) return null;
  return (
    <AppText
      style={[styles.row, { color: t.color.secondary }]}
      numberOfLines={2}
      testID="fin-scan-note-row"
    >
      {tt('ai_scan.note_row', { note })}
    </AppText>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 36,
    maxWidth: 280,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  fieldWrap: { position: 'absolute', left: 16, right: 16 },
  field: { borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  label: { fontSize: 13, fontWeight: '500' },
  inputRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  count: { fontSize: 13, textAlign: 'right' },
  row: { marginTop: 6, fontSize: 13, lineHeight: 18 },
});
