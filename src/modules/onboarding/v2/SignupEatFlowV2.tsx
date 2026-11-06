// G15-S1 (Ek karar) — FinSignupEat v2: eatkcal ilk sipariş kaydı, 3 panel
// (Şehrini seç → Teslimat adresi (+harita doğrulaması) → Telefon → Sepete dön).
//
// SALT GÖRÜNÜM KATMANI: mantık mevcut parçaları AYNEN çağırır —
//  · şehir: `useEatkcalRegistration()` (setCity/checkCity/status/messageKey)
//  · adres: eatkcal/v2/model/{addressModel,addressGeocode,addressSave} +
//    lib/delivery (bölgeler) + `AddressMap` (harita + sabit pin + ters geocode),
//    kayıt `insertAddress` (EkAddressAddScreen/AddressesScreen ile AYNI payload)
//  · telefon: `addresses.contact_phone` + `backfillProfileContact` (profil iletişim)
// Yalnız `yeni_onboarding` arkasında (SignupEatGate). Adres/telefon dosyalarında diff=0.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../core/design/components/AppText';
import { haptic } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { getSupabaseClient } from '../../../core/supabase';
import { Check, NavigationArrow } from '../../../components/icons';
import { fetchAllDeliveryZones } from '../../../lib/delivery';
import { normalizeAddress } from '../../../lib/addresses';
import { mapSupabaseErrorToUserMessage } from '../../../lib/supabaseErrors';
import { useAddressStore } from '../../../store/addressStore';
import { useEatkcalRegistration } from '../../profil/useRegistration';
import {
  EMPTY_FORM,
  EMPTY_ZONE_INDEX,
  buildAddressPayload,
  buildZoneIndex,
  isOutOfZone,
  matchReverseGeo,
  splitName,
  validateAddressForm,
  type AddressFormV2,
  type ZoneIndex,
} from '../../eatkcal/v2/model/addressModel';
import {
  IZMIR_CENTER,
  currentCoords,
  readLocationPermission,
  requestLocationPermission,
  reverseGeocodeAt,
} from '../../eatkcal/v2/model/addressGeocode';
import {
  backfillProfileContact,
  fetchProfileContact,
  fetchUserAddressRows,
  insertAddress,
} from '../../eatkcal/v2/model/addressSave';
import { AddressMap, NoMapCard, type AddressMapHandle } from '../../eatkcal/v2/ui/address/AddressMap';
import { AddressSelectField, OptionPickerSheet } from '../../eatkcal/v2/ui/address/fields';
import { OnbButton } from '../components/pieces';
import { useOnb } from '../components/onbTheme';
import { FormScreen, OnbField } from './FormScreen';
import {
  SIGNUP_EAT_CITIES,
  canContinueCity,
  formatPhoneMask,
  isValidTrMobile,
  nextStep,
  phoneDigits,
  phoneForStorage,
  prevStep,
  validateAddressStep,
  type AddressStepError,
  type SignupEatStep,
} from './signupEatLogic';

type Coords = { latitude: number; longitude: number };
type Perm = 'checking' | 'granted' | 'denied';

const GEOCODE_DEBOUNCE_MS = 350;
const K = 'onboarding.v2.signupEat.';

export interface SignupEatFlowV2Props {
  onBack: () => void;
  /** Akış tamam (şehir onaylı + adres/telefon kaydedildi ya da zaten adres var). */
  onAllowed: () => void;
  /** Şehir adımı geçilince (adres panelinden ÖNCE) — üst katman `writeCityGatePassed` çağırabilir. */
  onCityAllowed?: () => void;
  /** Oturum yokken adres paneline gelinirse (varsayılan: onBack). */
  onLoginRequired?: () => void;
  /** YALNIZ geliştirme vitrini: başlangıç paneli (üretimde yok sayılır). */
  vitrinStep?: SignupEatStep;
}

