import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BackgroundLayer } from '../../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../../components/onboarding/TopBar';
import { ChoiceCard } from '../../../components/onboarding/ChoiceCard';
import { PrimaryCTA } from '../../../components/onboarding/PrimaryCTA';
import { sportive } from '../../../theme/sportive';
import { useNutritionDraft } from '../../../store/nutritionDraftStore';
import { useSkipNutrition } from '../../../hooks/useSkipNutrition';
import { ACTIVITY_ORDER, ACTIVITY_LABELS } from '../../../lib/nutrition';

export default function NutritionActivityScreen() {
  const nav = useNavigation();
  const { activity, set } = useNutritionDraft();
  const { skip, loading: skipping } = useSkipNutrition();

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack pageIndicator="04 / 05" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.h1}>Hareketlilik seviyesi?</Text>
          <Text style={styles.sub}>Günlük kalori ihtiyacın aktiviteye göre değişir.</Text>

          <View style={{ marginTop: 24, gap: 8 }}>
            {ACTIVITY_ORDER.map((lvl) => (
              <ChoiceCard
                key={lvl}
                layout="horizontal"
                title={ACTIVITY_LABELS[lvl].title}
                description={ACTIVITY_LABELS[lvl].description}
                selected={activity === lvl}
                onPress={() => set({ activity: lvl })}
              />
            ))}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryCTA label="Hesapla" showArrow disabled={!activity} onPress={() => nav.navigate('NutritionSummary' as never)} />
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
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  h1: { ...sportive.type.h1, color: sportive.colors.textPrimary, marginBottom: 8 },
  sub: { ...sportive.type.body, color: sportive.colors.textSecondary },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  skipLink: { marginTop: 16, alignItems: 'center', padding: 12 },
  skipText: { fontFamily: sportive.type.body.fontFamily, fontSize: 15, color: sportive.colors.textSecondary },
});
