// S4/ENTEGRASYONA: Profil ekranına bu satır eklenecek.
// ProfileCollectionRow (FinCollectEntry) — profil listesinde "Tabak koleksiyonu"
// satırı: başlık + kazanılan sayı + chevron. Profil ekranının sahibi S4; burada
// yalnız bırakılabilir bir bileşen EXPORT ediyoruz.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { COLLECTION_TARGET } from './types';

export function ProfileCollectionRow({ count, onPress }: { count: number; onPress: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tr('collection.title')}, ${tr('collection.count', { n: count, total: COLLECTION_TARGET })}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: t.color.surface, borderColor: t.color.line, opacity: pressed ? t.touch.activeOpacity : 1 },
      ]}
    >
      <View style={styles.left}>
        <AppText variant="body" tone="ink">
          {tr('collection.title')}
        </AppText>
      </View>
      <View style={styles.right}>
        <AppText variant="body" tone="secondary" style={styles.count}>
          {String(count)}
        </AppText>
        {/* Chevron (sağ ok). */}
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d="M9 6l6 6-6 6" fill="none" stroke={t.color.secondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: {},
});
