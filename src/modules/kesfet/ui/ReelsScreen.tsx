// G58-S2 md.3 — Reels akışı (`kesfet_video`). Tasarım birebir: docs/g58/design/FinReelsPlayer.dc.html
// (+ FinReelsPlayerSwipe kaydırma ortası, FinReelsComments yorum sayfası). Müzik satırı ve dönen plak
// UYGULANMAZ (İlter: müzik yok); "Gönder" sistem paylaşım sayfasını açar (DM yok).
//
// Dikey sayfa sayfa akış: yukarı kaydır = sonraki, aşağı = önceki. Kaydırma 330 ms standart eğri, eşik
// 140 pt (hızlı fiske de çevirir); Reduce Motion'da kaydırma yerine 220 ms solma. Kaynak: dokunulan video
// ilk sırada + Keşfet akışındaki diğer videolu gönderiler (ortak store; sona yaklaşınca loadMore).
//
// TEK OYNATICI (saf kural `reelSlot`): yalnız ekrandaki sayfa oynar (sesli başlar; ses düğmesi), bir
// sonraki sayfa duraklatılmış oynatıcıyla önceden yüklenir, diğer sayfalar oynatıcısız (yalnız kapak →
// native decoder serbest). Dokun = duraklat/oynat, uzun bas = basılı tutarken duraklat. Ekran arka
// plandayken (başka sayfa / uygulama arka planda) durur.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PanResponder, Pressable, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import Svg, { Path } from 'react-native-svg';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { AppText, CURVE, DURATION, fontFamily, haptic, palette, useReducedMotion } from '../../../core/design';
import { useFeature } from '../../../core/flags';
import { useT } from '../../../core/i18n';
import { getProfilClient } from '../../profil';
import { track } from '../../../lib/analytics';
import { useKesfetStore } from '../store';
import { getKesfetClient } from '../client';
import {
  buildReelsQueue,
  reelShouldPlay,
  reelSlot,
  reelsAtEdge,
  reelsShouldLoadMore,
  reelsSnapIndex,
  type ReelSlot,
} from '../reels';
import { publicUrlForPath } from './MediaGrid';
import { Avatar } from './Avatar';
import { CommentsSheet } from './CommentsSheet';
import { postLink } from './format';
import type { FeedPost } from '../types';

const WHITE = '#FFFFFF';
// G40-S1 tek marka yeşili (tasarım dosyasındaki eski soluk lime yerine palette.lime).
const LIME = palette.lime;
const SHADOW = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 } as const;

// Tasarımdaki çizgi ikonlar (24 birim, 1.8 çizgi).
const P_HEART = 'M12 20s-7.5-4.6-9-9.5C2 7 4.3 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 2.9 0 5.2 2.5 4.2 6C19.5 15.4 12 20 12 20Z';
const P_BUBBLE = 'M12 20a8 8 0 1 0-7-4.2L4 20l4.2-1A8 8 0 0 0 12 20Z';
const P_SEND = 'M21 3 10 14 M21 3l-6.5 18-4.5-7-7-4.5L21 3Z';
const P_SAVE = 'M6 3h12v18l-6-4.5L6 21V3Z';
const P_SPK = 'M4 9h4l5-4v14l-5-4H4V9Z M16.5 8.5a5 5 0 0 1 0 7 M19 6a8.5 8.5 0 0 1 0 12';
const P_SPK_OFF = 'M4 9h4l5-4v14l-5-4H4V9Z M17 9.5l5 5 M22 9.5l-5 5';
const P_BACK = 'M15 5l-7 7 7 7';
const P_PLAY = 'M8 5v14l11-7L8 5Z';

