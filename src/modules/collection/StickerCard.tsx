// StickerCard — tek bir tabak çıkartması. Kullanıcı fotoğrafı yuvarlak köşeli,
// beyazımsı dolgulu, gölgeli bir die-cut çıkartma gibi; altında "No. NNN".
// Fotoğraf yoksa nötr yer tutucu.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../../core/design';
import { CachedImage } from '../../components/CachedImage';
import type { CollectionCard } from './types';

// "No. 043" — 3 haneye sıfır doldurur.
export function formatNo(no: number): string {
  return `No. ${String(no).padStart(3, '0')}`;
}

export function StickerCard({
  card,
  size = 104,
  rotation = 0,
  onPress,
}: {
  card: CollectionCard;
  size?: number;
  rotation?: number;
  onPress?: () => void;
}) {
  const t = useTheme();
  // Die-cut beyaz çerçeve kalınlığı — çıkartma kenarı hissi.
  const pad = Math.round(size * 0.06);
  const inner = size - pad * 2;

  const body = (
    <View style={[styles.wrap, { transform: [{ rotate: `${rotation}deg` }] }]}>
      <View
        style={[
          styles.sticker,
          t.elevation.md,
          {
            width: size,
            height: size,
            padding: pad,
            borderRadius: t.radius.lg,
            backgroundColor: t.color.surfaceRaised,
          },
        ]}
      >
        <View
          style={[
            styles.photoClip,
            { width: inner, height: inner, borderRadius: t.radius.md, backgroundColor: t.color.surface },
          ]}
        >
          {card.photoUri ? (
            <CachedImage uri={card.photoUri} style={{ width: inner, height: inner }} contentFit="cover" />
          ) : (
            <View style={[styles.placeholder, { borderColor: t.color.line, borderRadius: t.radius.md }]}>
              <AppText variant="caption" tone="secondary">
                —
              </AppText>
            </View>
          )}
        </View>
      </View>
      <AppText variant="caption" tone="secondary" style={styles.caption}>
        {formatNo(card.no)}
      </AppText>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${formatNo(card.no)}`}
      style={({ pressed }) => ({ opacity: pressed ? t.touch.activeOpacity : 1 })}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  sticker: { alignItems: 'center', justifyContent: 'center' },
  photoClip: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  placeholder: {
    flex: 1,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { marginTop: 6 },
});
