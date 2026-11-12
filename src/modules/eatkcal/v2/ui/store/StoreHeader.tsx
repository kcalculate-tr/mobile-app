// eatkcal v2 (G32-S1 md.2) — Mağaza sayfası yapışkan başlığı.
//
// TestFlight (12 Kas): ScrollView stickyHeader çipleri ekranın en üstüne (durum
// çubuğunun ALTINA) yapıştırıyor, geri düğmesi içeriğin üstünde yüzüyordu.
// Yeni düzen: opak (tema arka planı, Dark'ta da) tek blok — üstte güvenli alan
// kadar düz zemin, sonra [geri · mağaza adı] satırı, altında yatay kayan çipler.
// Seçili çip görünür alana kayar.
import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { CaretLeft } from '../../../../../components/icons';
import { haptic } from '../../../../../core/design';
import { SCROLL_KEYBOARD } from '../../../../../core/design/keyboard';
import { CategoryPill } from '../home/cards';
import { ekType, useEk } from '../kit';

/** Başlıktaki [geri · ad] satırının yüksekliği (44 dokunma alanı). */
export const STORE_BAR_ROW = 48;
/** Çip satırı dikey boşluğu (akış içi ve yapışık aynı → dikişsiz geçiş). */
const CHIP_PAD = 8;

/**
 * Akış içi çip bloğunun içerikteki y konumundan, yapışan başlığın görüneceği
 * kaydırma eşiği: çipler başlıktaki çip satırının hizasına (güvenli alan +
 * [geri · ad] satırı) geldiği an.
 */
export function storePinAt(chipsY: number, insetTop: number): number {
  return Math.max(0, chipsY - insetTop - STORE_BAR_ROW);
}

/** Yatay kayan kategori çipleri; seçili çip görünür alana kayar. */
export function StoreChips({
  chips,
  selected,
  onSelect,
  testID,
}: {
  chips: string[];
  selected: string | null;
  onSelect: (n: string | null) => void;
  testID?: string;
}) {
  const { t } = useEk();
  const ref = useRef<ScrollView>(null);
  const xs = useRef<Record<string, number>>({});
  const key = selected ?? '__all__';

  useEffect(() => {
    const x = xs.current[key];
    if (x != null) ref.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
  }, [key]);

  const pill = (k: string, label: string, value: string | null) => (
    <View
      key={k}
      onLayout={(e) => {
        xs.current[k] = e.nativeEvent.layout.x;
      }}
    >
      <CategoryPill label={label} selected={key === k} onPress={() => onSelect(value)} />
    </View>
  );

  return (
    <ScrollView
      {...SCROLL_KEYBOARD}
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      testID={testID}
    >
      {pill('__all__', t('eatkcal.v2.store.all'), null)}
      {chips.map((n) => pill(n, n, n))}
    </ScrollView>
  );
}

/** Yapışık başlık: güvenli alan (düz, opak) + [geri · mağaza adı] + çipler. */
export function StorePinnedHeader({
  name,
  onBack,
  chips,
  selected,
  onSelect,
}: {
  name: string;
  onBack: () => void;
  chips: string[];
  selected: string | null;
  onSelect: (n: string | null) => void;
}) {
  const { c, t, insets } = useEk();
  return (
    <View
      style={[styles.pinned, { paddingTop: insets.top, backgroundColor: c.bg, borderBottomColor: c.line }]}
      testID="ek-store-pinned"
    >
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            haptic('selection');
            onBack();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('eatkcal.v2.common.back')}
          hitSlop={4}
          style={styles.back}
          testID="ek-store-pinned-back"
        >
          <CaretLeft size={22} color={c.ink} />
        </Pressable>
        <Text style={[ekType.b15s, styles.name, { color: c.ink }]} numberOfLines={1} accessibilityRole="header">
          {name}
        </Text>
      </View>
      <StoreChips chips={chips} selected={selected} onSelect={onSelect} testID="ek-store-pinned-chips" />
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { paddingHorizontal: 16, paddingVertical: CHIP_PAD, gap: 10 },
  pinned: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
    elevation: 2,
  },
  row: { height: STORE_BAR_ROW, flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingRight: 16, gap: 4 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1 },
});
