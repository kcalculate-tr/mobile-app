// eatkcal v2 (G13-S2 md.5) — Adres ekle / düzenle (FinEkAddress,
// FinEkAddressNoPerm, FinEkAddressNoMap). Yalnız `yeni_siparis` açıkken
// kayıtlı rota (`EkAddressAdd`).
//
// MANTIK AYNEN (yeni adres mantığı YOK):
//  - harita + sabit pin + konum izni + ters geocode (native + Google) →
//    AddressVerificationSheet.tsx create modu (model/addressGeocode.ts)
//  - ilçe/mahalle eşleşmesi `matchToOption` (src/lib/geo.ts), seçenekler
//    `fetchAllDeliveryZones` (src/lib/delivery.ts) — AddressesScreen.tsx ile aynı
//  - doğrulama, payload, eksik kolon geri dönüşü, ilk adres varsayılan, bölge
//    dışı uyarısı (kaydı engellemez), profil iletişim bilgisi → AddressesScreen
//    (model/addressModel.ts + model/addressSave.ts, kaynak satırları orada)
//  - seçili adres `useAddressStore.setSelectedAddress` (AddressesScreen:227-231)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { haptic } from '../../../../core/design';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { ArrowLeft, NavigationArrow, WarningCircle } from '../../../../components/icons';
import { fetchAllDeliveryZones, fetchGlobalDeliverySettings, type DeliveryGlobals } from '../../../../lib/delivery';
import { normalizeAddress } from '../../../../lib/addresses';
import { mapSupabaseErrorToUserMessage, formatSupabaseErrorForDevLog } from '../../../../lib/supabaseErrors';
import { useAddressStore } from '../../../../store/addressStore';
import type { Address } from '../../../../types';
import { useEkNav, type EkV2ParamList } from '../nav';
import { EkButton, ekType, useEk } from '../ui/kit';
import { EkErrorCard } from '../ui/ErrorCard';
import { addressSaveError, type EkErrorModel } from '../model/errors';
import {
  EMPTY_FORM,
  EMPTY_ZONE_INDEX,
  buildAddressPayload,
  buildZoneIndex,
  formFromAddress,
  isOutOfZone,
  matchReverseGeo,
  splitName,
  validateAddressForm,
  zoneStatusFor,
  type AddressFormV2,
  type AddressValidationError,
  type ZoneIndex,
} from '../model/addressModel';
import {
  backfillProfileContact,
  fetchProfileContact,
  fetchUserAddressRows,
  insertAddress,
  updateAddress,
} from '../model/addressSave';
import {
  IZMIR_CENTER,
  currentCoords,
  readLocationPermission,
  requestLocationPermission,
  reverseGeocodeAt,
} from '../model/addressGeocode';
import { AddressMap, NoMapCard, type AddressMapHandle } from '../ui/address/AddressMap';
import { AddressInput, AddressSelectField, OptionPickerSheet, TitleChips } from '../ui/address/fields';

type Route = RouteProp<EkV2ParamList, 'EkAddressAdd'>;
type Coords = { latitude: number; longitude: number };
type Perm = 'checking' | 'granted' | 'denied';

const GEOCODE_DEBOUNCE_MS = 350;

