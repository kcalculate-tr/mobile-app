import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BackgroundLayer } from '../../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../../components/onboarding/TopBar';
import { GlassInput } from '../../../components/onboarding/GlassInput';
import { PrimaryCTA } from '../../../components/onboarding/PrimaryCTA';
import { sportive } from '../../../theme/sportive';
import { useNutritionDraft } from '../../../store/nutritionDraftStore';
import { useSkipNutrition } from '../../../hooks/useSkipNutrition';

export default function NutritionMetricsScreen() {
  const nav = useNavigation();
  const { age, height, weight, set } = useNutritionDraft();
  const [ageText, setAgeText] = useState(age ? String(age) : '');
  const [heightText, setHeightText] = useState(height ? String(height) : '');
  const [weightText, setWeightText] = useState(weight ? String(weight) : '');
  const [errors, setErrors] = useState<{ age?: string; height?: string; weight?: string }>({});
  const { skip, loading: skipping } = useSkipNutrition();

  const next = () => {
    const a = parseInt(ageText, 10);
    const h = parseInt(heightText, 10);
    const w = parseInt(weightText, 10);
    const e: typeof errors = {};
    if (!Number.isFinite(a) || a < 12 || a > 100) e.age = '12-100 arası gir.';
    if (!Number.isFinite(h) || h < 100 || h > 230) e.height = '100-230 cm arası.';
    if (!Number.isFinite(w) || w < 30 || w > 250) e.weight = '30-250 kg arası.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    set({ age: a, height: h, weight: w });
    nav.navigate('NutritionGoal' as never);
  };

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack pageIndicator="02 / 05" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.content}>
            <Text style={styles.h1}>Vücut metrikleri.</Text>
            <Text style={styles.sub}>BMR ve günlük kalori ihtiyacın için.</Text>

            <View style={{ marginTop: 28 }}>
              <GlassInput
                label="YAŞ"
                value={ageText}
                onChangeText={setAgeText}
                keyboardType="number-pad"
                placeholder="28"
                error={errors.age}
              />
              <GlassInput
                label="BOY (CM)"
                value={heightText}
                onChangeText={setHeightText}
                keyboardType="number-pad"
                placeholder="178"
                error={errors.height}
              />
              <GlassInput
                label="KİLO (KG)"
                value={weightText}
                onChangeText={setWeightText}
                keyboardType="number-pad"
                placeholder="75"
                error={errors.weight}
              />
            </View>
          </View>
          <View style={styles.footer}>
            <PrimaryCTA label="Devam" showArrow onPress={next} />
            <Pressable onPress={skip} disabled={skipping} style={styles.skipLink}>
              <Text style={styles.skipText}>Şimdilik Geç</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BackgroundLayer>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 12, flex: 1 },
  h1: { ...sportive.type.h1, color: sportive.colors.textPrimary, marginBottom: 8 },
  sub: { ...sportive.type.body, color: sportive.colors.textSecondary },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  skipLink: { marginTop: 16, alignItems: 'center', padding: 12 },
  skipText: { fontFamily: sportive.type.body.fontFamily, fontSize: 15, color: sportive.colors.textSecondary },
});
