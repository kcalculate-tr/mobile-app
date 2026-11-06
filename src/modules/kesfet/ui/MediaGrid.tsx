// Keşfet medya ızgarası — 1–4 görsel (expo-image). 1: tam genişlik 220 px;
// 2: yan yana; 3: solda büyük + sağda iki; 4: 2×2. Taşma radius 16 ile kırpılır.
// Video (G8-CONTRACT media[].kind) `kesfet_video` açıkken FeedVideo ile çizilir
// (bayrak kapalıyken ya da sunucu henüz `kind` göndermiyorsa düz kapak görseli
// — bugünkü davranışla birebir aynı).
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Icon } from './icons';
import { Image } from 'expo-image';
import { useTheme } from '../../../core/design';
import { useFeature } from '../../../core/flags';
import { useT } from '../../../core/i18n';
import { FeedVideo } from '../../media/video';
import { getSupabaseClient } from '../../../core/supabase';
import type { FeedMedia } from '../types';

const H = 220;
const GAP = 2;
const POST_MEDIA_BUCKET = 'post-media';

function publicUrlForPath(path: string): string {
  const { data } = getSupabaseClient().storage.from(POST_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function Cell({
  media,
  postId,
  isVisible,
  style,
  onOpenVideo,
}: {
  media: FeedMedia;
  postId: string;
  isVisible: boolean;
  style?: object;
  onOpenVideo?: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const kesfetVideo = useFeature('kesfet_video');

  if (media.kind === 'video' && kesfetVideo) {
    return (
      <FeedVideo
        id={postId}
        source={media.url}
        posterUri={media.thumb_path ? publicUrlForPath(media.thumb_path) : null}
        isVisible={isVisible}
        style={[{ backgroundColor: t.color.line }, style]}
        labels={{
          mute: tr('kesfet.ui.a11y.video_mute'),
          unmute: tr('kesfet.ui.a11y.video_unmute'),
          fullscreen: tr('kesfet.ui.a11y.video_fullscreen'),
          play: tr('kesfet.ui.a11y.video_play'),
        }}
        onOpen={onOpenVideo}
        phColor={t.isDark ? '#3A3A3C' : '#CFD2D7'}
        phIconColor={t.isDark ? '#A1A1A6' : '#45454A'}
        durationS={media.duration_s ?? null}
      />
    );
  }

  const posterUri = media.kind === 'video' ? (media.thumb_path ? publicUrlForPath(media.thumb_path) : media.url) : media.url;
  // G15 — yüklenirken/yüklenemezse Final yer tutucusu: gri zemin + görsel ikonu.
  return (
    <View style={[{ flex: 1, backgroundColor: t.isDark ? '#3A3A3C' : '#DCDEE2' }, style]}>
      <View style={[StyleSheet.absoluteFill, styles.ph]}>
        <Icon name="image" size={24} color={t.color.secondary} />
      </View>
      <Image
        source={{ uri: posterUri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={120}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

export function MediaGrid({
  media,
  postId,
  isVisible = false,
  onOpenVideo,
}: {
  media: FeedMedia[];
  postId: string;
  isVisible?: boolean;
  /** G15 — videoya dokun = tam ekran oynatıcı (FinVideo). */
  onOpenVideo?: () => void;
}) {
  const { width } = useWindowDimensions();
  if (media.length === 0) return null;
  const items = media.slice(0, 4);
  // G15 — tek görselde yükseklik en-boy oranından (Final: yatay ~220, kare ~300);
  // ölçü yoksa 220. Genişlik = ekran − 16·2 − 40 avatar − 12 aralık.
  const one = items.length === 1 ? items[0] : null;
  const w = Math.max(0, width - 84);
  const h =
    one && one.width > 0 && one.height > 0 ? Math.round(Math.min(320, Math.max(180, (w * one.height) / one.width))) : H;

  const cell = (m: FeedMedia) => <Cell media={m} postId={postId} isVisible={isVisible} onOpenVideo={onOpenVideo} />;

  let body: React.ReactNode;
  if (items.length === 1) {
    body = cell(items[0]);
  } else if (items.length === 2) {
    body = (
      <View style={styles.rowFill}>
        {cell(items[0])}
        <View style={{ width: GAP }} />
        {cell(items[1])}
      </View>
    );
  } else if (items.length === 3) {
    body = (
      <View style={styles.rowFill}>
        {cell(items[0])}
        <View style={{ width: GAP }} />
        <View style={styles.colFill}>
          {cell(items[1])}
          <View style={{ height: GAP }} />
          {cell(items[2])}
        </View>
      </View>
    );
  } else {
    body = (
      <View style={styles.rowFill}>
        <View style={styles.colFill}>
          {cell(items[0])}
          <View style={{ height: GAP }} />
          {cell(items[2])}
        </View>
        <View style={{ width: GAP }} />
        <View style={styles.colFill}>
          {cell(items[1])}
          <View style={{ height: GAP }} />
          {cell(items[3])}
        </View>
      </View>
    );
  }

  return <View style={[styles.wrap, { height: h }]}>{body}</View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, height: H, borderRadius: 16, overflow: 'hidden' },
  rowFill: { flex: 1, flexDirection: 'row' },
  colFill: { flex: 1 },
  ph: { alignItems: 'center', justifyContent: 'center' },
});
