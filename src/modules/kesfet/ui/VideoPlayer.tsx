// G15-S3 — Final FinVideo kare 2: tam ekran oynatıcı. Siyah zemin, sol üst ✕,
// ortada video (contain), sağda Beğen · Yorum · Kaydet · Paylaş sütunu (ikon 28 +
// sayı), altta yazar + metin, ilerleme çizgisi (4 px), oynat/duraklat + "0:15 /
// 0:42" ve ses düğmesi. Akıştaki videoya dokununca açılır (`kesfet_video`).
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import Svg, { Path } from 'react-native-svg';
import { AppText, fontFamily } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { fmtTime } from '../../media/video/ui/FeedVideo';
import { VolumeOffIcon, VolumeOnIcon } from '../../media/video/ui/icons';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './icons';
import type { FeedPost } from '../types';

const WHITE = '#FFFFFF';

function PauseIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill={WHITE}>
      <Path d="M216,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h40A16,16,0,0,1,216,48ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Z" />
    </Svg>
  );
}
function PlayIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill={WHITE}>
      <Path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z" />
    </Svg>
  );
}

function SideAction({ icon, count, label, onPress }: { icon: IconName; count?: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count}` : label} hitSlop={6} style={styles.side}>
      <Icon name={icon} size={28} color={WHITE} />
      {count ? <AppText style={styles.sideText}>{count}</AppText> : null}
    </Pressable>
  );
}

export function VideoPlayer({
  post,
  onClose,
  onLike,
  onComment,
  onSave,
  onShare,
}: {
  post: FeedPost | null;
  onClose: () => void;
  onLike: () => void;
  onComment?: () => void;
  onSave: () => void;
  /** G25-S1 md.7 (A10): verilmezse (bayrak `paylasim_baglanti` kapalı) düğme çizilmez. */
  onShare?: () => void;
}) {
  const { t: tr, fmt } = useT();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const media = post?.media.find((m) => m.kind === 'video') ?? null;
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(media?.duration_s ?? 0);

  const player = useVideoPlayer(media?.url ?? null, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (!post) return;
    if (paused) player.pause();
    else player.play();
  }, [player, paused, post]);

  useEffect(() => {
    if (!post) return;
    setDur(media?.duration_s ?? 0);
    const iv = setInterval(() => {
      const d = Number(player.duration) || media?.duration_s || 0;
      if (d > 0) setDur(d);
      setPos(Number(player.currentTime) || 0);
    }, 250);
    return () => clearInterval(iv);
  }, [player, post, media?.duration_s]);

  if (!post || !media) return null;
  const progress = dur > 0 ? Math.min(1, pos / dur) : 0;
  // Final oranları (852 yükseklikte): video 150–670, sağ sütun 420'den.
  const videoTop = Math.round(H * 0.176);
  const videoH = Math.round(H * 0.61);

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar style="light" />
      <View style={styles.root} accessibilityViewIsModal>
        <View style={[styles.video, { top: videoTop, height: videoH }]}>
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
        </View>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('common.close')}
          style={[styles.close, { top: insets.top }]}
        >
          <Icon name="x" size={24} color={WHITE} />
        </Pressable>

        <View style={[styles.sideCol, { top: Math.round(H * 0.493) }]}>
          <SideAction icon={post.me.liked ? 'heartFill' : 'heart'} count={fmt(post.stats.likes)} label={tr('kesfet.ui.a11y.like')} onPress={onLike} />
          {onComment ? (
            <SideAction icon="chatCircle" count={fmt(post.stats.comments)} label={tr('kesfet.ui.a11y.comment')} onPress={onComment} />
          ) : null}
          <SideAction icon={post.me.saved ? 'bookmarkFill' : 'bookmark'} count={fmt(post.stats.saves)} label={tr('kesfet.ui.a11y.save')} onPress={onSave} />
          {onShare ? <SideAction icon="share" label={tr('kesfet.ui.a11y.share')} onPress={onShare} /> : null}
        </View>

        <View style={styles.info}>
          <View style={styles.authorRow}>
            <Avatar name={post.author.display_name} url={post.author.avatar_url} size={32} />
            <AppText style={styles.name} numberOfLines={1}>
              {post.author.display_name}
            </AppText>
            <AppText style={styles.handle} numberOfLines={1}>
              @{post.author.handle}
            </AppText>
          </View>
          {post.body ? (
            <AppText style={styles.caption} numberOfLines={3}>
              {post.body}
            </AppText>
          ) : null}
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>

        <View style={[styles.controls, { bottom: Math.max(22, insets.bottom) }]}>
          <View style={styles.leftCtl}>
            <Pressable
              onPress={() => setPaused((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={paused ? tr('kesfet.ui.a11y.video_play') : tr('kesfet.ui.a11y.video_pause')}
              hitSlop={10}
            >
              {paused ? <PlayIcon /> : <PauseIcon />}
            </Pressable>
            <AppText style={styles.time}>{`${fmtTime(pos)} / ${fmtTime(dur)}`}</AppText>
          </View>
          <Pressable
            onPress={() => setMuted((m) => !m)}
            accessibilityRole="button"
            accessibilityLabel={muted ? tr('kesfet.ui.a11y.video_unmute') : tr('kesfet.ui.a11y.video_mute')}
            hitSlop={10}
          >
            {muted ? <VolumeOffIcon size={24} /> : <VolumeOnIcon size={24} />}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  video: { position: 'absolute', left: 0, right: 0, backgroundColor: '#2C2C2E', overflow: 'hidden' },
  close: { position: 'absolute', right: 4, width: 44, // G17-S1 md.7: modal → X sağda
    height: 44, alignItems: 'center', justifyContent: 'center' },
  sideCol: { position: 'absolute', right: 12, gap: 20 },
  side: { alignItems: 'center', gap: 2, minWidth: 44 },
  sideText: { color: WHITE, fontFamily: fontFamily.bodySemibold, fontSize: 13, lineHeight: 17 },
  info: { position: 'absolute', left: 16, right: 72, bottom: 120 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: WHITE, fontFamily: fontFamily.bodyBold, fontSize: 15, flexShrink: 1 },
  handle: { color: WHITE, opacity: 0.7, fontFamily: fontFamily.bodyRegular, fontSize: 15, flexShrink: 1 },
  caption: { marginTop: 8, color: WHITE, fontFamily: fontFamily.bodyRegular, fontSize: 14, lineHeight: 20 },
  track: { position: 'absolute', left: 16, right: 16, bottom: 70, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  fill: { height: 4, borderRadius: 2, backgroundColor: WHITE },
  controls: { position: 'absolute', left: 16, right: 16, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leftCtl: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  time: { color: WHITE, fontFamily: fontFamily.bodyRegular, fontSize: 13 },
});
