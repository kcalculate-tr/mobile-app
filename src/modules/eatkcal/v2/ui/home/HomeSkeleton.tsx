// eatkcal v2 (G13-S2 md.1) — FinEkHomeSkeleton: başlıklar gerçek, içerik
// blokları 1800 ms nabızlı iskelet (EkSkeleton). Ekran okuyucuya "Yükleniyor".
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import { EkSkeleton, ekType, useEk } from '../kit';
import { HRow } from './cards';

export function HomeSkeleton() {
  const { c, t } = useEk();
  const title = (k: string) => (
    <Text style={[ekType.h20, styles.title, { color: c.ink }]} accessibilityRole="header">
      {t(k)}
    </Text>
  );
  return (
    <View accessible accessibilityLabel={t('eatkcal.v2.common.loading')} testID="ek-home-skeleton">
      <View style={styles.gutter}>
        <EkSkeleton height={44} radius={22} />
        <EkSkeleton height={52} radius={18} style={{ marginTop: 10 }} />
      </View>
      <View style={{ marginTop: 10 }}>
        <HRow>
          {[0, 1].map((i) => (
            <EkSkeleton key={i} width={300} height={104} radius={20} />
          ))}
        </HRow>
      </View>
      <View style={{ marginTop: 10 }}>
        <HRow>
          {[96, 140, 120, 100].map((w, i) => (
            <EkSkeleton key={i} width={w} height={44} radius={22} />
          ))}
        </HRow>
      </View>
      {title('eatkcal.v2.home.stores')}
      <HRow>
        {[0, 1].map((i) => (
          <EkSkeleton key={i} width={236} height={146} radius={20} />
        ))}
      </HRow>
      {title('eatkcal.v2.home.popular')}
      <HRow>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ gap: 6 }}>
            <EkSkeleton width={148} height={148} radius={16} />
            <EkSkeleton width={110} height={14} radius={7} />
            <EkSkeleton width={60} height={14} radius={7} />
          </View>
        ))}
      </HRow>
      {title('eatkcal.v2.home.reviews')}
      <HRow>
        {[0, 1].map((i) => (
          <EkSkeleton key={i} width={260} height={104} radius={20} />
        ))}
      </HRow>
    </View>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: 16 },
  title: { paddingHorizontal: 16, marginTop: 24, marginBottom: 12 },
});