export default function EkAddressAddScreen() {
  const navigation = useEkNav();
  const route = useRoute<Route>();
  const editId = route.params?.addressId ?? '';
  const selectMode = Boolean(route.params?.selectMode);
  const { c, t, insets } = useEk();
  const { height: winH } = useWindowDimensions();
  const mapH = Math.round(winH * 0.55);
  const { user, authLoading } = useAuth();
  const setSelectedAddress = useAddressStore((s) => s.setSelectedAddress);

  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [index, setIndex] = useState<ZoneIndex>(EMPTY_ZONE_INDEX);
  const [globals, setGlobals] = useState<DeliveryGlobals | null>(null);
  const [form, setForm] = useState<AddressFormV2>(EMPTY_FORM);
  const [hasProfileContact, setHasProfileContact] = useState(true);
  const [askEmail, setAskEmail] = useState(false);

  const [mapMode, setMapMode] = useState<'map' | 'nomap'>('map');
  const [mapKey, setMapKey] = useState(0);
  const [perm, setPerm] = useState<Perm>('checking');
  const [center, setCenter] = useState<Coords | null>(null);
  const [movedByUser, setMovedByUser] = useState(false);
  const [deviceCenter, setDeviceCenter] = useState<Coords | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [filledFromMap, setFilledFromMap] = useState(false);
  const [needsNeighbourhood, setNeedsNeighbourhood] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const [picker, setPicker] = useState<'district' | 'neighbourhood' | null>(null);
  const [validation, setValidation] = useState<AddressValidationError | null>(null);
  const [saveError, setSaveError] = useState<EkErrorModel | null>(null);
  const [saving, setSaving] = useState(false);

  const mapRef = useRef<AddressMapHandle>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geoSeq = useRef(0);

  const editing = useMemo(() => (editId ? addresses.find((a) => a.id === editId) ?? null : null), [addresses, editId]);
  const initialCenter = useMemo<Coords>(
    () =>
      editing?.latitude != null && editing?.longitude != null
        ? { latitude: editing.latitude, longitude: editing.longitude }
        : IZMIR_CENTER,
    [editing],
  );
  const zoomedIn = editing?.latitude != null;

  // ── Oturum kapısı (AddressesScreen:309-314 deseni) ─────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) navigation.replace('Login', { redirectTo: 'Tabs' });
  }, [authLoading, user, navigation]);

  // ── Veri: adresler + delivery_zones + global ayar + profil (AddressesScreen:316-424) ──
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const supabase = getSupabaseClient();
      try {
        const [rows, zoneRows, g, contact] = await Promise.all([
          fetchUserAddressRows(supabase, user.id).catch(() => [] as Record<string, unknown>[]),
          fetchAllDeliveryZones<Record<string, unknown>>().catch(() => [] as Record<string, unknown>[]),
          fetchGlobalDeliverySettings(),
          fetchProfileContact(supabase, user.id).catch(() => ({ fullName: '', phone: '' })),
        ]);
        if (!mounted) return;
        const list = rows.map((r) => normalizeAddress(r)).filter((a) => a.id);
        setAddresses(list);
        setIndex(buildZoneIndex(zoneRows));
        setGlobals(g);
        const profileOk = Boolean(contact.fullName && contact.phone);
        setHasProfileContact(profileOk);
        const target = editId ? list.find((a) => a.id === editId) : null;
        if (target) {
          const f = formFromAddress(target, user.email);
          setForm(f);
          setAskEmail(!f.contact_email);
          setHasProfileContact(profileOk && Boolean(f.first_name && f.last_name));
        } else {
          const { first, last } = profileOk ? splitName(contact.fullName) : { first: '', last: '' };
          setForm({
            ...EMPTY_FORM,
            contact_email: user.email || '',
            first_name: first,
            last_name: last,
            contact_phone: profileOk ? contact.phone : '',
          });
          setAskEmail(!user.email);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, editId]);

  // ── Konum izni (AVS create modu, :123-133) ──────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status, canAskAgain } = await readLocationPermission();
      if (!mounted) return;
      if (status === 'granted') {
        setPerm('granted');
        if (!editId) {
          const here = await currentCoords();
          if (mounted && here) setDeviceCenter(here);
        }
        return;
      }
      if (status === 'denied' && !canAskAgain) {
        setPerm('denied');
        return;
      }
      // Yeni adreste izin ekranın amacıyla aynı: doğrudan sor (AVS "İzin ver").
      if (!editId) {
        const ok = await requestLocationPermission();
        if (!mounted) return;
        setPerm(ok ? 'granted' : 'denied');
        if (ok) {
          const here = await currentCoords();
          if (mounted && here) setDeviceCenter(here);
        }
      } else {
        setPerm(status === 'denied' ? 'denied' : 'granted');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [editId]);

  // Cihaz konumu harita kurulduktan sonra gelirse (ya da harita sonradan
  // kurulursa) yeni adreste bir kez oraya ortala (AVS:148-154 recenter).
  const centeredFor = useRef<number | null>(null);
  useEffect(() => {
    if (editId || loading || mapMode !== 'map' || !deviceCenter) return;
    if (centeredFor.current === mapKey) return;
    centeredFor.current = mapKey;
    const h = setTimeout(() => mapRef.current?.centerOn(deviceCenter), 0);
    return () => clearTimeout(h);
  }, [editId, loading, mapMode, deviceCenter, mapKey]);

  const handleUseMyLocation = useCallback(async () => {
    haptic('selection');
    let ok = perm === 'granted';
    if (!ok) {
      ok = await requestLocationPermission();
      setPerm(ok ? 'granted' : 'denied');
    }
    if (!ok) return;
    const here = await currentCoords();
    if (here) mapRef.current?.centerOn(here);
  }, [perm]);

  // ── Pin bırakıldı → ters geocode → forma uygula (AddressesScreen:508-564) ───
  const applyGeocode = useCallback(
    async (coords: Coords, fill: boolean) => {
      const seq = ++geoSeq.current;
      setGeocoding(true);
      const geo = await reverseGeocodeAt(coords.latitude, coords.longitude);
      if (seq !== geoSeq.current) return;
      setGeocoding(false);
      if (!fill || !geo) return;
      const m = matchReverseGeo(geo, indexRef.current);
      setNeedsNeighbourhood(m.needsNeighbourhood);
      setFilledFromMap(Boolean(m.district || geo.street));
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
    },
    [],
  );

  const handleCenterChange = useCallback(
    (coords: Coords, byUser: boolean) => {
      setCenter(coords);
      // Düzenlemede konum alanları YALNIZ kullanıcı pini oynatınca değişir
      // (eski akışta "Konumu düzenle" — AddressesScreen:532-544).
      const fill = !editId || byUser;
      if (editId && byUser) setMovedByUser(true);
      if (geoTimer.current) clearTimeout(geoTimer.current);
      geoTimer.current = setTimeout(() => applyGeocode(coords, fill), GEOCODE_DEBOUNCE_MS);
    },
    [applyGeocode, editId],
  );

  useEffect(() => () => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
  }, []);

  const set = <K extends keyof AddressFormV2>(key: K, value: AddressFormV2[K]) => {
    setValidation(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── Kaydet (AddressesScreen:603-808) ────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user || saving) return;
    setSaveError(null);
    const err = validateAddressForm(form, index);
    if (err) {
      setValidation(err);
      if (err !== 'err_required') setManualOpen(true);
      haptic('warning');
      return;
    }
    if (isOutOfZone(form, index)) {
      Alert.alert(t('eatkcal.v2.address.out_of_zone_title'), t('eatkcal.v2.address.out_of_zone_body'));
    }
    // Koordinat yalnız haritadan geldiyse (yeni adres: pin; düzenleme: pin oynatıldıysa).
    const pendingCoords =
      mapMode === 'map' && center && (!editId || movedByUser) ? center : null;
    const payload = buildAddressPayload(form, user.id, pendingCoords);
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      if (!hasProfileContact) {
        backfillProfileContact(supabase, user.id, form.first_name, form.last_name, form.contact_phone);
      }
      if (editId) {
        const { row } = await updateAddress(supabase, payload, editId, user.id);
        const updated = normalizeAddress(row);
        if (useAddressStore.getState().selectedAddress?.id === updated.id) setSelectedAddress(updated);
        haptic('success');
        if (selectMode) navigation.navigate('EkCheckout', { selectedAddressId: updated.id });
        else navigation.goBack();
      } else {
        const { row } = await insertAddress(supabase, payload, addresses.length === 0);
        const inserted = normalizeAddress(row);
        setSelectedAddress(inserted);
        haptic('success');
        if (selectMode) navigation.navigate('EkCheckout', { selectedAddressId: inserted.id });
        else navigation.goBack();
      }
    } catch (error: unknown) {
      if (__DEV__) console.warn(`[EkAddress] kayıt hatası: ${formatSupabaseErrorForDevLog(error)}`);
      setSaveError(addressSaveError(mapSupabaseErrorToUserMessage(error, t('eatkcal.v2.errors.address_body'))));
      haptic('warning');
    } finally {
      setSaving(false);
    }
  }, [
    user,
    saving,
    form,
    index,
    t,
    mapMode,
    center,
    editId,
    movedByUser,
    hasProfileContact,
    addresses.length,
    setSelectedAddress,
    selectMode,
    navigation,
  ]);

  const zone = zoneStatusFor(index, form.district, form.neighborhood, globals);
  const neighbourhoodOptions = form.district ? index.neighbourhoodsByDistrict[form.district] || [] : [];
  const showLocationFields =
    mapMode === 'nomap' || manualOpen || needsNeighbourhood || (!loading && (!form.district || !form.neighborhood));

  const zoneText = (() => {
    if (zone.kind === 'now') {
      return [
        `${t('eatkcal.v2.address.zone_now')}${zone.eta ? ` ${zone.eta}` : ''}`,
        zone.free ? t('eatkcal.v2.address.zone_free') : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    if (zone.kind === 'next_day') return t('eatkcal.v2.address.zone_next_day');
    if (zone.kind === 'none') return t('eatkcal.v2.address.zone_none');
    return geocoding ? t('eatkcal.v2.address.zone_checking') : null;
  })();

  const statusPill = zoneText ? (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={[styles.pill, { backgroundColor: zone.kind === 'now' ? c.accent : c.surface }]}
    >
      <Text style={[ekType.c13s, { color: zone.kind === 'now' ? c.onAccent : c.ink, textAlign: 'center' }]}>
        {zoneText}
      </Text>
    </View>
  ) : null;

  const subLine =
    mapMode === 'nomap'
      ? form.district
        ? t('eatkcal.v2.address.nomap_district_line', { district: form.district })
        : t('eatkcal.v2.address.nomap_no_district')
      : [
          [form.neighborhood ? `${form.neighborhood} ${t('eatkcal.v2.address.neighbourhood_suffix')}`.trim() : '', form.district]
            .filter(Boolean)
            .join(', '),
          filledFromMap ? t('eatkcal.v2.address.filled_from_map') : '',
        ]
          .filter(Boolean)
          .join(' · ');

  if (authLoading || !user) {
    return <View style={[styles.fill, { backgroundColor: c.bg }]} />;
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]} testID="ek-address-add">
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.fill}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {/* Harita (FinEkAddress) / yüklenemedi kartı (FinEkAddressNoMap) */}
          {mapMode === 'map' ? (
            loading ? (
              <View style={[styles.center, { height: mapH, backgroundColor: c.line }]}>
                <ActivityIndicator color={c.ink} />
              </View>
            ) : (
              <AddressMap
                key={mapKey}
                ref={mapRef}
                height={mapH}
                initialCenter={initialCenter}
                zoomedIn={zoomedIn}
                onCenterChange={handleCenterChange}
                onMapFailed={() => setMapMode('nomap')}
                status={statusPill}
                dragHint={perm === 'denied' ? t('eatkcal.v2.address.drag') : undefined}
                mapLabel={t('eatkcal.v2.address.map_preview')}
              />
            )
          ) : (
            <NoMapCard
              height={mapH}
              title={t('eatkcal.v2.address.nomap_title')}
              body={t('eatkcal.v2.address.nomap_body')}
              retryLabel={t('eatkcal.v2.address.nomap_retry')}
              onRetry={() => {
                setMapKey((k) => k + 1);
                setMapMode('map');
              }}
            />
          )}

          {/* Alt panel — sheet katmanı (28 üst köşe) */}
          <View style={[styles.panel, { backgroundColor: c.surface, borderTopColor: c.line }]}>
            <View style={[styles.handle, { backgroundColor: c.line }]} />

            <Pressable
              onPress={() => setManualOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityHint={t('eatkcal.v2.address.street')}
              style={styles.headBlock}
              disabled={mapMode === 'nomap'}
            >
              <Text style={[ekType.b17, { color: c.ink, fontSize: 16 }]} numberOfLines={2}>
                {mapMode === 'nomap'
                  ? t('eatkcal.v2.address.nomap_form_title')
                  : form.street || t('eatkcal.v2.address.pick_on_map')}
              </Text>
              {subLine ? <Text style={[ekType.c13, { color: c.secondary }]}>{subLine}</Text> : null}
            </Pressable>

            {showLocationFields ? (
              <>
                <AddressSelectField
                  label={t('eatkcal.v2.address.district')}
                  value={form.district}
                  placeholder={t('eatkcal.v2.address.pick_district')}
                  onPress={() => setPicker('district')}
                  testID="ek-address-district"
                />
                <View style={styles.grid2}>
                  <AddressSelectField
                    style={styles.cell}
                    label={t('eatkcal.v2.address.neighbourhood')}
                    value={form.neighborhood}
                    placeholder={
                      form.district ? t('eatkcal.v2.address.pick_neighbourhood') : t('eatkcal.v2.address.pick_district_first')
                    }
                    disabled={!form.district}
                    onPress={() => setPicker('neighbourhood')}
                    testID="ek-address-neighbourhood"
                  />
                  <AddressInput
                    style={styles.cell}
                    label={t('eatkcal.v2.address.street')}
                    value={form.street}
                    onChangeText={(v) => set('street', v)}
                    textContentType="streetAddressLine1"
                  />
                </View>
                {needsNeighbourhood ? (
                  <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.address.neighbourhood_hint')}</Text>
                ) : null}
              </>
            ) : null}

            <TitleChips
              value={form.titleChip}
              onChange={(v) => set('titleChip', v)}
              groupLabel={t('eatkcal.v2.address.title_group')}
              labels={{
                home: t('eatkcal.v2.address.chip_home'),
                work: t('eatkcal.v2.address.chip_work'),
                other: t('eatkcal.v2.address.chip_other'),
              }}
            />

            <View style={styles.grid3}>
              <AddressInput
                style={styles.cell}
                label={t('eatkcal.v2.address.building_no')}
                value={form.building_no}
                onChangeText={(v) => set('building_no', v)}
                keyboardType="number-pad"
                testID="ek-address-building"
              />
              <AddressInput
                style={styles.cell}
                label={t('eatkcal.v2.address.floor')}
                value={form.floor}
                onChangeText={(v) => set('floor', v)}
                keyboardType="number-pad"
              />
              <AddressInput
                style={styles.cell}
                label={t('eatkcal.v2.address.apartment')}
                value={form.apartment_no}
                onChangeText={(v) => set('apartment_no', v)}
                keyboardType="number-pad"
              />
            </View>

            <AddressInput
              label={t('eatkcal.v2.address.directions')}
              value={form.directions}
              onChangeText={(v) => set('directions', v)}
              placeholder={t('eatkcal.v2.address.directions_ph')}
            />

            {!hasProfileContact ? (
              <View style={styles.grid2}>
                <AddressInput
                  style={styles.cell}
                  label={t('eatkcal.v2.address.first_name')}
                  value={form.first_name}
                  onChangeText={(v) => set('first_name', v)}
                  textContentType="givenName"
                  autoComplete="given-name"
                />
                <AddressInput
                  style={styles.cell}
                  label={t('eatkcal.v2.address.last_name')}
                  value={form.last_name}
                  onChangeText={(v) => set('last_name', v)}
                  textContentType="familyName"
                  autoComplete="family-name"
                />
              </View>
            ) : null}

            <AddressInput
              label={t('eatkcal.v2.address.phone')}
              value={form.contact_phone}
              onChangeText={(v) => set('contact_phone', v)}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              testID="ek-address-phone"
            />

            {askEmail ? (
              <AddressInput
                label={t('eatkcal.v2.address.email')}
                value={form.contact_email}
                onChangeText={(v) => set('contact_email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
              />
            ) : null}

            {validation ? (
              <View style={styles.row} accessibilityRole="alert">
                <WarningCircle size={16} color={c.danger} weight="fill" />
                <Text style={[ekType.c13, { color: c.danger, flex: 1 }]}>
                  {t(`eatkcal.v2.address.${validation}`)}
                </Text>
              </View>
            ) : null}

            {saveError ? <EkErrorCard error={saveError} onAction={handleSave} /> : null}

            <EkButton
              label={saving ? t('eatkcal.v2.address.saving') : t('eatkcal.v2.address.save')}
              onPress={handleSave}
              disabled={saving || loading}
              variant="primary"
              style={{ marginTop: 6 }}
              testID="ek-address-save"
            />
          </View>
        </ScrollView>

        {/* Yüzen üst bar: geri · Konumumu kullan; izin kapalı şeridi */}
        <View pointerEvents="box-none" style={[styles.topBar, { top: insets.top + 6 }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('eatkcal.v2.common.back')}
            style={[styles.roundBtn, { backgroundColor: c.surface }]}
          >
            <ArrowLeft size={22} color={c.ink} />
          </Pressable>
          <Pressable
            onPress={handleUseMyLocation}
            accessibilityRole="button"
            style={[styles.locBtn, { backgroundColor: c.surface }]}
            testID="ek-address-use-location"
          >
            <NavigationArrow size={16} color={c.ink} weight="fill" />
            <Text style={[ekType.b15s, { color: c.ink }]}>{t('eatkcal.v2.address.use_location')}</Text>
          </Pressable>
        </View>
        {perm === 'denied' && mapMode === 'map' ? (
          <View
            style={[styles.permBanner, { top: insets.top + 60, backgroundColor: c.surface }]}
            accessibilityRole="alert"
            testID="ek-address-noperm"
          >
            <WarningCircle size={18} color={c.ink} />
            <Text style={[ekType.c13, { color: c.ink, flex: 1 }]}>{t('eatkcal.v2.address.perm_off')}</Text>
            <Pressable
              onPress={() => Linking.openSettings().catch(() => {})}
              accessibilityRole="button"
              style={styles.settingsBtn}
            >
              <Text style={[ekType.b15s, { color: c.ink }]}>{t('eatkcal.v2.address.settings')}</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <OptionPickerSheet
        visible={picker === 'district'}
        title={t('eatkcal.v2.address.district')}
        options={index.districtOptions}
        selected={form.district}
        onClose={() => setPicker(null)}
        onSelect={(v) => {
          // İlçe değişince mahalle listede yoksa boşalır (AddressesScreen:844-851).
          setValidation(null);
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
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  panel: {
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center' },
  headBlock: { minHeight: 44, justifyContent: 'center' },
  grid2: { flexDirection: 'row', gap: 8 },
  grid3: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: {
    minHeight: 40,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  topBar: {
    position: 'absolute',
    left: 4,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  locBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  permBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  settingsBtn: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
});
