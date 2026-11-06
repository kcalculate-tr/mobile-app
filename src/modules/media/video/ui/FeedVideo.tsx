// Akıştaki video — G8-S3.md m.2: görünür olunca sessiz otomatik oynat,
// görünmezken durdur, dokununca ses aç/kapat, tam ekran, aynı anda tek video.
// Veri tasarrufu/düşük güç modunda otomatik oynatma kapalı (bkz.
// useAutoplayAllowed.ts) — bu durumda kapak + elle "oynat" düğmesi gösterilir.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useActiveVideoStore } from '../activeVideo';
import { useAutoplayAllowed } from '../useAutoplayAllowed';
import { PlayIcon, VolumeOnIcon, VolumeOffIcon, ExpandIcon } from './icons';
import Svg, { Path } from 'react-native-svg';

function CameraIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill={color}>
      <Path d="M251.77,73a8,8,0,0,0-8.21.39L208,97.05V72a16,16,0,0,0-16-16H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V159l35.56,23.71A8,8,0,0,0,248,184a8,8,0,0,0,8-8V80A8,8,0,0,0,251.77,73ZM192,184H32V72H192V184Zm48-22.95-32-21.33V116.28L240,95Z" />
    </Svg>
  );
}

export interface FeedVideoLabels {
  mute: string;
  unmute: string;
  fullscreen: string;
  play: string;
}

// Varsayılan (TR) etiketler — çağıran i18n ile geçersiz kılar (TR/EN, G11-S3).
const DEFAULT_LABELS: FeedVideoLabels = {
  mute: 'Sesi kapat',
  unmute: 'Sesi aç',
  fullscreen: 'Tam ekran',
  play: 'Oynat',
};

export function FeedVideo({
  id,
  source,
  posterUri,
  isVisible,
  style,
  labels = DEFAULT_LABELS,
  onOpen,
  durationS,
  phColor,
  phIconColor,
}: {
  id: string;
  source: string;
  posterUri: string | null;
  isVisible: boolean;
  style?: object;
  labels?: FeedVideoLabels;
  /**
   * G15 (Final FinVideo) — verilirse: videoya dokun = tam ekran oynatıcı (çağıran
   * açar); ses ayrı düğmede; sol altta "▶ süre" hapı, altta ilerleme çizgisi.
   * Verilmezse G8 davranışı aynen (dokun = ses, ⤢ tam ekran).
   */
  onOpen?: () => void;
  /** Sunucu süresi (sn) — oynatıcı süresi gelene kadar hapta gösterilir. */
  durationS?: number | null;
  /** Yer tutucu renkleri (tema) — Final açık #CFD2D7 / #45454A. */
  phColor?: string;
  phIconColor?: string;
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

  // G15 — ilerleme çizgisi + süre hapı (yalnız Final modu): oynarken 250 ms'de bir.
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState<number>(durationS ?? 0);
  useEffect(() => {
    if (!onOpen) return;
    const tick = () => {
      const d = Number(player.duration) || durationS || 0;
      if (d > 0) {
        setDur(d);
        setProgress(Math.min(1, Math.max(0, (Number(player.currentTime) || 0) / d)));
      }
    };
    tick();
    if (!shouldPlay) return;
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [onOpen, player, shouldPlay, durationS]);

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
      {onOpen && !frameRendered && posterUri == null ? (
        // G15 — Final yer tutucu (ilk kare gelene kadar): gri zemin + kamera ikonu.
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ph, { backgroundColor: phColor ?? '#CFD2D7' }]}>
          <CameraIcon size={28} color={phIconColor ?? '#45454A'} />
        </View>
      ) : null}

      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={
          showManualPlayButton ? labels.play : onOpen ? labels.fullscreen : muted ? labels.unmute : labels.mute
        }
        onPress={() => {
          if (showManualPlayButton) {
            setManualPlay(true);
            return;
          }
          if (onOpen) {
            onOpen();
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

      {onOpen ? (
        <>
          {dur > 0 ? (
            <View pointerEvents="none" style={styles.durPill}>
              <PlayIcon size={12} />
              <Text style={styles.durText}>{fmtTime(dur)}</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={muted ? labels.unmute : labels.mute}
            onPress={() => setMuted((m) => !m)}
            hitSlop={4}
            style={styles.muteBtn}
          >
            {muted ? <VolumeOffIcon size={18} /> : <VolumeOnIcon size={18} />}
          </Pressable>
          <View pointerEvents="none" style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </>
      ) : (
      <View style={styles.controls}>
        <View style={styles.badge}>
          {muted ? <VolumeOffIcon size={16} /> : <VolumeOnIcon size={16} />}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={labels.fullscreen}
          style={styles.badge}
          onPress={() => void viewRef.current?.enterFullscreen()}
        >
          <ExpandIcon size={16} />
        </Pressable>
      </View>
      )}
    </View>
  );
}

/** 42 → "0:42", 75 → "1:15". */
export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
  ph: { alignItems: 'center', justifyContent: 'center' },
  durPill: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(10,10,10,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  muteBtn: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10,10,10,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  fill: { height: 3, backgroundColor: '#FFFFFF' },
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
