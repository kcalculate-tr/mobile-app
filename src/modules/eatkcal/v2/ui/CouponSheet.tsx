// eatkcal v2 — Kupon sheet'i (FinEkCart "Kupon"). Mantık bugünkü
// src/components/checkout/CouponPickerSheet.tsx (KİMSE — değiştirilmedi) ile
// AYNI: liste `fetchAvailableCampaigns()` (kodlu olanlar), uygulama
// `validateCoupon(code, cartTotal, items)`, hata `getCouponErrorMessage`.
// Başarılı sonuç çağırana (`onApplied`) verilir; cüzdana yazma sepet ekranında
// eski ekranla aynı alanlarla yapılır.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet, haptic } from '../../../../core/design';
import { Ticket } from '../../../../components/icons';
import {
  fetchAvailableCampaigns,
  getCouponErrorMessage,
  validateCoupon,
  type Campaign,
  type CouponCartItem,
  type CouponValidationSuccess,
} from '../../../../lib/offers';
import { formatDate } from '../../../../lib/campaignVisual';
import { couponError, type EkErrorModel } from '../model/errors';
import { EkErrorCard } from './ErrorCard';
import { ekType, useEk } from './kit';

export function CouponSheet({
  visible,
  onClose,
  cartTotal,
  items,
  onApplied,
  onSeeCoupons,
}: {
  visible: boolean;
  onClose: () => void;
  cartTotal: number;
  items: CouponCartItem[];
  onApplied: (result: CouponValidationSuccess) => void;
  /** "Kuponlarımı gör" — hata kartının tek kurtarma aksiyonu. */
  onSeeCoupons: () => void;
}) {
  const { c, t, theme } = useEk();
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState<EkErrorModel | null>(null);
  const [manualCode, setManualCode] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAvailableCampaigns();
      setList(all.filter((x) => !!x.code));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setManualCode('');
    load();
  }, [visible, load]);

  const apply = useCallback(
    async (code: string) => {
      if (busyCode || !code) return;
      setBusyCode(code);
      setError(null);
      const result = await validateCoupon(code, cartTotal, items);
      setBusyCode(null);
      if (!result.valid) {
        haptic('warning');
        setError({ ...couponError(result), detail: getCouponErrorMessage(result) });
        return;
      }
      onApplied(result);
      onClose();
    },
    [busyCode, cartTotal, items, onApplied, onClose],
  );

  const code = manualCode.trim().toUpperCase();

  return (
    <Sheet visible={visible} onClose={onClose} title={t('eatkcal.v2.coupon.title')} product="eat" maxHeightRatio={0.85}>
      <View style={{ gap: 12, paddingBottom: 16 }}>
        <View style={styles.row}>
          <TextInput
            value={manualCode}
            onChangeText={(v) => {
              setManualCode(v.toUpperCase());
              setError(null);
            }}
            placeholder={t('eatkcal.v2.coupon.placeholder')}
            placeholderTextColor={c.secondary}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel={t('eatkcal.v2.coupon.placeholder')}
            style={[styles.input, ekType.b15, { backgroundColor: c.line, color: c.ink }]}
            returnKeyType="done"
            onSubmitEditing={() => apply(code)}
          />
          <Pressable
            onPress={() => apply(code)}
            disabled={!code || busyCode != null}
            accessibilityRole="button"
            style={[styles.applyBtn, { backgroundColor: c.ink, opacity: !code ? 0.4 : 1 }]}
            testID="ek-coupon-apply"
          >
            {busyCode === code && code ? (
              <ActivityIndicator color={c.surface} />
            ) : (
              <Text style={[ekType.b15s, { color: c.surface }]}>{t('eatkcal.v2.coupon.apply')}</Text>
            )}
          </Pressable>
        </View>

        {error ? (
          <EkErrorCard
            error={error}
            onAction={() => {
              onClose();
              onSeeCoupons();
            }}
          />
        ) : null}

        <Text style={[ekType.c13s, { color: c.secondary }]}>{t('eatkcal.v2.coupon.mine')}</Text>
        {loading ? (
          <ActivityIndicator color={c.secondary} style={{ marginVertical: 16 }} />
        ) : list.length === 0 ? (
          <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.coupon.none')}</Text>
        ) : (
          list.map((camp) => {
            const kod = String(camp.code);
            const cond = camp.min_cart_total
              ? `${camp.title ?? kod} · ≥ ${camp.min_cart_total} TL`
              : (camp.title ?? kod);
            return (
              <View key={camp.id} style={[styles.coupon, { borderColor: theme.color.line }]}>
                <Ticket size={20} color={c.ink} />
                <View style={{ flex: 1 }}>
                  <Text style={[ekType.b15s, { color: c.ink }]} numberOfLines={1}>
                    {kod}
                  </Text>
                  <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={2}>
                    {camp.end_date ? `${cond} · ${t('eatkcal.v2.coupon.until', { date: formatDate(camp.end_date) })}` : cond}
                  </Text>
                </View>
                <Pressable
                  onPress={() => apply(kod)}
                  disabled={busyCode != null}
                  accessibilityRole="button"
                  accessibilityLabel={`${kod} ${t('eatkcal.v2.coupon.apply')}`}
                  style={styles.rowApply}
                >
                  {busyCode === kod ? (
                    <ActivityIndicator color={c.ink} />
                  ) : (
                    <Text style={[ekType.b15s, { color: c.ink }]}>{t('eatkcal.v2.coupon.apply')}</Text>
                  )}
                </Pressable>
              </View>
            );
          })
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, height: 52, paddingHorizontal: 14, borderRadius: 16 },
  applyBtn: { height: 52, paddingHorizontal: 18, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  coupon: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  rowApply: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
});
