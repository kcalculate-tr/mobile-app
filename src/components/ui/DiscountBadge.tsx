import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RADIUS } from '../../constants/theme';
import { formatDiscountCorner } from '../../utils/price';
import type { DiscountType } from '../../utils/price';

interface DiscountBadgeProps {
  discountType: DiscountType;
  discountValue: number | null | undefined;
}

/**
 * Ürün kartının sağ üst köşesindeki kırmızı indirim rozeti.
 *
 * Tek bileşen, üç ekran (Anasayfa, Kategori, Marka). Aynı rozeti üç yere
 * elle yazmak bugün düzelttiğimiz ayrışma hatalarının tam olarak kaynağıydı.
 *
 * Kalori rozetiyle aynı yükseklik ve aynı kenar boşluğunda duruyor: biri
 * solda, diğeri sağda, ikisi aynı hatta. Farklı hizada olsalar kart
 * dengesiz görünüyordu.
 *
 * Kullanan kapsayıcının `position: 'relative'` (RN'de varsayılan) olması
 * yeterli; rozet kendini mutlak konumlandırır.
 */
export default function DiscountBadge({ discountType, discountValue }: DiscountBadgeProps) {
  const metin = formatDiscountCorner(discountType, discountValue);
  if (!metin) return null;
  return (
    <View style={s.rozet} pointerEvents="none">
      <Text style={s.metin}>{metin}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  rozet: {
    position: 'absolute',
    top: 8,
    right: 8,
    // Kalori rozetiyle aynı iç boşluk → aynı yükseklik, aynı hat.
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: '#dc2626',
    zIndex: 1,
  },
  metin: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.3,
  },
});
