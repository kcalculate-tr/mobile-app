// Yorumlar alt sayfası — G8 (yalnız `kesfet_yorum` açıkken). Liste (eski → yeni,
// tek seviye yanıt), yazma kutusu, kendi yorumunu silme, ⋯ şikayet/engelle.
// add_comment → moderate-content (store yönetir). İyimser ekleme; sunucu onayı.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, useTheme, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';

import { useSheetRise } from '../motion';
import { useCommentsStore } from '../commentsStore';
import type { Comment, CommentAuthor } from '../types';
import { Avatar } from './Avatar';
import { Icon } from './icons';
import { BottomSheet } from './BottomSheet';
import { relativeTime, REPORT_REASONS, type ReportReason, type UiLang } from './format';

const MAX_LEN = 500;

function CommentRow({
  comment,
  nowMs,
  lang,
  depth,
  onReply,
  onDelete,
  onMenu,
}: {
  comment: Comment;
  nowMs: number;
  lang: UiLang;
  depth: number;
  onReply: (c: Comment) => void;
  onDelete: (c: Comment) => void;
  onMenu: (c: Comment) => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const time = comment.created_at ? relativeTime(comment.created_at, nowMs, lang) : '';
  return (
    <View style={[styles.row, depth > 0 && styles.rowReply]}>
      <Avatar name={comment.author.display_name} url={comment.author.avatar_url} official={false} size={32} />
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <AppText variant="caption" style={styles.rowName} numberOfLines={1}>
            {comment.author.display_name}
          </AppText>
          {comment.author.verified ? <Icon name="seal" size={13} color={t.color.accentLine} /> : null}
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.rowHandle}>
            @{comment.author.handle}
            {time ? ` · ${time}` : ''}
          </AppText>
        </View>
        <AppText variant="body" style={styles.rowText}>
          {comment.body}
        </AppText>
        <View style={styles.rowActions}>
          {depth === 0 ? (
            <Pressable onPress={() => onReply(comment)} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr('kesfet.comments.reply')}>
              <AppText variant="caption" tone="secondary" style={styles.rowAction}>
                {tr('kesfet.comments.reply')}
              </AppText>
            </Pressable>
          ) : null}
          {comment.can_delete ? (
            <Pressable onPress={() => onDelete(comment)} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr('common.delete')}>
              <AppText variant="caption" tone="secondary" style={styles.rowAction}>
                {tr('common.delete')}
              </AppText>
            </Pressable>
          ) : (
            <Pressable onPress={() => onMenu(comment)} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr('kesfet.ui.a11y.more')}>
              <Icon name="more" size={16} color={t.color.secondary} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export function CommentsSheet({
  visible,
  postId,
  currentUser,
  onClose,
  onToast,
}: {
  visible: boolean;
  postId: string | null;
  currentUser: CommentAuthor | null;
  onClose: () => void;
  onToast?: (message: string) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { t: tr, lang } = useT();

  const items = useCommentsStore((s) => s.items);
  const loading = useCommentsStore((s) => s.loading);
  const hasMore = useCommentsStore((s) => s.hasMore);
  const loadingMore = useCommentsStore((s) => s.loadingMore);
  const submitting = useCommentsStore((s) => s.submitting);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [menuTarget, setMenuTarget] = useState<Comment | null>(null);
  const keySeq = useRef(0);
  const nowMs = Date.now();

  useEffect(() => {
    if (visible && postId) {
      void useCommentsStore.getState().open(postId);
      setText('');
      setReplyTo(null);
    }
    if (!visible) useCommentsStore.getState().reset();
  }, [visible, postId]);

  // Tek seviye: üst yorumlar + hemen altına yanıtları. parent_id null → üst.
  const ordered: Array<{ c: Comment; depth: number }> = [];
  const byParent = new Map<string, Comment[]>();
  for (const c of items) {
    if (c.parent_id) {
      const arr = byParent.get(c.parent_id) ?? [];
      arr.push(c);
      byParent.set(c.parent_id, arr);
    }
  }
  for (const c of items) {
    if (!c.parent_id) {
      ordered.push({ c, depth: 0 });
      for (const r of byParent.get(c.id) ?? []) ordered.push({ c: r, depth: 1 });
    }
  }

  const submit = useCallback(async () => {
    const body = text.trim();
    if (!body || submitting) return;
    const author: CommentAuthor =
      currentUser ?? { id: 'me', display_name: tr('common.you'), handle: '', avatar_url: null, verified: false };
    keySeq.current += 1;
    const key = `comment-${postId}-${keySeq.current}`;
    setText('');
    const parent = replyTo?.id ?? null;
    setReplyTo(null);
    haptic('light');
    const id = await useCommentsStore.getState().add(body, author, parent, key);
    if (id) onToast?.(tr('kesfet.comments.sent'));
  }, [text, submitting, currentUser, tr, postId, replyTo, onToast]);

  const remaining = MAX_LEN - text.length;
  const { panelStyle, backdropStyle, onLayout } = useSheetRise(visible);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.fill}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('common.close')} />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <Animated.View onLayout={onLayout} style={[styles.sheet, panelStyle, { backgroundColor: t.color.bg }]}>
            <View style={[styles.handle, { backgroundColor: t.color.line }]} />
            <AppText variant="heading" style={styles.title}>
              {tr('kesfet.comments.title')}
            </AppText>

            {loading && items.length === 0 ? (
              <View style={styles.center}>
                <AppText variant="caption" tone="secondary">{tr('kesfet.ui.loading')}</AppText>
              </View>
            ) : ordered.length === 0 ? (
              <View style={styles.center}>
                <AppText variant="body" tone="secondary">{tr('kesfet.comments.empty')}</AppText>
              </View>
            ) : (
              <FlatList
                data={ordered}
                keyExtractor={(it) => it.c.id}
                renderItem={({ item }) => (
                  <CommentRow
                    comment={item.c}
                    depth={item.depth}
                    nowMs={nowMs}
                    lang={lang as UiLang}
                    onReply={(c) => setReplyTo(c)}
                    onDelete={(c) => void useCommentsStore.getState().remove(c.id)}
                    onMenu={(c) => setMenuTarget(c)}
                  />
                )}
                onEndReachedThreshold={0.5}
                onEndReached={() => {
                  if (hasMore && !loadingMore) void useCommentsStore.getState().loadMore();
                }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.listContent}
                style={styles.list}
              />
            )}

            {replyTo ? (
              <View style={styles.replyBar}>
                <AppText variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                  {tr('kesfet.comments.replying_to', { name: replyTo.author.display_name })}
                </AppText>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr('common.cancel')}>
                  <Icon name="x" size={16} color={t.color.secondary} />
                </Pressable>
              </View>
            ) : null}

            <View style={[styles.inputRow, { borderTopColor: t.color.line, paddingBottom: Math.max(insets.bottom, 8) }]}>
              <TextInput
                value={text}
                onChangeText={(v) => setText(v.slice(0, MAX_LEN))}
                placeholder={tr('kesfet.comments.placeholder')}
                placeholderTextColor={t.color.secondary}
                style={[styles.input, { color: t.color.ink, backgroundColor: t.color.surface }]}
                multiline
                accessibilityLabel={tr('kesfet.comments.placeholder')}
              />
              <Pressable
                onPress={submit}
                disabled={!text.trim() || submitting}
                accessibilityRole="button"
                accessibilityLabel={tr('kesfet.comments.send')}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.sendBtn,
                  { backgroundColor: text.trim() ? t.color.ink : t.color.line, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Icon name="share" size={18} color={text.trim() ? t.color.surface : t.color.secondary} />
              </Pressable>
            </View>
            {text.length > MAX_LEN - 60 ? (
              <AppText variant="caption" tone="secondary" style={styles.counter}>
                {remaining}
              </AppText>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>

        {/* Yorum ⋯ — şikayet / engelle */}
        <BottomSheet
          visible={menuTarget != null}
          onClose={() => setMenuTarget(null)}
          accessibilityLabel={tr('kesfet.ui.a11y.more')}
        >
          <View style={styles.menuGroup}>
            <AppText variant="heading" style={styles.menuTitle}>{tr('kesfet.ui.report_title')}</AppText>
            {REPORT_REASONS.map((reason: ReportReason) => (
              <Pressable
                key={reason}
                onPress={() => {
                  const c = menuTarget;
                  setMenuTarget(null);
                  if (c) {
                    void useCommentsStore.getState().report(c.id, reason);
                    onToast?.(tr('kesfet.ui.report_toast'));
                  }
                }}
                style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: t.color.surface }]}
                accessibilityRole="button"
                accessibilityLabel={tr(`kesfet.ui.report_reason.${reason}`)}
              >
                <Icon name="flag" size={20} color={t.color.ink} />
                <AppText variant="body">{tr(`kesfet.ui.report_reason.${reason}`)}</AppText>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                const c = menuTarget;
                setMenuTarget(null);
                if (c) {
                  void useCommentsStore.getState().blockAuthor(c.author.id);
                  onToast?.(tr('kesfet.ui.blocked_toast', { name: c.author.display_name }));
                }
              }}
              style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: t.color.surface }]}
              accessibilityRole="button"
              accessibilityLabel={tr('kesfet.ui.menu.block')}
            >
              <Icon name="slash" size={20} color={t.color.danger} />
              <AppText variant="body" style={{ color: t.color.danger }}>{tr('kesfet.ui.menu.block')}</AppText>
            </Pressable>
          </View>
        </BottomSheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,10,0.4)' },
  sheetWrap: { maxHeight: '85%' },
  sheet: { height: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16 },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 8, marginBottom: 8 },
  title: { marginBottom: 8 },
  center: { flex: 1, minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0, maxHeight: 420 },
  listContent: { paddingBottom: 8 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  rowReply: { marginLeft: 36 },
  rowBody: { flex: 1, minWidth: 0 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowName: { fontWeight: '700', flexShrink: 1 },
  rowHandle: { flexShrink: 1 },
  rowText: { marginTop: 2, fontSize: 15, lineHeight: 21 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  rowAction: { fontWeight: '600' },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  counter: { alignSelf: 'flex-end', marginTop: 2 },
  menuGroup: { gap: 2, paddingBottom: 8 },
  menuTitle: { marginBottom: 6 },
  menuRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, borderRadius: 12 },
});
