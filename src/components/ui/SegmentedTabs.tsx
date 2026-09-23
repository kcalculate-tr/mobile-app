import React, { useEffect, useRef, useState } from 'react'
import {
  Animated, Image, ImageSourcePropType, LayoutChangeEvent,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { IconProps } from 'phosphor-react-native'
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../constants/theme'

export type SegmentedTabItem<T extends string> = {
  key: T
  label: string
  Icon?: React.ComponentType<IconProps>
  /** Phosphor ikonu yerine görsel (ör. macro coin). Icon ile birlikte verilmez. */
  image?: ImageSourcePropType
  /** Etiketin sağında küçük sayı rozeti. */
  badge?: number
}

type Props<T extends string> = {
  items: SegmentedTabItem<T>[]
  value: T
  onChange: (key: T) => void
  /** Kabın yatay kenar boşluğu. Varsayılan SPACING.lg. */
  marginHorizontal?: number
  style?: object
}

/**
 * Uygulamanın TEK sekme tasarımı.
 *
 * Görsel dil Kcalculate ekranındaki Özet/Grafik toggle'ından alındı: gri
 * hazne, içinde beyaz + gölgeli aktif hap. Fark: aktif hap artık kayarak
 * geçiyor — sekme değişimi ani değil.
 *
 * Macro, Kcalculate ve Kampanyalar & Kuponlar ekranları buradan besleniyor;
 * yeni bir sekme tasarımı yazmak yerine bu bileşen kullanılmalı.
 */
export default function SegmentedTabs<T extends string>({
  items, value, onChange, marginHorizontal = SPACING.lg, style,
}: Props<T>) {
  const [width, setWidth] = useState(0)
  const slide = useRef(new Animated.Value(0)).current
  const index = Math.max(0, items.findIndex((i) => i.key === value))
  // Hazne padding'i 4 → iç genişlik = ölçülen genişlik − 8
  const segment = width > 0 ? (width - 8) / items.length : 0

  useEffect(() => {
    if (segment === 0) return
    Animated.spring(slide, {
      toValue: index * segment,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start()
  }, [index, segment, slide])

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w !== width) {
      setWidth(w)
      // İlk ölçümde animasyonsuz yerleş — açılışta hap soldan kaymasın.
      slide.setValue(index * ((w - 8) / items.length))
    }
  }

  return (
    <View style={[s.row, { marginHorizontal }, style]} onLayout={onLayout}>
      {segment > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.indicator,
            { width: segment, transform: [{ translateX: slide }] },
          ]}
        />
      )}

      {items.map((item) => {
        const active = item.key === value
        const Icon = item.Icon
        return (
          <TouchableOpacity
            key={item.key}
            style={s.btn}
            onPress={() => onChange(item.key)}
            activeOpacity={0.8}
          >
            {item.image ? (
              <Image
                source={item.image}
                style={[s.image, !active && s.imagePassive]}
                resizeMode="contain"
              />
            ) : Icon ? (
              <Icon size={14} color={active ? '#000000' : COLORS.text.tertiary} />
            ) : null}
            <Text style={[s.text, active && s.textActive]} numberOfLines={1}>{item.label}</Text>
            {item.badge != null && item.badge > 0 ? (
              <View style={[s.badge, active && s.badgeActive]}>
                <Text style={[s.badgeText, active && s.badgeTextActive]}>{item.badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: '#f6f6f6',
    borderRadius: RADIUS.pill,
    padding: 4,
  },
  // Kayan beyaz hap — butonların ALTINDA, dokunmayı engellemesin.
  indicator: {
    position: 'absolute',
    top: 4, bottom: 4, left: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: '#ffffff',
    ...SHADOWS.sm,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  image: { width: 18, height: 18 },
  // Pasif sekmede coin de metinle birlikte geri çekilsin.
  imagePassive: { opacity: 0.45 },
  text: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.tertiary,
  },
  textActive: {
    color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
  },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  badgeActive: { backgroundColor: COLORS.brand.green },
  badgeText: {
    fontSize: 10, color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  badgeTextActive: { color: '#000000' },
})
