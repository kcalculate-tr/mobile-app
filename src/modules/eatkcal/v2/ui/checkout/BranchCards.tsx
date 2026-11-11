// eatkcal v2 (G32-S1 md.4) — Gel-Al şube seçimi: şubeler YAN YANA kartlar.
// Kart: küçük şube görseli (yerel cephe fotoğrafı, yoksa cam kase) · ad · semt ·
// açık/kapalı · uzaklık (konum izni varsa). Seçili kart lime çerçeve + tik.
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { Check } from '../../../../../components/icons';
import { haptic } from '../../../../../core/design';
import { subeBanneri } from '../../../../../lib/branchBanner';
import type { Branch } from '../../../../../lib/branches';
import { branchKm, branchSemt } from '../../model/branchCard';
import { ekType, useEk } from '../kit';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const BOWL = require('../../../../../../assets/glass/bowl.png');

export interface BranchCardRow {
  branch: Branch;
  km: number | null;
}

export function BranchCards({
  rows,
  selectedId,
  open,
  nearestId,
  onSelect,
}: {
  rows: BranchCardRow[];
  selectedId: string | null;
  /** İşletme saatleri (tüm şubeler için ortak) — null: bilinmiyor, etiket gizli. */
  open: boolean | null;
  /** Konum izni varsa en yakın şube (yalnız etiket; seçimi kullanıcı yapar). */
  nearestId?: string | null;
  onSelect: (id: string) => void;
}) {
  const { c, t, lang } = useEk();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" testID="ek-branch-cards">
      {rows.map(({ branch: b, km }) => {
        const sel = b.id === selectedId;
        const banner = subeBanneri(b.slug);
        const semt = branchSemt(b.address);
        const dist = branchKm(km, lang);
        const status = open == null ? null : t(open ? 'eatkcal.v2.checkout.branch_open' : 'eatkcal.v2.checkout.closed');
        return (
          <Pressable
            key={b.id}
            onPress={() => {
              haptic('selection');
              onSelect(b.id);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            accessibilityLabel={[b.name, semt, status, dist].filter(Boolean).join(', ')}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: c.surface, borderColor: sel ? c.accent : c.line, borderWidth: sel ? 2 : 1 },
              pressed && { opacity: 0.85 },
            ]}
            testID={`ek-branch-card-${b.id}`}
          >
            <View style={[styles.img, { backgroundColor: c.line }]}>
              {banner ? (
                <Image source={banner} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
              ) : (
                <Image source={BOWL} style={styles.bowl} resizeMode="contain" testID="ek-branch-card-placeholder" />
              )}
              {sel ? (
                <View style={[styles.tick, { backgroundColor: c.accent }]} testID="ek-branch-card-tick">
                  <Check size={14} color={c.onAccent} weight="bold" />
                </View>
              ) : null}
              {nearestId === b.id ? (
                <View style={[styles.nearest, { backgroundColor: c.surface }]}>
                  <Text style={[ekType.c13s, { color: c.ink }]}>{t('eatkcal.v2.checkout.branch_nearest')}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.body}>
              <Text style={[ekType.b15s, { color: c.ink }]} numberOfLines={2}>
                {b.name}
              </Text>
              {semt ? (
                <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={2}>
                  {semt}
                </Text>
              ) : null}
              {status || dist ? (
                <View style={styles.meta}>
                  {status ? (
                    <View style={styles.status}>
                      <View style={[styles.dot, { backgroundColor: open ? c.accentLine : c.danger }]} />
                      <Text style={[ekType.c13s, { color: c.ink }]}>{status}</Text>
                    </View>
                  ) : null}
                  {dist ? <Text style={[ekType.c13, ekType.num, { color: c.secondary }]}>{dist}</Text> : null}
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, minWidth: 0, borderRadius: 18, overflow: 'hidden' },
  img: { height: 84, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bowl: { width: 64, height: 64 },
  tick: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nearest: { position: 'absolute', left: 8, bottom: 8, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  body: { padding: 10, gap: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, marginTop: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
