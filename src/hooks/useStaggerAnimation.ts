import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

const MAX_ITEMS = 30;

export function useStaggerAnimation(itemCount: number, delay = 60) {
  const animations = useRef(
    Array.from({ length: MAX_ITEMS }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(20),
    }))
  ).current;

  useEffect(() => {
    if (itemCount === 0) return;
    const anims = animations.slice(0, itemCount).map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 300,
          delay: i * delay,
          useNativeDriver: true,
        }),
        Animated.spring(anim.translateY, {
          toValue: 0,
          delay: i * delay,
          useNativeDriver: true,
          speed: 20,
          bounciness: 4,
        }),
      ])
    );
    Animated.stagger(delay, anims).start();
  }, [itemCount]);

  const getStyle = (index: number) => {
    const anim = animations[index];
    if (!anim) return {};
    return {
      opacity: anim.opacity,
      transform: [{ translateY: anim.translateY }],
    };
  };

  return { getStyle };
}
