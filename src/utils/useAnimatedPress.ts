import { useRef } from 'react';
import { Animated } from 'react-native';

export function useAnimatedPress(scale = 0.96) {
  const animatedScale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(animatedScale, {
      toValue: scale,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(animatedScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  return { animatedScale, onPressIn, onPressOut };
}
