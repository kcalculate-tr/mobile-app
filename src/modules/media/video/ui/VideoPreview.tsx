// Composer video önizleme — G8-S3.md m.2. Yerel dosya (henüz yüklenmedi),
// veri maliyeti yok → FeedVideo'daki veri tasarrufu kapısı burada gerekmez.
// Mount olunca sessiz otomatik oynat, dokununca ses aç/kapat, tam ekran;
// `useActiveVideoStore` üzerinden akıştaki videolarla aynı "tek video" kuralına
// uyar (önizleme açılırken arkadaki bir FeedVideo durur).
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useActiveVideoStore } from '../activeVideo';
import { VolumeOnIcon, VolumeOffIcon, ExpandIcon } from './icons';

const PREVIEW_ID = 'composer-video-preview';

export function VideoPreview({ uri, style }: { uri: string; style?: object }) {
  const [muted, setMuted] = useState(true);
  const viewRef = useRef<VideoView>(null);
  const setActive = useActiveVideoStore((s) => s.setActive);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    setActive(PREVIEW_ID);
    return () => {
      if (useActiveVideoStore.getState().activeId === PREVIEW_ID) setActive(null);
    };
  }, [setActive]);

  return (
    <View style={[styles.wrap, style]}>
      <VideoView ref={viewRef} player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />

      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Sesi aç' : 'Sesi kapat'}
        onPress={() => setMuted((m) => !m)}
      />

      <View style={styles.controls}>
        <View style={styles.badge}>
          {muted ? <VolumeOffIcon size={16} /> : <VolumeOnIcon size={16} />}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tam ekran"
          style={styles.badge}
          onPress={() => void viewRef.current?.enterFullscreen()}
        >
          <ExpandIcon size={16} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', overflow: 'hidden', borderRadius: 16 },
  controls: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', gap: 6 },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
