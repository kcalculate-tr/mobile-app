import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,

  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { haptic } from '../../utils/haptics';

/**
 * Seçilebilir yüzeyler (chip, ödeme yöntemi satırı, adres satırı) için ortak
 * dokunma davranışı. Üç şeyi standartlaştırır:
 *
 *  1. Basma geri bildirimi — parmak değdiği anda hafif küçülme (spring).
 *  2. Seçim geçişi — dolgu ANINDA değil, yumuşak geçişle gelir.
 *  3. Haptik — seçim değiştiğinde tek tip titreşim.
 *
 * Neden iki katman: React Native'de `backgroundColor` native driver ile
 * animate EDİLEMEZ. Bu yüzden seçili görünüm, tabanın üstüne mutlak konumlu
 * ayrı bir katman olarak biner ve yalnızca `opacity` animate edilir —
 * böylece geçiş JS thread'ine takılmadan 60fps akar.
 */
type Props = {
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Taban (seçili değilken) görünüm. `flex: 1` gibi layout stilleri buraya. */
  style?: StyleProp<ViewStyle>;
  /** Seçili görünüm — taban üstüne opacity ile biner. */
  selectedStyle?: StyleProp<ViewStyle>;
  /**
   * Katmanın köşe yarıçapı. Taban stilden MİRAS ALINMAZ, açıkça verilmeli;
   * verilmezse seçili dolgu köşelerden taşar.
   */
  borderRadius?: number;
  /**
   * Tabanda `borderWidth` varsa -1 verilir: katman kenarlığın da üstünü
   * örter, aksi halde seçili chip'in çevresinde soluk bir çerçeve kalır.
   */
  overlayInset?: number;
  pressScale?: number;
  feedback?: 'selection' | 'light' | 'none';
  children?: React.ReactNode;
};

const FILL_IN_MS = 180;
const FILL_OUT_MS = 140;

export default function Selectable({
  selected,
  onPress,
  disabled = false,
  style,
  selectedStyle,
  borderRadius = 0,
  overlayInset = 0,
  pressScale = 0.97,
  feedback = 'selection',
  children,
}: Props) {
  const fill = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: selected ? 1 : 0,
      duration: selected ? FILL_IN_MS : FILL_OUT_MS,
      useNativeDriver: true,
    }).start();
  }, [selected, fill]);

  const springTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => springTo(pressScale)}
      onPressOut={() => springTo(1)}
      onPress={() => {
        if (feedback !== 'none') haptic[feedback]();
        onPress();
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {/* Katman children'dan ÖNCE gelir: RN'de sonraki kardeş üste çizilir,
          böylece metin/ikon dolgunun üstünde kalır. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: overlayInset,
            left: overlayInset,
            right: overlayInset,
            bottom: overlayInset,
            borderRadius,
          },
          selectedStyle,
          { opacity: fill },
        ]}
      />
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const SELECTABLE_TIMING = { FILL_IN_MS, FILL_OUT_MS };

