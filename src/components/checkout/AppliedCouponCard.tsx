import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Percent } from 'phosphor-react-native'
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme'
import { SPRING } from '../../constants/motion'
import Shimmer from '../ui/Shimmer'

/**
 * Sepette uygulanmış kupon kartı.
 *
 * Kart bilinçli olarak sade: solda indirim ikonu, ortada BÜYÜK puntoyla
 * kuponun adı, sağda kaldır butonu. Tutar burada tekrar edilmiyor — sipariş
 * özetinde zaten satır olarak duruyor, iki yerde göstermek ikisini de
 * zayıflatıyordu.
 *
 * Üzerinden geçen ışık 24.09.2026'da ortak `Shimmer` bileşenine taşındı;
 * burada BEŞ kez oynayıp durur, çünkü bir kereye mahsus bir olayı kutluyor
 * (kupon uygulandı). Kalıcı bir davette (bkz. ReorderCard) aynı efekt
 * sonsuz çalışıyor.
 */
export default function AppliedCouponCard({ code, title, onRemove }: {
  code: string
  title?: string
  onRemove: () => void
}) {
  const girisScale = useRef(new Animated.Value(0.96)).current

  useEffect(() => {
    Animated.spring(girisScale, { toValue: 1, useNativeDriver: true, ...SPRING.enter }).start()
  }, [girisScale])

  return (
    <Animated.View style={[s.card, { transform: [{ scale: girisScale }] }]}>
      <Shimmer repeat={5} strength={0.6} />

      <View style={s.ikon}>
        <Percent size={20} color="#000000" weight="bold" />
      </View>

      <Text style={s.ad} numberOfLines={1}>{title?.trim() || code}</Text>

      <TouchableOpacity
        onPress={onRemove}
        activeOpacity={0.75}
        style={s.kaldirBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={s.kaldirText}>Kaldır</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    // Barın tamamı marka yeşili; üzerindeki her şey siyah.
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  // Yeşil zeminde yeşil kutu kaybolurdu; ikon hafif koyulaştırılmış bir
  // kare içinde duruyor, böylece yapısı korunuyor.
  ikon: {
    width: 40, height: 40, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(0,0,0,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  ad: {
    flex: 1,
    minWidth: 0,
    fontSize: 20,
    lineHeight: 26,
    color: '#000000',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  kaldirBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.22)',
  },
  kaldirText: {
    fontSize: TYPOGRAPHY.size.xs,
    color: 'rgba(0,0,0,0.7)',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
})
