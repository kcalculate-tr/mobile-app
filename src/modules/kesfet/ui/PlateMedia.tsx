// G15-S3 — FinFeed "Tabaktaki besinler": tek fotoğraflı öğün gönderisinde
// bileşen etiketleri (foto üstünde beyaz haplar), "Kalori hedefine uyar" çipi,
// "Besinleri göster/gizle" düğmesi ve besin tablosu (Besin · Miktar · Kalori ·
// P·K·Y + Toplam). Yalnız `meal_card.items` (sunucu verisi) varsa kullanılır;
// yoksa PostCard düz MediaGrid'e düşer (uydurma yok).
import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppText, fontFamily, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import type { FeedMedia, MealCard as MealCardData } from '../types';

const H = 220;
// Final FinFeed etiket yerleşimi (309 px genişlikteki fotoğrafta): Kinoa sol-orta,
// Tavuk göğsü sağ-üst, Sebzeler sağ-alt; dördüncü etiket sol-alt.
const SLOTS = [
  { x: 16 / 309, y: 110 },
  { x: 140 / 309, y: 58 },
  { x: 150 / 309, y: 150 },
  { x: 16 / 309, y: 160 },
];

function ScanIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8 M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8 M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16 M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
    </Svg>
  );
}

function CheckIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

function InfoIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round">
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 11v5 M12 8h.01" />
    </Svg>
  );
}

