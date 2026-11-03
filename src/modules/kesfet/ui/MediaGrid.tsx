// Keşfet medya ızgarası — 1–4 görsel (expo-image). 1: tam genişlik 220 px;
// 2: yan yana; 3: solda büyük + sağda iki; 4: 2×2. Taşma radius 16 ile kırpılır.
// Video (G8-CONTRACT media[].kind) `kesfet_video` açıkken FeedVideo ile çizilir
// (bayrak kapalıyken ya da sunucu henüz `kind` göndermiyorsa düz kapak görseli
// — bugünkü davranışla birebir aynı).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../../core/design';
import { useFeature } from '../../../core/flags';
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
}: {
  media: FeedMedia;
  postId: string;
  isVisible: boolean;
  style?: object;
}) {
  const t = useTheme();
  const kesfetVideo = useFeature('kesfet_video');

  if (media.kind === 'video' && kesfetVideo) {
    return (
      <FeedVideo
        id={postId}
        source={media.url}
        posterUri={media.thumb_path ? publicUrlForPath(media.thumb_path) : null}
        isVisible={isVisible}
        style={[{ backgroundColor: t.color.line }, style]}
      />
    );
  }

  const posterUri = media.kind === 'video' ? (media.thumb_path ? publicUrlForPath(media.thumb_path) : media.url) : media.url;
  return (
    <Image
      source={{ uri: posterUri }}
      style={[{ flex: 1, backgroundColor: t.color.line }, style]}
      contentFit="cover"
      transition={120}
      accessibilityIgnoresInvertColors
    />
  );
}

export function MediaGrid({
  media,
  postId,
  isVisible = false,
}: {
  media: FeedMedia[];
  postId: string;
  isVisible?: boolean;
}) {
  if (media.length === 0) return null;
  const items = media.slice(0, 4);

  const cell = (m: FeedMedia) => <Cell media={m} postId={postId} isVisible={isVisible} />;

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

  return <View style={styles.wrap}>{body}</View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, height: H, borderRadius: 16, overflow: 'hidden' },
  rowFill: { flex: 1, flexDirection: 'row' },
  colFill: { flex: 1 },
});
