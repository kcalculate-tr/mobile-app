// Sosyal bildirimler alt sayfası — G8 (yalnız `sosyal_bildirim` açıkken).
// Liste + okunmamış vurgusu; açılışta okundu işaretlenir. Dokun → gönderi/profil.
import React, { useEffect } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';

import { useSheetRise } from '../motion';
import { useNotificationsStore } from '../notificationsStore';
import type { SocialNotification } from '../types';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './icons';
import { relativeTime, type UiLang } from './format';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

function iconForKind(kind: SocialNotification['kind']): IconName {
  switch (kind) {
    case 'like': return 'heartFill';
    case 'comment':
    case 'reply': return 'chat';
    case 'did_it': return 'run';
    case 'add_to_day': return 'plus';
    default: return 'seal'; // follow / follow_request / follow_accept
  }
}

export function NotificationsSheet({
  visible,
  onClose,
  onOpenPost,
  onOpenProfile,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenPost: (postId: string) => void;
  onOpenProfile: (handle: string) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { t: tr, lang } = useT();
  const { panelStyle, backdropStyle, onLayout } = useSheetRise(visible);

  const items = useNotificationsStore((s) => s.items);
  const loading = useNotificationsStore((s) => s.loading);
  const hasMore = useNotificationsStore((s) => s.hasMore);
  const loadingMore = useNotificationsStore((s) => s.loadingMore);
  const nowMs = Date.now();

  useEffect(() => {
    if (visible) {
      void useNotificationsStore.getState().load().then(() => {
        // Açılışta okundu işaretle (rozet sıfırlanır).
        void useNotificationsStore.getState().markAllRead();
      });
    }
  }, [visible]);

  const renderItem = ({ item }: { item: SocialNotification }) => {
    const unread = item.read_at == null;
    const time = relativeTime(item.created_at, nowMs, lang as UiLang);
    return (
      <Pressable
        onPress={() => {
          onClose();
          if (item.post_id) onOpenPost(item.post_id);
          else onOpenProfile(item.actor.handle);
        }}
        style={({ pressed }) => [
          styles.row,
          unread && { backgroundColor: t.color.surface },
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
      >
        <View style={styles.avatarWrap}>
          <Avatar name={item.actor.display_name} url={item.actor.avatar_url} official={false} size={40} />
          <View style={[styles.kindBadge, { backgroundColor: t.color.ink }]}>
            <Icon name={iconForKind(item.kind)} size={11} color={t.color.surface} />
          </View>
        </View>
        <View style={styles.rowBody}>
          <AppText variant="body" numberOfLines={2}>
            <AppText variant="body" style={{ fontWeight: '700' }}>{item.actor.display_name}</AppText>
            {' '}
            {tr(`kesfet.notif.${item.kind}`)}
          </AppText>
          {time ? <AppText variant="caption" tone="secondary">{time}</AppText> : null}
        </View>
        {unread ? <View style={[styles.dot, { backgroundColor: t.color.accentLine }]} /> : null}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.fill}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('common.close')} />
        </Animated.View>
        <Animated.View onLayout={onLayout} style={[styles.sheet, panelStyle, { backgroundColor: t.color.bg, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={[styles.handle, { backgroundColor: t.color.line }]} />
          <AppText variant="heading" style={styles.title}>{tr('kesfet.notif.title')}</AppText>
          {loading && items.length === 0 ? (
            <View style={styles.center}><AppText variant="caption" tone="secondary">{tr('kesfet.ui.loading')}</AppText></View>
          ) : items.length === 0 ? (
            <View style={styles.center}><AppText variant="body" tone="secondary">{tr('kesfet.notif.empty')}</AppText></View>
          ) : (
            <FlatList {...SCROLL_KEYBOARD}
              data={items}
              keyExtractor={(n) => n.id}
              renderItem={renderItem}
              onEndReachedThreshold={0.5}
              onEndReached={() => { if (hasMore && !loadingMore) void useNotificationsStore.getState().loadMore(); }}
              style={styles.list}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,10,0.4)' },
  sheet: { maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 12 },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 8, marginBottom: 8 },
  title: { paddingHorizontal: 4, marginBottom: 4 },
  center: { minHeight: 140, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14 },
  avatarWrap: { width: 40, height: 40 },
  kindBadge: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
