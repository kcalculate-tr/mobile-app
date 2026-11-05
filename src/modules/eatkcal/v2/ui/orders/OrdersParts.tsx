// eatkcal v2 (G13-S2 md.6) — Siparişlerim / detay ortak parçaları.
// FinEkOrders: rozet 26 yükseklik · 13 köşe · 13/700; aktif = lime dolgu,
// diğerleri nötr (#E9EBEE = tema `line`). FinEkOrdersEmpty: kart 20 köşe,
// 48'lik ikon dairesi, başlık 20, gövde 15, 52'lik mürekkep buton.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../../../../core/design';
import { ekType, useEk } from '../kit';
import { statusBadge } from '../../model/orders';

export function OrderStatusBadge({ status }: { status: string }) {
  const { c, t } = useEk();
  const b = statusBadge(status);
  const bg = b.tone === 'active' ? c.accent : c.line;
  const fg = b.tone === 'active' ? c.onAccent : b.tone === 'negative' ? c.danger : c.ink;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]} testID={`ek-order-badge-${b.key}`}>
      <Text style={[ekType.c13s, styles.badgeText, { color: fg }]} numberOfLines={1}>
        {t(`eatkcal.v2.orders.status.${b.key}`)}
      </Text>
    </View>
  );
}

/** Mürekkep dolgu 52'lik buton (panolardaki siyah birincil). */
export function EkInkButton({
  label,
  onPress,
  icon,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  testID?: string;
}) {
  const { c } = useEk();
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        haptic('selection');
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.inkBtn,
        { backgroundColor: disabled ? c.line : c.ink },
        pressed && { opacity: 0.85 },
      ]}
    >
      {icon}
      <Text style={[ekType.b15s, { fontSize: 16, color: disabled ? c.secondary : c.surface }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Boş / sonuçsuz / hata kartı (FinEkOrdersEmpty / FilterEmpty). */
export function EkStateCard({
  icon,
  title,
  body,
  action,
  onAction,
  testID,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  testID?: string;
}) {
  const { c } = useEk();
  return (
    <View style={[styles.stateCard, { backgroundColor: c.surface }]} accessibilityRole="summary" testID={testID}>
      <View style={[styles.stateIcon, { backgroundColor: c.line }]} accessibilityElementsHidden>
        {icon}
      </View>
      <Text style={[ekType.h20, { color: c.ink, textAlign: 'center', marginTop: 4 }]}>{title}</Text>
      <Text style={[ekType.b15, { color: c.secondary, textAlign: 'center', marginBottom: 8 }]}>{body}</Text>
      <View style={{ alignSelf: 'stretch' }}>
        <EkInkButton label={action} onPress={onAction} testID={testID ? `${testID}-action` : undefined} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { height: 26, paddingHorizontal: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: 'PlusJakartaSans_700Bold' },
  inkBtn: {
    minHeight: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  stateCard: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: 16, borderRadius: 20, alignItems: 'center', gap: 8 },
  stateIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
