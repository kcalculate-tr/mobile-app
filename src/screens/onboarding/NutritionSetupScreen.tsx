import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/types';

const BRAND = '#C6F04F';
const BG = '#f6f6f6';
const WHITE = '#ffffff';
const GRAY_200 = '#e4e4e7';
const GRAY_400 = '#a1a1aa';
const GRAY_500 = '#71717a';
const GRAY_700 = '#3f3f46';
const TEXT_PRIMARY = '#1a1a1a';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Gender = 'male' | 'female' | '';
type Goal = 'lose_weight' | 'maintain' | 'gain_weight' | '';
type Activity = 'low' | 'medium' | 'high' | '';

const ACTIVITY_MULT: Record<string, number> = { low: 1.2, medium: 1.55, high: 1.725 };

export default function NutritionSetupScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [gender, setGender] = useState<Gender>('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<Goal>('');
  const [activity, setActivity] = useState<Activity>('');

  const finish = async () => {
    await AsyncStorage.setItem('@kcal_onboarding_done', 'true');
    await AsyncStorage.removeItem('@kcal_needs_nutrition_profile');
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      await finish();
      return;
    }
    const supabase = getSupabaseClient();
    const row: Record<string, any> = { user_id: user.id };
    if (gender) row.gender = gender;
    if (age) row.age = parseInt(age, 10);
    if (height) row.height = parseInt(height, 10);
    if (weight) row.weight = parseInt(weight, 10);
    if (goal) row.goal = goal;
    if (activity) row.activity_level = activity;

    if (gender && age && height && weight && goal && activity) {
      const h = parseInt(height, 10);
      const w = parseInt(weight, 10);
      const a = parseInt(age, 10);
      const bmr = gender === 'male'
        ? 10 * w + 6.25 * h - 5 * a + 5
        : 10 * w + 6.25 * h - 5 * a - 161;
      const tdee = bmr * (ACTIVITY_MULT[activity] ?? 1.55);
      const target = goal === 'lose_weight' ? tdee - 500 : goal === 'gain_weight' ? tdee + 500 : tdee;
      row.target_calories = Math.round(target);
    }

    await supabase.from('user_nutrition_profiles').upsert(row);
    await finish();
  };

  const ToggleBtn = ({
    active, label, onPress, height: h = 48,
  }: { active: boolean; label: string; onPress: () => void; height?: number }) => (
    <Pressable
      onPress={onPress}
      style={[s.toggleBtn, { height: h }, active && s.toggleBtnActive]}
    >
      <Text style={[s.toggleBtnText, active && s.toggleBtnTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={s.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.banner, { paddingTop: insets.top + 12 }]}>
            <LinearGradient
              colors={['rgba(198,240,79,0.12)', 'transparent']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <TouchableOpacity
              style={[s.skipPill, { top: insets.top + 12 }]}
              onPress={finish}
              activeOpacity={0.7}
            >
              <Text style={s.skipText}>Şimdilik Geç</Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 24 }}>
            <Text style={s.title}>Beslenme profilini oluştur</Text>
            <Text style={s.sub}>Sana özel kalori hedefi belirleyelim</Text>

            <Text style={s.label}>Cinsiyet</Text>
            <View style={s.row2}>
              <ToggleBtn active={gender === 'male'} label="Erkek" onPress={() => setGender('male')} />
              <ToggleBtn active={gender === 'female'} label="Kadın" onPress={() => setGender('female')} />
            </View>

            <View style={s.row3}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Yaş</Text>
                <TextInput
                  style={s.input}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  placeholder=""
                  placeholderTextColor={GRAY_400}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Boy (cm)</Text>
                <TextInput
                  style={s.input}
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="number-pad"
                  placeholder=""
                  placeholderTextColor={GRAY_400}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Kilo (kg)</Text>
                <TextInput
                  style={s.input}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="number-pad"
                  placeholder=""
                  placeholderTextColor={GRAY_400}
                />
              </View>
            </View>

            <Text style={s.label}>Hedef</Text>
            <View style={s.row3}>
              <ToggleBtn active={goal === 'lose_weight'} label="Kilo Ver" onPress={() => setGoal('lose_weight')} height={44} />
              <ToggleBtn active={goal === 'maintain'} label="Kiloyu Koru" onPress={() => setGoal('maintain')} height={44} />
              <ToggleBtn active={goal === 'gain_weight'} label="Kilo Al" onPress={() => setGoal('gain_weight')} height={44} />
            </View>

            <Text style={s.label}>Aktivite Seviyesi</Text>
            {[
              { v: 'low' as const, l: 'Az Hareketli', d: 'Masa başı, az egzersiz' },
              { v: 'medium' as const, l: 'Orta', d: 'Hafta 3-4 gün egzersiz' },
              { v: 'high' as const, l: 'Aktif', d: 'Her gün yoğun egzersiz' },
            ].map((opt) => {
              const active = activity === opt.v;
              return (
                <Pressable
                  key={opt.v}
                  onPress={() => setActivity(opt.v)}
                  style={[s.activityCard, active && s.activityCardActive]}
                >
                  <Text style={[s.activityLabel, active && { color: TEXT_PRIMARY }]}>{opt.l}</Text>
                  <Text style={s.activityDesc}>{opt.d}</Text>
                </Pressable>
              );
            })}

            <TouchableOpacity style={s.primaryBtn} onPress={handleSubmit} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Profilimi Oluştur</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  banner: {
    height: 160,
    backgroundColor: 'rgba(198,240,79,0.08)',
  },
  skipPill: {
    position: 'absolute',
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
    zIndex: 10,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: GRAY_500,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    color: GRAY_500,
    fontFamily: 'PlusJakartaSans_400Regular',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: GRAY_700,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GRAY_200,
    backgroundColor: WHITE,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: TEXT_PRIMARY,
  },
  row2: { flexDirection: 'row', gap: 10 },
  row3: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: TEXT_PRIMARY,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GRAY_200,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: { borderColor: BRAND, backgroundColor: BRAND },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: GRAY_500,
  },
  toggleBtnTextActive: {
    color: TEXT_PRIMARY,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  activityCard: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: GRAY_200,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  activityCardActive: {
    borderColor: BRAND,
    backgroundColor: 'rgba(198,240,79,0.08)',
  },
  activityLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  activityDesc: {
    fontSize: 13,
    color: GRAY_500,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
});
