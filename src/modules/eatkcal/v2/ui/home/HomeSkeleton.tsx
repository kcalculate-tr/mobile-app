// eatkcal v2 (G13-S2 md.1) — FinEkHomeSkeleton: başlıklar gerçek, içerik
// blokları 1800 ms nabızlı iskelet (EkSkeleton). Ekran okuyucuya "Yükleniyor".
// G56-S1 (EkHome kind="skel"): sıra yeni ana sayfa ile aynı — kampanya şeridi · çipler ·
// kalan kalori (parıltı zemini) · mağazalar · bu hafta en çok · yorumlar. Bölüm iskeletleri
// EkSec `st="skel"` ölçüleriyle (ui/growth/sections SecSkeleton).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { EkSkeleton, ekType, useEk } from '../kit';
import { HRow } from './cards';
import { SecSkeleton } from '../growth/sections';

export function HomeSkeleton() {
  const { c, t } = useEk();
  const title = (k: string) => (
    <Text style={[ekType.h20, styles.title, { color: c.ink }]} accessibilityRole="header">
      {t(k)}
    </Text>
  );
  return (
    <View accessible accessibilityLabel={t('eatkcal.v2.common.loading')} testID="ek-home-skeleton" style={{ gap: 10 }}>
      {/* Tur 26 md.11 (FinEkHomeSkeleton): sipariş kartı 88 · Macro 44 · teslimat 52. */}
      <View style={[styles.gutter, { gap: 10 }]}>
        <EkSkeleton height={88} radius={20} />
        <EkSkeleton height={44} radius={22} />
        <EkSkeleton height={52} radius={18} />
      </View>
      <SecSkeleton sec="banners" />
      <SecSkeleton sec="chips" />
      <SecSkeleton sec="kcal" />
      <View>
        {title('eatkcal.v2.home.stores')}
        <HRow>
          {[0, 1].map((i) => (
            <EkSkeleton key={i} width={236} height={146} radius={20} />
          ))}
        </HRow>
      </View>
      <SecSkeleton sec="top" />
      <View>
        {title('eatkcal.v2.home.reviews')}
        <HRow>
          {[0, 1].map((i) => (
            <EkSkeleton key={i} width={260} height={104} radius={20} />
          ))}
        </HRow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: 16 },
  title: { paddingHorizontal: 16, marginTop: 4, marginBottom: 12 },
});
