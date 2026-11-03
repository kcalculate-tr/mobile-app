// Keşfet medya ızgarası — 1–4 görsel (expo-image). 1: tam genişlik 220 px;
// 2: yan yana; 3: solda büyük + sağda iki; 4: 2×2. Taşma radius 16 ile kırpılır.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../../core/design';
import type { FeedMedia } from '../types';

const H = 220;
const GAP = 2;

function Cell({ media, style }: { media: FeedMedia; style?: object }) {
  const t = useTheme();
  return (
    <Image
      source={{ uri: media.url }}
      style={[{ flex: 1, backgroundColor: t.color.line }, style]}
      contentFit="cover"
      transition={120}
      accessibilityIgnoresInvertColors
    />
  );
}

export function MediaGrid({ media }: { media: FeedMedia[] }) {
  if (media.length === 0) return null;
  const items = media.slice(0, 4);

  let body: React.ReactNode;
  if (items.length === 1) {
    body = <Cell media={items[0]} />;
  } else if (items.length === 2) {
    body = (
      <View style={styles.rowFill}>
        <Cell media={items[0]} />
        <View style={{ width: GAP }} />
        <Cell media={items[1]} />
      </View>
    );
  } else if (items.length === 3) {
    body = (
      <View style={styles.rowFill}>
        <Cell media={items[0]} />
        <View style={{ width: GAP }} />
        <View style={styles.colFill}>
          <Cell media={items[1]} />
          <View style={{ height: GAP }} />
          <Cell media={items[2]} />
        </View>
      </View>
    );
  } else {
    body = (
      <View style={styles.rowFill}>
        <View style={styles.colFill}>
          <Cell media={items[0]} />
          <View style={{ height: GAP }} />
          <Cell media={items[2]} />
        </View>
        <View style={{ width: GAP }} />
        <View style={styles.colFill}>
          <Cell media={items[1]} />
          <View style={{ height: GAP }} />
          <Cell media={items[3]} />
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
