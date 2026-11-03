// Akıştaki video — G8-S3.md m.2: görünür olunca sessiz otomatik oynat,
// görünmezken durdur, dokununca ses aç/kapat, tam ekran, aynı anda tek video.
// Veri tasarrufu/düşük güç modunda otomatik oynatma kapalı (bkz.
// useAutoplayAllowed.ts) — bu durumda kapak + elle "oynat" düğmesi gösterilir.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useActiveVideoStore } from '../activeVideo';
import { useAutoplayAllowed } from '../useAutoplayAllowed';
import { PlayIcon, VolumeOnIcon, VolumeOffIcon, ExpandIcon } from './icons';

export function FeedVideo({
  id,
  source,
  posterUri,
  isVisible,
  style,
}: {
  id: string;
  source: string;
  posterUri: string | null;
  isVisible: boolean;
  style?: object;
}) {
  const autoplayAllowed = useAutoplayAllowed();
  const activeId = useActiveVideoStore((s) => s.activeId);
  const setActive = useActiveVideoStore((s) => s.setActive);
  const [muted, setMuted] = useState(true);
  const [frameRendered, setFrameRendered] = useState(false);
  const [manualPlay, setManualPlay] = useState(false);
  const viewRef = useRef<VideoView>(null);

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  // Görünür olunca "aktif" ol; görünmezden çıkınca ya da sökülünce bırak.
  useEffect(() => {
    if (isVisible) {
      setActive(id);
    } else if (useActiveVideoStore.getState().activeId === id) {
      setActive(null);
    }
    return () => {
      if (useActiveVideoStore.getState().activeId === id) setActive(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, id]);

  const isActive = activeId === id;
  const shouldPlay = isActive && isVisible && (autoplayAllowed || manualPlay);

  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, shouldPlay]);

  const showPoster = posterUri != null && (!frameRendered || !shouldPlay);
  const showManualPlayButton = posterUri != null && isActive && isVisible && !autoplayAllowed && !manualPlay;

  return (
    <View style={[styles.wrap, style]}>
      <VideoView
        ref={viewRef}
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        onFirstFrameRender={() => setFrameRendered(true)}
      />
      {showPoster ? (
        <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}

      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Sesi aç' : 'Sesi kapat'}
        onPress={() => {
          if (showManualPlayButton) {
            setManualPlay(true);
            return;
          }
          setMuted((m) => !m);
        }}
      >
        {showManualPlayButton ? (
          <View style={styles.centerOverlay}>
            <View style={styles.playBadge}>
              <PlayIcon size={28} />
            </View>
          </View>
        ) : null}
      </Pressable>

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
  wrap: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  centerOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
