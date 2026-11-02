import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';

interface Props {
  Icon: PhosphorIcon;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Sipariş akışındaki TÜM bilgilendirme satırlarının tek tasarımı:
 * açık gri yüzey, koyu ikon, ikincil metin. Önceden "tahmini teslimat"
 * gri, "teslimat günleri" sarı uyarı kutusuydu — aynı bilgi sınıfı iki farklı
 * dille konuşuyordu. Tek bileşene indirildi (23.09.2026).
 *
 * Vurgulanacak kelime için içeride <Text style={InfoPill.strong}> kullanılır.
 */
export default function InfoPill({ Icon, children, style }: Props) {
  return (
    <View style={[s.kutu, style]}>
      <Icon size={15} color={COLORS.text.primary} weight="bold" />
      <Text style={s.metin}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  kutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.xs,
    backgroundColor: '#f5f5f5',
  },
  metin: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  strong: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
});

/** Kutu içinde vurgulanacak kısım için ortak stil. */
InfoPill.strong = s.strong;