export function PlateMedia({
  media,
  meal,
  fitsGoal,
  initialOpen = false,
  onMediaTap,
  overlay,
}: {
  media: FeedMedia;
  meal: MealCardData;
  /** Öğün kalan günlük kaloriye sığıyor mu (gerçek özet verisi; bilinmiyorsa gizli). */
  fitsGoal?: boolean;
  initialOpen?: boolean;
  /** Fotoğrafa dokunma (çift dokunma beğen — PostCard yönetir). */
  onMediaTap?: () => void;
  /** Kalp damgası gibi üst katman (PostCard verir). */
  overlay?: React.ReactNode;
}) {
  const t = useTheme();
  const { t: tr, fmt } = useT();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(initialOpen);
  const items = meal.items ?? [];
  // Foto genişliği: ekran − 16·2 kenar − 40 avatar − 12 aralık.
  const photoW = Math.max(0, width - 84);
  const totalGrams = items.reduce((s, it) => s + it.grams, 0);
  const pky = (p: number, k: number, y: number) => `${fmt(Math.round(p))} / ${fmt(Math.round(k))} / ${fmt(Math.round(y))}`;

  return (
    <>
      <Pressable onPress={onMediaTap} accessibilityRole="imagebutton" accessibilityLabel={tr('kesfet.ui.a11y.like')}>
        <View style={[styles.photo, { backgroundColor: t.color.line }]}>
          <Image source={{ uri: media.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} accessibilityIgnoresInvertColors />
          {open ? (
            <>
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} />
              {items.slice(0, SLOTS.length).map((it, i) => (
                <View
                  key={`${it.name}-${i}`}
                  pointerEvents="none"
                  style={[styles.label, { left: Math.round(SLOTS[i].x * photoW), top: SLOTS[i].y }]}
                >
                  <AppText style={styles.labelText} numberOfLines={1}>
                    {tr('kesfet.ui.plate.label', { name: it.name, kcal: fmt(Math.round(it.kcal)) })}
                  </AppText>
                </View>
              ))}
            </>
          ) : null}
          {fitsGoal && open ? (
            <View
              style={styles.goalChip}
              accessible
              accessibilityLabel={`${tr('kesfet.ui.plate.fits_goal')}. ${tr('kesfet.ui.plate.fits_goal_hint')}`}
            >
              <CheckIcon size={14} color="#0A0A0A" />
              <AppText style={styles.pillText}>{tr('kesfet.ui.plate.fits_goal')}</AppText>
              <InfoIcon size={14} color="#0A0A0A" />
            </View>
          ) : null}
          <Pressable
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={open ? tr('kesfet.ui.plate.hide') : tr('kesfet.ui.plate.show')}
            hitSlop={4}
            style={styles.toggle}
          >
            <ScanIcon size={16} color="#0A0A0A" />
            <AppText style={styles.pillText}>{open ? tr('kesfet.ui.plate.hide') : tr('kesfet.ui.plate.show')}</AppText>
          </Pressable>
          {overlay}
        </View>
      </Pressable>

      {open ? (
        <View style={[styles.table, { backgroundColor: t.color.line }]} accessibilityLabel={tr('kesfet.ui.plate.table')}>
          <View style={styles.headRow}>
            <AppText style={[styles.cell, styles.nameCol, { color: t.color.secondary }]}>{tr('kesfet.ui.plate.col_food')}</AppText>
            <AppText style={[styles.cell, styles.numCol, { color: t.color.secondary }]}>{tr('kesfet.ui.plate.col_amount')}</AppText>
            <AppText style={[styles.cell, styles.numCol, { color: t.color.secondary }]}>{tr('kesfet.ui.plate.col_kcal')}</AppText>
            <AppText style={[styles.cell, styles.pkyCol, { color: t.color.secondary }]}>{tr('kesfet.ui.plate.col_pky')}</AppText>
          </View>
          {items.map((it, i) => (
            <View key={`${it.name}-row-${i}`} style={styles.row}>
              <AppText style={[styles.cell, styles.nameCol, { color: t.color.ink }]} numberOfLines={1}>
                {it.name}
              </AppText>
              <AppText style={[styles.cell, styles.numCol, { color: t.color.secondary }]}>{`${fmt(Math.round(it.grams))} g`}</AppText>
              <AppText style={[styles.cell, styles.numCol, styles.bold, { color: t.color.ink }]}>{fmt(Math.round(it.kcal))}</AppText>
              <AppText style={[styles.cell, styles.pkyCol, { color: t.color.secondary }]}>{pky(it.protein_g, it.carbs_g, it.fat_g)}</AppText>
            </View>
          ))}
          <View style={styles.row}>
            <AppText style={[styles.cell, styles.nameCol, styles.bold, { color: t.color.ink }]}>{tr('kesfet.ui.plate.total')}</AppText>
            <AppText style={[styles.cell, styles.numCol, styles.bold, { color: t.color.ink }]}>{`${fmt(Math.round(totalGrams))} g`}</AppText>
            <AppText style={[styles.cell, styles.numCol, styles.bold, { color: t.color.ink }]}>{fmt(Math.round(meal.kcal))}</AppText>
            <AppText style={[styles.cell, styles.pkyCol, styles.bold, { color: t.color.ink }]}>{pky(meal.protein_g, meal.carbs_g, meal.fat_g)}</AppText>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  photo: { marginTop: 10, height: H, borderRadius: 16, overflow: 'hidden' },
  scrim: { backgroundColor: 'rgba(10,10,10,0.3)' },
  label: { position: 'absolute', height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  labelText: { fontFamily: fontFamily.bodySemibold, fontSize: 13, lineHeight: 18, color: '#0A0A0A' },
  goalChip: {
    position: 'absolute',
    top: 12,
    left: 12,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggle: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: { fontFamily: fontFamily.bodySemibold, fontSize: 13, lineHeight: 18, color: '#0A0A0A' },
  table: { marginTop: 10, borderRadius: 16, overflow: 'hidden', paddingHorizontal: 12 },
  headRow: { height: 32, flexDirection: 'row', alignItems: 'center' },
  row: { height: 40, flexDirection: 'row', alignItems: 'center' },
  cell: { fontFamily: fontFamily.bodyRegular, fontSize: 13, lineHeight: 18 },
  nameCol: { flex: 1, minWidth: 0 },
  numCol: { width: 56, textAlign: 'right' },
  pkyCol: { width: 84, textAlign: 'right' },
  bold: { fontFamily: fontFamily.bodySemibold },
});
