// Şube vitrin fotoğrafları — Gel-Al akışında müşteriye gideceği yerin GERÇEK
// cephesini göstermek için.
//
// Neden yerel asset, neden uzak URL değil:
//   · İki şube var; fotoğraflar yılda bir değişir. Ağdan çekmek, checkout'un
//     en kritik adımında boş bir kutu ve yükleme gecikmesi demek.
//   · Metro bundler require()'ı STATİK çözer — `require(degisken)` çalışmaz,
//     bu yüzden harita elle yazılıyor.
//
// Yeni şube açılınca: fotoğrafı src/assets/branches/<slug>.jpg olarak koy ve
// aşağıya bir satır ekle. Haritada olmayan şube bannersiz görünür, hata vermez.
//
// Görseller 1200x400 (3:1) JPEG, ~110 KB. Oran UI'daki kutuyla aynı; bu yüzden
// resizeMode="cover" kırpma yapmıyor.
import type { ImageSourcePropType } from 'react-native';

const BANNERLAR: Record<string, ImageSourcePropType> = {
  basinsitesi: require('../assets/branches/basinsitesi.jpg'),
  mansuroglu: require('../assets/branches/mansuroglu.jpg'),
};

/** Banner kutusunun en/boy oranı — görsellerle BİREBİR aynı olmalı. */
export const BANNER_ORANI = 3;

export function subeBanneri(slug: string | null | undefined): ImageSourcePropType | null {
  if (!slug) return null;
  return BANNERLAR[slug.trim().toLowerCase()] ?? null;
}
