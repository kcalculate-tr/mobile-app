// `/u/<handle>` derin bağlantı hedefi (G5-S4 md.2).
//
// Herkese açık profil katmanı (handle) henüz kurulmadığı için hafif, herkese
// açık bir karşılama gösterir. URL'de yalnız kullanıcı handle'ı bulunur — ham
// kullanıcı kimliği (UUID) veya sağlık verisi YOK.

import React from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { User } from '../../components/icons';
import DeepLinkLanding from '../../components/share/DeepLinkLanding';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SharedProfile'>;

export default function SharedProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'SharedProfile'>>();
  const handle = (route.params?.handle ?? '').toString().trim().replace(/^@/, '');

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  return (
    <DeepLinkLanding
      IconComponent={User}
      eyebrow="Profil"
      title={handle ? `@${handle}` : 'Paylaşılan profil'}
      subtitle="Bu kullanıcının paylaşımlarını görmek ve kendi beslenme takibini yapmak için Kcalculate'i aç."
      primaryLabel="Uygulamayı aç"
      onPrimary={goHome}
    />
  );
}
