import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import BottomSheet from '../../components/BottomSheet';
import { AppText, haptic, useTheme } from '../../core/design';
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
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight="60%"
      handleColor={t.color.line}
      containerStyle={{ backgroundColor: t.color.surface }}
    >
      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: t.color.accent }]}>
          <Bell size={28} color={t.color.onAccent} weight="fill" />
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
          style={[styles.primary, { backgroundColor: t.color.accent, opacity: busy ? 0.6 : 1 }]}
        >
          <AppText variant="body" tone="onAccent">
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
          style={styles.secondary}
        >
          <AppText variant="body" tone="secondary">
            {tt('celebrate.notify_later')}
          </AppText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', paddingTop: 8, paddingBottom: 8, gap: 12 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center' },
  sub: { textAlign: 'center', paddingHorizontal: 8 },
  primary: {
    minHeight: 52,
    alignSelf: 'stretch',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondary: { minHeight: 52, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
