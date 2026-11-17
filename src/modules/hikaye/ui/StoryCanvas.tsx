// G59-S1 — Hikâye tuvali: taban (foto / video / düz-degrade zemin) + katmanlar (z sıralı). Katman konumu
// tuvale oranla (x,y), ölçek tasarım tuvaline (393 genişlik) göre orantılanır → her ekranda aynı yerleşim.
// Düzenleyici `renderOverlay` ile sürükleme/sıkıştırma sarmalayıcısı verir; görüntüleyici `media` ile video.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { pathD, sortByZ } from '../overlays';
import type { DrawPath, StoryBg, StoryOverlay } from '../types';
import { CANVAS_W } from './tokens';
import { StorySticker, type StickerInteract } from './StorySticker';

/** Merkez kutusu: katman içeriği bu kutunun ortasına oturur (ölçüm gerekmez). */
const BOX = 400;

export function StoryBackground({ bg, style }: { bg: StoryBg | null; style?: object }) {
  const colors = bg?.colors?.length ? bg.colors : ['#4A4F3A', '#17191C'];
  if (bg?.kind === 'solid' || colors.length < 2) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors[0] }, style]} />;
  }
  return <LinearGradient colors={colors as [string, string, ...string[]]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, style]} />;
}

export function DrawLayer({ paths, w, h, live }: { paths: DrawPath[]; w: number; h: number; live?: DrawPath | null }) {
  const k = w / CANVAS_W;
  const all = live ? [...paths, live] : paths;
  if (!all.length) return null;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      {all.map((p, i) => (
        <Path
          key={i}
          d={pathD(p.pts, w, h)}
          fill="none"
          stroke={p.color}
          strokeWidth={(p.brush === 'marker' ? p.width * 2.2 : p.width) * k}
          strokeLinecap={p.brush === 'marker' ? 'square' : 'round'}
          strokeLinejoin="round"
          opacity={p.brush === 'marker' ? 0.55 : 1}
        />
      ))}
    </Svg>
  );
}

export function OverlayAt({
  overlay,
  w,
  h,
  children,
}: {
  overlay: Pick<StoryOverlay, 'x' | 'y' | 'scale' | 'rotation'>;
  w: number;
  h: number;
  children: React.ReactNode;
}) {
  const k = w / CANVAS_W;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: overlay.x * w - BOX / 2,
        top: overlay.y * h - BOX / 2,
        width: BOX,
        height: BOX,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View pointerEvents="box-none" style={{ transform: [{ rotate: `${overlay.rotation}deg` }, { scale: overlay.scale * k }] }}>
        {children}
      </View>
    </View>
  );
}

export function StoryCanvas({
  w,
  h,
  mediaUri,
  mediaType,
  bg,
  overlays,
  media,
  reduceTransparency,
  interactFor,
  renderOverlay,
  liveDraw,
  children,
  testID,
}: {
  w: number;
  h: number;
  mediaUri: string | null;
  mediaType: 'image' | 'video' | 'none';
  bg: StoryBg | null;
  overlays: StoryOverlay[];
  /** Video oynatıcı vb. (verilirse taban yerine çizilir). */
  media?: React.ReactNode;
  reduceTransparency?: boolean;
  interactFor?: (o: StoryOverlay) => StickerInteract | undefined;
  /** Düzenleyici: katman sarmalayıcısı (sürükle / sıkıştır / seç). */
  renderOverlay?: (o: StoryOverlay, node: React.ReactNode) => React.ReactNode;
  liveDraw?: DrawPath | null;
  children?: React.ReactNode;
  testID?: string;
}) {
  const sorted = sortByZ(overlays);
  const drawPaths = sorted.flatMap((o) => (o.kind === 'draw' ? o.data.paths : []));
  return (
    <View style={{ width: w, height: h, backgroundColor: '#000000', overflow: 'hidden' }} testID={testID}>
      {media ? (
        media
      ) : mediaType === 'none' || !mediaUri ? (
        <StoryBackground bg={bg} />
      ) : (
        <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      )}
      <DrawLayer paths={drawPaths} w={w} h={h} live={liveDraw} />
      {sorted.map((o) => {
        if (o.kind === 'draw') return null;
        const node = <StorySticker overlay={o} reduceTransparency={reduceTransparency} interact={interactFor?.(o)} />;
        return (
          <React.Fragment key={o.id}>
            {renderOverlay ? renderOverlay(o, node) : (
              <OverlayAt overlay={o} w={w} h={h}>
                {node}
              </OverlayAt>
            )}
          </React.Fragment>
        );
      })}
      {children}
    </View>
  );
}
