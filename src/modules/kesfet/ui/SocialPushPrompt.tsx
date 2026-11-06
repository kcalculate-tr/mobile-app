// Sosyal push ön sayfası — G8. İlk sosyal etkileşimden (beğeni/yorum/paylaşım/
// ben de yaptım) SONRA bir kez gösterilir; sistem izin penceresini açmadan önce
// bağlamı anlatır. "İzin ver" → requestPushPermissionOnly (token almaz, DB'ye
// dokunmaz). Bir kez gösterim AsyncStorage bayrağıyla kilitlenir.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText, fontFamily, useTheme, haptic } from '../../../core/design';
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
        {/* G15 — Final FinSheetNotify dili: sola dayalı, gri ikon dairesi, siyah + çerçeveli düğmeler. */}
        <View style={[styles.iconWrap, { backgroundColor: t.color.line }]}>
          <Icon name="bell" size={22} color={t.color.ink} />
        </View>
        <AppText textRole="screenTitle" style={styles.title}>{tr('kesfet.push.title')}</AppText>
        <AppText variant="body" tone="secondary" style={styles.desc}>{tr('kesfet.push.desc')}</AppText>
        <Pressable
          onPress={allow}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.push.allow')}
          style={({ pressed }) => [styles.primary, { backgroundColor: t.color.ink, opacity: pressed ? 0.9 : 1 }]}
        >
          <AppText style={[styles.btnText, { color: t.color.bg }]}>{tr('kesfet.push.allow')}</AppText>
        </Pressable>
        <Pressable
          onPress={later}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.push.later')}
          style={({ pressed }) => [styles.secondary, { borderColor: t.isDark ? '#48484A' : '#C3C7CC' }, pressed && { opacity: 0.8 }]}
        >
          <AppText style={[styles.btnText, { color: t.color.ink }]}>{tr('kesfet.push.later')}</AppText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { alignItems: 'flex-start', gap: 8, paddingBottom: 8 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: {},
  desc: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  primary: { alignSelf: 'stretch', minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  secondary: { alignSelf: 'stretch', minHeight: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { fontFamily: fontFamily.bodySemibold, fontSize: 15 },
});
