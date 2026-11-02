/**
 * Yeni tasarımın başlık yazı tipi: Bricolage Grotesque (OFL lisanslı).
 *
 * Dosyalar `assets/fonts/`'a Atelier Triay'ın resmî GitHub deposundan indirildi
 * (varsayılan optik boy, statik örnekler). Lisans: `assets/fonts/OFL.txt`.
 *
 * ÖNEMLİ: Bu fontlar uygulama açılışında (App.tsx) YÜKLENMEZ — üretim açılışı
 * değişmesin diye yalnızca kullanıldıkları yerde (şimdilik yalnız __DEV__
 * vitrini) `useFonts(bricolageFonts)` ile yüklenir. Gövde fontu Plus Jakarta
 * Sans zaten App.tsx'te yükleniyor; onu burada tekrar yüklemiyoruz.
 */

export const bricolageFonts = {
  BricolageGrotesque_400Regular: require('../../../assets/fonts/BricolageGrotesque-Regular.ttf'),
  BricolageGrotesque_500Medium: require('../../../assets/fonts/BricolageGrotesque-Medium.ttf'),
  BricolageGrotesque_600SemiBold: require('../../../assets/fonts/BricolageGrotesque-SemiBold.ttf'),
  BricolageGrotesque_700Bold: require('../../../assets/fonts/BricolageGrotesque-Bold.ttf'),
  BricolageGrotesque_800ExtraBold: require('../../../assets/fonts/BricolageGrotesque-ExtraBold.ttf'),
} as const;

export type BricolageFamily = keyof typeof bricolageFonts;
