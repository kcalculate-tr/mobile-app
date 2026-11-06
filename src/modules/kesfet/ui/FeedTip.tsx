// Keşfet akışı ipucu şeridi — FinFeedTip (FeedR3, tip=true). Akışa ilk kez
// girişte bir kez gösterilir; AsyncStorage bayrağıyla kilitlenir (SocialPushPrompt
// ile aynı desen). Kapat (x) → bayrağı işaretler, bir daha çizilmez.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText, fontFamily, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';

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

/**
 * G15 — Final FinFeedTip: logla düğmesinin altına çapalı siyah balon (koyu temada
 * açık) — başlık + açıklama + altı çizili "Tamam". Konumu çağıran verir (PostCard
 * ilk öğün kartının altına mutlak yerleştirir); ok (caret) sağda, düğmeyi gösterir.
 */
export function FeedTip({ onDismiss }: { onDismiss: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();

  const close = () => {
    void markSeen();
    onDismiss();
  };

  const bg = t.color.ink;
  const fg = t.color.bg;
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <View style={[styles.caret, { borderBottomColor: bg }]} />
      <View style={[styles.box, { backgroundColor: bg }]}>
        <AppText style={[styles.title, { color: fg }]}>{tr('kesfet.ui.feed_tip_title')}</AppText>
        <View style={styles.bottom}>
          <AppText style={[styles.body, { color: fg }]}>{tr('kesfet.ui.feed_tip_body')}</AppText>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel={tr('kesfet.ui.feed_tip_ok')}>
            <AppText style={[styles.ok, { color: fg }]}>{tr('kesfet.ui.feed_tip_ok')}</AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 262, alignItems: 'flex-end', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  caret: {
    marginRight: 28,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  box: { alignSelf: 'stretch', borderRadius: 18, paddingLeft: 14, paddingRight: 8, paddingTop: 12, paddingBottom: 8, gap: 2 },
  title: { fontFamily: fontFamily.bodySemibold, fontSize: 14, lineHeight: 20 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { flex: 1, fontFamily: fontFamily.bodyRegular, fontSize: 13, lineHeight: 18, opacity: 0.7 },
  ok: { minHeight: 36, paddingHorizontal: 8, textAlignVertical: 'center', lineHeight: 36, fontFamily: fontFamily.bodyBold, fontSize: 13, textDecorationLine: 'underline' },
});
