// Derin bağlantı (deep link) yapılandırması — React Navigation linking (G5-S4 md.2).
//
// Yalnız iki YENİ rota eşlenir (G7-S1: gerçek ekranlara bağlandı):
//   https://l.eatkcal.com/p/<post_id>  (veya kcal://p/<post_id>)  → SharedPost (tek PostCard)
//   https://l.eatkcal.com/u/<handle>   (veya kcal://u/<handle>)   → PublicProfile
//
// GÜVENLİK/UYUM:
//  • `filter`, uygulamanın expo-linking ile MANUEL işlediği geri dönüşleri
//    (auth-callback → src/core/AuthContext.tsx, payment-callback → src/lib/payment.ts)
//    React Navigation'dan GİZLER. Böylece bu URL'ler çifte işlenmez / yanlış
//    ekrana düşmez; o akışlar aynen çalışmaya devam eder.
//  • Push bildirim derin bağlantıları Linking URL'i DEĞİL, bildirim datasıyla
//    (resolveNavigation, src/lib/navigation.ts) işlenir → bu config'le çakışmaz.
//  • Eşleşmeyen her URL (ör. kcal://reviews) config'de yok → React Navigation
//    yok sayar, normal açılışa (initialRouteName) düşer.
//
// NOT (üretim etkisi): mevcut 1.0.7 cihazlarda l.eatkcal.com için
// associatedDomains/intentFilters YOK; alan adı + YENİ BUILD gelene kadar https
// bağlantıları uygulamayı açmaz. Bu config tek başına mevcut davranışı bozmaz.

import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'), // kcal:// (özel şema + geliştirme)
    'https://l.eatkcal.com',
    'http://l.eatkcal.com',
  ],
  // `dev/screen/` = YALNIZ __DEV__ ekran vitrini (src/dev/VitrinGate) — kendi kökünü açar.
  filter: (url) =>
    !url.includes('auth-callback') &&
    !url.includes('payment-callback') &&
    !url.includes('dev/screen/'),
  config: {
    screens: {
      SharedPost: 'p/:postId',
      PublicProfile: 'u/:handle',
      // Keşfet derin bağlantısı — her İKİ kabukta da aynı kök `Kesfet` ekranına
      // gider (eski kabukta stack Keşfet; yeni kabukta KesfetTab in-app sekmedir,
      // ama derin bağlantı tam ekran Keşfet'i açar). `Kesfet` rotası yalnız
      // `kesfet` açıkken kayıtlı; kapalıyken RN bu yolu yok sayar (davranış aynı).
      Kesfet: 'kesfet',
    },
  },
};
