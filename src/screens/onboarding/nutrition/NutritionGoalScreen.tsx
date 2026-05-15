import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TrendDown, Minus, TrendUp } from 'phosphor-react-native';
import { BackgroundLayer } from '../../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../../components/onboarding/TopBar';
import { ChoiceCard } from '../../../components/onboarding/ChoiceCard';
import { PrimaryCTA } from '../../../components/onboarding/PrimaryCTA';
import { sportive } from '../../../theme/sportive';
import { useNutritionDraft } from '../../../store/nutritionDraftStore';
import { useSkipNutrition } from '../../../hooks/useSkipNutrition';
import type { Goal } from '../../../lib/nutrition';

const OPTIONS: { value: Goal; title: string; desc: string; Icon: React.FC<any> }[] = [
  { value: 'lose_weight', title: 'Kilo Ver', desc: 'Açık dengeyle kademeli azalma', Icon: TrendDown },
  { value: 'maintain',    title: 'Kiloyu Koru', desc: 'Mevcut formunu sürdür', Icon: Minus },
  { value: 'gain_weight', title: 'Kilo Al', desc: 'Hafif fazlalıkla yapı kazan', Icon: TrendUp },
];

export default function NutritionGoalScreen() {
  const nav = useNavigation();
  const { goal, set } = useNutritionDraft();
  const { skip, loading: skipping } = useSkipNutrition();

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack pageIndicator="03 / 05" />
        <View style={styles.content}>
          <Text style={styles.h1}>Hedefin nedir?</Text>
          <Text style={styles.sub}>Senin için kalori hedefini buna göre belirleyeceğiz.</Text>

          <View style={{ marginTop: 24, gap: 10 }}>
            {OPTIONS.map((o) => (
              <ChoiceCard
                key={o.value}
                layout="horizontal"
                icon={<o.Icon size={24} color={goal === o.value ? sportive.colors.accent : sportive.colors.textPrimary} weight="regular" />}
                title={o.title}
                description={o.desc}
                selected={goal === o.value}
                onPress={() => set({ goal: o.value })}
              />
            ))}
          </View>
        </View>
        <View style={styles.footer}>
          <PrimaryCTA label="Devam" showArrow disabled={!goal} onPress={() => nav.navigate('NutritionActivity' as never)} />
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
  sub: { ...sportive.type.body, color: sportive.colors.textSecondary },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  skipLink: { marginTop: 16, alignItems: 'center', padding: 12 },
  skipText: { fontFamily: sportive.type.body.fontFamily, fontSize: 15, color: sportive.colors.textSecondary },
});
