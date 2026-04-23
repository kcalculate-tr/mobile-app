import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Alert,
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
import {
  CaretLeft,
  CheckCircle,
  EyeIcon,
  EyeSlashIcon,
  MapPinIcon,
} from 'phosphor-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Location from 'expo-location';
import { getSupabaseClient } from '../../lib/supabase';
import { registerForPushNotifications, requestPushPermissionOnly } from '../../lib/notifications';
import { RootStackParamList } from '../../navigation/types';
import FormField, { FormFieldOption } from '../../components/FormField';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const loginRegisterImage = require('../../assets/login-register.webp');
const onboardingImage1 = require('../../assets/onboarding/onboarding-flow-1.webp');
const onboardingVideo2 = require('../../assets/onboarding/onboarding-flow-2.mp4');
const onboardingImage3 = require('../../assets/onboarding/onboarding-flow-3.webp');

const BRAND = '#C6F04F';
const BG = '#f6f6f6';
const BLACK = '#000000';
const WHITE = '#ffffff';
const GRAY_200 = '#e4e4e7';
const GRAY_400 = '#a1a1aa';
const GRAY_500 = '#71717a';
const GRAY_700 = '#3f3f46';
const TEXT_PRIMARY = '#1a1a1a';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ONBOARDING_FLAG = '@kcal_onboarding_done';

type Gender = 'male' | 'female' | '';
type Goal = 'lose' | 'maintain' | 'gain' | '';
type Activity = 'sedentary' | 'light' | 'moderate' | 'very_active' | '';

type AddressForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  district: string;
  neighbourhood: string;
  street: string;
  fullAddress: string;
  buildingNo: string;
  floor: string;
  apartmentNo: string;
};

const EMPTY_FORM: AddressForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  city: 'İzmir',
  district: '',
  neighbourhood: '',
  street: '',
  fullAddress: '',
  buildingNo: '',
  floor: '',
  apartmentNo: '',
};

const DotIndicator = ({ current, total = 4 }: { current: number; total?: number }) => (
  <View style={styles.dots}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={{
          width: i === current ? 24 : 6,
          height: 6,
          borderRadius: 100,
          backgroundColor: i === current ? BRAND : '#d4d4d8',
        }}
      />
    ))}
  </View>
);