function Glyph({ d, size, fill = 'none', stroke = WHITE, width = 1.8 }: { d: string; size: number; fill?: string; stroke?: string; width?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}

function videoOf(post: FeedPost) {
  return post.media.find((m) => m.kind === 'video') ?? null;
}

function posterOf(post: FeedPost): string | null {
  const v = videoOf(post);
  if (v?.thumb_path) return publicUrlForPath(v.thumb_path);
  const img = post.media.find((m) => m.kind !== 'video');
  return img?.url ?? null;
}

/** Oynatıcı — YALNIZ 'play' ve 'preload' sayfalarında yaratılır (sökülünce native kaynak bırakılır). */
function ReelVideo({
  url,
  shouldPlay,
  muted,
  onProgress,
}: {
  url: string;
  shouldPlay: boolean;
  muted: boolean;
  onProgress?: (p: number) => void;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = muted;
  });
  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);
  useEffect(() => {
    if (shouldPlay) player.play();
    else player.pause();
  }, [player, shouldPlay]);
  useEffect(() => {
    if (!shouldPlay || !onProgress) return;
    const iv = setInterval(() => {
      const d = Number(player.duration) || 0;
      onProgress(d > 0 ? Math.min(1, (Number(player.currentTime) || 0) / d) : 0);
    }, 250);
    return () => clearInterval(iv);
  }, [player, shouldPlay, onProgress]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} testID="reel-video" />;
}

function SideButton({
  label,
  children,
  text,
  onPress,
  selected,
  testID,
  minH = 60,
}: {
  label: string;
  children: React.ReactNode;
  text?: string;
  onPress: () => void;
  selected?: boolean;
  testID?: string;
  minH?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected != null ? { selected } : undefined}
      style={({ pressed }) => [styles.side, { minHeight: minH }, pressed ? styles.sidePressed : null]}
      testID={testID}
    >
      {children}
      {text != null ? <AppText style={[styles.sideText, SHADOW]}>{text}</AppText> : null}
    </Pressable>
  );
}

