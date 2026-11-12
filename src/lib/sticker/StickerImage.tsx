/**
 * G30-S1 md.2 — Çıkartma beyaz konturu (FinMoSticker "kalkan çıkartma" hissi).
 *
 * Çıkartma (şeffaf zeminli, nesneye kırpılmış görsel) gösterilen HER yer bunu kullanır:
 * Tara sonucu kalkış (StickerLift), Ana sayfa / Gün öğün satırı (MealThumb), Logla izi uçuşu
 * (LogTraceHost). Normal fotoğrafa UYGULANMAZ — çağıran yalnız çıkartmada bu bileşeni seçer.
 *
 * OTA ile gidebilsin diye tamamen JS: aynı görüntünün beyaz `tintColor`'lı kopyaları N yönde
 * `outline` kadar ofsetle arkaya dizilir (tintColor saydam olmayan pikselleri boyar → siluetin
 * genişletilmiş beyaz hâli), en arkada çok hafif bir gölge kopyası (siyah, bulanık, %14).
 * Skia yok, yeni paket yok. Kopyalar aynı URI → görüntü önbellekte bir kez çözülür.
 *
 * Kalınlık: ≈ 3 pt; küçük görselde 1,5–2 pt (`stickerOutlineWidth`). Kontur kutunun DIŞINA
 * taşar — kap `overflow: 'hidden'` OLMAMALI (ya da kontur kadar iç boşluk bırakmalı).
 * Dekoratif: VoiceOver'a kapalı.
 */
import React from 'react';
import { Image, StyleSheet, View, type ImageProps, type StyleProp, type ViewStyle } from 'react-native';

/** Büyük görsel konturu (pt). */
export const STICKER_OUTLINE = 3;
/** Küçük görsel (< 64 pt) konturu. */
export const STICKER_OUTLINE_SMALL = 2;
/** Çok küçük görsel (< 40 pt) konturu. */
export const STICKER_OUTLINE_TINY = 1.5;
/** Gölge: çok hafif (FinMoSticker kalkış gölgesinden ayrı, sürekli). */
export const STICKER_SHADOW_OPACITY = 0.14;

/** Görselin kısa kenarına göre kontur kalınlığı. */
export function stickerOutlineWidth(minSide: number): number {
  if (!(minSide > 0)) return STICKER_OUTLINE;
  if (minSide < 40) return STICKER_OUTLINE_TINY;
  if (minSide < 64) return STICKER_OUTLINE_SMALL;
  return STICKER_OUTLINE;
}

/**
 * Kontur kopyalarının ofsetleri. İnce konturda 8 yön yeter; 3 pt'de 12 yön (her 30°) —
 * kenar dalgalanması r·(1 − cos 15°) ≈ 0,1 pt, gözle görülmez.
 */
export function outlineOffsets(width: number): { dx: number; dy: number }[] {
  const n = width >= 2.5 ? 12 : 8;
  const out: { dx: number; dy: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push({ dx: round2(Math.cos(a) * width), dy: round2(Math.sin(a) * width) });
  }
  return out;
}

function round2(v: number): number {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

export function StickerImage({
  uri,
  style,
  resizeMode = 'contain',
  outline,
  size,
  testID,
  onLoad,
  onError,
}: {
  uri: string;
  /** Görselin kutusu (konum/ölçü). Kontur bunun dışına taşar. */
  style?: StyleProp<ViewStyle>;
  resizeMode?: 'contain' | 'stretch';
  /** Kontur kalınlığı (pt). Verilmezse `size`'dan, o da yoksa 3 pt. */
  outline?: number;
  /** Kutunun kısa kenarı (pt) — kalınlık seçimi için. */
  size?: number;
  testID?: string;
  onLoad?: ImageProps['onLoad'];
  onError?: ImageProps['onError'];
}) {
  const w = outline ?? stickerOutlineWidth(size ?? 0);
  const offsets = outlineOffsets(w);
  const source = { uri };
  return (
    <View
      style={style}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {/* Çok hafif gölge: siluetin siyah, bulanık kopyası (iOS + Android aynı). */}
      <Image
        source={source}
        style={[StyleSheet.absoluteFill, styles.shadow, { transform: [{ translateY: Math.max(1, w * 0.6) }] }]}
        resizeMode={resizeMode}
        blurRadius={Math.max(2, w * 1.5)}
        testID={testID ? `${testID}-shadow` : undefined}
      />
      {offsets.map((o, i) => (
        <Image
          key={i}
          source={source}
          style={[StyleSheet.absoluteFill, styles.white, { transform: [{ translateX: o.dx }, { translateY: o.dy }] }]}
          resizeMode={resizeMode}
          testID={testID ? `${testID}-outline` : undefined}
        />
      ))}
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onLoad={onLoad}
        onError={onError}
        testID={testID ? `${testID}-img` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  white: { tintColor: '#FFFFFF' },
  shadow: { tintColor: '#000000', opacity: STICKER_SHADOW_OPACITY },
});
