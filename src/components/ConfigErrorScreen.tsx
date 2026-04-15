import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ScreenContainer from './ScreenContainer';

interface ConfigErrorScreenProps {
  missingKeys?: string[];
  onRetry?: () => void;
}

export default function ConfigErrorScreen({
  missingKeys = [],
  onRetry,
}: ConfigErrorScreenProps) {
  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Konfigürasyon Eksik</Text>
        <Text style={styles.message}>
          Uygulama yapılandırması eksik. Lütfen güncelleme yapın.
        </Text>
        {missingKeys.length > 0 ? (
          <Text style={styles.keys}>Eksik alanlar: {missingKeys.join(', ')}</Text>
        ) : null}
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#202020',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#444',
    textAlign: 'center',
    lineHeight: 22,
  },
  keys: {
    marginTop: 12,
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#C6F04F',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  retryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
