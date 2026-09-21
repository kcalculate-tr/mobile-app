import { LayoutAnimation, Platform, UIManager } from 'react-native';

// Android'de LayoutAnimation varsayilan olarak KAPALI; acilmazsa configureNext
// sessizce hicbir sey yapmaz ve degisimler anlik olur.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Liste degisimleri icin tek tip gecis.
 *
 * Cagri, state'i degistiren satirdan HEMEN ONCE yapilir: LayoutAnimation
 * bir sonraki layout hesabini yakalar, yani once tarif edip sonra degistirmek
 * gerekir. Eklenen satir yerini acarak gelir, silinen kapanarak gider,
 * komsulari da kayarak uyum saglar.
 */
export function animateListChange(duration = 260): void {
  LayoutAnimation.configureNext({
    duration,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
      duration: Math.round(duration * 0.75),
    },
  });
}

export default animateListChange;
