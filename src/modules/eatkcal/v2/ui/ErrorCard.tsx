// eatkcal v2 (G13-S2 md.7) — FinEkErrors kartı: başlık · tek satır açıklama ·
// tek kurtarma aksiyonu. Sepet, ürün, sipariş özeti ve adres ekranlarında
// kullanılır. Hata rengi animasyonsuz (koreografi kuralı); kart opak.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin, Package, Tag, Ticket } from '../../../../components/icons';
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
  // G14-S1 — FinEkErrors: ortalı ikon dairesi (48) · başlık (Bricolage 20) ·
  // tek satır açıklama · tam genişlik siyah kurtarma düğmesi (52).
  // G15-S5: Final ikonları — kupon bilet · stok paket · fiyat etiket · adres iğne.
  const Icon = error.kind === 'coupon' ? Ticket : error.kind === 'address' ? MapPin : error.kind === 'stock' ? Package : Tag;
  return (
    <View
      style={[styles.card, { backgroundColor: c.surface }]}
      accessibilityRole="alert"
      testID={testID ?? `ek-error-${error.kind}`}
    >
      <View style={[styles.icon, { backgroundColor: c.line }]}>
        <Icon size={24} color={c.ink} />
      </View>
      <Text style={[ekType.h20, styles.center, { color: c.ink, marginTop: 4 }]}>{t(error.titleKey)}</Text>
      <Text style={[ekType.b15, styles.center, { color: c.secondary, marginBottom: 8 }]} numberOfLines={2}>
        {body}
      </Text>
      <Pressable
        onPress={() => {
          haptic('selection');
          onAction();
        }}
        accessibilityRole="button"
        style={[styles.action, { backgroundColor: c.ink }]}
        testID={`ek-error-${error.kind}-action`}
      >
        <Text style={[ekType.b15s, { color: c.surface, fontSize: 16 }]}>{t(error.actionKey)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 16, gap: 8, alignItems: 'center' },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  action: { alignSelf: 'stretch', height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
