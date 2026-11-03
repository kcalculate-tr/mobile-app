// Keşfet avatarı — üç hâl: (1) kurumsal "kcal" baloncuğu (siyah daire + lime
// nokta), (2) görsel (expo-image), (3) baş harf dolgusu. Tasarım: 40 px daire.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../../core/design';
import { AppText } from '../../../core/design';

function initial(name: string): string {
  const ch = name.trim().charAt(0);
  return ch ? ch.toLocaleUpperCase('tr-TR') : '';
}

export function Avatar({
  name,
  url,
  official = false,
  size = 40,
}: {
  name: string;
  url: string | null;
  official?: boolean;
  size?: number;
}) {
  const t = useTheme();
  const radius = size / 2;

  if (official) {
    return (
      <View
        style={[
          styles.base,
          { width: size, height: size, borderRadius: radius, backgroundColor: t.color.ink },
        ]}
      >
        <View style={styles.wordmark}>
          <AppText
            variant="caption"
            style={{ color: t.color.surface, fontWeight: '700', fontSize: size * 0.3 }}
            numberOfLines={1}
          >
            kcal
          </AppText>
          <View
            style={{
              width: size * 0.075,
              height: size * 0.075,
              borderRadius: size * 0.0375,
              backgroundColor: t.color.accent,
              marginLeft: 1,
              marginBottom: 1,
            }}
          />
        </View>
      </View>
    );
  }

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: t.color.line }}
        contentFit="cover"
        transition={120}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radius, backgroundColor: t.color.line },
      ]}
    >
      <AppText variant="caption" tone="secondary" style={{ fontWeight: '700', fontSize: size * 0.42 }}>
        {initial(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  wordmark: { flexDirection: 'row', alignItems: 'flex-end' },
});
