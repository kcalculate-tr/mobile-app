import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Warning } from 'phosphor-react-native';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Warning size={64} color={COLORS.brand.green} weight="duotone" />
        </View>

        <Text style={styles.title}>Ups! Bir şeyler ters gitti</Text>
        
        <Text style={styles.subtitle}>
          Kcal ekibi olarak bu sorunu çözüyoruz.{'\n'}
          Lütfen uygulamayı yeniden başlatın.
        </Text>

        {__DEV__ && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Geliştirici Bilgisi:</Text>
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.button} 
          onPress={resetError}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Yeniden Başlat</Text>
        </TouchableOpacity>

        <View style={styles.brandContainer}>
          <Text style={styles.brandText}>KCAL</Text>
          <Text style={styles.brandSubtext}>Premium Beslenme Deneyimi</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${COLORS.brand.green}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: TYPOGRAPHY.weight.black as any,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '400',
    fontFamily: 'PlusJakartaSans_400Regular' as any,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING['6xl'],
    maxWidth: 300,
  },
  errorBox: {
    backgroundColor: COLORS.gray[100],
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    maxWidth: '100%' as any,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold as any,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.error,
    marginBottom: SPACING.xs,
  },
  errorText: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.text.tertiary,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: COLORS.brand.green,
    paddingHorizontal: SPACING['3xl'],
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.sm,
    minWidth: 200,
    shadowColor: COLORS.brand.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.black as any,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.black,
    textAlign: 'center',
  },
  brandContainer: {
    position: 'absolute',
    bottom: SPACING['6xl'],
    alignItems: 'center',
  },
  brandText: {
    fontSize: 28,
    fontWeight: TYPOGRAPHY.weight.black as any,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.brand.green,
    letterSpacing: 2,
  },
  brandSubtext: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.text.tertiary,
    marginTop: SPACING.xs,
  },
});
