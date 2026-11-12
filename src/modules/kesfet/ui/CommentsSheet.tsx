// Yorumlar alt sayfası — Final FinComments (G15-S3). Yalnız `kesfet_yorum` açıkken.
//  1) Liste: ortalı "Yorumlar · N"; satır = avatar 36 (yanıt 28, 52 girinti), ad +
//     @kullanıcı · süre + ⋯, metin, "Yanıtla" (+ kendi yorumunda "Sil"). Altta
//     avatar + "Yorum yaz" hapı + siyah yuvarlak gönder.
//  2) ⋯ → "<Ad> adlı kişinin yorumu": Şikayet et (tam sayfa ReportFlow) · Engelle
//     (onay) · Vazgeç.
//  3) Boş: sohbet ikonu, "İlk yorumu sen yaz", kısa not.
// add_comment → moderate-content (store yönetir). İyimser ekleme; sunucu onayı.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { AppText, fontFamily, useTheme, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { KeyboardLiftView } from '../../../core/design/components/KeyboardLiftView';
import { CountPill } from '../../../core/design/components/CountPill';

import { useSheetRise } from '../motion';
import { useCommentsStore } from '../commentsStore';
import type { Comment, CommentAuthor } from '../types';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './icons';
import { BottomSheet } from './BottomSheet';
import { BlockConfirm, ReportModal, reportReasonText } from './ReportFlow';
import { relativeTime, type UiLang } from './format';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

const MAX_LEN = 500;

const SEND_PATH =
  'M231.87,114l-168-95.89A16,16,0,0,0,40.92,37.34L71.55,128,40.92,218.67A16,16,0,0,0,56,240a16.15,16.15,0,0,0,7.93-2.1l167.92-96.05a16,16,0,0,0,.05-27.89ZM56,224a.56.56,0,0,0,0-.12L85.74,136H144a8,8,0,0,0,0-16H85.74L56.06,32.16A.46.46,0,0,0,56,32l168,95.83Z';
const BUBBLE_PATH =
  'M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z';

