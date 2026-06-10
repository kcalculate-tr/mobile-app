import React, { useEffect } from 'react';
import {
  BackHandler,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS } from '../constants/theme';

const STORE_URL =
  Platform.select({
    ios: 'https://apps.apple.com/app/id6763964912',
    android: 'https://play.google.com/store/apps/details?id=com.kcalmobile.app',
  }) ?? 'https://play.google.com/store/apps/details?id=com.kcalmobile.app';

const DEFAULT_MESSAGE =
  'Uygulamanın bu sürümü artık desteklenmiyor. Devam etmek için lütfen en son sürüme güncelleyin.';

type Props = {
  visible: boolean;
  message?: string | null;
};

export default function ForceUpdateModal({ visible, message }: Props) {
  // Android donanım geri tuşunu engelle — modal kapatılamaz olmalı.
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  const handleUpdate = () => {
    Linking.openURL(STORE_URL).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}} // no-op: zorunlu, kapatılamaz
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Güncelleme Gerekli</Text>
          <Text style={styles.message}>{message?.trim() || DEFAULT_MESSAGE}</Text>
          <Pressable style={styles.button} onPress={handleUpdate}>
            <Text style={styles.buttonText}>Güncelle</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  button: {
    width: '100%',
    height: 54,
    borderRadius: 100,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1a3d00',
  },
});