export default function SignupEatFlowV2({
  onBack,
  onAllowed,
  onCityAllowed,
  onLoginRequired,
  vitrinStep,
}: SignupEatFlowV2Props) {
  const initial: SignupEatStep = __DEV__ && vitrinStep ? vitrinStep : 'city';
  const [step, setStep] = useState<SignupEatStep>(initial);

  const goNext = (hasAddress: boolean) => {
    const n = nextStep(step, hasAddress);
    if (n === 'done') onAllowed();
    else setStep(n);
  };
  const goBack = () => {
    const p = prevStep(step);
    if (p) setStep(p);
    else onBack();
  };

  if (step === 'city') {
    return (
      <CityPanel
        onBack={onBack}
        onPassed={() => {
          onCityAllowed?.();
          goNext(Boolean(useAddressStore.getState().selectedAddress));
        }}
      />
    );
  }
  const flow = (
    <AddressPhoneFlow
      step={step}
      vitrin={__DEV__ && vitrinStep != null}
      onBack={goBack}
      onToPhone={() => goNext(false)}
      onSaved={() => goNext(false)}
      onLoginRequired={onLoginRequired ?? onBack}
    />
  );
  // YALNIZ __DEV__ vitrini: Final panolarındaki gri "Klavye" yer tutucusu (gerçekte sistem klavyesi).
  if (__DEV__ && vitrinStep != null) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>{flow}</View>
        <View style={{ height: 300, backgroundColor: '#DCDEE2', alignItems: 'center', justifyContent: 'center' }}>
          <AppText textRole="helper" style={{ color: '#6B6B70' }}>Klavye</AppText>
        </View>
      </View>
    );
  }
  return flow;
}

