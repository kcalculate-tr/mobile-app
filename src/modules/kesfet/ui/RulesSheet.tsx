// Topluluk kuralları — FinRules. İlk paylaşımdan önce bir kez gösterilir
// (ComposerScreen "Gönder" düğmesini kapsar); AsyncStorage bayrağıyla kilitlenir
// (SocialPushPrompt ile aynı desen). "Anladım, paylaş" → bayrağı işaretler ve
// paylaşımı devam ettirir; "Vazgeç" bayrağı işaretlemez, bir dahaki denemede
// yine sorar.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText, useTheme, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { BottomSheet } from './BottomSheet';
import { Icon } from './icons';

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

const RULE_KEYS = ['item_1', 'item_2', 'item_3'] as const;

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

  const accept = async () => {
    haptic('light');
    await markSeen();
    onAccept();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={tr('kesfet.rules.title')}>
      <View style={styles.group}>
        <View style={[styles.iconWrap, { backgroundColor: t.color.accent }]}>
          <Icon name="flag" size={24} color={t.color.onAccent} />
        </View>
        <AppText variant="heading" style={styles.title}>{tr('kesfet.rules.title')}</AppText>
        <AppText variant="body" tone="secondary" style={styles.intro}>{tr('kesfet.rules.intro')}</AppText>
        {RULE_KEYS.map((key) => (
          <View key={key} style={styles.ruleRow}>
            <View style={[styles.dot, { backgroundColor: t.color.ink }]} />
            <AppText variant="body" style={styles.ruleText}>{tr(`kesfet.rules.${key}`)}</AppText>
          </View>
        ))}
        <Pressable
          onPress={accept}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.rules.accept')}
          style={({ pressed }) => [styles.primary, { backgroundColor: t.color.ink, opacity: pressed ? 0.9 : 1 }]}
        >
          <AppText variant="body" style={{ color: t.color.surface, fontWeight: '700' }}>{tr('kesfet.rules.accept')}</AppText>
        </Pressable>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.rules.cancel')}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}
        >
          <AppText variant="body" tone="secondary" style={{ fontWeight: '600' }}>{tr('kesfet.rules.cancel')}</AppText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { alignItems: 'center', gap: 8, paddingBottom: 8 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { textAlign: 'center' },
  intro: { textAlign: 'center', marginBottom: 4 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, alignSelf: 'stretch', paddingHorizontal: 8, marginBottom: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  ruleText: { flex: 1 },
  primary: { alignSelf: 'stretch', minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
