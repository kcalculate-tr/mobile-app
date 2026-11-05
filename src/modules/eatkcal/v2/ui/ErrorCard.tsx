// eatkcal v2 (G13-S2 md.7) — FinEkErrors kartı: başlık · tek satır açıklama ·
// tek kurtarma aksiyonu. Sepet, ürün, sipariş özeti ve adres ekranlarında
// kullanılır. Hata rengi animasyonsuz (koreografi kuralı); kart opak.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WarningCircle } from '../../../../components/icons';
import { haptic } from '../../../../core/design';
import { ekType, money, useEk } from './kit';
import type { EkErrorModel } from '../model/errors';

export function EkErrorCard({
  error,
  onAction,
  testID,
}: {
  error: EkErrorModel;
  onAction: () => void;
  testID?: string;
}) {
  const { c, t } = useEk();
  const p = error.params ?? {};
  let body = error.detail ?? '';
  if (error.kind === 'stock') {
    body = t('eatkcal.v2.errors.stock_body', { names: String(p.names ?? '') });
  } else if (error.kind === 'price') {
    body = t('eatkcal.v2.errors.price_body', {
      before: money(Number(p.before ?? 0)),
      after: money(Number(p.after ?? 0)),
    });
  } else if (!body) {
    body = t(error.kind === 'coupon' ? 'eatkcal.v2.errors.coupon_body' : 'eatkcal.v2.errors.address_body');
  }
  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
      accessibilityRole="alert"
      testID={testID ?? `ek-error-${error.kind}`}
    >
      <View style={styles.row}>
        <WarningCircle size={20} color={c.danger} weight="fill" />
        <Text style={[ekType.b15s, { color: c.ink, flex: 1 }]}>{t(error.titleKey)}</Text>
      </View>
      <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={2}>
        {body}
      </Text>
      <Pressable
        onPress={() => {
          haptic('selection');
          onAction();
        }}
        accessibilityRole="button"
        style={styles.action}
        testID={`ek-error-${error.kind}-action`}
      >
        <Text style={[ekType.c13s, { color: c.accentLine }]}>{t(error.actionKey)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 14, borderWidth: 1, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