// ── Panel 1 · Şehrini seç (alttan sheet) ───────────────────────────────────────
function CityPanel({ onBack, onPassed }: { onBack: () => void; onPassed: () => void }) {
  const P = useOnb();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const reg = useEatkcalRegistration();
  // Final (FinSignupEat panel 1): İzmir baştan seçili.
  const [selected, setSelected] = useState<string | null>('İzmir');
  const { setCity } = reg;
  useEffect(() => {
    setCity('İzmir');
  }, [setCity]);
  const [notified, setNotified] = useState<Record<string, boolean>>({});

  const pick = (city: { name: string; allowed: boolean }) => {
    haptic('selection');
    setSelected(city.name);
    if (city.allowed) reg.setCity(city.name);
  };

  const proceed = async () => {
    if (!selected) return;
    const ok = await reg.checkCity();
    if (ok) onPassed();
  };

  return (
    <View style={[styles.root, { backgroundColor: P.bg }]} testID="signup-eat-city">
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: P.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(10,10,10,0.32)' }]}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t(`${K}back`)}
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: P.isDark ? '#1C1C1E' : P.bg, paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: P.line2 }]} />
        <AppText style={[styles.sheetTitle, { color: P.ink }]}>{t(`${K}city_title`)}</AppText>
        <AppText textRole="bodySm" style={{ color: P.sec, marginTop: 4 }}>
          {t(`${K}city_sub`)}
        </AppText>

        <View style={{ marginTop: 12 }}>
          {SIGNUP_EAT_CITIES.map((city, i) => {
            const on = selected === city.name;
            return (
              <Pressable
                key={city.name}
                onPress={() => pick(city)}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: !city.allowed }}
                testID={`city-${city.name}`}
                style={[
                  styles.cityRow,
                  { borderTopColor: P.line, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <AppText
                    textRole="body"
                    style={{
                      color: city.allowed ? P.ink : P.sec,
                      fontFamily: city.allowed ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium',
                      fontSize: 16,
                    }}
                  >
                    {city.name}
                  </AppText>
                  <AppText textRole="helper" style={{ color: P.sec }}>
                    {city.allowed ? t(`${K}city_active`) : t(`${K}city_soon`)}
                  </AppText>
                </View>
                {city.allowed ? (
                  on ? (
                    <View style={[styles.tick, { backgroundColor: P.ink }]}>
                      <Check size={14} color={P.onInk} weight="bold" />
                    </View>
                  ) : null
                ) : (
                  <Pressable
                    onPress={() => setNotified((p) => ({ ...p, [city.name]: true }))}
                    accessibilityRole="button"
                    style={[styles.notify, { borderColor: P.line2 }]}
                  >
                    <AppText textRole="helper" style={{ color: P.ink, fontFamily: 'PlusJakartaSans_700Bold' }}>
                      {notified[city.name] ? t(`${K}city_notified`) : t(`${K}city_notify`)}
                    </AppText>
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>

        {reg.messageKey ? (
          <AppText textRole="helper" style={styles.msg}>
            {t(reg.messageKey)}
          </AppText>
        ) : reg.status === 'error' ? (
          <AppText textRole="helper" style={styles.msg}>
            {t('eatkcal.city_gate.error')}
          </AppText>
        ) : null}

        <OnbButton
          label={t(`${K}continue`)}
          onPress={proceed}
          disabled={!canContinueCity(selected, reg.status === 'checking')}
          style={{ marginTop: 12 }}
          icon={() => (reg.status === 'checking' ? <ActivityIndicator color={P.onInk} /> : null)}
        />
      </View>
    </View>
  );
}

// ── Panel 2 + 3 · Adres (harita doğrulamalı) ve Telefon ──────────────────────
function AddressPhoneFlow({
  step,
  vitrin,
  onBack,
  onToPhone,
  onSaved,
  onLoginRequired,
}: {
  step: Exclude<SignupEatStep, 'city'>;
  vitrin: boolean;
  onBack: () => void;
  onToPhone: () => void;
  onSaved: () => void;
  onLoginRequired: () => void;
}) {
  const P = useOnb();
  const { t } = useT();
  const { user, authLoading } = useAuth();
  const setSelectedAddress = useAddressStore((s) => s.setSelectedAddress);

  const [index, setIndex] = useState<ZoneIndex>(EMPTY_ZONE_INDEX);
  const [addressCount, setAddressCount] = useState(0);
  const [hasProfileContact, setHasProfileContact] = useState(true);
  const [askEmail, setAskEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AddressFormV2>(
    vitrin
      ? { ...EMPTY_FORM, street: 'Basın Sitesi', building_no: '12', apartment_no: '4', floor: '2' }
      : EMPTY_FORM,
  );
  const [phone, setPhone] = useState('');

  const [mapFailed, setMapFailed] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [perm, setPerm] = useState<Perm>('checking');
  const [center, setCenter] = useState<Coords | null>(null);
  const [pinConfirmed, setPinConfirmed] = useState(vitrin);
  const [deviceCenter, setDeviceCenter] = useState<Coords | null>(null);
  const [needsNeighbourhood, setNeedsNeighbourhood] = useState(false);
  const [picker, setPicker] = useState<'district' | 'neighbourhood' | null>(null);
  const [stepError, setStepError] = useState<AddressStepError>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mapRef = useRef<AddressMapHandle>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geoSeq = useRef(0);
  const centeredFor = useRef<number | null>(null);

  // Oturum kapısı: adres kaydı oturum ister (EkAddressAddScreen ile aynı).
  useEffect(() => {
    if (authLoading) return;
    if (!user && !vitrin) onLoginRequired();
  }, [authLoading, user, vitrin, onLoginRequired]);

  // Veri: bölgeler + mevcut adres sayısı + profil iletişim (EkAddressAddScreen:138-181).
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      const supabase = getSupabaseClient();
      try {
        const [rows, zoneRows, contact] = await Promise.all([
          fetchUserAddressRows(supabase, user.id).catch(() => [] as Record<string, unknown>[]),
          fetchAllDeliveryZones<Record<string, unknown>>().catch(() => [] as Record<string, unknown>[]),
          fetchProfileContact(supabase, user.id).catch(() => ({ fullName: '', phone: '' })),
        ]);
        if (!mounted) return;
        setAddressCount(rows.length);
        setIndex(buildZoneIndex(zoneRows));
        const profileOk = Boolean(contact.fullName && contact.phone);
        setHasProfileContact(profileOk);
        const { first, last } = profileOk ? splitName(contact.fullName) : { first: '', last: '' };
        setForm((prev) => ({
          ...prev,
          contact_email: user.email || '',
          first_name: first,
          last_name: last,
          contact_phone: profileOk ? contact.phone : '',
        }));
        if (profileOk) setPhone(phoneDigits(contact.phone));
        setAskEmail(!user.email);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  // Konum izni (EkAddressAddScreen:184-217, yeni adres kolu).
  useEffect(() => {
    if (step !== 'address' || vitrin) return;
    let mounted = true;
    (async () => {
      const { status, canAskAgain } = await readLocationPermission();
      if (!mounted) return;
      if (status === 'granted') {
        setPerm('granted');
        const here = await currentCoords();
        if (mounted && here) setDeviceCenter(here);
        return;
      }
      if (status === 'denied' && !canAskAgain) {
        setPerm('denied');
        return;
      }
      const ok = await requestLocationPermission();
      if (!mounted) return;
      setPerm(ok ? 'granted' : 'denied');
      if (ok) {
        const here = await currentCoords();
        if (mounted && here) setDeviceCenter(here);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [step, vitrin]);

  // Cihaz konumu gelince haritayı bir kez oraya ortala; bu "konum doğrulandı" sayılır.
  useEffect(() => {
    if (step !== 'address' || loading || mapFailed || !deviceCenter) return;
    if (centeredFor.current === mapKey) return;
    centeredFor.current = mapKey;
    const h = setTimeout(() => {
      mapRef.current?.centerOn(deviceCenter);
      setPinConfirmed(true);
    }, 0);
    return () => clearTimeout(h);
  }, [step, loading, mapFailed, deviceCenter, mapKey]);

  const handleUseMyLocation = useCallback(async () => {
    haptic('selection');
    let ok = perm === 'granted';
    if (!ok) {
      ok = await requestLocationPermission();
      setPerm(ok ? 'granted' : 'denied');
    }
    if (!ok) return;
    const here = await currentCoords();
    if (here) {
      mapRef.current?.centerOn(here);
      setPinConfirmed(true);
    }
  }, [perm]);

  // Pin bırakıldı → ters geocode → forma uygula (EkAddressAddScreen:243-267).
  const applyGeocode = useCallback(async (coords: Coords) => {
    const seq = ++geoSeq.current;
    const geo = await reverseGeocodeAt(coords.latitude, coords.longitude);
    if (seq !== geoSeq.current || !geo) return;
    const m = matchReverseGeo(geo, indexRef.current);
    setNeedsNeighbourhood(m.needsNeighbourhood);
    setForm((prev) => {
      const district = m.district || prev.district;
      const districtChanged = district !== prev.district;
      return {
        ...prev,
        district,
        neighborhood: m.neighbourhood || (districtChanged ? '' : prev.neighborhood),
        street: geo.street || prev.street,
        building_no: geo.streetNumber || prev.building_no,
      };
    });
  }, []);

  const handleCenterChange = useCallback(
    (coords: Coords, byUser: boolean) => {
      setCenter(coords);
      if (byUser) setPinConfirmed(true);
      setStepError(null);
      if (geoTimer.current) clearTimeout(geoTimer.current);
      geoTimer.current = setTimeout(() => applyGeocode(coords), GEOCODE_DEBOUNCE_MS);
    },
    [applyGeocode],
  );
  useEffect(
    () => () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    },
    [],
  );

  const set = <K2 extends keyof AddressFormV2>(key: K2, value: AddressFormV2[K2]) => {
    setStepError(null);
    setFormError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pinCoords = pinConfirmed ? center ?? (vitrin ? IZMIR_CENTER : null) : null;

  const continueFromAddress = () => {
    const err = validateAddressStep({ form, index, pinCoords, mapFailed });
    if (err) {
      setStepError(err);
      haptic('warning');
      return;
    }
    onToPhone();
  };

  // Kaydet (EkAddressAddScreen:292-336, yeni adres kolu) — AYNI payload/yardımcılar.
  const save = async () => {
    if (!user || saving) return;
    setSaveError(null);
    const full: AddressFormV2 = { ...form, contact_phone: phoneForStorage(phone) };
    if (!isValidTrMobile(phone)) {
      setFormError(t(`${K}err_phone`));
      haptic('warning');
      return;
    }
    const err = validateAddressForm(full, index);
    if (err) {
      setFormError(t(`eatkcal.v2.address.${err}`));
      haptic('warning');
      return;
    }
    if (isOutOfZone(full, index)) {
      // Kaydı ENGELLEMEZ (mevcut kural).
      Alert.alert(t('eatkcal.v2.address.out_of_zone_title'), t('eatkcal.v2.address.out_of_zone_body'));
    }
    const payload = buildAddressPayload(full, user.id, pinCoords && !mapFailed ? pinCoords : null);
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      if (!hasProfileContact) {
        backfillProfileContact(supabase, user.id, full.first_name, full.last_name, full.contact_phone);
      }
      const { row } = await insertAddress(supabase, payload, addressCount === 0);
      setSelectedAddress(normalizeAddress(row));
      haptic('success');
      onSaved();
    } catch (e: unknown) {
      setSaveError(mapSupabaseErrorToUserMessage(e, t('eatkcal.v2.errors.address_body')));
      haptic('warning');
    } finally {
      setSaving(false);
    }
  };

  const neighbourhoodOptions = form.district ? index.neighbourhoodsByDistrict[form.district] || [] : [];
  const showZoneFields = mapFailed || needsNeighbourhood || !form.district || !form.neighborhood;
  const errText: Record<Exclude<AddressStepError, null>, string> = {
    needs_pin: t(`${K}err_needs_pin`),
    needs_zone: t(`${K}err_needs_zone`),
    needs_street: t(`${K}err_needs_street`),
  };

  // ── Panel 3 · Telefon ──
  if (step === 'phone') {
    return (
      <FormScreen
        onBack={onBack}
        barTitle={undefined}
        progress={{ total: 2, done: 2 }}
        title={t(`${K}phone_title`)}
        subtitle={t(`${K}phone_sub`)}
        footer={
          <OnbButton
            label={saving ? t(`${K}saving`) : t(`${K}back_to_cart`)}
            onPress={save}
            disabled={saving || loading}
          />
        }
      >
        {!hasProfileContact ? (
          <View style={styles.row2}>
            <OnbField
              style={{ flex: 1 }}
              label={t('eatkcal.v2.address.first_name')}
              value={form.first_name}
              onChangeText={(v) => set('first_name', v)}
              textContentType="givenName"
              testID="signup-eat-first"
            />
            <OnbField
              style={{ flex: 1 }}
              label={t('eatkcal.v2.address.last_name')}
              value={form.last_name}
              onChangeText={(v) => set('last_name', v)}
              textContentType="familyName"
              testID="signup-eat-last"
            />
          </View>
        ) : null}
        <OnbField
          label={t(`${K}phone_label`)}
          value={formatPhoneMask(phone)}
          onChangeText={(v) => {
            setFormError(null);
            setPhone(phoneDigits(v.replace(/^\+90\s?/, '')));
          }}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          hint={formError ? undefined : t(`${K}phone_hint`)}
          error={formError ?? undefined}
          testID="signup-eat-phone"
        />
        {askEmail ? (
          <OnbField
            label={t('eatkcal.v2.address.email')}
            value={form.contact_email}
            onChangeText={(v) => set('contact_email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
          />
        ) : null}
        {saveError ? (
          <AppText textRole="helper" style={styles.errText} accessibilityRole="alert">
            {saveError}
          </AppText>
        ) : null}
      </FormScreen>
    );
  }

  // ── Panel 2 · Teslimat adresi ──
  return (
    <>
      <FormScreen
        onBack={onBack}
        barTitle={t(`${K}address_title`)}
        progress={{ total: 2, done: 1 }}
        footer={<OnbButton label={t(`${K}continue`)} onPress={continueFromAddress} disabled={loading} />}
      >
        <View style={styles.row2}>
          <OnbField
            style={{ flex: 3 }}
            label={t(`${K}field_address`)}
            value={form.street}
            onChangeText={(v) => set('street', v)}
            textContentType="streetAddressLine1"
            focusedOverride={undefined}
            testID="signup-eat-street"
          />
          <OnbField
            style={{ flex: 1.2 }}
            label={t(`${K}field_building`)}
            value={form.building_no}
            onChangeText={(v) => set('building_no', v)}
            keyboardType="number-pad"
            testID="signup-eat-building"
          />
        </View>
        <View style={styles.row2}>
          <OnbField
            style={{ flex: 1 }}
            label={t(`${K}field_apartment`)}
            value={form.apartment_no}
            onChangeText={(v) => set('apartment_no', v)}
            keyboardType="number-pad"
          />
          <OnbField
            style={{ flex: 1 }}
            label={t(`${K}field_floor`)}
            value={form.floor}
            onChangeText={(v) => set('floor', v)}
            keyboardType="number-pad"
          />
        </View>
        <OnbField
          label={t(`${K}field_directions`)}
          value={form.directions}
          onChangeText={(v) => set('directions', v)}
          placeholder={t(`${K}directions_ph`)}
        />

        {showZoneFields ? (
          <View style={{ marginTop: 6 }}>
            <AddressSelectField
              label={t('eatkcal.v2.address.district')}
              value={form.district}
              placeholder={t('eatkcal.v2.address.pick_district')}
              onPress={() => setPicker('district')}
              testID="signup-eat-district"
            />
            <AddressSelectField
              style={{ marginTop: 8 }}
              label={t('eatkcal.v2.address.neighbourhood')}
              value={form.neighborhood}
              placeholder={
                form.district ? t('eatkcal.v2.address.pick_neighbourhood') : t('eatkcal.v2.address.pick_district_first')
              }
              disabled={!form.district}
              onPress={() => setPicker('neighbourhood')}
              testID="signup-eat-neighbourhood"
            />
          </View>
        ) : null}

        {/* Harita önizleme = doğrulama alanı (sabit pin, sürükle → ters geocode) */}
        <View style={[styles.mapBox, { borderColor: P.chipEdge }]}>
          {mapFailed ? (
            <NoMapCard
              height={190}
              title={t('eatkcal.v2.address.nomap_title')}
              body={t('eatkcal.v2.address.nomap_body')}
              retryLabel={t('eatkcal.v2.address.nomap_retry')}
              onRetry={() => {
                setMapKey((k) => k + 1);
                setMapFailed(false);
              }}
            />
          ) : vitrin ? (
            <View style={[styles.mapStub, { backgroundColor: P.track }]}>
              <AppText textRole="bodySm" style={{ color: P.sec }}>
                {t('eatkcal.v2.address.map_preview')}
              </AppText>
            </View>
          ) : loading ? (
            <View style={[styles.mapStub, { backgroundColor: P.track }]}>
              <ActivityIndicator color={P.ink} />
            </View>
          ) : (
            <AddressMap
              key={mapKey}
              ref={mapRef}
              height={190}
              initialCenter={IZMIR_CENTER}
              zoomedIn={false}
              onCenterChange={handleCenterChange}
              onMapFailed={() => setMapFailed(true)}
              dragHint={perm === 'denied' ? t('eatkcal.v2.address.drag') : undefined}
              mapLabel={t('eatkcal.v2.address.map_preview')}
            />
          )}
        </View>
        {!mapFailed && !vitrin ? (
          <View style={styles.mapFoot}>
            <AppText textRole="helper" style={{ color: P.sec, flex: 1 }}>
              {t(`${K}map_hint`)}
            </AppText>
            <Pressable
              onPress={handleUseMyLocation}
              accessibilityRole="button"
              style={[styles.locBtn, { borderColor: P.line2 }]}
              testID="signup-eat-use-location"
            >
              <NavigationArrow size={14} color={P.ink} weight="fill" />
              <AppText textRole="helper" style={{ color: P.ink, fontFamily: 'PlusJakartaSans_700Bold' }}>
                {t('eatkcal.v2.address.use_location')}
              </AppText>
            </Pressable>
          </View>
        ) : null}

        {stepError ? (
          <AppText textRole="helper" style={styles.errText} accessibilityRole="alert" testID="signup-eat-step-error">
            {errText[stepError]}
          </AppText>
        ) : null}
      </FormScreen>

      <OptionPickerSheet
        visible={picker === 'district'}
        title={t('eatkcal.v2.address.district')}
        options={index.districtOptions}
        selected={form.district}
        onClose={() => setPicker(null)}
        onSelect={(v) => {
          setStepError(null);
          setForm((prev) => {
            const opts = index.neighbourhoodsByDistrict[v] || [];
            const keep = opts.some((o) => o.value === prev.neighborhood);
            return { ...prev, district: v, neighborhood: keep ? prev.neighborhood : '' };
          });
          setPicker(null);
        }}
      />
      <OptionPickerSheet
        visible={picker === 'neighbourhood'}
        title={t('eatkcal.v2.address.neighbourhood')}
        options={neighbourhoodOptions}
        selected={form.neighborhood}
        onClose={() => setPicker(null)}
        onSelect={(v) => {
          set('neighborhood', v);
          setNeedsNeighbourhood(false);
          setPicker(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 26, lineHeight: 30, letterSpacing: -0.3 },
  cityRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tick: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  notify: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, justifyContent: 'center' },
  msg: { color: '#E5484D', textAlign: 'center', marginTop: 10 },
  row2: { flexDirection: 'row', gap: 10 },
  mapBox: { marginTop: 18, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  mapStub: { height: 120, alignItems: 'center', justifyContent: 'center' },
  mapFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  locBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errText: { color: '#E5484D', marginTop: 10 },
});
