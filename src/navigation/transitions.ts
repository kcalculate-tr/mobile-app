import { Animated, Dimensions } from 'react-native';

/**
 * Sekme geçişi — marka sayfalarındaki (kcalculate / tera / Breaking Fast)
 * geçişin aynısı.
 *
 * O sayfalar bir STACK ekranı ve `slide_from_right` kullanıyor: gelen ekran
 * sağdan tam genişlikte kayarak giriyor, giden ekran arkada yavaşça sola
 * kayıyor (parallaks). Referans hareket bu; sekmeler de buna uyuyor.
 *
 * ── 24.09.2026: neden hazır 'shift' DEĞİL ──────────────────────────────────
 * Kütüphanenin `forShift` hazırı iki şey yapıyordu:
 *   1. ekranı yalnızca ±50px kaydırıyordu — marka sayfasındaki tam genişlikte
 *      kaymayla aynı his vermiyordu
 *   2. geçiş boyunca OPAKLIĞI 0'a indiriyordu
 *
 * İkincisi bir hataya yol açıyordu: sekme ilk kez açıldığında ekran tembel
 * (lazy) yükleniyor, yani animasyon başladığında henüz DOM'da yok; bu yarış
 * yüzünden ilerleme değeri 0'a oturmayınca ekran opaklık 0'da takılı kalıyor
 * ve "sepet yüklenmiyor" gibi görünüyordu. Burada opaklığa HİÇ dokunulmuyor —
 * değer takılsa bile ekran görünür kalır, en kötü ihtimalle kaymış durur.
 * (Ayrıca Sepet sekmesi artık `lazy: false`, yani yarış hiç oluşmuyor.)
 *
 * progress: -1 = bu ekranın sırası aktiften KÜÇÜK (solda)
 *            0 = aktif
 *           +1 = sırası aktiften BÜYÜK (sağda)
 */

/** Giden ekranın arkada kaldığı oran — iOS'taki push davranışıyla aynı. */
const PARALLAKS = 0.3;

export function forSlide({ current }: { current: { progress: Animated.AnimatedInterpolation<number> | Animated.Value } }) {
  // Uygulama portre kilitli (app.config.js: orientation 'portrait'), bu yüzden
  // genişliği bir kez okumak güvenli.
  const genislik = Dimensions.get('window').width;
  return {
    sceneStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-genislik * PARALLAKS, 0, genislik],
          }),
        },
      ],
    },
  };
}
