// Keşfet akışı ipucu şeridi — FinFeedTip (FeedR3, tip=true). Akışa ilk kez
// girişte bir kez gösterilir; AsyncStorage bayrağıyla kilitlenir (SocialPushPrompt
// ile aynı desen). Kapat (x) → bayrağı işaretler, bir daha çizilmez.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Icon } from './icons';

export const FEED_TIP_SEEN_FLAG = '@kcal_kesfet_feed_tip_seen';

/** Daha önce gösterildi/kapatıldı mı? */
export async function feedTipSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FEED_TIP_SEEN_FLAG)) != null;
  } catch {
    return true; // hata → gösterme (güvenli taraf)
  }
}

async function markSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(FEED_TIP_SEEN_FLAG, '1');
  } catch {
    /* yut */
  }
}

export function FeedTip({ onDismiss }: { onDismiss: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();

  const close = () => {
    void markSeen();
    onDismiss();
  };

  return (
    <View style={[styles.row, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
      <Icon name="info" size={16} color={t.color.secondary} />
      <AppText variant="caption" tone="secondary" style={styles.text}>
        {tr('kesfet.ui.feed_tip')}
      </AppText>
      <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr('common.close')}>
        <Icon name="x" size={14} color={t.color.secondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: { flex: 1 },
});
