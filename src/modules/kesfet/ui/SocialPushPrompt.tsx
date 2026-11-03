// Sosyal push ön sayfası — G8. İlk sosyal etkileşimden (beğeni/yorum/paylaşım/
// ben de yaptım) SONRA bir kez gösterilir; sistem izin penceresini açmadan önce
// bağlamı anlatır. "İzin ver" → requestPushPermissionOnly (token almaz, DB'ye
// dokunmaz). Bir kez gösterim AsyncStorage bayrağıyla kilitlenir.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText, useTheme, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { requestPushPermissionOnly } from '../../../core/notifications';
import { BottomSheet } from './BottomSheet';
import { Icon } from './icons';

export const SOCIAL_PUSH_PROMPT_FLAG = '@kcal_social_push_prompt_shown';

/** Daha önce gösterildi mi? */
export async function socialPushPromptSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SOCIAL_PUSH_PROMPT_FLAG)) != null;
  } catch {
    return true; // hata → gösterme (güvenli taraf)
  }
}

async function markSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(SOCIAL_PUSH_PROMPT_FLAG, '1');
  } catch {
    /* yut */
  }
}

export function SocialPushPrompt({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();

  const allow = async () => {
    haptic('light');
    await markSeen();
    onClose();
    await requestPushPermissionOnly().catch(() => {});
  };
  const later = async () => {
    await markSeen();
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={later} accessibilityLabel={tr('kesfet.push.title')}>
      <View style={styles.group}>
        <View style={[styles.iconWrap, { backgroundColor: t.color.accent }]}>
          <Icon name="bell" size={26} color={t.color.onAccent} />
        </View>
        <AppText variant="heading" style={styles.title}>{tr('kesfet.push.title')}</AppText>
        <AppText variant="body" tone="secondary" style={styles.desc}>{tr('kesfet.push.desc')}</AppText>
        <Pressable
          onPress={allow}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.push.allow')}
          style={({ pressed }) => [styles.primary, { backgroundColor: t.color.ink, opacity: pressed ? 0.9 : 1 }]}
        >
          <AppText variant="body" style={{ color: t.color.surface, fontWeight: '700' }}>{tr('kesfet.push.allow')}</AppText>
        </Pressable>
        <Pressable
          onPress={later}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.push.later')}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}
        >
          <AppText variant="body" tone="secondary" style={{ fontWeight: '600' }}>{tr('kesfet.push.later')}</AppText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { alignItems: 'center', gap: 8, paddingBottom: 8 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { textAlign: 'center' },
  desc: { textAlign: 'center', marginBottom: 8 },
  primary: { alignSelf: 'stretch', minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
