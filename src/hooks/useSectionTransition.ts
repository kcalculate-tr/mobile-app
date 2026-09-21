import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Bir bölümün içeriği değiştiğinde kısa bir çapraz geçiş uygular.
 *
 * Neden efekt, neden callback DEĞİL:
 * Önceki yaklaşım (CheckoutScreen'deki `animateSection`) state değişimini
 * animasyonun bitiş callback'inin İÇİNDE yapıyordu. İki ayrı şekilde
 * kırılıyordu:
 *
 *   1. callback() ağır bir yeniden render tetikliyor (randevulu bölümü
 *      FlatList'iyle birlikte monte oluyor). Native driver'a bağlı
 *      Animated.Value bu sırada yeniden bağlanabiliyor ve hemen ardından
 *      başlatılan fade-in düşebiliyor — opacity 0'da KALIYOR, bölüm
 *      görünmez oluyor. ("Randevulu"ya basınca boş beyaz alan.)
 *   2. callback() hata fırlatırsa fade-in satırına hiç gelinmiyor; aynı sonuç.
 *
 * Burada state anında değişir, animasyon yalnızca ona TEPKİ verir. Efektin
 * temizliği opacity'yi her durumda 1'e döndürdüğü için bölüm görünmez
 * kalamaz — unmount, hızlı ardışık dokunuş veya hata fark etmez.
 */
export function useSectionTransition(
  deps: readonly unknown[],
  options: { from?: number; duration?: number } = {},
): Animated.Value {
  const { from = 0.25, duration = 220 } = options;
  const opacity = useRef(new Animated.Value(1)).current;
  const isFirstRun = useRef(true);

  useEffect(() => {
    // İlk render'da yanıp sönmesin — sadece DEĞİŞİMLERDE geçiş yapılır.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    opacity.setValue(from);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
      opacity.setValue(1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return opacity;
}

export default useSectionTransition;
