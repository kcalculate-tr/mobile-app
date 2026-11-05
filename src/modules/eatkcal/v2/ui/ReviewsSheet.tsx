// eatkcal v2 (G13-S2 md.2) — Yorumlar sheet'i (FinEkReviews).
//
// Veri: MEVCUT tek kaynak `vitrinYorumlariniGetir` (src/lib/socialProof.ts —
// `vitrin_yorumlari` RPC: Boss panelden onaylı, ≥4 yıldız, ad sunucuda
// maskeli). Bu kaynak marka bazında değil ve alt puan / ürün / KCAL yanıtı
// alanı taşımıyor. Bu yüzden panodaki:
//  - ortalama puan + "[N] değerlendirme" + 5→1 dağılımı GİZLİ (yalnız ≥4★
//    onaylı alt kümeden ortalama/dağılım göstermek yanıltır),
//  - Lezzet / Teslimat / Kalori uyumu alt puanları GİZLİ (veri yok),
//  - ürün adı ve "KCAL yanıtı" satırları GİZLİ (veri yok).
// `aggregate` / `subScores` props'u ileride gerçek veriyle beslenirse bölümler
// kendiliğinden görünür (uydurma yok — veri yoksa çizilmez).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../../../../core/design';
import { yorumTarihi, kaynakEtiketi, type VitrinYorumu } from '../../../../lib/socialProofRules';
import { EkStars, ekType, useEk } from './kit';

export interface ReviewAggregate {
  average: number;
  count: number;
  /** 5→1 yıldız adetleri (index 0 = 5★). */
  distribution?: [number, number, number, number, number];
}

export interface ReviewSubScores {
  taste?: number | null;
  delivery?: number | null;
  calorieFit?: number | null;
}

export function ReviewsSheet({
  visible,
  onClose,
  reviews,
  aggregate,
  subScores,
}: {
  visible: boolean;
  onClose: () => void;
  reviews: readonly VitrinYorumu[];
  aggregate?: ReviewAggregate | null;
  subScores?: ReviewSubScores | null;
}) {
  const { c, t } = useEk();
  const subs: { key: string; value: number }[] = [];
  if (subScores) {
    const raw: [string, number | null | undefined][] = [
      ['eatkcal.v2.reviews.taste', subScores.taste],
      ['eatkcal.v2.reviews.delivery', subScores.delivery],
      ['eatkcal.v2.reviews.calorie_fit', subScores.calorieFit],
    ];
    for (const [key, value] of raw) if (typeof value === 'number' && value > 0) subs.push({ key, value });
  }
  const maxBar = aggregate?.distribution ? Math.max(1, ...aggregate.distribution) : 1;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('eatkcal.v2.reviews.title')} product="eat" testID="ek-reviews-sheet">
      {aggregate && aggregate.count > 0 ? (
        <View style={styles.agg}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[styles.avg, ekType.num, { color: c.ink }]}>{aggregate.average.toFixed(1)}</Text>
            <EkStars value={aggregate.average} />
            <Text style={[ekType.c13, { color: c.secondary }]}>
              {t('eatkcal.v2.reviews.count', { n: aggregate.count })}
            </Text>
          </View>
          {aggregate.distribution ? (
            <View style={{ flex: 1, gap: 4 }}>
              {aggregate.distribution.map((n, i) => (
                <View key={i} style={styles.barRow}>
                  <Text style={[ekType.c13, ekType.num, { color: c.secondary, width: 14 }]}>{5 - i}</Text>
                  <View style={[styles.bar, { backgroundColor: c.line }]}>
                    <View style={[styles.bar, { backgroundColor: c.ink, width: `${(n / maxBar) * 100}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {subs.length > 0 ? (
        <View style={styles.subs}>
          {subs.map(({ key, value: v }) => (
            <View key={key} style={styles.subRow}>
              <Text style={[ekType.b15, { color: c.secondary, flex: 1 }]}>{t(key)}</Text>
              <Text style={[ekType.b15s, ekType.num, { color: c.ink }]}>{v.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 12, paddingBottom: 12 }}>
        {reviews.map((r) => {
          const date = yorumTarihi(r.tarih);
          const tag = kaynakEtiketi(r.kaynak);
          return (
            <View key={r.id} style={[styles.item, { borderBottomColor: c.line }]}>
              <View style={styles.itemHead}>
                <Text style={[ekType.b15s, { color: c.ink }]}>{r.ad}</Text>
                <EkStars value={r.rating} size={13} />
                <View style={{ flex: 1 }} />
                {date ? <Text style={[ekType.c13, { color: c.secondary }]}>{date}</Text> : null}
              </View>
              <Text style={[ekType.b15, { color: c.ink }]}>{r.yorum}</Text>
              {tag ? <Text style={[ekType.c13, { color: c.secondary }]}>{tag}</Text> : null}
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  agg: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingVertical: 12 },
  avg: { fontFamily: ekType.h24.fontFamily, fontSize: 40, lineHeight: 44 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { height: 6, borderRadius: 3, flex: 1, overflow: 'hidden' },
  subs: { paddingVertical: 8, gap: 4 },
  subRow: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  item: { gap: 4, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
