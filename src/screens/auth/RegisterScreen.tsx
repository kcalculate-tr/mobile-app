import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const loginRegisterImage = require('../../assets/login-register.webp');
import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import {
  CaretLeft,
  CheckCircle,
  EyeIcon,
  EyeSlashIcon,
  MapPinIcon,
} from 'phosphor-react-native';
import { getSupabaseClient } from '../../lib/supabase';
import { registerForPushNotifications } from '../../lib/notifications';
import { RootStackParamList } from '../../navigation/types';
import FormField, { FormFieldOption } from '../../components/FormField';

const BRAND = '#C6F04F';
const BG = '#f6f6f6';
const WHITE = '#ffffff';
const GRAY_200 = '#e4e4e7';
const GRAY_400 = '#a1a1aa';
const GRAY_500 = '#71717a';
const GRAY_700 = '#3f3f46';
const TEXT_PRIMARY = '#1a1a1a';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
  firstName: '', lastName: '', email: '', password: '', phone: '',
  city: 'İzmir', district: '', neighbourhood: '', street: '', fullAddress: '',
  buildingNo: '', floor: '', apartmentNo: '',
};

export default function RegisterScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [districtOptions, setDistrictOptions] = useState<FormFieldOption[]>([]);
  const [neighborhoodMap, setNeighborhoodMap] = useState<Record<string, FormFieldOption[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const refs = {
    lastName: useRef<TextInput>(null),
    email: useRef<TextInput>(null),
    password: useRef<TextInput>(null),
    phone: useRef<TextInput>(null),
    street: useRef<TextInput>(null),
    fullAddress: useRef<TextInput>(null),
    buildingNo: useRef<TextInput>(null),
    floor: useRef<TextInput>(null),
    apartmentNo: useRef<TextInput>(null),
  };

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase
      .from('delivery_zones')
      .select('*')
      .order('district', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) return;
        const dSet = new Set<string>();
        const nMap = new Map<string, Set<string>>();
        (data as Record<string, any>[]).forEach((row) => {
          const d = String(row.district ?? '').trim();
          if (!d) return;
          dSet.add(d);
          const n = String(row.neighborhood ?? row.neighbourhood ?? row.mahalle ?? '').trim();
          if (!n) return;
          const set = nMap.get(d) ?? new Set<string>();
          set.add(n);
          nMap.set(d, set);
        });
        setDistrictOptions(
          Array.from(dSet).sort((a, b) => a.localeCompare(b, 'tr')).map((d) => ({ label: d, value: d })),
        );
        const normalized: Record<string, FormFieldOption[]> = {};
        nMap.forEach((set, d) => {
          normalized[d] = Array.from(set).sort((a, b) => a.localeCompare(b, 'tr')).map((n) => ({ label: n, value: n }));
        });
        setNeighborhoodMap(normalized);
      });
  }, []);

  const neighborhoodOptions = useMemo(
    () => (form.district ? neighborhoodMap[form.district] ?? [] : []),
    [form.district, neighborhoodMap],
  );

  const requestLocation = async () => {
    setLocationStatus('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationStatus('idle'); return; }
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
    if (!form.password || form.password.length < 6) return Alert.alert('Uyarı', 'Şifre en az 6 karakter olmalı.');
    if (!form.phone.trim()) return Alert.alert('Uyarı', 'Telefon zorunludur.');
    if (!termsAccepted) return Alert.alert('Uyarı', 'Devam etmek için kullanım koşullarını kabul etmelisiniz.');

    setSubmitting(true);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
    });

    if (error) {
      setSubmitting(false);
      let message = error.message;
      if (/rate limit/i.test(error.message)) message = 'Çok fazla deneme yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.';
      else if (/already registered/i.test(error.message)) message = 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.';
      else if (/invalid email/i.test(error.message)) message = 'Geçerli bir e-posta adresi girin.';
      else if (/password/i.test(error.message)) message = 'Şifre en az 6 karakter olmalıdır.';
      Alert.alert('Hata', message);
      return;
    }

    if (data.user) {
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
    // Push token register — best-effort, akışı bloklama
    registerForPushNotifications().catch(() => {});
    navigation.reset({
      index: 0,
      routes: [{ name: 'EmailVerification', params: { email: form.email.trim() } }],
    });
  };

  return (
    <View style={[s.root, { backgroundColor: '#FFFFFF' }]}>
      <TouchableOpacity
        style={[s.backBtn, { position: 'absolute', top: insets.top + 12, left: 20, zIndex: 10 }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <CaretLeft size={18} color={TEXT_PRIMARY} weight="bold" />
      </TouchableOpacity>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={{ width: '100%', height: SCREEN_HEIGHT * 0.28 }}>
            <Image source={loginRegisterImage} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', '#FFFFFF']}
              pointerEvents="none"
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}
            />
          </View>
          <View style={{ paddingHorizontal: 24, paddingTop: 24, backgroundColor: '#FFFFFF', marginTop: -1 }}>
            <Text style={s.title}>Hesap Oluştur</Text>
            <Text style={s.sub}>Bugün sağlıklı beslenme yolculuğuna başla</Text>

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Ad</Text>
                <TextInput
                  style={s.input}
                  value={form.firstName}
                  onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))}
                  placeholder="Ad"
                  placeholderTextColor={GRAY_400}
                  returnKeyType="next"
                  onSubmitEditing={() => refs.lastName.current?.focus()}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Soyad</Text>
                <TextInput
                  ref={refs.lastName}
                  style={s.input}
                  value={form.lastName}
                  onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))}
                  placeholder="Soyad"
                  placeholderTextColor={GRAY_400}
                  returnKeyType="next"
                  onSubmitEditing={() => refs.email.current?.focus()}
                />
              </View>
            </View>

            <Text style={s.label}>E-posta</Text>
            <TextInput
              ref={refs.email}
              style={s.input}
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder="ornek@mail.com"
              placeholderTextColor={GRAY_400}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => refs.password.current?.focus()}
            />

            <Text style={s.label}>Şifre</Text>
            <View style={s.passRow}>
              <TextInput
                ref={refs.password}
                style={[s.input, { flex: 1, marginTop: 0 }]}
                value={form.password}
                onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                placeholder="En az 6 karakter"
                placeholderTextColor={GRAY_400}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => refs.phone.current?.focus()}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword((v) => !v)} activeOpacity={0.7}>
                {showPassword ? <EyeSlashIcon size={18} color={GRAY_500} /> : <EyeIcon size={18} color={GRAY_500} />}
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Telefon</Text>
            <TextInput
              ref={refs.phone}
              style={s.input}
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              placeholder="05XX XXX XX XX"
              placeholderTextColor={GRAY_400}
              keyboardType="phone-pad"
              returnKeyType="next"
              onSubmitEditing={() => refs.street.current?.focus()}
            />

            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Teslimat Adresi</Text>
              <TouchableOpacity
                onPress={requestLocation}
                disabled={locationStatus === 'loading'}
                style={s.locationLink}
                activeOpacity={0.7}
              >
                {locationStatus === 'loading' ? (
                  <ActivityIndicator size="small" color={GRAY_500} />
                ) : locationStatus === 'done' ? (
                  <CheckCircle size={16} color="#4ade80" weight="fill" />
                ) : (
                  <MapPinIcon size={16} color={GRAY_400} weight="fill" />
                )}
                <Text style={[s.locationLinkText, locationStatus === 'done' && { color: '#4ade80' }]}>
                  {locationStatus === 'loading' ? 'Konum alınıyor...' : locationStatus === 'done' ? 'Konum alındı' : 'Konum doğrula'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={s.label}>İl</Text>
            <TextInput style={[s.input, s.inputDisabled]} value="İzmir" editable={false} />

            <View style={{ marginTop: 12 }}>
              <FormField
                label="İlçe"
                value={form.district}
                onChangeText={(v) =>
                  setForm((f) => ({ ...f, district: v, neighbourhood: v !== f.district ? '' : f.neighbourhood }))
                }
                placeholder="İlçe seçin"
                type="select"
                options={districtOptions}
                editable={districtOptions.length > 0}
              />
            </View>

            <FormField
              label="Mahalle"
              value={form.neighbourhood}
              onChangeText={(v) => setForm((f) => ({ ...f, neighbourhood: v }))}
              placeholder="Mahalle seçin"
              type="select"
              options={neighborhoodOptions}
              editable={Boolean(form.district) && neighborhoodOptions.length > 0}
            />

            <Text style={s.label}>Cadde / Sokak</Text>
            <TextInput
              ref={refs.street}
              style={s.input}
              value={form.street}
              onChangeText={(v) => setForm((f) => ({ ...f, street: v }))}
              placeholder="Cadde veya sokak"
              placeholderTextColor={GRAY_400}
              returnKeyType="next"
              onSubmitEditing={() => refs.fullAddress.current?.focus()}
            />

            <Text style={s.label}>Açık Adres</Text>
            <TextInput
              ref={refs.fullAddress}
              style={[s.input, s.inputMulti]}
              value={form.fullAddress}
              onChangeText={(v) => setForm((f) => ({ ...f, fullAddress: v }))}
              placeholder="Detaylı adres"
              placeholderTextColor={GRAY_400}
              multiline
              textAlignVertical="top"
            />

            <View style={s.row3}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>No</Text>
                <TextInput
                  ref={refs.buildingNo}
                  style={s.input}
                  value={form.buildingNo}
                  onChangeText={(v) => setForm((f) => ({ ...f, buildingNo: v }))}
                  placeholder="No"
                  placeholderTextColor={GRAY_400}
                  returnKeyType="next"
                  onSubmitEditing={() => refs.floor.current?.focus()}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Kat</Text>
                <TextInput
                  ref={refs.floor}
                  style={s.input}
                  value={form.floor}
                  onChangeText={(v) => setForm((f) => ({ ...f, floor: v }))}
                  placeholder="Kat"
                  placeholderTextColor={GRAY_400}
                  returnKeyType="next"
                  onSubmitEditing={() => refs.apartmentNo.current?.focus()}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Daire</Text>
                <TextInput
                  ref={refs.apartmentNo}
                  style={s.input}
                  value={form.apartmentNo}
                  onChangeText={(v) => setForm((f) => ({ ...f, apartmentNo: v }))}
                  placeholder="Daire"
                  placeholderTextColor={GRAY_400}
                  returnKeyType="done"
                />
              </View>
            </View>

            <TouchableOpacity style={s.termsRow} onPress={() => setTermsAccepted((v) => !v)} activeOpacity={0.8}>
              <View style={[s.termsCheck, !termsAccepted && s.termsCheckEmpty]}>
                {termsAccepted && <Text style={s.termsCheckMark}>✓</Text>}
              </View>
              <Text style={s.termsText}>
                <Text
                  style={s.termsLink}
                  onPress={() =>
                    WebBrowser.openBrowserAsync('https://eatkcal.com/sozlesmeler/kullanim-kosullari', {
                      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                    })
                  }
                >
                  Kullanım Koşulları
                </Text>
                {"'nı ve "}
                <Text
                  style={s.termsLink}
                  onPress={() =>
                    WebBrowser.openBrowserAsync('https://eatkcal.com/sozlesmeler/gizlilik-politikasi', {
                      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                    })
                  }
                >
                  Gizlilik Politikası
                </Text>
                {"'nı okudum, kabul ediyorum"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.primaryBtn, submitting && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={TEXT_PRIMARY} />
              ) : (
                <Text style={s.primaryBtnText}>Hesabı Oluştur</Text>
              )}
            </TouchableOpacity>

            <View style={s.loginRow}>
              <Text style={s.loginText}>Zaten hesabın var mı? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                <Text style={s.loginLink}>Giriş Yap</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  backBtn: {
    marginLeft: 20,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  logoImg: { width: 100, height: 40, marginTop: 8, marginBottom: 12 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
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
  inputDisabled: {
    backgroundColor: '#f4f4f5',
    color: GRAY_500,
  },
  inputMulti: {
    height: 84,
    paddingTop: 12,
  },
  row2: { flexDirection: 'row', gap: 10 },
  row3: { flexDirection: 'row', gap: 10 },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: TEXT_PRIMARY,
  },
  locationLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  locationLinkText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: GRAY_500,
  },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4, marginTop: 20 },
  termsCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  termsCheckEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  termsCheckMark: { fontSize: 12, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  termsText: { flex: 1, fontSize: 13, color: GRAY_500, lineHeight: 19 },
  termsLink: { color: TEXT_PRIMARY, fontWeight: '600', fontFamily: 'PlusJakartaSans_600SemiBold' },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: TEXT_PRIMARY,
  },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginText: { fontSize: 14, color: GRAY_500 },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: TEXT_PRIMARY,
  },
});
