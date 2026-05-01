import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CaretLeft, PencilSimple, LockSimple } from 'phosphor-react-native';
import { MACRO_COLORS, hexToRgba } from '../../constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { getSupabaseClient } from '../../lib/supabase';
import { mapSupabaseErrorToUserMessage } from '../../lib/supabaseErrors';
import { RootStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/theme';
import {
  ActivityLevel,
  Gender,
  Goal as GoalType,
  ACTIVITY_LABELS,
  ACTIVITY_ORDER,
  calculateBMR,
  calculateMacroTargets,
  calculateTDEE,
  migrateLegacyActivity,
} from '../../lib/nutrition';

type NutritionProfileNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const safeInt = (v: string, fallback: number): number => {
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const getBMICategory = (bmi: number) => {
  if (bmi < 18.5) return { label: 'Zayıf', color: '#06B6D4' };
  if (bmi < 25) return { label: 'Normal', color: '#16A34A' };
  if (bmi < 30) return { label: 'Fazla Kilolu', color: '#F59E0B' };
  return { label: 'Obez', color: '#DC2626' };
};

const getBMIProgress = (bmi: number) => Math.min(1, Math.max(0, (bmi - 10) / 30));

function ToggleGroup<T extends string>({ options, selected, onSelect }: {
  options: { key: T; label: string }[];
  selected: T;
  onSelect: (key: T) => void;
}) {
  return (
    <View style={tg.row}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.key}
          style={[tg.btn, selected === opt.key && tg.btnActive]}
          onPress={() => onSelect(opt.key)}
          activeOpacity={0.8}
        >
          <Text style={[tg.text, selected === opt.key && tg.textActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tg = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 100, backgroundColor: '#f0f0f0' },
  btnActive: { backgroundColor: COLORS.brand.green },
  text: { fontSize: 13, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.secondary },
  textActive: { color: '#000000' },
});

const GENDER_OPTIONS: { key: Gender; label: string }[] = [
  { key: 'male', label: 'Erkek' }, { key: 'female', label: 'Kadın' },
];
const GOAL_OPTIONS: { key: GoalType; label: string }[] = [
  { key: 'lose_weight', label: 'Kilo Ver' },
  { key: 'maintain', label: 'Kiloyu Koru' },
  { key: 'gain_weight', label: 'Kilo Al' },
];
const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string; desc: string }[] =
  ACTIVITY_ORDER.map((key) => ({
    key,
    label: ACTIVITY_LABELS[key].title,
    desc: ACTIVITY_LABELS[key].description,
  }));

export default function NutritionProfileScreen() {
  const navigation = useNavigation<NutritionProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isAuthenticated, loading } = useRequireAuth();

  const [gender, setGender] = useState<Gender>('male');
  const [ageText, setAgeText] = useState('30');
  const [heightText, setHeightText] = useState('175');
  const [weightText, setWeightText] = useState('70');
  const [goal, setGoal] = useState<GoalType>('maintain');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');

  // Beden ölçüleri
  const [waistText, setWaistText] = useState('');
  const [hipText, setHipText] = useState('');
  const [chestText, setChestText] = useState('');

  // Özel makro
  const [useCustomMacros, setUseCustomMacros] = useState(false);
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');

  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Mevcut profili yükle
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('user_nutrition_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          if (data.gender) setGender(data.gender);
          if (data.age) setAgeText(String(data.age));
          if (data.height) setHeightText(String(data.height));
          if (data.weight) setWeightText(String(data.weight));
          if (data.goal) setGoal(data.goal);
          if (data.activity_level) setActivity(migrateLegacyActivity(data.activity_level));
          if (data.waist_cm) setWaistText(String(data.waist_cm));
          if (data.hip_cm) setHipText(String(data.hip_cm));
          if (data.chest_cm) setChestText(String(data.chest_cm));
          if (data.use_custom_macros) setUseCustomMacros(data.use_custom_macros);
          if (data.custom_calories) setCustomCalories(String(data.custom_calories));
          if (data.custom_protein) setCustomProtein(String(data.custom_protein));
          if (data.custom_carbs) setCustomCarbs(String(data.custom_carbs));
          if (data.custom_fat) setCustomFat(String(data.custom_fat));
        }
      } catch { /* silent */ }
      finally { setDataLoading(false); }
    };
    load();
  }, [user]);

  const parsed = useMemo(() => ({
    age: safeInt(ageText, 30),
    height: safeInt(heightText, 175),
    weight: safeInt(weightText, 70),
  }), [ageText, heightText, weightText]);

  const macros = useMemo(() => {
    const input = {
      gender,
      age: parsed.age,
      heightCm: parsed.height,
      weightKg: parsed.weight,
      goal,
      activity,
    };
    const targets = calculateMacroTargets(input);
    return {
      bmr: Math.round(calculateBMR(input)),
      tdee: Math.round(calculateTDEE(input)),
      targetKcal: targets.calories,
      protein: targets.protein,
      carbs: targets.carbs,
      fat: targets.fat,
      targetWater: targets.water,
    };
  }, [gender, parsed, goal, activity]);

  const bmi = useMemo(() => {
    const h = parsed.height / 100;
    return Math.round((parsed.weight / (h * h)) * 10) / 10;
  }, [parsed]);

  const bmiCategory = getBMICategory(bmi);
  const bmiProgress = getBMIProgress(bmi);

  const displayMacros = useCustomMacros ? {
    targetKcal: safeInt(customCalories, macros.targetKcal),
    protein: safeInt(customProtein, macros.protein),
    carbs: safeInt(customCarbs, macros.carbs),
    fat: safeInt(customFat, macros.fat),
  } : {
    targetKcal: macros.targetKcal,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
  };

  const handleSave = async () => {
    if (!user) { setErrorMessage('Giriş yapmanız gerekiyor.'); return; }
    if (parsed.age <= 0 || parsed.height <= 0 || parsed.weight <= 0) {
      setErrorMessage('Lütfen geçerli değerler girin.'); return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split('T')[0];

      const [profileRes, measurementRes] = await Promise.all([
        supabase.from('user_nutrition_profiles').upsert(
          {
            user_id: user.id,
            gender, age: parsed.age, height: parsed.height, weight: parsed.weight,
            goal, activity_level: activity,
            waist_cm: waistText ? safeInt(waistText, 0) : null,
            hip_cm: hipText ? safeInt(hipText, 0) : null,
            chest_cm: chestText ? safeInt(chestText, 0) : null,
            target_calories: displayMacros.targetKcal,
            target_protein: displayMacros.protein,
            target_carbs: displayMacros.carbs,
            target_fat: displayMacros.fat,
            target_water: macros.targetWater,
            use_custom_macros: useCustomMacros,
            custom_calories: useCustomMacros ? safeInt(customCalories, 0) : null,
            custom_protein: useCustomMacros ? safeInt(customProtein, 0) : null,
            custom_carbs: useCustomMacros ? safeInt(customCarbs, 0) : null,
            custom_fat: useCustomMacros ? safeInt(customFat, 0) : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        ),
        supabase.from('body_measurements').upsert(
          {
            user_id: user.id,
            date: today,
            weight_kg: parsed.weight,
            waist_cm: waistText ? safeInt(waistText, 0) : null,
            hip_cm: hipText ? safeInt(hipText, 0) : null,
            chest_cm: chestText ? safeInt(chestText, 0) : null,
          },
          { onConflict: 'user_id,date' },
        ),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (measurementRes.error) throw measurementRes.error;

      setSuccessMessage('Profiliniz kaydedildi!');
      setTimeout(() => navigation.goBack(), 800);
    } catch (error: unknown) {
      setErrorMessage(mapSupabaseErrorToUserMessage(error, 'Profil kaydedilemedi. Lütfen tekrar deneyin.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || dataLoading) return <ActivityIndicator style={{ flex: 1 }} color={COLORS.brand.green} />;
  if (!isAuthenticated) return null;

  return (
    <View style={[s.root, { flex: 1, paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
          <CaretLeft size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Beslenme Profilim</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: Math.max(32, insets.bottom + 24) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* BMR Kartı */}
          <View style={s.bmrCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.bmrLabel}>Bazal Metabolizma (BMR)</Text>
              <Text style={s.bmrValue}>{macros.bmr} <Text style={s.bmrUnit}>kcal</Text></Text>
              <Text style={s.tdeeText}>Günlük yakım: {macros.tdee} kcal</Text>
            </View>
            <View style={s.targetKcalBox}>
              <Text style={s.targetKcalLabel}>Hedef</Text>
              <Text style={s.targetKcalValue}>{displayMacros.targetKcal}</Text>
              <Text style={s.targetKcalUnit}>kcal/gün</Text>
            </View>
          </View>

          {/* BMI */}
          <View style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.cardLabel}>Vücut Kitle Endeksi (BMI)</Text>
              <View style={[s.bmiCategoryBadge, { backgroundColor: bmiCategory.color + '20' }]}>
                <Text style={[s.bmiCategoryText, { color: bmiCategory.color }]}>{bmiCategory.label}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <Text style={[s.bmiValue, { color: bmiCategory.color }]}>{bmi}</Text>
              <Text style={s.bmiUnit}>kg/m²</Text>
            </View>
            <View style={s.bmiTrack}>
              <View style={[s.bmiFill, { width: `${bmiProgress * 100}%` as any, backgroundColor: bmiCategory.color }]} />
            </View>
            <View style={s.bmiScale}>
              <Text style={s.bmiScaleText}>Zayıf{'\n'}&lt;18.5</Text>
              <Text style={s.bmiScaleText}>Normal{'\n'}18.5–25</Text>
              <Text style={s.bmiScaleText}>Fazla{'\n'}25–30</Text>
              <Text style={s.bmiScaleText}>Obez{'\n'}30+</Text>
            </View>
          </View>

          {/* Cinsiyet */}
          <View style={s.card}>
            <Text style={s.cardLabel}>Cinsiyet</Text>
            <ToggleGroup options={GENDER_OPTIONS} selected={gender} onSelect={setGender} />
          </View>

          {/* Kişisel Bilgiler */}
          <View style={s.card}>
            <Text style={s.cardLabel}>Kişisel Bilgiler</Text>
            <View style={s.triRow}>
              {[
                { label: 'Yaş', value: ageText, set: setAgeText, ph: '30' },
                { label: 'Boy (cm)', value: heightText, set: setHeightText, ph: '175' },
                { label: 'Kilo (kg)', value: weightText, set: setWeightText, ph: '70' },
              ].map((field) => (
                <View key={field.label} style={s.triCell}>
                  <Text style={s.inputLabel}>{field.label}</Text>
                  <TextInput
                    style={s.numInput} value={field.value} onChangeText={field.set}
                    keyboardType="number-pad" maxLength={3} placeholder={field.ph}
                    placeholderTextColor={COLORS.text.tertiary}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Beden Ölçüleri */}
          <View style={s.card}>
            <Text style={s.cardLabel}>Beden Ölçüleri <Text style={s.optionalTag}>(opsiyonel)</Text></Text>
            <View style={s.triRow}>
              {[
                { label: 'Bel (cm)', value: waistText, set: setWaistText, ph: '80' },
                { label: 'Kalça (cm)', value: hipText, set: setHipText, ph: '95' },
                { label: 'Göğüs (cm)', value: chestText, set: setChestText, ph: '100' },
              ].map((field) => (
                <View key={field.label} style={s.triCell}>
                  <Text style={s.inputLabel}>{field.label}</Text>
                  <TextInput
                    style={s.numInput} value={field.value} onChangeText={field.set}
                    keyboardType="number-pad" maxLength={3} placeholder={field.ph}
                    placeholderTextColor={COLORS.text.tertiary}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Hedef */}
          <View style={s.card}>
            <Text style={s.cardLabel}>Hedef</Text>
            <ToggleGroup options={GOAL_OPTIONS} selected={goal} onSelect={setGoal} />
          </View>

          {/* Aktivite */}
          <View style={s.card}>
            <Text style={s.cardLabel}>Aktivite Seviyesi</Text>
            <View style={s.activityList}>
              {ACTIVITY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.activityRow, activity === opt.key && s.activityRowActive]}
                  onPress={() => setActivity(opt.key)}
                  activeOpacity={0.8}
                >
                  <View style={[s.activityRadio, activity === opt.key && s.activityRadioActive]}>
                    {activity === opt.key && <View style={s.activityRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.activityLabel}>{opt.label}</Text>
                    <Text style={s.activityDesc}>{opt.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Makro Hedefleri */}
          <View style={s.macroCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.cardLabel}>Günlük Makro Hedefleri</Text>
            </View>

            {/* Toggle Bar */}
            <View style={s.macroToggleRow}>
              <TouchableOpacity
                style={[s.macroToggleBtn, !useCustomMacros && s.macroToggleBtnActive]}
                onPress={() => setUseCustomMacros(false)}
                activeOpacity={0.8}
              >
                <LockSimple size={13} color={!useCustomMacros ? '#000000' : COLORS.text.secondary} />
                <Text style={[s.macroToggleBtnText, !useCustomMacros && s.macroToggleBtnTextActive]}>Otomatik</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.macroToggleBtn, useCustomMacros && s.macroToggleBtnActive]}
                onPress={() => {
                  if (!useCustomMacros) {
                    setCustomCalories(String(macros.targetKcal));
                    setCustomProtein(String(macros.protein));
                    setCustomCarbs(String(macros.carbs));
                    setCustomFat(String(macros.fat));
                  }
                  setUseCustomMacros(true);
                }}
                activeOpacity={0.8}
              >
                <PencilSimple size={13} color={useCustomMacros ? '#000000' : COLORS.text.secondary} />
                <Text style={[s.macroToggleBtnText, useCustomMacros && s.macroToggleBtnTextActive]}>Elle Düzenle</Text>
              </TouchableOpacity>
            </View>

            {!useCustomMacros && (
              <View style={s.macroGrid}>
                {[
                  { label: 'Protein', value: macros.protein, unit: 'g', color: MACRO_COLORS.protein.main, bg: MACRO_COLORS.protein.track },
                  { label: 'Karb', value: macros.carbs, unit: 'g', color: MACRO_COLORS.carbs.main, bg: MACRO_COLORS.carbs.track },
                  { label: 'Yağ', value: macros.fat, unit: 'g', color: MACRO_COLORS.fat.main, bg: MACRO_COLORS.fat.track },
                  { label: 'Su', value: macros.targetWater, unit: 'L', color: '#06B6D4', bg: '#ECFEFF' },
                ].map((m) => (
                  <View key={m.label} style={[s.macroCell, { backgroundColor: m.bg }]}>
                    <Text style={[s.macroCellValue, { color: m.color }]}>{m.value}</Text>
                    <Text style={[s.macroCellUnit, { color: m.color }]}>{m.unit}</Text>
                    <Text style={s.macroCellLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            )}
            {useCustomMacros && (
              <View style={s.customMacroGrid}>
                {[
                  { label: 'Kalori', value: customCalories, set: setCustomCalories, unit: 'kcal', color: MACRO_COLORS.calories.main },
                  { label: 'Protein', value: customProtein, set: setCustomProtein, unit: 'g', color: MACRO_COLORS.protein.main },
                  { label: 'Karb', value: customCarbs, set: setCustomCarbs, unit: 'g', color: MACRO_COLORS.carbs.main },
                  { label: 'Yağ', value: customFat, set: setCustomFat, unit: 'g', color: MACRO_COLORS.fat.main },
                ].map((m) => (
                  <View key={m.label} style={s.customMacroCell}>
                    <Text style={[s.inputLabel, { color: m.color }]}>{m.label} ({m.unit})</Text>
                    <TextInput
                      style={[s.numInput, { borderColor: m.color + '40' }]}
                      value={m.value} onChangeText={m.set}
                      keyboardType="number-pad" maxLength={4}
                      placeholder="0" placeholderTextColor={COLORS.text.tertiary}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          {errorMessage ? <Text style={s.errorText}>{errorMessage}</Text> : null}
          {successMessage ? <Text style={s.successText}>{successMessage}</Text> : null}

          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={handleSave} disabled={saving} activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#000000" size="small" />
              : <Text style={s.saveBtnText}>Kaydet</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f6f6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },

  bmrCard: {
    backgroundColor: '#1a1a1a', borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  bmrLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  bmrValue: { fontSize: 32, fontWeight: '800',
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.brand.green },
  bmrUnit: { fontSize: 16, fontWeight: '400',
fontFamily: 'PlusJakartaSans_400Regular', color: 'rgba(255,255,255,0.6)' },
  tdeeText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  targetKcalBox: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14,
    alignItems: 'center', minWidth: 80,
  },
  targetKcalLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  targetKcalValue: { fontSize: 24, fontWeight: '800',
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#ffffff' },
  targetKcalUnit: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },

  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardLabel: { fontSize: 13, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  optionalTag: { fontSize: 11, fontWeight: '400',
fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.text.tertiary },

  // BMI
  bmiCategoryBadge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  bmiCategoryText: { fontSize: 11, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold'},
  bmiValue: { fontSize: 36, fontWeight: '800',
fontFamily: 'PlusJakartaSans_800ExtraBold'},
  bmiUnit: { fontSize: 13, color: COLORS.text.tertiary, marginBottom: 6 },
  bmiTrack: {
    height: 8, borderRadius: 4, backgroundColor: '#f0f0f0', overflow: 'hidden',
  },
  bmiFill: { height: '100%', borderRadius: 4 },
  bmiScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  bmiScaleText: { fontSize: 9, color: COLORS.text.tertiary, textAlign: 'center' },

  triRow: { flexDirection: 'row', gap: 8 },
  triCell: { flex: 1, gap: 6 },
  inputLabel: { fontSize: 11, color: COLORS.text.secondary, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold'},
  numInput: {
    height: 48, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)', backgroundColor: '#f6f6f6',
    paddingHorizontal: 10, fontSize: 18, fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000', textAlign: 'center',
  },

  activityList: { gap: 8 },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: '#f9f9f9',
  },
  activityRowActive: { borderColor: COLORS.brand.green, backgroundColor: '#f7fce6' },
  activityRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: '#d0d0d0', alignItems: 'center', justifyContent: 'center',
  },
  activityRadioActive: { borderColor: COLORS.brand.green },
  activityRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.brand.green },
  activityLabel: { fontSize: 14, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: '#000000' },
  activityDesc: { fontSize: 11, color: COLORS.text.tertiary, marginTop: 1 },

  macroCard: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
  },
  macroCell: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
  },
  macroCellValue: { fontSize: 15, fontWeight: '800',
fontFamily: 'PlusJakartaSans_800ExtraBold'},
  macroCellUnit: { fontSize: 10, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold'},
  macroCellLabel: { fontSize: 10, color: COLORS.text.tertiary, marginTop: 2 },

  macroToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 100,
    padding: 3,
    gap: 0,
  },
  macroToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 100,
  },
  macroToggleBtnActive: { backgroundColor: COLORS.brand.green },
  macroToggleBtnText: { fontSize: 12, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.secondary },
  macroToggleBtnTextActive: { color: '#000000' },

  customMacroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  customMacroCell: { width: '47%' },

  errorText: { fontSize: 13, color: MACRO_COLORS.fat.main, textAlign: 'center' },
  successText: { fontSize: 13, color: '#16A34A', textAlign: 'center', fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold'},
  saveBtn: {
    height: 56, borderRadius: 100, backgroundColor: COLORS.brand.green,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 16, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
});
