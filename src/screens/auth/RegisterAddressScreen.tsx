import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { MapPin } from 'phosphor-react-native';
import { BackgroundLayer } from '../../components/onboarding/BackgroundLayer';
import { TopBar } from '../../components/onboarding/TopBar';
import { GlassInput } from '../../components/onboarding/GlassInput';
import { GlassPicker, PickerOption } from '../../components/onboarding/GlassPicker';
import { GlassButton } from '../../components/onboarding/GlassButton';
import { PrimaryCTA } from '../../components/onboarding/PrimaryCTA';
import { sportive } from '../../theme/sportive';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useNavGate } from '../../store/navGateStore';
import { getSupabaseClient } from '../../lib/supabase';

const norm = (s: string) => s.trim().toLocaleLowerCase('tr');

export default function RegisterAddressScreen() {
  const nav = useNavigation();
  const { firstName, lastName, phone, email, setAddress, reset } = useOnboardingStore();
  const [ilce, setIlce] = useState('');
  const [mahalle, setMahalle] = useState('');
  const [street, setStreet] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [districtOptions, setDistrictOptions] = useState<PickerOption[]>([]);
  const [neighborhoodMap, setNeighborhoodMap] = useState<Record<string, PickerOption[]>>({});
  const [errors, setErrors] = useState<{ ilce?: string; mahalle?: string; street?: string; fullAddress?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

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
        const normalized: Record<string, PickerOption[]> = {};
        nMap.forEach((set, d) => {
          normalized[d] = Array.from(set).sort((a, b) => a.localeCompare(b, 'tr')).map((n) => ({ label: n, value: n }));
        });
        setNeighborhoodMap(normalized);
      });
  }, []);

  const neighborhoodOptions = useMemo(
    () => (ilce ? neighborhoodMap[ilce] ?? [] : []),
    [ilce, neighborhoodMap],
  );

  const handleSelectIlce = (v: string) => {
    setIlce(v);
    if (v !== ilce) setMahalle('');
  };

  const handleUseLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin gerekli', 'Konumunu kullanmak için izin vermelisin.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const [geo] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (geo) {
        const dCands = [geo.subregion, geo.district].filter(Boolean) as string[];
        const dHit = districtOptions.find((o) => dCands.some((c) => norm(o.value) === norm(c)));
        if (dHit) {
          setIlce(dHit.value);
          const nOpts = neighborhoodMap[dHit.value] ?? [];
          const nCands = [geo.district, geo.name].filter(Boolean) as string[];
          const nHit = nOpts.find((o) => nCands.some((c) => norm(o.value) === norm(c)));
          if (nHit) setMahalle(nHit.value);
        }
        const composedStreet = [geo.street, geo.name].filter(Boolean).join(' ');
        if (composedStreet) setStreet(composedStreet);
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message ?? 'Konum alınamadı.');
    } finally {
      setLocating(false);
    }
  };

  const canSubmit =
    Boolean(ilce.trim()) &&
    Boolean(mahalle.trim()) &&
    Boolean(street.trim()) &&
    Boolean(fullAddress.trim());

  const handleSubmit = async () => {
    const e: typeof errors = {};
    if (!ilce.trim()) e.ilce = 'Bu alan zorunlu.';
    if (!mahalle.trim()) e.mahalle = 'Bu alan zorunlu.';
    if (!street.trim()) e.street = 'Bu alan zorunlu.';
    if (!fullAddress.trim()) e.fullAddress = 'Bu alan zorunlu.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) {
        setErrors({ general: 'Oturum bulunamadı. Tekrar dene.' });
        return;
      }

      setAddress({ il: 'İzmir', ilce: ilce.trim(), mahalle: mahalle.trim(), street: street.trim(), fullAddress: fullAddress.trim() });

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone,
        })
        .eq('id', userId);
      if (profileError) throw profileError;

      const { error: addressError } = await supabase.from('addresses').insert({
        user_id: userId,
        title: 'Ev',
        city: 'İzmir',
        district: ilce.trim(),
        neighbourhood: mahalle.trim(),
        street: street.trim(),
        full_address: fullAddress.trim(),
        contact_name: `${firstName} ${lastName}`,
        contact_phone: phone,
        contact_email: email,
      });
      if (addressError) throw addressError;

      reset();
      // Kayıt bitti, beslenme adımına geçiyoruz. needsNutrition='true' yap
      // ki bayat @kcal_onboarding_done='true' olsa bile gate kullanıcıyı
      // OnboardingStack'te tutsun. `registering` burada TEMİZLENMEZ —
      // beslenme akışının state-driven çıkışı (NutritionSummary / skip)
      // temizler; aksi halde bu render frame'inde gate açılıp stack
      // sökülürdü. nav.navigate stack-içi (OnboardingStack zaten mount).
      await AsyncStorage.setItem('@kcal_needs_nutrition_profile', 'true');
      useNavGate.getState().refresh();
      nav.navigate('NutritionGender' as never);
    } catch (err: any) {
      setErrors({ general: err?.message ?? 'Kayıt tamamlanamadı.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <BackgroundLayer mode="blur">
      <SafeAreaView style={styles.safe}>
        <TopBar showBack pageIndicator="03 / 03" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <Text style={styles.h1}>Nereye teslim edelim?</Text>
              <Text style={styles.sub}>Kapına hızlı teslimat için adresine ihtiyacımız var.</Text>

              <View style={{ marginTop: 20 }}>
                <GlassButton
                  label={locating ? 'Konum alınıyor…' : 'Konumumu kullan'}
                  icon={<MapPin size={16} color="#FFF" weight="bold" />}
                  onPress={handleUseLocation}
                  disabled={locating}
                />
              </View>

              <View style={{ marginTop: 20 }}>
                <GlassInput label="İL" value="İzmir" editable={false} />
                <GlassPicker
                  label="İLÇE"
                  value={ilce}
                  onChange={handleSelectIlce}
                  options={districtOptions}
                  placeholder="İlçe seç"
                  error={errors.ilce}
                />
                <GlassPicker
                  label="MAHALLE"
                  value={mahalle}
                  onChange={setMahalle}
                  options={neighborhoodOptions}
                  placeholder={ilce ? 'Mahalle seç' : 'Önce ilçe seç'}
                  error={errors.mahalle}
                  disabled={!ilce}
                />
                <GlassInput
                  label="CADDE / SOKAK"
                  value={street}
                  onChangeText={setStreet}
                  autoCapitalize="words"
                  placeholder="Cadde veya sokak adı"
                  error={errors.street}
                />
                <GlassInput
                  label="AÇIK ADRES"
                  value={fullAddress}
                  onChangeText={setFullAddress}
                  multiline
                  numberOfLines={3}
                  placeholder="Bina no, daire no, kat…"
                  error={errors.fullAddress}
                />
                {errors.general ? <Text style={styles.errorText}>{errors.general}</Text> : null}
              </View>
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <PrimaryCTA label="Hesabı oluştur" loading={loading} disabled={!canSubmit} onPress={handleSubmit} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BackgroundLayer>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  h1: { ...sportive.type.h1, color: sportive.colors.textPrimary, marginBottom: 8 },
  sub: { ...sportive.type.body, color: sportive.colors.textSecondary },
  errorText: { ...sportive.type.caption, color: sportive.colors.error, marginTop: 8, textAlign: 'center' },
  footer: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
});
