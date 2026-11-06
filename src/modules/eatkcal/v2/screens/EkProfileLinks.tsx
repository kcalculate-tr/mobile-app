// eatkcal v2 (G15-S5 md.5) — sipariş akışından açılan Profil sayfaları için
// rota sarmalayıcıları. Sipariş detayı "Talep oluştur" → `ProfileSupport`,
// ödeme sözleşme bağlantıları → `ProfileContracts`; bu rotalar bugün 1.0.7
// SupportScreen / ContractsScreen'i açıyor. `yeni_siparis` açıkken Profil
// modülünün Final görünümleri (FinPrSupport / FinPrAgreements — G12-S4, profil
// sahipliği; burada YALNIZ import edilir, değiştirilmez) rota olarak açılır.
// Veri/mantık o bileşenlerde (support_tickets aynı kolonlar; sözleşme metinleri aynı).
import React from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import SettingsSupportScreen from '../../../profil/ui/screens/SettingsSupportScreen';
import SettingsAgreementsScreen from '../../../profil/ui/screens/SettingsAgreementsScreen';

export function EkSupportRoute() {
  const navigation = useNavigation();
  return <SettingsSupportScreen onBack={() => navigation.goBack()} />;
}

export function EkContractsRoute() {
  const navigation = useNavigation();
  const slug = (useRoute().params as { slug?: string } | undefined)?.slug;
  return <SettingsAgreementsScreen onBack={() => navigation.goBack()} initialSlug={slug} />;
}
