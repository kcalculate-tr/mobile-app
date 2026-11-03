// Gönderi menüsü (⋯) — tasarım T20PostMenu / T20PostMenuBlock.
// Üç görünüm: (1) menü: Bağlantıyı kopyala · Şikayet et · Engelle · Vazgeç,
// (2) şikayet: neden listesi → report_content, (3) engelle: onay adımı → block_user.
// Engelleme onaylanınca çağıran akıştan yazarı anında düşürür.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { haptic } from '../../../core/design';
import { BottomSheet } from './BottomSheet';
import { Icon, type IconName } from './icons';
import { REPORT_REASONS, type ReportReason } from './format';

type MenuView = 'menu' | 'report' | 'block';

function MenuRow({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: IconName;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const color = danger ? t.color.danger : t.color.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.color.surface }]}
    >
      <Icon name={icon} size={22} color={color} />
      <AppText variant="body" style={{ color }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function PostMenu({
  visible,
  onClose,
  authorName,
  onCopyLink,
  onReport,
  onBlock,
}: {
  visible: boolean;
  onClose: () => void;
  authorName: string;
  onCopyLink: () => void;
  onReport: (reason: ReportReason) => void;
  onBlock: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const [view, setView] = useState<MenuView>('menu');

  // Her açılışta menüden başla.
  useEffect(() => {
    if (visible) setView('menu');
  }, [visible]);

  const close = () => {
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close} accessibilityLabel={tr('kesfet.ui.a11y.post_menu')}>
      {view === 'menu' ? (
        <View style={styles.group}>
          <MenuRow
            icon="link"
            label={tr('kesfet.ui.menu.copy_link')}
            onPress={() => {
              haptic('selection');
              onCopyLink();
              close();
            }}
          />
          <MenuRow
            icon="flag"
            label={tr('kesfet.ui.menu.report')}
            onPress={() => setView('report')}
          />
          <MenuRow
            icon="slash"
            label={tr('kesfet.ui.menu.block')}
            danger
            onPress={() => setView('block')}
          />
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={tr('common.cancel')}
            style={({ pressed }) => [styles.cancel, { borderColor: t.color.line }, pressed && { opacity: 0.9 }]}
          >
            <AppText variant="body" style={{ fontWeight: '600' }}>
              {tr('common.cancel')}
            </AppText>
          </Pressable>
        </View>
      ) : view === 'report' ? (
        <View style={styles.group}>
          <AppText variant="heading" style={styles.title}>
            {tr('kesfet.ui.report_title')}
          </AppText>
          {REPORT_REASONS.map((reason) => (
            <MenuRow
              key={reason}
              icon="flag"
              label={tr(`kesfet.ui.report_reason.${reason}`)}
              onPress={() => {
                haptic('selection');
                onReport(reason);
                close();
              }}
            />
          ))}
          <Pressable
            onPress={() => setView('menu')}
            accessibilityRole="button"
            accessibilityLabel={tr('common.cancel')}
            style={({ pressed }) => [styles.cancel, { borderColor: t.color.line }, pressed && { opacity: 0.9 }]}
          >
            <AppText variant="body" style={{ fontWeight: '600' }}>
              {tr('common.cancel')}
            </AppText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.group}>
          <AppText variant="heading" style={styles.title}>
            {tr('kesfet.ui.block_confirm_title', { name: authorName })}
          </AppText>
          <AppText variant="body" tone="secondary" style={styles.desc}>
            {tr('kesfet.ui.block_confirm_desc')}
          </AppText>
          <Pressable
            onPress={() => {
              haptic('medium');
              onBlock();
              close();
            }}
            accessibilityRole="button"
            accessibilityLabel={tr('kesfet.ui.menu.block')}
            style={({ pressed }) => [styles.blockBtn, { backgroundColor: t.color.danger, opacity: pressed ? 0.9 : 1 }]}
          >
            <AppText variant="body" style={{ color: '#FFFFFF', fontWeight: '700' }}>
              {tr('kesfet.ui.menu.block')}
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => setView('menu')}
            accessibilityRole="button"
            accessibilityLabel={tr('common.cancel')}
            style={({ pressed }) => [styles.cancel, { borderColor: t.color.line }, pressed && { opacity: 0.9 }]}
          >
            <AppText variant="body" style={{ fontWeight: '600' }}>
              {tr('common.cancel')}
            </AppText>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: 4, paddingBottom: 4 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 8, borderRadius: 14 },
  title: { marginBottom: 4 },
  desc: { marginBottom: 12 },
  cancel: { minHeight: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  blockBtn: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
