import React, { useEffect, useRef } from 'react'
import { Animated, ViewStyle } from 'react-native'

/**
 * Sekme değişiminde içeriği yumuşak geçirir: hafif aşağıdan gelip belirir.
 *
 * `swapKey` değiştiğinde animasyon baştan oynar. Ani "zıplayan" sekme
 * geçişini engellemek için var; başka bir işlevi yok.
 */
export default function FadeSwap({ swapKey, style, children }: {
  swapKey: string
  style?: ViewStyle
  children: React.ReactNode
}) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(8)).current

  useEffect(() => {
    opacity.setValue(0)
    translateY.setValue(8)
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }),
    ]).start()
  }, [swapKey, opacity, translateY])

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  )
}
