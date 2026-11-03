// `/p/<post_id>` derin bağlantı hedefi (G5-S4 md.2).
//
// Sosyal gönderi katmanı (Keşfet) henüz kurulmadığı için hafif, herkese açık
// bir karşılama gösterir. Bağlantı çözüldüğünde uygulama bu ekranı açar;
// kullanıcı buradan uygulamaya girer. URL'de yalnız opak post_id bulunur
// (sağlık verisi/özel kimlik yok).

import React from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ForkKnife } from '../../components/icons';
import DeepLinkLanding from '../../components/share/DeepLinkLanding';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SharedPost'>;

export default function SharedPostScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'SharedPost'>>();
  const postId = (route.params?.postId ?? '').toString().trim();

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  return (
    <DeepLinkLanding
      IconComponent={ForkKnife}
      eyebrow="Paylaşılan öğün"
      title={postId ? 'Bu öğün Kcalculate ile paylaşıldı' : 'Paylaşılan içerik'}
      subtitle="İçeriği uygulamada aç, kendi öğünlerini de kalori ve protein tahminiyle takip et."
      primaryLabel="Uygulamayı aç"
      onPrimary={goHome}
    />
  );
}