const InfoStep = ({
  title,
  subtitle,
  bullets,
  gradientBg,
  onContinue,
  onBack,
  onSkip,
  continueLabel = 'Devam',
  continueStyle = 'secondary',
  current,
  showBack,
  mediaImage,
  mediaVideo,
}: {
  title: string;
  subtitle: string;
  bullets?: { emoji: string; label: string }[];
  gradientBg: string;
  onContinue: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  continueLabel?: string;
  continueStyle?: 'primary' | 'secondary';
  current: number;
  showBack?: boolean;
  mediaImage?: any;
  mediaVideo?: any;
}) => {
  const [videoLoading, setVideoLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(mediaVideo ?? null, (p) => {
    if (mediaVideo) {
      p.loop = true;
      p.muted = true;
      p.play();
      setVideoLoading(false);
    }
  });
  return (
    <View style={styles.root}>
      {mediaImage ? (
        <View style={{ position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
          <Image
            source={mediaImage}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
            resizeMode="cover"
          />
        </View>
      ) : mediaVideo ? (
        <View style={{ position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
          <VideoView
            player={player}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
            contentFit="cover"
            nativeControls={false}
          />
          {videoLoading && (
            <View style={{ position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={TEXT_PRIMARY} />
            </View>
          )}
        </View>
      ) : (
        <View style={{ position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: gradientBg }} />
      )}

      <LinearGradient
        colors={[
          'transparent',
          'rgba(255,255,255,0.5)',
          'rgba(255,255,255,0.95)',
          '#FFFFFF',
        ]}
        locations={[0.4, 0.55, 0.7, 0.85]}
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
      />

      {showBack && onBack ? (
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <CaretLeft size={18} color={TEXT_PRIMARY} weight="bold" />
        </TouchableOpacity>
      ) : null}
      {onSkip ? (
        <TouchableOpacity
          style={[styles.skipPill, { top: insets.top + 12, backgroundColor: 'rgba(255,255,255,0.85)' }]}
          onPress={onSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Atla</Text>
        </TouchableOpacity>
      ) : null}

      <View style={[styles.fullscreenBottom, { paddingBottom: insets.bottom + 8 }]}>
        <Text style={styles.infoTitleLg}>{title}</Text>
        <Text style={styles.infoSubtitle}>{subtitle}</Text>
        {bullets ? (
          <View style={styles.bulletsRow}>
            {bullets.map((b) => (
              <View key={b.label} style={styles.bulletItem}>
                <Text style={{ fontSize: 24 }}>{b.emoji}</Text>
                <Text style={styles.bulletText}>{b.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <TouchableOpacity
          style={continueStyle === 'primary' ? styles.primaryBtn : styles.secondaryBtn}
          onPress={onContinue}
          activeOpacity={0.85}
        >
          <Text
            style={continueStyle === 'primary' ? styles.primaryBtnText : styles.secondaryBtnText}
          >
            {continueLabel}
          </Text>
        </TouchableOpacity>
        <DotIndicator current={current} />
      </View>
    </View>
  );
};


export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  // Step 4 state
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [districtOptions, setDistrictOptions] = useState<FormFieldOption[]>([]);
  const [neighborhoodMap, setNeighborhoodMap] = useState<Record<string, FormFieldOption[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Step 5 state
  const [gender, setGender] = useState<Gender>('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<Goal>('');
  const [activity, setActivity] = useState<Activity>('');

  const refs = {
    lastName: useRef<TextInput>(null),
    email: useRef<TextInput>(null),
    password: useRef<TextInput>(null),
    phone: useRef<TextInput>(null),
    district: useRef<TextInput>(null),
    neighbourhood: useRef<TextInput>(null),
    street: useRef<TextInput>(null),
    fullAddress: useRef<TextInput>(null),
    buildingNo: useRef<TextInput>(null),
    floor: useRef<TextInput>(null),
    apartmentNo: useRef<TextInput>(null),
  };

  useEffect(() => {
    if (step !== 3) return;
    const supabase = getSupabaseClient();
    supabase
      .from('delivery_zones')
      .select('*')
      .order('district', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) return;
        const districtSet = new Set<string>();
        const nMap = new Map<string, Set<string>>();
        (data as Record<string, any>[]).forEach((row) => {
          const d = String(row.district ?? '').trim();
          if (!d) return;
          districtSet.add(d);
          const n = String(
            row.neighborhood ?? row.neighbourhood ?? row.mahalle ?? '',
          ).trim();
          if (!n) return;
          const set = nMap.get(d) ?? new Set<string>();
          set.add(n);
          nMap.set(d, set);
        });
        setDistrictOptions(
          Array.from(districtSet)
            .sort((a, b) => a.localeCompare(b, 'tr'))
            .map((d) => ({ label: d, value: d })),
        );
        const normalized: Record<string, FormFieldOption[]> = {};
        nMap.forEach((set, d) => {
          normalized[d] = Array.from(set)
            .sort((a, b) => a.localeCompare(b, 'tr'))
            .map((n) => ({ label: n, value: n }));
        });
        setNeighborhoodMap(normalized);
      });
  }, [step]);

  const neighborhoodOptions = useMemo(
    () => (form.district ? neighborhoodMap[form.district] ?? [] : []),
    [form.district, neighborhoodMap],
  );

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_FLAG, 'true');
    } catch {}
    // Native push permission popup — sessiz fail (reddedilirse akış devam eder)
    try {
      await requestPushPermissionOnly();
    } catch (e) {
      if (__DEV__) console.warn('[onboarding] push permission ask failed:', e);
    }
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  const skipToEnd = async () => {
    await finishOnboarding();
  };

  const requestLocation = async () => {
    setLocationStatus('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('idle');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const [addr] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (!addr) {
        setLocationStatus('idle');
        return;
      }

      const norm = (s?: string | null) =>
        (s ?? '').toLocaleLowerCase('tr').replace(/\s+mah(allesi)?$/i, '').trim();

      const districtCandidates = [addr.subregion, addr.district].filter(Boolean) as string[];
      let matchedDistrict = '';
      for (const cand of districtCandidates) {
        const hit = districtOptions.find((o) => norm(o.value) === norm(cand));
        if (hit) { matchedDistrict = hit.value; break; }
      }

      let matchedNeighbourhood = '';
      if (matchedDistrict) {
        const neighOpts = neighborhoodMap[matchedDistrict] ?? [];
        const neighCandidates = [addr.district, addr.name].filter(Boolean) as string[];
        for (const cand of neighCandidates) {
          const hit = neighOpts.find((o) => norm(o.value) === norm(cand));
          if (hit) { matchedNeighbourhood = hit.value; break; }
        }
      }

      const streetLine = [addr.street, addr.streetNumber].filter(Boolean).join(' ');
      const fullAddress = [streetLine, addr.name, addr.postalCode]
        .filter(Boolean)
        .join(', ');

      setForm((f) => {
        const districtChanged = matchedDistrict && matchedDistrict !== f.district;
        return {
          ...f,
          city: addr.region || addr.city || f.city || 'İzmir',
          district: matchedDistrict || f.district,
          neighbourhood: matchedNeighbourhood || (districtChanged ? '' : f.neighbourhood),
          fullAddress: fullAddress || f.fullAddress,
        };
      });
      setLocationStatus('done');
      setTimeout(() => setLocationStatus('idle'), 2000);
    } catch {
      setLocationStatus('idle');
    }
  };

  const handleRegister = async () => {
    if (!form.firstName.trim()) return Alert.alert('Uyarı', 'Ad zorunludur.');
    if (!form.lastName.trim()) return Alert.alert('Uyarı', 'Soyad zorunludur.');
    if (!form.email.trim()) return Alert.alert('Uyarı', 'E-posta zorunludur.');
    if (!form.password || form.password.length < 6)
      return Alert.alert('Uyarı', 'Şifre en az 6 karakter olmalı.');
    if (!form.phone.trim()) return Alert.alert('Uyarı', 'Telefon zorunludur.');

    setSubmitting(true);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
    });

    if (error) {
      setSubmitting(false);
      let message = error.message;
      if (/rate limit/i.test(error.message)) {
        message = 'Çok fazla deneme yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.';
      } else if (/already registered/i.test(error.message)) {
        message = 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.';
      } else if (/invalid email/i.test(error.message)) {
        message = 'Geçerli bir e-posta adresi girin.';
      } else if (/password/i.test(error.message)) {
        message = 'Şifre en az 6 karakter olmalıdır.';
      }
      Alert.alert('Hata', message);
      return;
    }

    if (data.user) {
      setUserId(data.user.id);

      await supabase.from('profiles').upsert({
        id: data.user.id,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim(),
      });

      if (form.district.trim() && form.street.trim()) {
        await supabase.from('addresses').insert({
          user_id: data.user.id,
          title: 'Ev',
          city: form.city || 'İzmir',
          district: form.district.trim(),
          neighbourhood: form.neighbourhood.trim() || '',
          street: form.street.trim() || '',
          full_address: form.fullAddress.trim() || '',
          building_no: form.buildingNo.trim() || '',
          floor: form.floor.trim() || '',
          apartment_no: form.apartmentNo.trim() || '',
          contact_name: `${form.firstName.trim()} ${form.lastName.trim()}`,
          contact_phone: form.phone.trim(),
          contact_email: form.email.trim(),
        });
      }
    }

    setSubmitting(false);
    await AsyncStorage.setItem('@kcal_needs_nutrition_profile', 'true');
    await AsyncStorage.setItem('@kcal_onboarding_done', 'true');
    // Onboarding-içi register: izin ister + token kaydeder (auth oluştu)
    registerForPushNotifications().catch(() => {
      // izin reddi sessiz — akışı bozmasın
    });
    navigation.reset({
      index: 0,
      routes: [{ name: 'EmailVerification', params: { email: form.email.trim() } }],
    });
  };

  const handleProfileSubmit = async () => {
    if (!userId) {
      await finishOnboarding();
      return;
    }
    const supabase = getSupabaseClient();
    const updates: Record<string, any> = {};
    if (gender) updates.gender = gender;
    if (age) updates.age = parseInt(age, 10);
    if (height) updates.height = parseInt(height, 10);
    if (weight) updates.weight = parseInt(weight, 10);
    if (goal) updates.goal = goal;
    if (activity) updates.activity_level = activity;

    if (height && weight && age && gender && activity) {
      const h = parseInt(height, 10);
      const w = parseInt(weight, 10);
      const a = parseInt(age, 10);
      const bmr = gender === 'male'
        ? 10 * w + 6.25 * h - 5 * a + 5
        : 10 * w + 6.25 * h - 5 * a - 161;
      const mult: Record<string, number> = {
        sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725,
      };
      const goalAdj: Record<string, number> = { lose: -500, maintain: 0, gain: 300 };
      const tdee = bmr * (mult[activity] || 1.375);
      updates.daily_calorie_goal = Math.round(tdee + (goalAdj[goal] ?? 0));
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('profiles').update(updates).eq('id', userId);
    }
    await finishOnboarding();
  };

  // ─── Step 0: Welcome ───
  if (step === 0) {
    return (
      <InfoStep
        current={0}
        gradientBg="#EFFBD5"
        mediaImage={onboardingImage1}
        title="Sağlıklı beslenmenin en lezzetli hali"
        subtitle="Makro hesaplı, taze hazırlanan öğünler kapında. Sen sadece seç, gerisini biz halledelim."
        continueLabel="Başlayalım"
        continueStyle="primary"
        onContinue={() => setStep(1)}
        onSkip={skipToEnd}
      />
    );
  }

  // ─── Step 1: How it works ───
  if (step === 1) {
    return (
      <InfoStep
        current={1}
        gradientBg="#FEF3C7"
        mediaVideo={onboardingVideo2}
        title="Seç, hazırlansın, kapına gelsin"
        subtitle="Protein, kalori ve besin değerleri hesaplanmış öğünlerden seç. Taze taze hazırlayıp sana ulaştıralım."
        showBack
        onBack={() => setStep(0)}
        onContinue={() => setStep(2)}
        onSkip={skipToEnd}
      />
    );
  }

  // ─── Step 2: Kcalculate ───
  if (step === 2) {
    return (
      <InfoStep
        current={2}
        gradientBg="#DCFCE7"
        mediaImage={onboardingImage3}
        title="Kalorini takip et, hedefine ulaş"
        subtitle="Kcalculate ile günlük kalori, protein, karbonhidrat ve yağ alımını kolayca izle. Haftalık raporlarla gelişimini gör."
        showBack
        onBack={() => setStep(1)}
        onContinue={() => setStep(3)}
        onSkip={skipToEnd}
      />
    );
  }

  // ─── Step 3: Register + Address ───
  if (step === 3) {
    return (
      <View style={[styles.root, { backgroundColor: '#FFFFFF' }]}>
        <TouchableOpacity
          style={[styles.backBtn, { position: 'absolute', top: insets.top + 12, left: 20, zIndex: 10 }]}
          onPress={() => setStep(2)}
          activeOpacity={0.7}
        >
          <CaretLeft size={18} color={TEXT_PRIMARY} weight="bold" />
        </TouchableOpacity>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={{ width: '100%', height: SCREEN_HEIGHT * 0.28 }}>
              <Image
                source={loginRegisterImage}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', '#FFFFFF']}
                pointerEvents="none"
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}
              />
            </View>
            <View style={{ paddingHorizontal: 24, paddingTop: 24, backgroundColor: '#FFFFFF', marginTop: -1 }}>
              <Text style={[styles.formTitle, { marginTop: 0 }]}>Hesabını oluştur</Text>
              <Text style={styles.formSub}>Bilgilerini gir, hemen siparişe başla</Text>

            {/* Ad - Soyad */}
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ad</Text>
                <TextInput
                  style={styles.input}
                  value={form.firstName}
                  onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))}
                  placeholder="Ad"
                  placeholderTextColor={GRAY_400}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => refs.lastName.current?.focus()}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Soyad</Text>
                <TextInput
                  ref={refs.lastName}
                  style={styles.input}
                  value={form.lastName}
                  onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))}
                  placeholder="Soyad"
                  placeholderTextColor={GRAY_400}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => refs.email.current?.focus()}
                />
              </View>
            </View>

            <Text style={styles.label}>E-posta</Text>
            <TextInput
              ref={refs.email}
              style={styles.input}
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder="ornek@mail.com"
              placeholderTextColor={GRAY_400}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refs.password.current?.focus()}
            />

            <Text style={styles.label}>Şifre</Text>
            <View style={styles.passRow}>
              <TextInput
                ref={refs.password}
                style={[styles.input, { flex: 1, marginTop: 0 }]}
                value={form.password}
                onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                placeholder="En az 6 karakter"
                placeholderTextColor={GRAY_400}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => refs.phone.current?.focus()}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                activeOpacity={0.7}
              >
                {showPassword ? (
                  <EyeSlashIcon size={18} color={GRAY_500} />
                ) : (
                  <EyeIcon size={18} color={GRAY_500} />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Telefon</Text>
            <TextInput
              ref={refs.phone}
              style={styles.input}
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              placeholder="05XX XXX XX XX"
              placeholderTextColor={GRAY_400}
              keyboardType="phone-pad"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refs.street.current?.focus()}
            />

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Teslimat Adresi</Text>
              <TouchableOpacity
                onPress={requestLocation}
                disabled={locationStatus === 'loading'}
                style={styles.locationLink}
                activeOpacity={0.7}
              >
                {locationStatus === 'loading' ? (
                  <ActivityIndicator size="small" color={GRAY_500} />
                ) : locationStatus === 'done' ? (
                  <CheckCircle size={16} color="#4ade80" weight="fill" />
                ) : (
                  <MapPinIcon size={16} color={GRAY_400} weight="fill" />
                )}
                <Text
                  style={[
                    styles.locationLinkText,
                    locationStatus === 'done' && { color: '#4ade80' },
                  ]}
                >
                  {locationStatus === 'loading'
                    ? 'Konum alınıyor...'
                    : locationStatus === 'done'
                    ? 'Konum alındı'
                    : 'Konum doğrula'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>İl</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value="İzmir"
              editable={false}
            />

            <View style={{ marginTop: 12 }}>
              <FormField
                label="İlçe"
                value={form.district}
                onChangeText={(v) =>
                  setForm((f) => ({
                    ...f,
                    district: v,
                    neighbourhood: v !== f.district ? '' : f.neighbourhood,
                  }))
                }
                placeholder="İlçe seçin"
                type="select"
                options={districtOptions}
                editable={districtOptions.length > 0}
              />
            </View>

            <View>
              <FormField
                label="Mahalle"
                value={form.neighbourhood}
                onChangeText={(v) => setForm((f) => ({ ...f, neighbourhood: v }))}
                placeholder="Mahalle seçin"
                type="select"
                options={neighborhoodOptions}
                editable={Boolean(form.district) && neighborhoodOptions.length > 0}
              />
            </View>

            <Text style={styles.label}>Cadde / Sokak</Text>
            <TextInput
              ref={refs.street}
              style={styles.input}
              value={form.street}
              onChangeText={(v) => setForm((f) => ({ ...f, street: v }))}
              placeholder="Cadde veya sokak"
              placeholderTextColor={GRAY_400}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refs.fullAddress.current?.focus()}
            />

            <Text style={styles.label}>Açık Adres</Text>
            <TextInput
              ref={refs.fullAddress}
              style={[styles.input, styles.inputMulti]}
              value={form.fullAddress}
              onChangeText={(v) => setForm((f) => ({ ...f, fullAddress: v }))}
              placeholder="Detaylı adres"
              placeholderTextColor={GRAY_400}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.row3}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>No</Text>
                <TextInput
                  ref={refs.buildingNo}
                  style={styles.input}
                  value={form.buildingNo}
                  onChangeText={(v) => setForm((f) => ({ ...f, buildingNo: v }))}
                  placeholder="No"
                  placeholderTextColor={GRAY_400}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => refs.floor.current?.focus()}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Kat</Text>
                <TextInput
                  ref={refs.floor}
                  style={styles.input}
                  value={form.floor}
                  onChangeText={(v) => setForm((f) => ({ ...f, floor: v }))}
                  placeholder="Kat"
                  placeholderTextColor={GRAY_400}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => refs.apartmentNo.current?.focus()}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Daire</Text>
                <TextInput
                  ref={refs.apartmentNo}
                  style={styles.input}
                  value={form.apartmentNo}
                  onChangeText={(v) => setForm((f) => ({ ...f, apartmentNo: v }))}
                  placeholder="Daire"
                  placeholderTextColor={GRAY_400}
                  returnKeyType="done"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={TEXT_PRIMARY} />
              ) : (
                <Text style={styles.primaryBtnText}>Hesabı Oluştur</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Zaten hesabın var mı? </Text>
              <TouchableOpacity
                onPress={async () => {
                  await AsyncStorage.setItem(ONBOARDING_FLAG, 'true');
                  try {
                    await requestPushPermissionOnly();
                  } catch {}
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.loginLink}>Giriş Yap</Text>
              </TouchableOpacity>
            </View>

            <DotIndicator current={3} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  topHalf: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
  fullscreenBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  infoTitleLg: {
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroMedia: {
    flex: 1,
    width: '100%',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  heroContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  logoText: {
    fontSize: 52,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: BLACK,
    letterSpacing: -1,
  },
  logoSub: {
    fontSize: 13,
    color: GRAY_400,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  bulletsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 20,
  },
  bulletItem: {
    alignItems: 'center',
    gap: 6,
  },
  bulletText: {
    fontSize: 12,
    color: GRAY_700,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  bottomHalf: {
    backgroundColor: BG,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: BLACK,
    textAlign: 'center',
    marginBottom: 10,
  },
  infoSubtitle: {
    fontSize: 15,
    color: GRAY_500,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: TEXT_PRIMARY,
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: BLACK,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: WHITE,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  // Form
  formTopBar: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: BLACK,
    marginBottom: 6,
  },
  formSub: {
    fontSize: 14,
    color: GRAY_500,
    marginBottom: 20,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: GRAY_200,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  locationCardActive: {
    borderColor: BRAND,
    backgroundColor: 'rgba(198,240,79,0.08)',
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: TEXT_PRIMARY,
  },
  locationSub: {
    fontSize: 12,
    color: GRAY_500,
    marginTop: 2,
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
    color: TEXT_PRIMARY,
  },
  inputDisabled: {
    backgroundColor: '#f4f4f5',
    color: GRAY_500,
  },
  inputMulti: {
    height: 84,
    paddingTop: 12,
  },
  row2: {
    flexDirection: 'row',
    gap: 10,
  },
  row3: {
    flexDirection: 'row',
    gap: 10,
  },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyeBtn: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GRAY_200,
    backgroundColor: WHITE,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: TEXT_PRIMARY,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 4,
  },
  locationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  locationLinkText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: GRAY_500,
  },
  step3Banner: {
    height: 160,
    backgroundColor: 'rgba(198,240,79,0.08)',
    position: 'relative',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  loginText: { fontSize: 14, color: GRAY_500 },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: TEXT_PRIMARY,
  },
  // Toggle
  toggleBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GRAY_200,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    borderColor: BRAND,
    backgroundColor: BRAND,
  },
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
  },
  skipUnder: {
    fontSize: 14,
    color: GRAY_400,
    textDecorationLine: 'underline',
    marginTop: 4,
  },
});