function Glyph({ d, size, color }: { d: string; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" accessible={false}>
      <Path d={d} fill={color} />
    </Svg>
  );
}

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
      <Avatar
        name={comment.author.display_name}
        url={comment.author.avatar_url}
        official={false}
        size={depth > 0 ? 28 : 36}
      />
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <AppText variant="caption" style={[styles.rowName, { color: t.color.ink }]} numberOfLines={1}>
            {comment.author.display_name}
          </AppText>
          {comment.author.verified ? <Icon name="seal" size={13} color={t.color.accentLine} /> : null}
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.rowHandle}>
            {comment.author.handle ? `@${comment.author.handle}` : ''}
            {time ? `${comment.author.handle ? ', ' : ''}${time}` : ''}
          </AppText>
          {!comment.can_delete ? (
            <Pressable
              onPress={() => onMenu(comment)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={tr('kesfet.ui.a11y.more')}
              style={styles.more}
            >
              <Icon name="more" size={16} color={t.color.secondary} />
            </Pressable>
          ) : null}
        </View>
        <AppText variant="body" style={[styles.rowText, { color: t.color.ink }]}>
          {comment.body}
        </AppText>
        <View style={styles.rowActions}>
          <Pressable
            onPress={() => onReply(comment)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={tr('kesfet.comments.reply')}
            style={styles.actionHit}
          >
            <AppText variant="caption" tone="secondary" style={styles.rowAction}>
              {tr('kesfet.comments.reply')}
            </AppText>
          </Pressable>
          {comment.can_delete ? (
            <Pressable
              onPress={() => onDelete(comment)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={tr('common.delete')}
              style={styles.actionHit}
            >
              <AppText variant="caption" tone="secondary" style={styles.rowAction}>
                {tr('common.delete')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function MenuRow({ icon, label, last, onPress }: { icon: IconName; label: string; last?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.menuRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: t.color.line },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Icon name={icon} size={22} color={t.color.ink} />
      <AppText variant="body" style={[styles.menuText, { color: t.color.ink }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function CommentsSheet({
  visible,
  postId,
  currentUser,
  count,
  onClose,
  onToast,
  vitrinMenu,
}: {
  visible: boolean;
  postId: string | null;
  currentUser: CommentAuthor | null;
  /** Başlıktaki sayı (gönderinin yorum sayacı); yoksa yüklenen yorum sayısı. */
  count?: number;
  onClose: () => void;
  onToast?: (message: string) => void;
  /** YALNIZ __DEV__ vitrini: FinComments kare 2 — ilk yorumun ⋯ menüsü açık. */
  vitrinMenu?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { t: tr, lang, fmt } = useT();

  const items = useCommentsStore((s) => s.items);
  const loading = useCommentsStore((s) => s.loading);
  const hasMore = useCommentsStore((s) => s.hasMore);
  const loadingMore = useCommentsStore((s) => s.loadingMore);
  const submitting = useCommentsStore((s) => s.submitting);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [menuTarget, setMenuTarget] = useState<Comment | null>(null);
  const [menuView, setMenuView] = useState<'menu' | 'block'>('menu');
  const [reportTarget, setReportTarget] = useState<Comment | null>(null);
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

  // Vitrin: ilk (başkasının) yorumun menüsü.
  useEffect(() => {
    if (!vitrinMenu || !visible || items.length === 0 || menuTarget) return;
    const first = items.find((c) => !c.can_delete);
    if (first) {
      setMenuView('menu');
      setMenuTarget(first);
    }
  }, [vitrinMenu, visible, items, menuTarget]);

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
    // Yanıtlar tek seviye: yanıta yanıt → üst yoruma bağlanır.
    const parent = replyTo ? replyTo.parent_id ?? replyTo.id : null;
    setReplyTo(null);
    haptic('light');
    const id = await useCommentsStore.getState().add(body, author, parent, key);
    if (id) onToast?.(tr('kesfet.comments.sent'));
  }, [text, submitting, currentUser, tr, postId, replyTo, onToast]);

  const remaining = MAX_LEN - text.length;
  const { panelStyle, backdropStyle, onLayout } = useSheetRise(visible);
  // Liste boş geldiyse (silinmiş/gizlenmiş yorumlar) sayaç 0 — başlık listeyle çelişmesin.
  const shownCount = !loading && ordered.length === 0 ? 0 : count ?? ordered.length;
  const line2 = t.isDark ? '#48484A' : '#C3C7CC';
  const onInk = t.isDark ? '#0A0A0A' : '#FFFFFF';
  const closeMenu = () => {
    setMenuTarget(null);
    setMenuView('menu');
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.fill}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('common.close')} />
        </Animated.View>
        {/* G21-S1 md.10: KAV (Android'de davranışsız) yerine ortak KeyboardLiftView. */}
        <KeyboardLiftView limitHeight testID="comments-lift">
          <Animated.View
            onLayout={onLayout}
            accessibilityViewIsModal
            style={[
              styles.sheet,
              panelStyle,
              { backgroundColor: t.color.bg, paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: line2 }]} />
            {/* G38 md.4: "Yorumlar (12)" yerine başlık + sayı hapı. */}
            <View
              style={styles.titleRow}
              accessible
              accessibilityRole="header"
              accessibilityLabel={`${tr('kesfet.comments.title')}, ${fmt(shownCount)}`}
              testID="comments-title"
            >
              <AppText style={[styles.title, { color: t.color.ink }]}>{tr('kesfet.comments.title')}</AppText>
              <CountPill count={shownCount} max={999} bg={line2} fg={t.color.ink} testID="comments-count" />
            </View>

            {loading && items.length === 0 ? (
              <View style={styles.center}>
                <AppText variant="caption" tone="secondary">{tr('kesfet.ui.loading')}</AppText>
              </View>
            ) : ordered.length === 0 ? (
              <View style={styles.empty}>
                <Glyph d={BUBBLE_PATH} size={32} color={t.color.secondary} />
                <AppText style={[styles.emptyTitle, { color: t.color.ink }]}>{tr('kesfet.comments.empty_title')}</AppText>
                <AppText variant="caption" tone="secondary" style={styles.emptySub}>
                  {tr('kesfet.comments.empty_sub')}
                </AppText>
              </View>
            ) : (
              <FlatList {...SCROLL_KEYBOARD}
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
                    onMenu={(c) => {
                      setMenuView('menu');
                      setMenuTarget(c);
                    }}
                  />
                )}
                onEndReachedThreshold={0.5}
                onEndReached={() => {
                  if (hasMore && !loadingMore) void useCommentsStore.getState().loadMore();
                }}
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

            <View style={styles.inputRow}>
              <Avatar
                name={currentUser?.display_name ?? ''}
                url={currentUser?.avatar_url ?? null}
                official={false}
                size={32}
              />
              <TextInput
                value={text}
                onChangeText={(v) => setText(v.slice(0, MAX_LEN))}
                placeholder={tr('kesfet.comments.placeholder_short')}
                placeholderTextColor={t.color.secondary}
                style={[
                  styles.input,
                  { color: t.color.ink, backgroundColor: t.color.surface, borderColor: t.color.line },
                ]}
                multiline
                accessibilityLabel={tr('kesfet.comments.placeholder_short')}
              />
              <Pressable
                onPress={submit}
                disabled={!text.trim() || submitting}
                accessibilityRole="button"
                accessibilityState={{ disabled: !text.trim() || submitting }}
                accessibilityLabel={tr('kesfet.comments.send')}
                hitSlop={4}
                style={({ pressed }) => [styles.sendBtn, { backgroundColor: t.color.ink, opacity: pressed ? 0.85 : 1 }]}
              >
                <Glyph d={SEND_PATH} size={18} color={onInk} />
              </Pressable>
            </View>
            {text.length > MAX_LEN - 60 ? (
              <AppText variant="caption" tone="secondary" style={styles.counter}>
                {remaining}
              </AppText>
            ) : null}
          </Animated.View>
        </KeyboardLiftView>

        {/* Yorum ⋯ — Şikayet et / Engelle (FinComments kare 2) */}
        <BottomSheet visible={menuTarget != null} onClose={closeMenu} accessibilityLabel={tr('kesfet.ui.a11y.more')}>
          {menuView === 'menu' ? (
            <View>
              <AppText variant="caption" tone="secondary" style={styles.menuCaption}>
                {tr('kesfet.report.comment_menu_title', { name: menuTarget?.author.display_name ?? '' })}
              </AppText>
              <MenuRow
                icon="flag"
                label={tr('kesfet.ui.menu.report')}
                onPress={() => {
                  const c = menuTarget;
                  closeMenu();
                  setReportTarget(c);
                }}
              />
              <MenuRow icon="slash" label={tr('kesfet.ui.menu.block')} onPress={() => setMenuView('block')} />
              <Pressable
                onPress={closeMenu}
                accessibilityRole="button"
                accessibilityLabel={tr('common.cancel')}
                style={({ pressed }) => [styles.cancel, { borderColor: line2 }, pressed && { opacity: 0.9 }]}
              >
                <AppText variant="body" style={[styles.cancelText, { color: t.color.ink }]}>
                  {tr('common.cancel')}
                </AppText>
              </Pressable>
            </View>
          ) : (
            <BlockConfirm
              name={menuTarget?.author.display_name ?? ''}
              onConfirm={() => {
                const c = menuTarget;
                closeMenu();
                if (c) {
                  void useCommentsStore.getState().blockAuthor(c.author.id);
                  onToast?.(tr('kesfet.ui.blocked_toast', { name: c.author.display_name }));
                }
              }}
              onCancel={() => setMenuView('menu')}
            />
          )}
        </BottomSheet>

        <ReportModal
          visible={reportTarget != null}
          authorName={reportTarget?.author.display_name ?? ''}
          onSubmit={(reason, note) =>
            reportTarget ? useCommentsStore.getState().report(reportTarget.id, reportReasonText(reason, note)) : false
          }
          onBlock={() => {
            const c = reportTarget;
            if (c) {
              void useCommentsStore.getState().blockAuthor(c.author.id);
              onToast?.(tr('kesfet.ui.blocked_toast', { name: c.author.display_name }));
            }
          }}
          onClose={() => setReportTarget(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,10,0.4)' },
  sheet: { flexShrink: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16 },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 8, marginBottom: 16 },
  title: { textAlign: 'center', fontSize: 15, lineHeight: 21, fontFamily: fontFamily.bodyBold },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  center: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingTop: 40, paddingBottom: 60, alignItems: 'center', gap: 8 },
  emptyTitle: { fontFamily: fontFamily.headingBold, fontSize: 18, lineHeight: 24 },
  emptySub: { fontSize: 13, textAlign: 'center' },
  list: { flexGrow: 0, flexShrink: 1, maxHeight: 470 },
  row: { flexDirection: 'row', gap: 10, paddingTop: 10, paddingBottom: 2 },
  rowReply: { paddingLeft: 52 },
  rowBody: { flex: 1, minWidth: 0 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowName: { fontSize: 13, fontFamily: fontFamily.bodyBold, flexShrink: 1 },
  rowHandle: { fontSize: 13, flexShrink: 1 },
  more: { marginLeft: 'auto', paddingLeft: 8 },
  rowText: { fontSize: 14, lineHeight: 20 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actionHit: { minHeight: 32, justifyContent: 'center' },
  rowAction: { fontSize: 13, fontFamily: fontFamily.bodySemibold },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 },
  inputRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    fontFamily: fontFamily.bodyRegular,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  counter: { alignSelf: 'flex-end', marginTop: 2 },
  menuCaption: { fontSize: 13, paddingTop: 4, paddingBottom: 6 },
  menuRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuText: { fontSize: 16, lineHeight: 22 },
  cancel: { height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  cancelText: { fontSize: 15, fontFamily: fontFamily.bodySemibold },
});
