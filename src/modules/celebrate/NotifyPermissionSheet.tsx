import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Sheet, haptic, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { requestPushPermissionOnly } from '../../core/notifications';
import { Bell } from '../../components/icons';

/**
 * FinSheetNotify — ILK ogun kutlamasindan sonra teklif edilen bildirim izni
 * alttan sayfasi. Yeni izin mantigi KURMAZ; yalniz requestPushPermissionOnly
 * cagirir ve sonucu disari verir.
 */
export function NotifyPermissionSheet({
  visible,
  onClose,
  onResult,
}: {
  visible: boolean;
  onClose: () => void;
  onResult?: (status: 'granted' | 'denied' | 'undetermined') => void;
}) {
  const t = useTheme();
  const { t: tt } = useT();
  const [busy, setBusy] = useState(false);

  const onAllow = async () => {
    if (busy) return;
    setBusy(true);
    haptic('selection');
    try {
      const status = await requestPushPermissionOnly();
      onResult?.(status);
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} maxHeightRatio={0.6}>
      <View style={styles.body}>
        {/* G15-S4 — FinSheetNotify: gri daire + çizgi zil, sola dayalı başlık. */}
        <View style={[styles.iconWrap, { backgroundColor: t.color.bg }]}>
          <Bell size={24} color={t.color.ink} />
        </View>

        <AppText variant="title" tone="ink" style={styles.title}>
          {tt('celebrate.notify_title')}
        </AppText>
        <AppText variant="body" tone="secondary" style={styles.sub}>
          {tt('celebrate.notify_body')}
        </AppText>

        <Pressable
          onPress={onAllow}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={tt('celebrate.notify_allow')}
          style={[styles.primary, { backgroundColor: t.color.ink, opacity: busy ? 0.6 : 1 }]}
        >
          {/* G14-S1 — FinSheetNotify: birincil siyah, ikincil çerçeveli. */}
          <AppText variant="body" style={{ color: t.color.surface, fontWeight: '600' }}>
            {tt('celebrate.notify_allow')}
          </AppText>
        </Pressable>

        <Pressable
          onPress={() => {
            haptic('selection');
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel={tt('celebrate.notify_later')}
          style={[styles.secondary, { borderColor: t.color.line }]}
        >
          <AppText variant="body" tone="ink" style={{ fontWeight: '600' }}>
            {tt('celebrate.notify_later')}
          </AppText>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'stretch', paddingTop: 8, paddingBottom: 8, gap: 12 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'left' },
  sub: { textAlign: 'left' },
  primary: {
    minHeight: 52,
    alignSelf: 'stretch',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondary: {
    minHeight: 52,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
});
