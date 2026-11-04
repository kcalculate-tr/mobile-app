// CollectionGrid (FinCollectGrid) — "Tabak koleksiyonu" ızgarası.
// Başlık + "N / 120 tabak" ilerleme + ince çubuk + filtre çipleri
// (Tümü/Kahvaltı/Öğle/Akşam/eatkcal) + 3 sütunlu çıkartma ızgarası. Kazanılan
// kartlar StickerCard; kalan yuvalar SVG kesik-çizgi (dashed) silüet yer tutucuları.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { AppText, haptic, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { StickerCard } from './StickerCard';
import { COLLECTION_TARGET, type CollectionCard, type CollectionMeal } from './types';

type FilterKey = 'all' | CollectionMeal;

// Filtre çipleri — 'snack' şu an tasarımda ayrı çip değil; Tümü kapsar.
const FILTERS: { key: FilterKey; i18n: string }[] = [
  { key: 'all', i18n: 'collection.filter_all' },
  { key: 'breakfast', i18n: 'collection.filter_breakfast' },
  { key: 'lunch', i18n: 'collection.filter_lunch' },
  { key: 'dinner', i18n: 'collection.filter_dinner' },
  { key: 'eatkcal', i18n: 'collection.filter_eatkcal' },
];

// Satırı doldurmak için en az bu kadar yuva göster (6 dolu + 6 kilitli gibi).
const MIN_SLOTS = 12;

export function CollectionGrid({
  cards,
  onOpen,
  style,
}: {
  cards: CollectionCard[];
  onOpen?: (card: CollectionCard) => void;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const [filter, setFilter] = useState<FilterKey>('all');

  const shown = useMemo(
    () => (filter === 'all' ? cards : cards.filter((c) => c.meal === filter)),
    [cards, filter],
  );

  // İlerleme — tüm koleksiyondaki kazanılan sayıya göre (filtreye değil).
  const wonCount = cards.length;
  const progress = Math.min(wonCount / COLLECTION_TARGET, 1);

  // 3'ün katına tamamla, en az MIN_SLOTS yuva.
  const slotTarget = Math.max(MIN_SLOTS, Math.ceil(shown.length / 3) * 3 + (shown.length % 3 === 0 ? 3 : 0));
  const lockedCount = Math.max(0, slotTarget - shown.length);

  // Dönme açısı indekse göre -3..3 arasında değişir (çıkartma hissi).
  const rotationFor = (i: number) => [-3, 2, -2, 3, -1, 1][i % 6];

  return (
    <View style={[styles.container, style]}>
      <AppText variant="title" tone="ink" style={styles.title}>
        {tr('collection.title')}
      </AppText>

      <AppText variant="caption" tone="secondary" style={styles.count}>
        {tr('collection.count', { n: wonCount, total: COLLECTION_TARGET })}
      </AppText>

      {/* İnce ilerleme çubuğu. */}
      <View style={[styles.barTrack, { backgroundColor: t.color.line }]}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.round(progress * 100)}%`, backgroundColor: t.color.accent },
          ]}
        />
      </View>

      {/* Filtre çipleri. */}
      <View style={styles.chips}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <View
              key={f.key}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? t.color.accent : 'transparent',
                  borderColor: active ? t.color.accent : t.color.line,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onStartShouldSetResponder={() => true}
              onResponderRelease={() => {
                haptic('selection');
                setFilter(f.key);
              }}
            >
              <AppText variant="caption" tone={active ? 'onAccent' : 'secondary'}>
                {tr(f.i18n)}
              </AppText>
            </View>
          );
        })}
      </View>

      {/* 3 sütunlu ızgara. */}
      <View style={styles.grid}>
        {shown.map((card, i) => (
          <View key={card.id} style={styles.cell}>
            <StickerCard card={card} rotation={rotationFor(i)} onPress={onOpen ? () => onOpen(card) : undefined} />
          </View>
        ))}
        {Array.from({ length: lockedCount }).map((_, i) => (
          <View key={`locked-${i}`} style={styles.cell}>
            <LockedSlot variant={i % 3} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Kilitli yuva — kesik-çizgi silüet (tabak / kase / kupa) + "Kilitli".
function LockedSlot({ variant }: { variant: number }) {
  const t = useTheme();
  const { t: tr } = useT();
  const size = 104;
  const stroke = t.color.line;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.lockedBox,
          { width: size, height: size, borderRadius: t.radius.lg, backgroundColor: t.color.surface },
        ]}
      >
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 60 60">
          {variant === 0 ? (
            // Tabak — iç içe iki daire (çıkartma kenarı + yemek alanı).
            <>
              <Circle cx={30} cy={30} r={26} fill="none" stroke={stroke} strokeWidth={2} strokeDasharray="5 5" />
              <Circle cx={30} cy={30} r={15} fill="none" stroke={stroke} strokeWidth={2} strokeDasharray="4 4" />
            </>
          ) : variant === 1 ? (
            // Kase — yarım daire gövde + üst elips ağzı.
            <>
              <Path
                d="M8 26 Q8 48 30 48 Q52 48 52 26 Z"
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeDasharray="5 5"
              />
              <Path
                d="M8 26 Q30 36 52 26"
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            </>
          ) : (
            // Kupa — dikdörtgen gövde + sağda kulp.
            <>
              <Rect x={12} y={16} width={26} height={30} rx={5} fill="none" stroke={stroke} strokeWidth={2} strokeDasharray="5 5" />
              <Path
                d="M38 22 Q50 22 50 31 Q50 40 38 40"
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            </>
          )}
        </Svg>
      </View>
      <AppText variant="caption" tone="secondary" style={styles.caption}>
        {tr('collection.locked')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 26, lineHeight: 32 },
  count: { marginTop: 6 },
  barTrack: { height: 4, borderRadius: 999, overflow: 'hidden', marginTop: 8, marginBottom: 14 },
  barFill: { height: 4, borderRadius: 999 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 },
  cell: { width: '31%', alignItems: 'center' },
  wrap: { alignItems: 'center' },
  lockedBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'transparent',
  },
  caption: { marginTop: 6 },
});
