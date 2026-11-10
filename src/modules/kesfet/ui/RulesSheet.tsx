// Topluluk kuralları — FinRules (G14-S1: Final'e göre TAM SAYFA). İlk paylaşımdan
// önce bir kez gösterilir (ComposerScreen "Gönder" düğmesini kapsar); AsyncStorage
// bayrağıyla kilitlenir (eski SocialPushPrompt ile aynı desen). "Anladım, paylaş" →
// bayrağı işaretler ve paylaşımı devam ettirir; X ("Vazgeç") bayrağı işaretlemez,
// bir dahaki denemede yine sorar.
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { BowlFood } from 'phosphor-react-native/lib/commonjs/icons/BowlFood';
import { PersonSimpleRun } from 'phosphor-react-native/lib/commonjs/icons/PersonSimpleRun';
import { SneakerMove } from 'phosphor-react-native/lib/commonjs/icons/SneakerMove';
import { Smiley } from 'phosphor-react-native/lib/commonjs/icons/Smiley';
import { Prohibit } from 'phosphor-react-native/lib/commonjs/icons/Prohibit';
import { ShieldCheck } from 'phosphor-react-native/lib/commonjs/icons/ShieldCheck';
import { X } from 'phosphor-react-native/lib/commonjs/icons/X';
import { AppText, useTheme, haptic, fontFamily } from '../../../core/design';
import { useT } from '../../../core/i18n';

export const RULES_SEEN_FLAG = '@kcal_kesfet_rules_seen';

/** Daha önce kabul edildi mi? */
export async function rulesSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(RULES_SEEN_FLAG)) != null;
  } catch {
    return false; // hata → göster (güvenli taraf: kurallar atlanmasın)
  }
}

async function markSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(RULES_SEEN_FLAG, '1');
  } catch {
    /* yut */
  }
}

const ALLOWED = [
  { key: 'allowed_1', Icon: BowlFood },
  { key: 'allowed_2', Icon: PersonSimpleRun },
  { key: 'allowed_3', Icon: SneakerMove },
  { key: 'allowed_4', Icon: Smiley },
] as const;
const BANNED = ['banned_1', 'banned_2', 'banned_3', 'banned_4', 'banned_5'] as const;

export function RulesSheet({
  visible,
  onAccept,
  onClose,
}: {
  visible: boolean;
  onAccept: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();

  const accept = async () => {
    haptic('light');
    await markSeen();
    onAccept();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: t.color.bg, paddingTop: insets.top }]}>
        {/* Koyu temada durum çubuğu açık renk (App geneli 'dark'). */}
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={tr('kesfet.rules.cancel')}
            hitSlop={8}
            style={styles.close}
          >
            <X size={22} color={t.color.ink} />
          </Pressable>
        </View>
        <ScrollView>
          <View style={styles.titleBlock}>
            <AppText variant="title" style={styles.title} accessibilityRole="header">
              {tr('kesfet.rules.title')}
            </AppText>
            <AppText style={styles.lead} tone="secondary">{tr('kesfet.rules.lead')}</AppText>
          </View>

          <View style={styles.section}>
            <AppText style={styles.sectionLabel} tone="secondary">{tr('kesfet.rules.allowed_title')}</AppText>
            {ALLOWED.map(({ key, Icon }) => (
              <View key={key} style={styles.allowedRow}>
                <Icon size={22} color={t.color.ink} />
                <AppText style={styles.rowText}>{tr(`kesfet.rules.${key}`)}</AppText>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <AppText style={styles.sectionLabel} tone="secondary">{tr('kesfet.rules.banned_title')}</AppText>
            {BANNED.map((key) => (
              <View key={key} style={[styles.bannedRow, { borderTopColor: t.color.line }]}>
                <Prohibit size={20} color={t.color.ink} />
                <View style={styles.bannedText}>
                  <AppText style={styles.bannedTitle}>{tr(`kesfet.rules.${key}`)}</AppText>
                  <AppText style={styles.bannedSub} tone="secondary">{tr(`kesfet.rules.${key}_sub`)}</AppText>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.note, { backgroundColor: t.color.line }]}>
            <ShieldCheck size={20} color={t.color.ink} />
            <AppText style={styles.noteText}>{tr('kesfet.rules.note')}</AppText>
          </View>
          {/* G15: Final FinRules'ta sabit düğme yok — kabul düğmesi notun ALTINDA,
              içerikle birlikte kayar (not kartı düğmenin arkasında kalmaz). */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable
              onPress={accept}
              accessibilityRole="button"
              accessibilityLabel={tr('kesfet.rules.accept')}
              style={({ pressed }) => [styles.primary, { backgroundColor: t.color.ink, opacity: pressed ? 0.9 : 1 }]}
            >
              <AppText style={[styles.primaryText, { color: t.isDark ? t.color.bg : t.color.surface }]}>{tr('kesfet.rules.accept')}</AppText>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // G17-S1 md.7: modal → X sağda.
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 4 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { paddingHorizontal: 16, paddingTop: 4 },
  title: { fontSize: 28, lineHeight: 32 },
  lead: { marginTop: 6, fontSize: 15, lineHeight: 21 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel: { fontFamily: fontFamily.bodyBold, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  allowedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  rowText: { flex: 1, fontSize: 15, lineHeight: 21 },
  bannedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  bannedText: { flex: 1 },
  bannedTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 21 },
  bannedSub: { fontSize: 13, lineHeight: 18 },
  note: { margin: 16, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, flexDirection: 'row', gap: 10 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  footer: { paddingHorizontal: 16, paddingTop: 4 },
  primary: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fontFamily.bodySemibold, fontSize: 17 },
});
