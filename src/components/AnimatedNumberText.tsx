import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
} from 'react-native';

interface Props extends Omit<TextProps, 'style' | 'children'> {
  value: string | number;
  style?: StyleProp<TextStyle>;
}

// Değer değiştiğinde vertical slide + crossfade:
//   önceki değer yukarı kayıp solar (y: 0 → -20, opacity 1 → 0)
//   yeni değer alttan kayarak gelir (y: 20 → 0, opacity 0 → 1)
// Süre ~220 ms, paralel — Apple Stocks price change hissi.
export const AnimatedNumberText: React.FC<Props> = ({ value, style, ...rest }) => {
  const stringValue = String(value);
  const prevValueRef = useRef(stringValue);

  const [displayValues, setDisplayValues] = useState({
    current: stringValue,
    previous: stringValue,
    isAnimating: false,
  });

  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const incomingTranslateY = useRef(new Animated.Value(20)).current;
  const incomingOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prevValueRef.current === stringValue) return;

    const fromValue = prevValueRef.current;
    prevValueRef.current = stringValue;

    setDisplayValues({
      current: stringValue,
      previous: fromValue,
      isAnimating: true,
    });

    translateY.setValue(0);
    opacity.setValue(1);
    incomingTranslateY.setValue(20);
    incomingOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -20,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(incomingTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(incomingOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start((result) => {
      // Interrupt olduysa (hızlı arka arkaya değişim) state'i update etme —
      // son tamamlanan animasyonun callback'i doğru final state'i yazar.
      if (!result.finished) return;
      setDisplayValues({
        current: stringValue,
        previous: stringValue,
        isAnimating: false,
      });
    });
  }, [stringValue, translateY, opacity, incomingTranslateY, incomingOpacity]);

  if (!displayValues.isAnimating) {
    return (
      <Text style={style} {...rest}>
        {displayValues.current}
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[style, styles.absolute, { transform: [{ translateY }], opacity }]}
        {...rest}
      >
        {displayValues.previous}
      </Animated.Text>
      <Animated.Text
        style={[
          style,
          { transform: [{ translateY: incomingTranslateY }], opacity: incomingOpacity },
        ]}
        {...rest}
      >
        {displayValues.current}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});

export default AnimatedNumberText;
