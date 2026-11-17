// G57 (17 Kas) — gönderi görseline dokununca tam ekran görüntüleyici: siyah zemin, görsel sığdırılmış
// (kırpılmadan), birden çok görselde yatay kaydırma + sayaç, iOS'ta iki parmakla yakınlaştırma.
//
// G58-S2 md.2 (Instagram/X gibi): altta yazar (avatar + ad → profil), açıklama (2 satır, dokununca
// açılır), Beğen / Yorum / Kaydet / Paylaş + sayılar. Sayı ve durum ÇAĞIRANIN canlı `post`'undan gelir
// (akışta ortak store, detayda sayfanın iyimser durumu) → kartla senkron. Yorum düğmesi görüntüleyicinin
// ÜSTÜNDE CommentsSheet açar (aynı Modal ağacında), kapatınca görüntüleyiciye döner. Çift dokunma
// beğenir (kalp damgası), tek dokunma etkileşim katmanını gizler/gösterir, aşağı kaydırma ya da × kapatır.
// Kurallar saf: `../reels` (classifyTap, viewerShouldDismiss …).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText, CURVE, DURATION, REDUCED, SPRING, fontFamily, haptic, palette, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { Icon, type IconName } from './icons';
import { Avatar } from './Avatar';
import { CommentsSheet } from './CommentsSheet';
import { classifyTap, doubleTapShouldLike, viewerCapturesPan, viewerShouldDismiss, DOUBLE_TAP_MS } from '../reels';
import type { FeedPost } from '../types';

export interface ImageViewerState {
  urls: string[];
  index: number;
}

const WHITE = '#FFFFFF';
const LIME = palette.lime;

