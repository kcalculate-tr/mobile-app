/**
 * Yeni tasarımın başlık yazı tipi: Bricolage Grotesque (OFL lisanslı).
 *
 * Dosyalar `assets/fonts/`'a Atelier Triay'ın resmî GitHub deposundan indirildi
 * (varsayılan optik boy, statik örnekler). Lisans: `assets/fonts/OFL.txt`.
 *
 * G14-S1: Bu fontlar artık uygulama açılışında (App.tsx useFonts) Plus Jakarta
 * ile birlikte YÜKLENİR. Önceden yüklenmiyordu ve yeni ekranların (Final)
 * başlıkları sistem fontuna düşüyordu. Bayrak kapalı ekranlar bu aileyi
 * referans etmez (görünüm aynı).
 *
 * G16-S2 (Android): dosya adları kodtaki aile adlarıyla AYNI
 * (`BricolageGrotesque_700Bold.ttf` …) ve app.config.js `expo-font` eklentisiyle
 * build'e gömülür. Android gömülü fontu DOSYA ADIYLA çözer (assets/fonts/<ad>.ttf);
 * yalnız çalışma zamanında yüklenince Fabric'te metin typeface kaydolmadan
 * ölçülüp Roboto'ya düşebiliyordu (Plus Jakarta için app.config.js'teki notla aynı).
 */

export const bricolageFonts = {
  BricolageGrotesque_400Regular: require('../../../assets/fonts/BricolageGrotesque_400Regular.ttf'),
  BricolageGrotesque_500Medium: require('../../../assets/fonts/BricolageGrotesque_500Medium.ttf'),
  BricolageGrotesque_600SemiBold: require('../../../assets/fonts/BricolageGrotesque_600SemiBold.ttf'),
  BricolageGrotesque_700Bold: require('../../../assets/fonts/BricolageGrotesque_700Bold.ttf'),
  BricolageGrotesque_800ExtraBold: require('../../../assets/fonts/BricolageGrotesque_800ExtraBold.ttf'),
} as const;

export type BricolageFamily = keyof typeof bricolageFonts;
