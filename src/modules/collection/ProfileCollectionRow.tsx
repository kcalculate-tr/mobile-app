// ProfileCollectionRow (FinCollectEntry) — G15-S2: Profil'de "Tabak koleksiyonu"
// şeridi. Lime tonlu bant: başlık + "N / 120 tabak · son: No. NNN" + "Yeni"
// rozeti + chevron; altında son 4 kartın pul (kesik kenar) küçük resimleri
// ve "No. NNN" etiketleri. Profil yalnız en az 1 kart varken çizer (yoksa düz
// "Koleksiyon" satırı kalır).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { CachedImage } from '../../components/CachedImage';
import { formatNo } from './StickerCard';
import { COLLECTION_TARGET } from './types';

export interface CollectionStamp {
  no: number;
  photoUri?: string | null;
}

export function ProfileCollectionRow({
  count,
  recent = [],
  isNew = false,
  onPress,
}: {
  count: number;
  /** En yeni önce; ilk 4'ü çizilir. */
  recent?: CollectionStamp[];
  /** Son kart henüz görülmediyse "Yeni" rozeti. */
  isNew?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const last = recent[0];
  const sub = last
    ? `${tr('collection.count', { n: count, total: COLLECTION_TARGET })} · ${tr('collection.last', { no: formatNo(last.no) })}`
    : tr('collection.count', { n: count, total: COLLECTION_TARGET });
  const band = t.isDark ? 'rgba(198,240,79,0.12)' : 'rgba(198,240,79,0.28)';
  const stamp = t.isDark ? '#3A3A3C' : '#D3D6DA';
  const edge = t.isDark ? '#48484A' : '#C3C7CC';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tr('collection.title')}, ${sub}`}
      style={({ pressed }) => [styles.band, { backgroundColor: band, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.head}>
        <View style={styles.headText}>
          <AppText style={styles.title}>{tr('collection.title')}</AppText>
          <AppText tone="secondary" style={styles.sub} numberOfLines={1}>
            {sub}
          </AppText>
        </View>
        {isNew ? (
          <View style={[styles.newBadge, { backgroundColor: t.color.accent }]}>
            <AppText tone="onAccent" style={styles.newText}>
              {tr('collection.new')}
            </AppText>
          </View>
        ) : null}
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d="M9 6l6 6-6 6" fill="none" stroke={t.color.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      {recent.length > 0 ? (
        <View style={styles.stamps}>
          {recent.slice(0, 4).map((s) => (
            <View key={s.no} style={[styles.stamp, { backgroundColor: stamp, borderColor: edge }]}>
              {s.photoUri ? <CachedImage uri={s.photoUri} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <View style={[styles.noChip, { backgroundColor: t.color.bg }]}>
                <AppText style={styles.noText}>{formatNo(s.no)}</AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  band: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headText: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13 },
  newBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  newText: { fontSize: 12, fontWeight: '700' },
  stamps: { flexDirection: 'row', gap: 4 },
  stamp: {
    width: 74,
    height: 98,
    borderRadius: 6,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 4,
  },
  noChip: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  noText: { fontSize: 12, fontWeight: '700' },
});