function ReelPage({
  post,
  slot,
  focused,
  muted,
  following,
  height,
  bottomInset,
  onToggleMute,
  onLike,
  onSave,
  onComment,
  onSend,
  onFollow,
  onOpenAuthor,
  isMine,
}: {
  post: FeedPost;
  slot: ReelSlot;
  focused: boolean;
  muted: boolean;
  following: boolean;
  height: number;
  bottomInset: number;
  onToggleMute: () => void;
  onLike: () => void;
  onSave: () => void;
  onComment?: () => void;
  onSend?: () => void;
  onFollow?: () => void;
  onOpenAuthor?: () => void;
  isMine: boolean;
}) {
  const { t: tr, fmt } = useT();
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  // Sayfa ekrandan çıkınca duraklatma/metin sıfırlanır (geri gelince baştan, kapalı açıklama).
  useEffect(() => {
    if (slot !== 'play') {
      setPaused(false);
      setHolding(false);
      setOpen(false);
    }
  }, [slot]);
  const video = videoOf(post);
  const poster = posterOf(post);
  const playing = reelShouldPlay(slot, { paused, holding, focused });
  const title = post.meal_card?.name ?? (post.activity_card ? tr(`kesfet.activity.type.${post.activity_card.type}`) : null);
  const caption = post.body?.trim() ?? '';
  const chips: string[] = [];
  if (post.meal_card) {
    chips.push(tr('kesfet_reels.kcal', { n: fmt(Math.round(post.meal_card.kcal)) }));
    chips.push(tr('kesfet_reels.protein', { n: fmt(Math.round(post.meal_card.protein_g)) }));
  } else if (post.activity_card) {
    chips.push(tr('kesfet_reels.activity_min', { n: fmt(post.activity_card.minutes) }));
  }
  const handle = post.author.handle ? `@${post.author.handle.replace(/^@/, '')}` : null;

  return (
    <View
      style={[styles.page, { height }]}
      accessible={false}
      accessibilityLabel={`${tr('kesfet_reels.reel')}: ${title ?? post.author.display_name}`}
      testID={`reel-page-${post.id}`}
    >
      {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      {video && slot !== 'none' ? (
        <ReelVideo url={video.url} shouldPlay={playing} muted={muted} onProgress={slot === 'play' ? setProgress : undefined} />
      ) : null}
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} style={styles.topShade} />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.82)']}
        locations={[0, 0.62]}
        style={styles.bottomShade}
      />

      {/* Dokun = duraklat/oynat · uzun bas = basılı tutarken duraklat. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setPaused((p) => !p)}
        onLongPress={() => setHolding(true)}
        onPressOut={() => setHolding(false)}
        delayLongPress={250}
        accessibilityRole="button"
        accessibilityLabel={paused ? tr('kesfet_reels.play') : tr('kesfet_reels.pause')}
        testID="reel-tap"
      />
      {slot === 'play' && paused ? (
        <View pointerEvents="none" style={styles.pausedBadge} testID="reel-paused">
          <Glyph d={P_PLAY} size={40} fill={WHITE} stroke={WHITE} width={1} />
        </View>
      ) : null}

      {/* Sağ sütun: Beğen · Yorumlar · Gönder · Kaydet · Ses (müzik plağı YOK). */}
      <View style={[styles.sideCol, { bottom: 112 + bottomInset }]}>
        <SideButton
          label={tr('kesfet_reels.like_a11y', { n: fmt(post.stats.likes) })}
          text={fmt(post.stats.likes)}
          onPress={onLike}
          selected={post.me.liked}
          testID="reel-like"
        >
          <Glyph d={P_HEART} size={32} fill={post.me.liked ? LIME : 'none'} stroke={post.me.liked ? LIME : WHITE} />
        </SideButton>
        {onComment ? (
          <SideButton
            label={tr('kesfet_reels.comment_a11y', { n: fmt(post.stats.comments) })}
            text={fmt(post.stats.comments)}
            onPress={onComment}
            testID="reel-comment"
          >
            <Glyph d={P_BUBBLE} size={32} />
          </SideButton>
        ) : null}
        {onSend ? (
          <SideButton label={tr('kesfet_reels.send')} text={tr('kesfet_reels.send')} onPress={onSend} testID="reel-send">
            <Glyph d={P_SEND} size={30} />
          </SideButton>
        ) : null}
        <SideButton
          label={`${tr('kesfet_reels.save')}, ${fmt(post.stats.saves)}`}
          text={fmt(post.stats.saves)}
          onPress={onSave}
          selected={post.me.saved}
          testID="reel-save"
        >
          <Glyph d={P_SAVE} size={30} fill={post.me.saved ? WHITE : 'none'} />
        </SideButton>
        <SideButton
          label={muted ? tr('kesfet_reels.unmute') : tr('kesfet_reels.mute')}
          onPress={onToggleMute}
          selected={muted}
          minH={52}
          testID="reel-mute"
        >
          <View style={styles.muteCircle}>
            <Glyph d={muted ? P_SPK_OFF : P_SPK} size={22} />
          </View>
        </SideButton>
      </View>

      {/* Alt: yazar + Takip et, başlık (öğün/etkinlik), açıklama (devamını göster yerinde), çıkartmalar. */}
      <View style={[styles.info, { bottom: 52 + bottomInset }]} pointerEvents="box-none">
        <View style={styles.authorRow}>
          <Pressable
            onPress={onOpenAuthor}
            disabled={!onOpenAuthor}
            accessibilityRole={onOpenAuthor ? 'link' : undefined}
            accessibilityLabel={handle ? `${post.author.display_name} ${handle}` : post.author.display_name}
            style={styles.authorTap}
            testID="reel-author"
          >
            <Avatar name={post.author.display_name} url={post.author.avatar_url} size={36} />
            <View style={styles.authorText}>
              <AppText style={styles.authorName} numberOfLines={1}>
                {post.author.display_name}
              </AppText>
              {handle ? (
                <AppText style={styles.authorHandle} numberOfLines={1}>
                  {handle}
                </AppText>
              ) : null}
            </View>
          </Pressable>
          {!isMine && onFollow ? (
            <Pressable
              onPress={onFollow}
              disabled={following}
              accessibilityRole="button"
              accessibilityState={{ selected: following }}
              accessibilityLabel={following ? tr('kesfet_reels.following') : tr('kesfet_reels.follow')}
              style={styles.followHit}
              testID="reel-follow"
            >
              <View style={[styles.followPill, following ? styles.followPillOn : null]}>
                <AppText style={styles.followText}>{following ? tr('kesfet_reels.following') : tr('kesfet_reels.follow')}</AppText>
              </View>
            </Pressable>
          ) : null}
        </View>
        {title ? (
          <AppText style={[styles.title, SHADOW]} accessibilityRole="header" numberOfLines={2}>
            {title}
          </AppText>
        ) : null}
        {caption ? (
          <AppText style={styles.caption} numberOfLines={open ? undefined : 2} testID="reel-caption">
            {caption}
          </AppText>
        ) : null}
        {caption.length > 80 || caption.split('\n').length > 2 ? (
          <Pressable
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            style={styles.moreHit}
            testID="reel-more"
          >
            <AppText style={styles.more}>{open ? tr('kesfet_reels.less') : tr('kesfet_reels.more')}</AppText>
          </Pressable>
        ) : null}
        {chips.length ? (
          <View style={styles.chips}>
            {chips.map((c) => (
              <View key={c} style={styles.chip}>
                <AppText style={styles.chipText}>{c}</AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View
        style={[styles.track, { bottom: 26 + bottomInset }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={tr('kesfet_reels.progress')}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

export function ReelsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const { t: tr } = useT();
  const reduced = useReducedMotion();
  const videoOn = useFeature('kesfet_video');
  const yorum = useFeature('kesfet_yorum');
  const startId: string | undefined = route.params?.startId;

  const posts = useKesfetStore((s) => s.posts);
  const hasMore = useKesfetStore((s) => s.hasMore);
  const loading = useKesfetStore((s) => s.loading);
  const loadingMore = useKesfetStore((s) => s.loadingMore);
  // Dokunulan gönderi akışta değilse (ör. başka yüzeyden) bir kez getirilir.
  const [extra, setExtra] = useState<FeedPost[]>([]);
  useEffect(() => {
    if (!startId || posts.some((p) => p.id === startId)) return;
    let alive = true;
    getKesfetClient()
      .getPost({ post: startId })
      .then((p) => alive && p && setExtra([p]))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startId]);
  useEffect(() => {
    if (posts.length === 0 && !loading) void useKesfetStore.getState().load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queue = useMemo(() => buildReelsQueue(posts, startId, extra), [posts, startId, extra]);
  const [index, setIndex] = useState(0);
  const count = queue.length;
  const active = Math.min(index, Math.max(0, count - 1));
  const activePost = queue[active] ?? null;

  useEffect(() => {
    if (reelsShouldLoadMore(active, count, hasMore) && !loadingMore && !loading) void useKesfetStore.getState().loadMore();
  }, [active, count, hasMore, loadingMore, loading]);

  // Ekran önde mi (başka sayfa açıldı / uygulama arka planda → dur).
  const [navFocused, setNavFocused] = useState(true);
  const [appActive, setAppActive] = useState(true);
  useEffect(() => {
    const offF = navigation?.addListener?.('focus', () => setNavFocused(true));
    const offB = navigation?.addListener?.('blur', () => setNavFocused(false));
    const sub = AppState.addEventListener?.('change', (s) => setAppActive(s === 'active'));
    return () => {
      if (typeof offF === 'function') offF();
      if (typeof offB === 'function') offB();
      sub?.remove?.();
    };
  }, [navigation]);
  const focused = navFocused && appActive;

  // Ses: sesli başlar; tercih sayfalar arası ortak.
  const [muted, setMuted] = useState(false);
  const [following, setFollowing] = useState<ReadonlySet<string>>(() => new Set());
  const [commentsPost, setCommentsPost] = useState<FeedPost | null>(null);
  // YALNIZ __DEV__ vitrini (FinReelsComments karesi): ilk reel'in yorum sayfası açık.
  const vitrinComments = __DEV__ && route.params?.vitrinComments === true;
  useEffect(() => {
    if (vitrinComments && !commentsPost && queue[0]) setCommentsPost(queue[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitrinComments, queue.length]);

  // ── Sayfa kaydırma (330 ms standart eğri, eşik 140 pt; azaltılmışta 220 ms solma) ──
  const dy = useSharedValue(0);
  const fade = useSharedValue(1);
  const busy = useRef(false);
  const stateRef = useRef({ active, count, reduced, H });
  stateRef.current = { active, count, reduced, H };

  const settle = useCallback((next: number) => {
    setIndex(next);
    dy.value = 0;
    busy.current = false;
    haptic('light');
  }, [dy]);
  const unlock = useCallback(() => {
    busy.current = false;
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const { active: cur, reduced: rm, H: h } = stateRef.current;
      if (next === cur) {
        dy.value = withTiming(0, { duration: DURATION.base, easing: CURVE.standard }, () => runOnJS(unlock)());
        return;
      }
      busy.current = true;
      if (rm) {
        // Reduce Motion: kaydırma yok — anlık değişim + 220 ms solma (110 çıkış + 110 giriş = DURATION.instant ×2).
        dy.value = 0;
        fade.value = withSequence(
          withTiming(0, { duration: DURATION.instant }, (done) => {
            if (done) runOnJS(settle)(next);
          }),
          withTiming(1, { duration: DURATION.instant }),
        );
        return;
      }
      const target = next > cur ? -h : h;
      dy.value = withTiming(target, { duration: DURATION.base, easing: CURVE.standard }, (done) => {
        if (done) runOnJS(settle)(next);
      });
    },
    [dy, fade, settle, unlock],
  );
  const goToRef = useRef(goTo);
  goToRef.current = goTo;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => !busy.current && Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          const { active: cur, count: n, reduced: rm } = stateRef.current;
          if (rm) return;
          // Uçlarda dirençli (ilk sayfada aşağı, son sayfada yukarı).
          dy.value = reelsAtEdge(cur, n, g.dy) ? g.dy * 0.25 : g.dy;
        },
        onPanResponderRelease: (_e, g) => {
          const { active: cur, count: n } = stateRef.current;
          goToRef.current(reelsSnapIndex(cur, n, g.dy, g.vy));
        },
        onPanResponderTerminate: () => {
          goToRef.current(stateRef.current.active);
        },
      }),
    [dy],
  );

  const stackStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dy.value }], opacity: fade.value }));

  const react = (post: FeedPost, kind: 'like' | 'save') => {
    haptic('light');
    const on = kind === 'like' ? !post.me.liked : !post.me.saved;
    void useKesfetStore.getState().react(post.id, kind, on);
  };
  const follow = async (post: FeedPost) => {
    haptic('selection');
    setFollowing((s) => new Set(s).add(post.author.id));
    try {
      const res = await getProfilClient().follow({ user: post.author.id, on: true });
      track('follow', { on: true, state: res?.state, surface: 'kesfet_reels' });
    } catch {
      setFollowing((s) => {
        const n = new Set(s);
        n.delete(post.author.id);
        return n;
      });
      haptic('warning');
    }
  };
  const send = async (post: FeedPost) => {
    try {
      const r = await Share.share({ message: postLink(post.id), url: postLink(post.id) });
      if (r?.action !== Share.dismissedAction) track('share', { target: 'post', surface: 'kesfet_reels' });
    } catch {
      // Paylaşım sayfası kapatıldı / desteklenmiyor — sessiz.
    }
  };

  // Bayrak kapalıyken hiçbir giriş yok; rota yine de açılırsa (eski bağlantı) geri dön.
  useEffect(() => {
    if (!videoOn && !__DEV__) navigation.goBack?.();
  }, [videoOn, navigation]);

  const windowIdx = [active - 1, active, active + 1].filter((i) => i >= 0 && i < count);
  const bottomInset = Math.max(0, insets.bottom - 8);

  return (
    <View style={styles.root} testID="kesfet-reels">
      <StatusBar style="light" />
      {count === 0 ? (
        <View style={styles.empty} testID="reels-empty">
          {loading || (startId && extra.length === 0 && !posts.length) ? null : (
            <>
              <View style={styles.emptyIcon}>
                <Glyph d={P_PLAY} size={30} fill={WHITE} stroke={WHITE} width={1} />
              </View>
              <AppText style={styles.emptyTitle} accessibilityRole="header">
                {tr('kesfet_reels.empty_title')}
              </AppText>
              <AppText style={styles.emptySub}>{tr('kesfet_reels.empty_sub')}</AppText>
            </>
          )}
        </View>
      ) : (
        <Animated.View
          style={[StyleSheet.absoluteFill, stackStyle]}
          {...pan.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={activePost ? `${tr('kesfet_reels.reel')} ${active + 1} / ${count}` : tr('kesfet_reels.title')}
          accessibilityActions={[
            { name: 'increment', label: tr('kesfet_reels.next_a11y') },
            { name: 'decrement', label: tr('kesfet_reels.prev_a11y') },
          ]}
          onAccessibilityAction={(e) => {
            if (busy.current) return;
            if (e.nativeEvent.actionName === 'increment') goTo(Math.min(count - 1, active + 1));
            if (e.nativeEvent.actionName === 'decrement') goTo(Math.max(0, active - 1));
          }}
        >
          {windowIdx.map((i) => {
            const p = queue[i];
            return (
              <View key={p.id} style={[styles.layer, { top: (i - active) * H, height: H }]} importantForAccessibility={i === active ? 'auto' : 'no-hide-descendants'} accessibilityElementsHidden={i !== active}>
                <ReelPage
                  post={p}
                  slot={reelSlot(i, active)}
                  focused={focused}
                  muted={muted}
                  following={following.has(p.author.id)}
                  height={H}
                  bottomInset={bottomInset}
                  isMine={p.me.is_author}
                  onToggleMute={() => setMuted((m) => !m)}
                  onLike={() => react(p, 'like')}
                  onSave={() => react(p, 'save')}
                  onComment={yorum ? () => setCommentsPost(p) : undefined}
                  onSend={() => void send(p)}
                  onFollow={() => void follow(p)}
                  onOpenAuthor={
                    p.author.handle || p.author.id
                      ? () => navigation.navigate('PublicProfile', { handle: (p.author.handle || p.author.id).replace(/^@/, '') })
                      : undefined
                  }
                />
              </View>
            );
          })}
        </Animated.View>
      )}

      {/* Üst: geri (sol, 36 pt daire / 44 pt dokunma) + ortada "Reels". */}
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel={tr('kesfet_reels.back')}
        style={[styles.back, { top: insets.top }]}
        testID="reels-back"
      >
        <View style={styles.backCircle}>
          <Glyph d={P_BACK} size={22} width={2.2} />
        </View>
      </Pressable>
      <View pointerEvents="none" style={[styles.titleBar, { top: insets.top }]}>
        <AppText style={[styles.titleText, SHADOW]}>{tr('kesfet_reels.title')}</AppText>
      </View>

      {yorum ? (
        <CommentsSheet
          visible={commentsPost != null}
          postId={commentsPost?.id ?? null}
          currentUser={null}
          count={commentsPost ? (posts.find((x) => x.id === commentsPost.id)?.stats.comments ?? commentsPost.stats.comments) : undefined}
          onClose={() => setCommentsPost(null)}
          showClose
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  layer: { position: 'absolute', left: 0, right: 0 },
  page: { width: '100%', overflow: 'hidden', backgroundColor: '#111111' },
  topShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 160 },
  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 470 },
  pausedBadge: { position: 'absolute', top: '45%', alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  sideCol: { position: 'absolute', right: 6, width: 64, alignItems: 'center', gap: 10 },
  side: { width: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  sidePressed: { transform: [{ scale: 0.9 }] },
  sideText: { color: WHITE, fontFamily: fontFamily.bodyBold, fontSize: 13, lineHeight: 17 },
  muteCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  info: { position: 'absolute', left: 16, right: 84, gap: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minHeight: 44 },
  authorText: { minWidth: 0, flexShrink: 1 },
  authorName: { color: WHITE, fontFamily: fontFamily.bodyBold, fontSize: 15, lineHeight: 18 },
  authorHandle: { color: 'rgba(255,255,255,0.8)', fontFamily: fontFamily.bodyRegular, fontSize: 13, lineHeight: 16 },
  followHit: { height: 44, justifyContent: 'center' },
  followPill: { height: 32, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderColor: WHITE, justifyContent: 'center' },
  followPillOn: { borderColor: 'rgba(255,255,255,0.5)' },
  followText: { color: WHITE, fontFamily: fontFamily.bodyBold, fontSize: 13 },
  title: { color: WHITE, fontFamily: fontFamily.headingBold, fontSize: 19, lineHeight: 23 },
  caption: { color: 'rgba(255,255,255,0.92)', fontFamily: fontFamily.bodyRegular, fontSize: 14, lineHeight: 20 },
  moreHit: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: -12, marginBottom: -10 },
  more: { color: WHITE, fontFamily: fontFamily.bodyBold, fontSize: 14 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center' },
  chipText: { color: WHITE, fontFamily: fontFamily.bodyBold, fontSize: 12 },
  track: { position: 'absolute', left: 16, right: 16, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  fill: { height: 3, borderRadius: 2, backgroundColor: WHITE },
  back: { position: 'absolute', left: 6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  backCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  titleBar: { position: 'absolute', left: 0, right: 0, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 9 },
  titleText: { color: WHITE, fontFamily: fontFamily.bodyBold, fontSize: 15 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: WHITE, fontFamily: fontFamily.headingBold, fontSize: 20, textAlign: 'center' },
  emptySub: { color: '#A1A1A6', fontFamily: fontFamily.bodyRegular, fontSize: 15, textAlign: 'center' },
});

export default ReelsScreen;
