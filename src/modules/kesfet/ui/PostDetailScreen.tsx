// Gönderi detayı — Final FinDetail (G15-S3). YALNIZ `kesfet` bayrağı açıkken
// SharedPostScreen bunu çizer (bayrak kapalı → eski derin bağlantı ekranı aynen).
//
// Düzen: "← Gönderi" üst çubuğu · yazar satırı (avatar, ad, @kullanıcı, ⋯) · metin ·
// büyük görsel · öğün kartı ("Ben de logla" — metin KIRPILMAZ) ya da etkinlik
// kartı · "SS:DD · G Ay" · istatistik satırı (N Ben de logladı · N Beğeni ·
// N Kaydetme) · ikon satırı (yorum, ben de logla, beğen, kaydet, paylaş) · ayraç ·
// yorumlar (kesfet_yorum) · altta sabit "Yanıtını yaz".
//
// Veri yalnız gerçek alanlardan: görüntülenme sayısı FeedPost'ta yok → gösterilmez;
// yorum satırında yalnız gerçek sayaç (yanıt sayısı) var.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SCREEN_KEYBOARD_BEHAVIOR } from '../../../core/design/keyboard';
import { CoachRecipeButton } from '../../coach/ui/entries';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path } from 'react-native-svg';
import { AppText, fontFamily, useTheme, haptic, FinListSkeleton, FinSkeletonBlock } from '../../../core/design';
import { useFeature } from '../../../core/flags';
import { useT } from '../../../core/i18n';
import { ArrowLeft } from '../../../components/icons';
import { getKesfetClient } from '../client';
import { useKesfetStore } from '../store';
import { inferMealTypeFromHour } from '../../ai/scan/mealTypeFromHour';
import type { Comment, FeedPost } from '../types';
import { Avatar } from './Avatar';
import { VerifiedBadge } from './VerifiedBadge';
import { MediaGrid } from './MediaGrid';
import { ActivityCard } from './ActivityCard';
import { DidItSheet } from './DidItSheet';
import { PostMenu } from './PostMenu';
import { AddToast, type ToastState } from './AddToast';
import { Icon } from './icons';
import { postLink, relativeTime, roleBadgeKey, type ReportReason, type UiLang } from './format';
import { track } from '../../../lib/analytics';

// Final ikonları: yorum (ChatCircle) ve "ben de logla" (tarama çerçevesi + artı).
const CHAT =
  'M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z';
const SCAN_PLUS =
  'M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8 M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8 M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16 M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16 M12 8.5v7 M8.5 12h7';

function ChatIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" accessible={false}>
      <Path d={CHAT} fill={color} />
    </Svg>
  );
}
function ScanPlusIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d={SCAN_PLUS} stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const MONTHS: Record<UiLang, string[]> = {
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** "13:05 · 6 Kas" — yerel saat. Geçersiz tarih → boş. */
export function detailTimestamp(iso: string, lang: UiLang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const mon = MONTHS[lang][d.getMonth()];
  return lang === 'en' ? `${hh}:${mm}, ${mon} ${d.getDate()}` : `${hh}:${mm}, ${d.getDate()} ${mon}`;
}

function IconCount({
  icon,
  count,
  label,
  onPress,
  color,
}: {
  icon: React.ReactNode;
  count?: number | null;
  label: string;
  onPress?: () => void;
  color: string;
}) {
  const { fmt } = useT();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={count != null ? `${label} (${count})` : label}
      hitSlop={8}
      style={styles.iconCount}
    >
      {icon}
      {count != null ? (
        <AppText variant="caption" style={[styles.iconCountText, { color }]}>
          {fmt(count)}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** Öğün kartı — FinDetail sürümü: "N kişi logladı" + lime "⊡ Ben de logla" (kırpılmaz). */
function DetailMealCard({ post, onLog }: { post: FeedPost; onLog: () => void }) {
  const t = useTheme();
  const { t: tr, fmt } = useT();
  const meal = post.meal_card!;
  return (
    <View style={[styles.mealCard, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
      <View style={styles.mealRow}>
        <View style={[styles.mealThumb, { backgroundColor: t.color.line }]}>
          {meal.photo_url ? (
            <Image source={{ uri: meal.photo_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
        </View>
        <View style={styles.mealInfo}>
          <AppText variant="caption" style={styles.mealName} numberOfLines={2}>
            {meal.name}
          </AppText>
          <AppText variant="caption" tone="secondary" style={styles.mealMacro} numberOfLines={1}>
            {tr('kesfet.ui.meal_card.macro', { kcal: fmt(meal.kcal), protein: fmt(meal.protein_g) })}
          </AppText>
          <View style={styles.chips}>
            {([
              ['P', meal.protein_g],
              ['K', meal.carbs_g],
              ['Y', meal.fat_g],
            ] as const).map(([k, v]) => (
              <View key={k} style={[styles.chip, { backgroundColor: t.color.line }]}>
                <AppText variant="caption" style={styles.chipText}>
                  {`${k} ${fmt(Math.round(v))}`}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={[styles.mealFoot, { borderTopColor: t.color.line }]}>
        <AppText variant="caption" tone="secondary" style={styles.mealCount} numberOfLines={1}>
          {post.stats.adds > 0 ? tr('kesfet.ui.meal_card.logged_count', { count: post.stats.adds }) : ''}
        </AppText>
        <Pressable
          onPress={onLog}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.detail.me_too')}
          hitSlop={6}
          style={({ pressed }) => [styles.logPill, { backgroundColor: t.color.accent }, pressed && { opacity: 0.85 }]}
        >
          <ScanPlusIcon size={16} color={t.color.onAccent} />
          {/* Metin sığmazsa satır büyür; KIRPILMAZ (numberOfLines yok, flexShrink 0). */}
          <AppText variant="caption" style={[styles.logPillText, { color: t.color.onAccent }]}>
            {tr('kesfet.detail.me_too')}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function CommentRow({
  comment,
  nowMs,
  reply,
  onReply,
}: {
  comment: Comment;
  nowMs: number;
  reply?: boolean;
  onReply: () => void;
}) {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const badge = roleBadgeKey(comment.author.role ?? '');
  const time = comment.created_at ? relativeTime(comment.created_at, nowMs, lang as UiLang) : '';
  return (
    <View style={[styles.comment, reply && styles.commentReply, { borderBottomColor: t.color.line }]}>
      <Avatar name={comment.author.display_name} url={comment.author.avatar_url} size={reply ? 32 : 40} />
      <View style={styles.commentBody}>
        <View style={styles.commentHead}>
          <AppText variant="caption" style={styles.commentName} numberOfLines={1}>
            {comment.author.display_name}
          </AppText>
          {comment.author.verified ? <VerifiedBadge size={14} /> : null}
          {badge ? (
            <AppText variant="caption" tone="secondary" style={styles.commentMeta} numberOfLines={1}>
              {tr(`kesfet.ui.badge.${badge}`)}
            </AppText>
          ) : null}
          <AppText variant="caption" tone="secondary" style={[styles.commentMeta, styles.shrink]} numberOfLines={1}>
            {comment.author.handle ? `@${comment.author.handle}` : ''}
            {time ? `, ${time}` : ''}
          </AppText>
        </View>
        <AppText variant="caption" style={styles.commentText}>
          {comment.body}
        </AppText>
        {!reply ? (
          <View style={styles.commentActions}>
            <IconCount
              icon={<ChatIcon size={16} color={t.color.secondary} />}
              count={comment.reply_count}
              label={tr('kesfet.comments.reply')}
              onPress={onReply}
              color={t.color.secondary}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function PostDetailScreen({
  postId,
  onBack,
  onOpenAuthor,
}: {
  postId: string;
  onBack: () => void;
  /** G21-S1 md.8 — yazara dokun = açık profil (handle, @ olmadan). */
  onOpenAuthor?: (handle: string) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { t: tr, fmt, lang } = useT();
  const yorum = useFeature('kesfet_yorum');

  const [post, setPost] = useState<FeedPost | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [didItOpen, setDidItOpen] = useState(false);
  const [didItDone, setDidItDone] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const inputRef = useRef<TextInput>(null);
  const seq = useRef(0);

  // Yorumlar YEREL durumda (CommentsSheet'in ortak store'u görünmezken sıfırlanır —
  // akış ekranı altta açıkken detaydaki listeyi silmesin).
  const [comments, setComments] = useState<Comment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    getKesfetClient()
      .getPost({ post: postId })
      .then((p) => {
        if (!alive) return;
        setPost(p);
        setState(p ? 'ready' : 'notfound');
      })
      .catch(() => alive && setState('notfound'));
    return () => {
      alive = false;
    };
  }, [postId]);

  useEffect(() => {
    if (!yorum || !postId) return;
    let alive = true;
    getKesfetClient()
      .listComments({ post: postId, limit: 30 })
      .then((page) => alive && setComments(page.items))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [yorum, postId]);

  const nowMs = Date.now();

  const react = useCallback(
    (kind: 'like' | 'save') => {
      if (!post) return;
      haptic('light');
      const on = kind === 'like' ? !post.me.liked : !post.me.saved;
      // İyimser: sayaç + durum anında; hata olursa geri.
      const prev = post;
      setPost({
        ...post,
        me: { ...post.me, [kind === 'like' ? 'liked' : 'saved']: on },
        stats: {
          ...post.stats,
          [kind === 'like' ? 'likes' : 'saves']: Math.max(0, (kind === 'like' ? post.stats.likes : post.stats.saves) + (on ? 1 : -1)),
        },
      });
      void useKesfetStore
        .getState()
        .react(post.id, kind, on)
        .catch(() => setPost(prev));
    },
    [post],
  );

  const logMeToo = useCallback(async () => {
    if (!post) return;
    haptic('light');
    seq.current += 1;
    const mealType = inferMealTypeFromHour(new Date().getHours());
    const key = `kesfet-detail-${post.id}-${mealType}-${seq.current}`;
    const id = await useKesfetStore.getState().addToDay(post.id, mealType, 1, key);
    if (!id) return;
    setPost((p) => (p ? { ...p, stats: { ...p.stats, adds: p.stats.adds + 1 } } : p));
    setToast({ message: tr('kesfet.added_toast', { meal: tr(`meal.${mealType}`) }) });
  }, [post, tr]);

  const onShare = useCallback(() => {
    if (!post) return;
    void Share.share({ message: postLink(post.id), url: postLink(post.id) })
      .then((r) => { if (r?.action !== Share.dismissedAction) track('share', { target: 'post', surface: 'post_detail' }); })
      .catch(() => {});
  }, [post]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || submitting) return;
    seq.current += 1;
    const key = `detail-comment-${postId}-${seq.current}`;
    const author = { id: 'me', display_name: tr('common.you'), handle: '', avatar_url: null, verified: false };
    const parent = replyTo?.id ?? null;
    const tempId = `temp-${key}`;
    setText('');
    setReplyTo(null);
    setSubmitting(true);
    // İyimser: geçici yorum anında listede; sunucu onayında gerçek id/durum, hatada geri.
    setComments((list) => [
      ...list,
      { id: tempId, post_id: postId, author, parent_id: parent, body, status: 'pending', created_at: '', reply_count: 0, can_delete: true },
    ]);
    try {
      const res = await getKesfetClient().addComment({ post: postId, body, parent, idempotencyKey: key });
      setComments((list) => list.map((c) => (c.id === tempId ? { ...c, id: res.comment_id, status: res.status } : c)));
      getKesfetClient().moderateContent({ targetType: 'comment', targetId: res.comment_id }).catch(() => {});
      setToast({ message: tr('kesfet.comments.sent') });
    } catch {
      setComments((list) => list.filter((c) => c.id !== tempId));
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, postId, tr, replyTo]);

  // Tek seviye: üst yorumlar + hemen altına yanıtları (CommentsSheet ile aynı kural).
  const thread = useMemo(() => {
    const visible = comments.filter((c) => c.status !== 'removed');
    const byParent = new Map<string, Comment[]>();
    for (const c of visible) {
      if (c.parent_id) byParent.set(c.parent_id, [...(byParent.get(c.parent_id) ?? []), c]);
    }
    const out: Array<{ c: Comment; reply: boolean }> = [];
    for (const c of visible) {
      if (c.parent_id) continue;
      out.push({ c, reply: false });
      for (const r of byParent.get(c.id) ?? []) out.push({ c: r, reply: true });
    }
    return out;
  }, [comments]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: t.color.line }]}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={tr('kesfet.detail.back')}
        style={styles.back}
        hitSlop={4}
      >
        <ArrowLeft size={24} color={t.color.ink} />
      </Pressable>
      <AppText textRole="section" style={styles.headerTitle} accessibilityRole="header">
        {tr('kesfet.detail.title')}
      </AppText>
    </View>
  );

  if (state !== 'ready' || !post) {
    return (
      <View style={[styles.screen, { backgroundColor: t.color.bg }]}>
        {header}
        <View style={styles.center}>
          {state === 'loading' ? (
            // G22-S2 md.7: FinMoLoad iskeleti (yazar satırı + görsel).
            <View style={{ alignSelf: 'stretch', paddingHorizontal: 16, gap: 14 }}>
            <FinListSkeleton rows={1} style={{ paddingHorizontal: 0 }} testID="post-skeleton" />
            <FinSkeletonBlock height={280} radius={16} />
          </View>
          ) : (
            <AppText variant="body" tone="secondary">
              {tr('kesfet.share.post_unavailable')}
            </AppText>
          )}
        </View>
      </View>
    );
  }

  const badge = roleBadgeKey(post.author.role);
  const stamp = detailTimestamp(post.published_at, lang as UiLang);
  const iconColor = t.color.secondary;
  const isMeal = post.meal_card != null;

  return (
    <View style={[styles.screen, { backgroundColor: t.color.bg }]}>
      {header}
      <KeyboardAvoidingView style={styles.fill} behavior={SCREEN_KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.pad}>
            {/* Yazar */}
            <Pressable
              style={styles.author}
              onPress={onOpenAuthor && post.author.handle ? () => onOpenAuthor(post.author.handle) : undefined}
              disabled={!onOpenAuthor || !post.author.handle}
              accessibilityRole={onOpenAuthor ? 'link' : undefined}
              testID="post-detail-author"
            >
              <Avatar name={post.author.display_name} url={post.author.avatar_url} official={badge === 'official'} />
              <View style={styles.authorText}>
                <View style={styles.nameRow}>
                  <AppText variant="caption" style={styles.authorName} numberOfLines={1}>
                    {post.author.display_name}
                  </AppText>
                  {post.author.verified ? <VerifiedBadge size={16} /> : null}
                  {badge ? (
                    <AppText variant="caption" tone="secondary" style={styles.role} numberOfLines={1}>
                      {tr(`kesfet.ui.badge.${badge}`)}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="caption" tone="secondary" style={styles.handle} numberOfLines={1}>
                  @{post.author.handle}
                </AppText>
              </View>
              <Pressable
                onPress={() => setMenuOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={tr('kesfet.ui.a11y.post_menu')}
                style={styles.more}
                hitSlop={4}
              >
                <Icon name="more" size={20} color={t.color.secondary} />
              </Pressable>
            </Pressable>

            {post.body ? (
              <AppText variant="body" style={styles.body}>
                {post.body}
              </AppText>
            ) : null}

            {post.media.length > 0 ? (
              <View style={styles.media}>
                <MediaGrid media={post.media} postId={post.id} isVisible />
              </View>
            ) : null}

            {isMeal ? <DetailMealCard post={post} onLog={() => void logMeToo()} /> : null}
            {/* G24-S1 (FinRecipe Tur 26k): "Bu tarif bana uyar mı?" — Koç bu tarif + günün verisiyle açılır. */}
            {isMeal && post.meal_card ? (
              <View style={{ paddingHorizontal: 16 }}>
                <CoachRecipeButton postId={post.id} name={post.meal_card.name} />
              </View>
            ) : null}
            {post.post_type === 'etkinlik' && post.activity_card ? (
              <ActivityCard
                activity={post.activity_card}
                didItCount={post.stats.did_it}
                done={didItDone}
                onDidIt={() => setDidItOpen(true)}
              />
            ) : null}

            {stamp ? (
              <AppText variant="caption" tone="secondary" style={styles.stamp}>
                {stamp}
              </AppText>
            ) : null}

            {/* İstatistikler */}
            <View style={[styles.stats, { borderColor: t.color.line }]}>
              {isMeal ? (
                <AppText variant="caption" tone="secondary" style={styles.stat}>
                  <AppText variant="caption" style={styles.statNum}>{fmt(post.stats.adds)}</AppText>
                  {` ${tr('kesfet.detail.stat_added')}`}
                </AppText>
              ) : null}
              <AppText variant="caption" tone="secondary" style={styles.stat}>
                <AppText variant="caption" style={styles.statNum}>{fmt(post.stats.likes)}</AppText>
                {` ${tr('kesfet.detail.stat_likes')}`}
              </AppText>
              <AppText variant="caption" tone="secondary" style={styles.stat}>
                <AppText variant="caption" style={styles.statNum}>{fmt(post.stats.saves)}</AppText>
                {` ${tr('kesfet.detail.stat_saves')}`}
              </AppText>
            </View>

            {/* İkon satırı */}
            <View style={styles.iconRow}>
              {yorum ? (
                <IconCount
                  icon={<ChatIcon color={iconColor} />}
                  count={post.stats.comments}
                  label={tr('kesfet.ui.a11y.comment')}
                  onPress={() => inputRef.current?.focus()}
                  color={iconColor}
                />
              ) : null}
              {isMeal ? (
                <IconCount
                  icon={<ScanPlusIcon color={iconColor} />}
                  count={post.stats.adds}
                  label={tr('kesfet.detail.me_too')}
                  onPress={() => void logMeToo()}
                  color={iconColor}
                />
              ) : null}
              <IconCount
                icon={<Icon name={post.me.liked ? 'heartFill' : 'heart'} size={18} color={post.me.liked ? t.color.accentLine : iconColor} />}
                count={post.stats.likes}
                label={tr('kesfet.ui.a11y.like')}
                onPress={() => react('like')}
                color={iconColor}
              />
              <IconCount
                icon={<Icon name={post.me.saved ? 'bookmarkFill' : 'bookmark'} size={18} color={post.me.saved ? t.color.accentLine : iconColor} />}
                count={post.stats.saves}
                label={tr('kesfet.ui.a11y.save')}
                onPress={() => react('save')}
                color={iconColor}
              />
              <IconCount
                icon={<Icon name="share" size={18} color={iconColor} />}
                label={tr('kesfet.ui.a11y.share')}
                onPress={onShare}
                color={iconColor}
              />
            </View>
          </View>

          {yorum ? (
            <>
              <View style={[styles.band, { backgroundColor: t.color.line }]} />
              {thread.map(({ c, reply }) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  nowMs={nowMs}
                  reply={reply}
                  onReply={() => {
                    setReplyTo(c);
                    inputRef.current?.focus();
                  }}
                />
              ))}
            </>
          ) : null}
        </ScrollView>

        {yorum ? (
          <View
            style={[
              styles.composer,
              { borderTopColor: t.color.line, backgroundColor: t.color.bg, paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <View style={[styles.meAvatar, { backgroundColor: t.color.line }]} />
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder={
                replyTo
                  ? tr('kesfet.comments.replying_to', { name: replyTo.author.display_name })
                  : tr('kesfet.detail.reply_ph')
              }
              placeholderTextColor={t.color.secondary}
              style={[styles.input, { backgroundColor: t.color.surface, borderColor: t.color.line, color: t.color.ink }]}
              returnKeyType="send"
              onSubmitEditing={() => void send()}
              accessibilityLabel={tr('kesfet.detail.reply_ph')}
              maxLength={500}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <PostMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        authorName={post.author.display_name}
        isMine={post.me.is_author}
        onCopyLink={() => {
          void Clipboard.setStringAsync(postLink(post.id)).then(() => setToast({ message: tr('kesfet.ui.link_copied') }));
        }}
        onReport={(reason: ReportReason) => useKesfetStore.getState().report('post', post.id, reason)}
        onBlock={() => {
          void useKesfetStore
            .getState()
            .blockAuthor(post.author.id)
            .then((ok) => {
              if (ok) onBack();
            });
        }}
        onDelete={() => {
          void useKesfetStore
            .getState()
            .deletePost(post.id)
            .then((ok) => {
              if (ok) onBack();
            });
        }}
      />
      <DidItSheet
        visible={didItOpen}
        activity={post.activity_card}
        authorName={post.author.display_name}
        onClose={() => setDidItOpen(false)}
        onAdd={(minutes) => {
          setDidItOpen(false);
          seq.current += 1;
          void useKesfetStore
            .getState()
            .didIt(post.id, minutes, `didit-detail-${post.id}-${seq.current}`)
            .then((kcal) => {
              if (kcal == null) return;
              setDidItDone(true);
              setToast({ message: tr('kesfet.activity.logged') });
            });
        }}
      />
      <AddToast toast={toast} onDismiss={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { marginLeft: 4 },
  scroll: { paddingBottom: 24 },
  pad: { paddingHorizontal: 16, paddingTop: 14 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorName: { fontSize: 15, fontFamily: fontFamily.bodyBold, flexShrink: 1 },
  role: { fontSize: 13 },
  handle: { fontSize: 13 },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { marginTop: 12, fontSize: 17, lineHeight: 25 },
  media: { marginTop: 10 },
  mealCard: { marginTop: 10, borderRadius: 16, borderWidth: 1, padding: 8 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealThumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
  mealInfo: { flex: 1, minWidth: 0, gap: 2 },
  mealName: { fontSize: 15, fontFamily: fontFamily.bodyBold },
  mealMacro: { fontSize: 13 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 2 },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  chipText: { fontSize: 13, fontFamily: fontFamily.bodyBold },
  mealFoot: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mealCount: { flex: 1, fontSize: 13 },
  logPill: {
    flexShrink: 0,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logPillText: { fontSize: 14, fontFamily: fontFamily.bodyBold },
  stamp: { marginTop: 12, fontSize: 13 },
  stats: {
    marginTop: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 16,
    rowGap: 4,
  },
  stat: { fontSize: 13 },
  statNum: { fontSize: 13, fontFamily: fontFamily.bodyBold },
  iconRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  iconCount: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  iconCountText: { fontSize: 13 },
  band: { height: 8, marginTop: 4 },
  comment: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  commentReply: { paddingLeft: 68 },
  commentBody: { flex: 1, minWidth: 0 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentName: { fontSize: 14, fontFamily: fontFamily.bodyBold, flexShrink: 0, maxWidth: '50%' },
  commentMeta: { fontSize: 13 },
  shrink: { flexShrink: 1 },
  commentText: { marginTop: 2, fontSize: 15, lineHeight: 21 },
  commentActions: { flexDirection: 'row', gap: 24 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  meAvatar: { width: 32, height: 32, borderRadius: 16 },
  input: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, fontSize: 15 },
});

export default PostDetailScreen;
