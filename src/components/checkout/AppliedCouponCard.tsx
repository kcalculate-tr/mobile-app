import React, { useEffect, useRef, useState } from 'react'
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Percent } from 'phosphor-react-native'
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme'

/** Işık bandının genişliği — geniş bant daha yumuşak, daha "parlama" hissi verir. */
const BAND = 170
/** Kaç kez geçsin. Sürekli döngü dikkati tutamaz, bir süre sonra göz görmez olur. */
const SHIMMER_REPEAT = 5
/** Bir geçişin süresi. Hızlı geçerse göz yakalayamıyor, efekt anlaşılmıyor. */
const SHIMMER_MS = 1500

/**
 * Sepette uygulanmış kupon kartı.
 *
 * Kart bilinçli olarak sade: solda indirim ikonu, ortada BÜYÜK puntoyla
 * kuponun adı, sağda kaldır butonu. Tutar burada tekrar edilmiyor — sipariş
 * özetinde zaten satır olarak duruyor, iki yerde göstermek ikisini de
 * zayıflatıyordu.
 *
 * Üzerinden "/" biçiminde 45°'lik geniş bir ışık, SOLDAN SAĞA yürüyerek
 * geçiyor. Kupon uygulandığı anda 5 kez oynar ve durur.
 */
export default function AppliedCouponCard({ code, title, onRemove }: {
  code: string
  title?: string
  onRemove: () => void
}) {
  const [box, setBox] = useState({ width: 0, height: 0 })
  const shimmer = useRef(new Animated.Value(0)).current
  const girisScale = useRef(new Animated.Value(0.96)).current

  useEffect(() => {
    Animated.spring(girisScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start()
  }, [girisScale])

  useEffect(() => {
    if (box.width <= 0) return
    shimmer.setValue(0)
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: SHIMMER_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(450),
      ]),
      { iterations: SHIMMER_REPEAT },
    ).start()
  }, [box.width, shimmer])

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width !== box.width || height !== box.height) setBox({ width, height })
  }

  // Bant 45° eğik olduğu için yatayda kendi genişliğinden fazla yer kaplar;
  // kartın iki yanından tamamen çıkabilmesi için yüksekliği de payda sayıyoruz.
  const basla = -(BAND + box.height)
  const bitir = box.width + box.height

  return (
    <Animated.View style={[s.card, { transform: [{ scale: girisScale }] }]} onLayout={onLayout}>
      {/* "/" biçiminde 45°'lik ışık, soldan sağa yürüyor.
          Sıra kritik: translateX ÖNCE yazılıyor ki hareket kartın kendi
          yatay ekseninde kalsın; rotate yalnızca bandın BİÇİMİNİ eğiyor.
          (Ters sırada yazılırsa hareket de dönüyor ve ışık çapraz kayıyor.) */}
      {box.width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.band,
            {
              left: 0,
              top: -box.height,
              height: box.height * 3,
              transform: [
                { translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [basla, bitir] }) },
                { rotate: '-45deg' },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.22)',
              'rgba(255,255,255,0.60)',
              'rgba(255,255,255,0.22)',
              'rgba(255,255,255,0)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

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
  band: {
    position: 'absolute',
    width: BAND,
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
    fontWeight: '800',
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
    fontWeight: '600',
  },
})
