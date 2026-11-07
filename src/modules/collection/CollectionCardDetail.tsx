// CollectionCardDetail (FinCollectGrid) — G15-S2: tabak kartı detayı.
// Geri · büyük foto (çıkartma) · "No. 043 · İlk kez" · ad (Bricolage 28) ·
// "2 Kas · Öğle · Tara fotoğrafın" · kcal / Protein / Karb üçlü satır ·
// lime "Tekrar logla ⌄" (⌄ öğün değiştirir). Koleksiyon ızgarasından ve
// "Kart kazandın!" → "Kartı gör"den açılır. Yalnız yeni kabuk.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, haptic, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { ArrowLeft, CaretDown, Check } from '../../components/icons';
import { CachedImage } from '../../components/CachedImage';
import { formatNo } from './StickerCard';
import type { CollectionCard } from './types';

const CYCLE: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'> = ['breakfast', 'lunch', 'dinner', 'snack'];

export function CollectionCardDetail({
  card,
  onBack,
  onRelog,
}: {
  card: CollectionCard;
  onBack: () => void;
  /** Aynı tabağı bugüne yeniden logla (seçilen öğüne). */
  onRelog?: (meal: 'breakfast' | 'lunch' | 'dinner' | 'snack') => Promise<void>;
}) {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const insets = useSafeAreaInsets();
  const initial = card.meal === 'eatkcal' ? 'lunch' : card.meal;
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(initial);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const date = new Date(card.dateISO).toLocaleDateString(lang, { day: 'numeric', month: 'short' });
  const source = card.meal === 'eatkcal' ? 'eatkcal' : tr('collection.source_scan');
  const line = t.isDark ? '#2C2C2E' : '#E9EBEE';
  const stats = [
    { k: 'kcal', v: String(Math.round(card.kcal)) },
    card.protein_g != null ? { k: tr('gun.macro_protein'), v: `${Math.round(card.protein_g)} g` } : null,
    card.carbs_g != null ? { k: tr('gun.macro_carbs'), v: `${Math.round(card.carbs_g)} g` } : null,
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <View style={[styles.fill, { backgroundColor: t.color.bg }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 120 }}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={tr('collection.back')} style={styles.back}>
          <ArrowLeft size={22} color={t.color.ink} />
        </Pressable>
        <View style={styles.photoWrap}>
          <View style={[styles.photo, { backgroundColor: t.isDark ? '#2C2C2E' : '#E3E5E9' }]}>
            {card.photoUri ? <CachedImage uri={card.photoUri} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
        </View>
        <View style={styles.pad}>
          <AppText tone="secondary" style={styles.no}>
            {card.firstTime ? `${formatNo(card.no)} (${tr('collection.first_time')})` : formatNo(card.no)}
          </AppText>
          <AppText textRole="screenTitle" style={styles.name}>
            {card.name}
          </AppText>
          <AppText tone="secondary" style={styles.meta}>
            {`${date}, ${tr(`meal.${card.meal}`)}, ${source}`}
          </AppText>
        </View>
        <View style={[styles.stats, { borderTopColor: line, borderBottomColor: line }]}>
          {stats.map((s, i) => (
            <View key={s.k} style={[styles.stat, i > 0 ? { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: line } : null]}>
              <AppText tone="secondary" style={styles.statK}>
                {s.k}
              </AppText>
              <AppText style={styles.statV}>{s.v}</AppText>
            </View>
          ))}
        </View>
        {onRelog ? (
          <View style={[styles.pill, { backgroundColor: t.color.accent }]}>
            <Pressable
              onPress={async () => {
                if (busy || done) return;
                haptic('light');
                setBusy(true);
                try {
                  await onRelog(meal);
                  setDone(true);
                } finally {
                  setBusy(false);
                }
              }}
              accessibilityRole="button"
              style={styles.pillMain}
            >
              {busy ? <ActivityIndicator color={t.color.onAccent} /> : done ? <Check size={18} color={t.color.onAccent} weight="bold" /> : null}
              <AppText tone="onAccent" style={styles.pillText}>
                {done ? tr(`gun.logged_${meal}`) : tr('collection.relog')}
              </AppText>
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              onPress={() => {
                haptic('selection');
                setMeal((m) => CYCLE[(CYCLE.indexOf(m) + 1) % CYCLE.length]);
              }}
              accessibilityRole="button"
              accessibilityLabel={tr('gun.change_meal', { meal: tr(`meal.${meal}`) })}
              style={styles.caret}
            >
              <CaretDown size={16} color={t.color.onAccent} weight="bold" />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  back: { width: 44, height: 44, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  photoWrap: { alignItems: 'center', paddingVertical: 8 },
  photo: { width: 248, height: 248, borderRadius: 124, overflow: 'hidden' },
  pad: { paddingHorizontal: 16, paddingTop: 20, gap: 4 },
  no: { fontSize: 13, fontWeight: '700' },
  name: { fontSize: 28, lineHeight: 34 },
  meta: { fontSize: 13 },
  stats: { marginTop: 16, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
  statK: { fontSize: 13 },
  statV: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 17 },
  pill: { marginTop: 32, marginHorizontal: 16, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center' },
  pillMain: { flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pillText: { fontSize: 15, fontWeight: '700' },
  divider: { width: 1, height: 22, backgroundColor: 'rgba(10,10,10,0.28)' },
  caret: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
});
