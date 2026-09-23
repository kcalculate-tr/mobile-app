import React, { useEffect, useRef, useState } from 'react'
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ticket } from 'phosphor-react-native'
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme'

const SHIMMER_WIDTH = 130
/** Işık kaç kez geçsin — sonsuz döngü dikkat dağıtır, indirim gölgede kalır. */
const SHIMMER_REPEAT = 3

/**
 * Sepette uygulanmış kupon kartı.
 *
 * Tasarım kararı: kazanılan tutar kartın KAHRAMANI. Eskiden kupon kodu
 * büyüktü, indirim tutarı ise sipariş özetinin içinde küçük bir satırdı —
 * yani müşteri asıl kazandığı şeyi en son görüyordu. Burada sıralama tersine
 * çevrildi: koyu zemin, neon ve büyük rakam.
 *
 * Üzerinden soldan sağa geçen ışık, kupon uygulandığı ANDA birkaç kez oynar
 * ve durur; sürekli dönen bir parıltı dikkati tutamaz, rahatsız eder.
 */
export default function AppliedCouponCard({ code, title, discount, onRemove }: {
  code: string
  title?: string
  discount: number
  onRemove: () => void
}) {
  const [width, setWidth] = useState(0)
  const shimmer = useRef(new Animated.Value(0)).current
  const girisScale = useRef(new Animated.Value(0.96)).current

  useEffect(() => {
    Animated.spring(girisScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start()
  }, [girisScale])

  useEffect(() => {
    if (width <= 0) return
    shimmer.setValue(0)
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(700),
      ]),
      { iterations: SHIMMER_REPEAT },
    ).start()
  }, [width, shimmer])

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w !== width) setWidth(w)
  }

  return (
    <Animated.View style={[s.card, { transform: [{ scale: girisScale }] }]} onLayout={onLayout}>
      {/* Soldan sağa geçen ışık */}
      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.shimmer,
            {
              transform: [{
                translateX: shimmer.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-SHIMMER_WIDTH, width + SHIMMER_WIDTH],
                }),
              }],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      <View style={s.ikon}>
        <Ticket size={18} color="#000000" weight="fill" />
      </View>

      <View style={s.orta}>
        <Text style={s.etiket}>KUPON UYGULANDI</Text>
        <Text style={s.kod} numberOfLines={1}>{title?.trim() || code}</Text>
      </View>

      <View style={s.sag}>
        <Text style={s.tutar} numberOfLines={1}>{`−₺${Math.round(discount).toLocaleString('tr-TR')}`}</Text>
        <TouchableOpacity onPress={onRemove} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.kaldir}>Kaldır</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: '#0D0D0D',
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(185,239,20,0.25)',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: SHIMMER_WIDTH,
  },
  ikon: {
    width: 38, height: 38, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center', justifyContent: 'center',
  },
  orta: { flex: 1, minWidth: 0 },
  etiket: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: COLORS.brand.green,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
  },
  kod: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.size.sm,
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
  },
  sag: { alignItems: 'flex-end' },
  tutar: {
    fontSize: 24,
    lineHeight: 28,
    color: COLORS.brand.green,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: '800',
  },
  kaldir: {
    marginTop: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    textDecorationLine: 'underline',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
})
