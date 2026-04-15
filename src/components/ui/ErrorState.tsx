import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PrimaryButton from './PrimaryButton';

type ErrorStateProps = {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function ErrorState({
  title = 'Bir Hata Oluştu',
  message,
  actionLabel = 'Tekrar Dene',
  onAction,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onAction ? (
        <PrimaryButton title={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#991B1B',
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    color: '#7F1D1D',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 16,
    minWidth: 160,
  },
});