function ViewerAction({
  icon,
  color = WHITE,
  label,
  count,
  onPress,
  testID,
  selected,
}: {
  icon: IconName;
  color?: string;
  label: string;
  count?: string;
  onPress: () => void;
  testID?: string;
  selected?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      accessibilityState={selected != null ? { selected } : undefined}
      hitSlop={6}
      style={styles.action}
      testID={testID}
    >
      <Icon name={icon} size={26} color={color} />
      {count != null ? (
        <AppText style={styles.actionCount} testID={testID ? `${testID}-count` : undefined}>
          {count}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export function ImageViewer({
  state,
  onClose,
  post,
  onLike,
  onSave,
  onShare,
  onOpenAuthor,
  commentsEnabled = false,
  onCommentsClosed,
}: {
  state: ImageViewerState | null;
  onClose: () => void;
  /** G58-S2 — canlı gönderi (verilirse etkileşim katmanı çizilir). */
  post?: FeedPost | null;
  onLike?: () => void;
  onSave?: () => void;
  /** Verilmezse (bayrak `paylasim_baglanti` kapalı) Paylaş çizilmez. */
  onShare?: () => void;
  onOpenAuthor?: () => void;
  /** `kesfet_yorum` açık mı — kapalıyken Yorum düğmesi çizilmez. */
  commentsEnabled?: boolean;
  /** Yorum sayfası kapandı (detay sayfası kendi yerel listesini tazeler). */
  onCommentsClosed?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t: tr, fmt } = useT();
  const reduced = useReducedMotion();
  const { width, height } = Dimensions.get('window');
  const [page, setPage] = useState(state?.index ?? 0);
  const [chrome, setChrome] = useState(true);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  // Yalnız AÇILIŞTA (yeni görsel listesi / başlangıç) sıfırla — çağıranın yeniden çizimi katmanı kapatmasın.
  const openKey = state ? `${state.index}|${state.urls.join('|')}` : '';
  useEffect(() => {
    setPage(state?.index ?? 0);
    setChrome(true);
    setCaptionOpen(false);
    setCommentsOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey]);

  // Çift dokunma kalp damgası (PostCard / FinMoLike ile aynı eğri).
  const heart = useSharedValue(0);
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.value,
    transform: [{ scale: reduced ? 1 : 0.6 + heart.value * 0.55 }],
  }));
  const burstHeart = () => {
    cancelAnimation(heart);
    heart.value = 0;
    heart.value = withSequence(
      reduced ? withTiming(1, { duration: DURATION.micro }) : withSpring(1, SPRING.eat),
      withTiming(0, { duration: DURATION.standard, easing: CURVE.in }),
    );
  };

  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );
  const postRef = useRef(post);
  postRef.current = post;
  const onLikeRef = useRef(onLike);
  onLikeRef.current = onLike;

  const onImageTap = () => {
    const now = Date.now();
    if (classifyTap(now, lastTap.current) === 'double') {
      lastTap.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = null;
      if (!postRef.current) return;
      burstHeart();
      haptic('light');
      if (doubleTapShouldLike(postRef.current.me.liked)) onLikeRef.current?.();
      return;
    }
    lastTap.current = now;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      setChrome((c) => !c);
    }, DOUBLE_TAP_MS);
  };

  // Aşağı kaydırarak kapat (yakınlaştırılmışken devre dışı — kaydırma görselin içinde kalsın).
  const zoomed = useRef(false);
  const dragY = useRef(new RNAnimated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => !zoomed.current && viewerCapturesPan(g.dx, g.dy),
        onPanResponderMove: (_e, g) => {
          if (g.dy > 0) dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (viewerShouldDismiss(g.dy, g.vy, g.dx)) {
            closeRef.current();
            dragY.setValue(0);
            return;
          }
          if (reducedRef.current) RNAnimated.timing(dragY, { toValue: 0, duration: REDUCED.duration, useNativeDriver: true }).start();
          else RNAnimated.spring(dragY, { toValue: 0, ...SPRING.ai, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => dragY.setValue(0),
      }),
    [dragY],
  );

  if (!state || state.urls.length === 0) return null;
  const n = state.urls.length;
  const bgOpacity = dragY.interpolate({ inputRange: [0, 300], outputRange: [1, 0.35], extrapolate: 'clamp' });
  const authorName = post?.author.display_name ?? '';
  const caption = post?.body?.trim() ?? '';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <RNAnimated.View style={[StyleSheet.absoluteFill, styles.bg, { opacity: bgOpacity }]} />
      <RNAnimated.View
        style={[styles.root, { transform: [{ translateY: dragY }] }]}
        testID="kesfet-image-viewer"
        accessibilityViewIsModal
        {...pan.panHandlers}
      >
        <FlatList
          {...SCROLL_KEYBOARD}
          data={state.urls}
          keyExtractor={(u, i) => `${i}-${u}`}
          horizontal
          pagingEnabled
          initialScrollIndex={Math.min(state.index, n - 1)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index }) => (
            <ScrollView
              {...SCROLL_KEYBOARD}
              style={{ width, height }}
              contentContainerStyle={styles.center}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              scrollEventThrottle={32}
              onScroll={(e) => {
                const z = (e.nativeEvent as { zoomScale?: number }).zoomScale ?? 1;
                zoomed.current = z > 1.01;
              }}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              <Pressable
                onPress={onImageTap}
                accessible
                accessibilityRole="image"
                accessibilityLabel={tr('kesfet_act.viewer_a11y', { i: index + 1, n })}
                accessibilityHint={post ? tr('kesfet_reels.viewer_hint') : undefined}
                testID={`kesfet-image-viewer-image-${index}`}
              >
                <Image source={{ uri: item }} style={{ width, height: height * 0.86 }} contentFit="contain" transition={120} />
              </Pressable>
            </ScrollView>
          )}
        />

        <Animated.View pointerEvents="none" style={[styles.heartOverlay, heartStyle]}>
          <Icon name="heartFill" size={96} color={LIME} />
        </Animated.View>

        {chrome && n > 1 ? (
          <View style={[styles.counter, { top: insets.top + 16 }]} pointerEvents="none" testID="kesfet-image-viewer-counter">
            <AppText style={styles.counterText}>{`${page + 1}/${n}`}</AppText>
          </View>
        ) : null}

        {post && chrome ? (
          <View style={styles.bottom} testID="kesfet-image-viewer-overlay">
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={[styles.bottomInner, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Pressable
                onPress={onOpenAuthor}
                disabled={!onOpenAuthor}
                accessibilityRole={onOpenAuthor ? 'link' : undefined}
                accessibilityLabel={post.author.handle ? `${authorName} @${post.author.handle}` : authorName}
                style={styles.authorRow}
                testID="kesfet-image-viewer-author"
              >
                <Avatar name={authorName} url={post.author.avatar_url} size={32} />
                <AppText style={styles.name} numberOfLines={1}>
                  {authorName}
                </AppText>
              </Pressable>
              {caption ? (
                <AppText
                  style={styles.caption}
                  numberOfLines={captionOpen ? undefined : 2}
                  onPress={() => setCaptionOpen((v) => !v)}
                  suppressHighlighting
                  accessibilityRole="button"
                  accessibilityState={{ expanded: captionOpen }}
                  testID="kesfet-image-viewer-caption"
                >
                  {caption}
                </AppText>
              ) : null}
              <View style={styles.actions}>
                <ViewerAction
                  icon={post.me.liked ? 'heartFill' : 'heart'}
                  color={post.me.liked ? LIME : WHITE}
                  label={tr('kesfet.ui.a11y.like')}
                  count={fmt(post.stats.likes)}
                  selected={post.me.liked}
                  onPress={() => {
                    haptic('light');
                    onLike?.();
                  }}
                  testID="kesfet-image-viewer-like"
                />
                {commentsEnabled ? (
                  <ViewerAction
                    icon="chatCircle"
                    label={tr('kesfet.ui.a11y.comment')}
                    count={fmt(post.stats.comments)}
                    onPress={() => setCommentsOpen(true)}
                    testID="kesfet-image-viewer-comment"
                  />
                ) : null}
                <ViewerAction
                  icon={post.me.saved ? 'bookmarkFill' : 'bookmark'}
                  label={tr('kesfet.ui.a11y.save')}
                  count={fmt(post.stats.saves)}
                  selected={post.me.saved}
                  onPress={() => {
                    haptic('light');
                    onSave?.();
                  }}
                  testID="kesfet-image-viewer-save"
                />
                {onShare ? (
                  <ViewerAction icon="share" label={tr('kesfet.ui.a11y.share')} onPress={onShare} testID="kesfet-image-viewer-share" />
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet_act.viewer_close')}
          hitSlop={8}
          style={[styles.close, { top: insets.top + 8 }]}
          testID="kesfet-image-viewer-close"
        >
          <Icon name="x" size={22} color={WHITE} />
        </Pressable>
      </RNAnimated.View>

      {/* Yorumlar görüntüleyicinin ÜSTÜNDE (aynı Modal ağacı) — kapatınca görüntüleyiciye dönülür. */}
      {post && commentsEnabled ? (
        <CommentsSheet
          visible={commentsOpen}
          postId={commentsOpen ? post.id : null}
          currentUser={null}
          count={post.stats.comments}
          onClose={() => {
            setCommentsOpen(false);
            onCommentsClosed?.();
          }}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: '#000000' },
  root: { flex: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  heartOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' },
  counterText: { color: WHITE, fontSize: 13, fontFamily: fontFamily.bodySemibold },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 48 },
  bottomInner: { paddingHorizontal: 16, gap: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, alignSelf: 'flex-start', maxWidth: '100%' },
  name: { color: WHITE, fontFamily: fontFamily.bodyBold, fontSize: 15, flexShrink: 1 },
  caption: { color: 'rgba(255,255,255,0.92)', fontFamily: fontFamily.bodyRegular, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 2 },
  action: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { color: WHITE, fontFamily: fontFamily.bodySemibold, fontSize: 14 },
});
