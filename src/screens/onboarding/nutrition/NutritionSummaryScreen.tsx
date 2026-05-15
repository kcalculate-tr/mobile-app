import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackgroundLayer } from '../../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../../components/onboarding/TopBar';
import { PrimaryCTA } from '../../../components/onboarding/PrimaryCTA';
import { sportive } from '../../../theme/sportive';
import { useNutritionDraft } from '../../../store/nutritionDraftStore';
import { useNavGate } from '../../../store/navGateStore';
import { useSkipNutrition } from '../../../hooks/useSkipNutrition';
import { calculateMacroTargets } from '../../../lib/nutrition';
import { getSupabaseClient } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

const MISSING_LABELS: { key: 'gender' | 'age' | 'height' | 'weight' | 'goal' | 'activity'; label: string }[] = [
  { key: 'gender', label: 'cinsiyet' },
  { key: 'age', label: 'yaş' },
  { key: 'height', label: 'boy' },
  { key: 'weight', label: 'kilo' },
  { key: 'goal', label: 'hedef' },
  { key: 'activity', label: 'aktivite seviyesi' },
];

export default function NutritionSummaryScreen() {
  const { user } = useAuth();
  const draft = useNutritionDraft();
  const [loading, setLoading] = useState(false);
  const { skip, loading: skipping } = useSkipNutrition();

  const targets = useMemo(() => {
    if (!draft.gender || !draft.age || !draft.height || !draft.weight || !draft.goal || !draft.activity) {
      return null;
    }
    return calculateMacroTargets({
      gender: draft.gender,
      age: draft.age,
      heightCm: draft.height,
      weightKg: draft.weight,
      goal: draft.goal,
      activity: draft.activity,
    });
  }, [draft]);

  const handleComplete = async () => {
    if (!targets || !user) {
      Alert.alert('Hata', 'Eksik bilgi. Lütfen geri dönüp tamamla.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('user_nutrition_profiles').upsert({
        user_id: user.id,
        gender: draft.gender,
        age: draft.age,
        height: draft.height,
        weight: draft.weight,
        goal: draft.goal,
        activity_level: draft.activity,
        target_calories: targets.calories,
        target_protein: targets.protein,
        target_carbs: targets.carbs,
        target_fat: targets.fat,
        target_water: targets.water,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      await AsyncStorage.multiSet([
        ['@kcal_onboarding_done', 'true'],
        ['@kcal_needs_nutrition_profile', 'false'],
      ]);

      // State-driven geçiş: AppNavigator bayrakları yeniden okur ve
      // MainStack'e (Tabs) geçer. Imperative nav.reset YOK — OnboardingStack
      // unmount olacağı için draft.reset() de burada çağrılmıyor (targets'ı
      // null'layıp "Bilgiler eksik" fallback'ini bir kare gösteriyordu).
      useNavGate.getState().refresh();
    } catch (err: any) {
      Alert.alert('Hata', err?.message ?? 'Kayıt başarısız.');
    } finally {
      setLoading(false);
    }
  };

  // "Makrolarımı kendim gireceğim": önerilen kalorileri gördükten sonra
  // manuel giriş. Onboarding'i bitir, MainStack'e geç ve Beslenme Profili
  // (NutritionProfile) ekranına yönlendir.
  const handleManualMacros = async () => {
    try {
      await AsyncStorage.multiSet([
        ['@kcal_onboarding_done', 'true'],
        ['@kcal_needs_nutrition_profile', 'false'],
      ]);
      useNavGate.getState().setPendingRoute('NutritionProfile');
      useNavGate.getState().refresh();
    } catch (err) {
      console.error('Manual macros error:', err);
    }
  };

  if (!targets) {
    const missing = MISSING_LABELS.filter((m) => !draft[m.key]).map((m) => m.label);
    const detail =
      missing.length > 0
        ? `Eksik: ${missing.join(', ')}. Geri dönüp tamamla.`
        : 'Geri dönüp adımları tamamla.';
    return (
      <BackgroundLayer mode="blur">
        <SafeAreaView style={styles.safe}>
          <TopBar showBack pageIndicator="05 / 05" />
          <View style={styles.content}>
            <Text style={styles.h1}>Bilgiler eksik.</Text>
            <Text style={styles.sub}>{detail}</Text>
          </View>
        </SafeAreaView>
      </BackgroundLayer>
    );
  }

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack pageIndicator="05 / 05" />
        <View style={styles.content}>
          <Text style={styles.h1}>İşte senin hedefin.</Text>
          <Text style={styles.sub}>Aktivitene ve hedeflerine göre hesapladık.</Text>

          <View style={styles.bigNumberWrap}>
            <Text style={styles.bigNumber}>{targets.calories.toLocaleString('tr-TR')}</Text>
            <Text style={styles.bigCaption}>KCAL / GÜN</Text>
          </View>

          <View style={styles.macroRow}>
            <MacroCard label="Protein" value={targets.protein} />
            <MacroCard label="Karb" value={targets.carbs} />
            <MacroCard label="Yağ" value={targets.fat} />
          </View>
        </View>
        <View style={styles.footer}>
          <PrimaryCTA label="Tamamla" loading={loading} onPress={handleComplete} />
          <Pressable onPress={skip} disabled={skipping} style={styles.skipLink}>
            <Text style={styles.skipText}>Şimdilik Geç</Text>
          </Pressable>
          <Pressable onPress={handleManualMacros} style={styles.manualLink}>
            <Text style={styles.skipText}>Makrolarımı kendim gireceğim →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </BackgroundLayer>
  );
}

const MacroCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View style={styles.macroCard}>
    <Text style={styles.macroValue}>
      {value}
      <Text style={styles.macroUnit}>g</Text>
    </Text>
    <Text style={styles.macroLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 12, flex: 1 },
  h1: { ...sportive.type.h1, color: sportive.colors.textPrimary, marginBottom: 8 },
  sub: { ...sportive.type.body, color: sportive.colors.textSecondary },
  bigNumberWrap: { alignItems: 'center', marginTop: 36, marginBottom: 32 },
  bigNumber: { ...sportive.type.number, color: sportive.colors.accent },
  bigCaption: { ...sportive.type.tactical, color: sportive.colors.textSecondary, marginTop: 6 },
  macroRow: { flexDirection: 'row', gap: 10 },
  macroCard: {
    flex: 1,
    backgroundColor: sportive.colors.glassBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sportive.colors.glassBorder,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  macroValue: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 26, color: sportive.colors.textPrimary, letterSpacing: -0.6 },
  macroUnit: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: sportive.colors.textTertiary },
  macroLabel: { ...sportive.type.tactical, color: sportive.colors.textSecondary, marginTop: 4 },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  skipLink: { marginTop: 16, alignItems: 'center', padding: 12 },
  manualLink: { marginTop: 8, alignItems: 'center', padding: 12 },
  skipText: { fontFamily: sportive.type.body.fontFamily, fontSize: 15, color: sportive.colors.textSecondary },
});
