import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { User } from 'phosphor-react-native';
import { BackgroundLayer } from '../../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../../components/onboarding/TopBar';
import { ChoiceCard } from '../../../components/onboarding/ChoiceCard';
import { PrimaryCTA } from '../../../components/onboarding/PrimaryCTA';
import { sportive } from '../../../theme/sportive';
import { useNutritionDraft } from '../../../store/nutritionDraftStore';
import { useSkipNutrition } from '../../../hooks/useSkipNutrition';

export default function NutritionGenderScreen() {
  const nav = useNavigation();
  const { gender, set } = useNutritionDraft();
  const { skip, loading: skipping } = useSkipNutrition();

  const next = () => nav.navigate('NutritionMetrics' as never);

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack pageIndicator="01 / 05" />
        <View style={styles.content}>
          <Text style={styles.h1}>Önce, kendinden bahset.</Text>
          <Text style={styles.sub}>Hedefini hesaplamak için cinsiyet bilgine ihtiyacımız var.</Text>

          <View style={styles.row}>
            <ChoiceCard
              icon={<User size={32} color={gender === 'male' ? sportive.colors.accent : sportive.colors.textPrimary} weight="regular" />}
              title="Erkek"
              selected={gender === 'male'}
              onPress={() => set({ gender: 'male' })}
            />
            <ChoiceCard
              icon={<User size={32} color={gender === 'female' ? sportive.colors.accent : sportive.colors.textPrimary} weight="regular" />}
              title="Kadın"
              selected={gender === 'female'}
              onPress={() => set({ gender: 'female' })}
            />
          </View>
        </View>
        <View style={styles.footer}>
          <PrimaryCTA label="Devam" showArrow disabled={!gender} onPress={next} />
          <Pressable onPress={skip} disabled={skipping} style={styles.skipLink}>
            <Text style={styles.skipText}>Şimdilik Geç</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </BackgroundLayer>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 12, flex: 1 },
  h1: { ...sportive.type.h1, color: sportive.colors.textPrimary, marginBottom: 8 },
  sub: { ...sportive.type.body, color: sportive.colors.textSecondary, marginBottom: 32 },
  row: { flexDirection: 'row', gap: 12 },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  skipLink: { marginTop: 16, alignItems: 'center', padding: 12 },
  skipText: { fontFamily: sportive.type.body.fontFamily, fontSize: 15, color: sportive.colors.textSecondary },
});
