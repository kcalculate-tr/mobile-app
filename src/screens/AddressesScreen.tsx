import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { CaretLeft, PencilSimple, MapPin, Plus, Trash } from 'phosphor-react-native';
import ScreenContainer from '../components/ScreenContainer';
import FormField, { FormFieldOption } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import {
  formatSupabaseErrorForDevLog,
  mapSupabaseErrorToUserMessage,
} from '../lib/supabaseErrors';
import { getSupabaseClient } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import { Address } from '../types';
import { useAddressStore } from '../store/addressStore';
import { COLORS } from '../constants/theme';

type AddressesRouteProp = RouteProp<RootStackParamList, 'Addresses'>;
type AddressesNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type AddressForm = {
  title: string;
  first_name: string;
  last_name: string;
  contact_phone: string;
  contact_email: string;
  district: string;
  neighborhood: string;
  street: string;
  building_no: string;
  floor: string;
  apartment_no: string;
  building_name: string;
  full_address: string;
};

const INITIAL_FORM: AddressForm = {
  title: '',
  first_name: '',
  last_name: '',
  contact_phone: '',
  contact_email: '',
  district: '',
  neighborhood: '',
  street: '',
  building_no: '',
  floor: '',
  apartment_no: '',
  building_name: '',
  full_address: '',
};

const normalizeAddress = (row: Record<string, unknown>): Address => ({
  id: String(row.id ?? '').trim(),
  user_id: String(row.user_id ?? '').trim() || undefined,
  title: String(row.title ?? 'Adres').trim(),
  contact_name: String(row.contact_name ?? '').trim(),
  first_name: String(row.first_name ?? '').trim() || undefined,
  last_name: String(row.last_name ?? '').trim() || undefined,
  contact_phone: String(row.contact_phone ?? '').trim(),
  contact_email: String(row.contact_email ?? '').trim(),
  full_address: String(row.full_address ?? '').trim(),
  city: String(row.city ?? 'İzmir').trim() || 'İzmir',
  district: String(row.district ?? '').trim(),
  neighbourhood:
    String(
      row.neighborhood ?? row.neighbourhood ?? row.mahalle ?? '',
    ).trim() || null,
  building_no: String(row.building_no ?? '').trim() || undefined,
  floor: String(row.floor ?? '').trim() || undefined,
  apartment_no: String(row.apartment_no ?? '').trim() || undefined,
  building_name: String(row.building_name ?? '').trim() || undefined,
  created_at: String(row.created_at ?? '').trim() || undefined,
  updated_at: String(row.updated_at ?? '').trim() || undefined,
});

const getMissingColumnName = (errorText: string) => {
  const match = errorText.match(/column ["']?([a-zA-Z0-9_]+)["']?/i);
  return match?.[1] || '';
};

const resolveAddressSaveErrorMessage = (error: unknown, fallback: string) =>
  mapSupabaseErrorToUserMessage(error, fallback);

const readZoneDistrict = (row: Record<string, unknown>) =>
  String(row.district ?? '').trim();

const readZoneNeighborhood = (row: Record<string, unknown>) =>
  String(row.neighborhood ?? row.neighbourhood ?? row.mahalle ?? '').trim();

const getGoogleMapsKey = (): string => {
  const fromConfig =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
  const value =
    (typeof fromConfig === 'string' ? fromConfig : '') ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
    '';
  return String(value).trim();
};

export default function AddressesScreen() {
  const navigation = useNavigation<AddressesNavigationProp>();
  const route = useRoute<AddressesRouteProp>();
  const insets = useSafeAreaInsets();

  const { user, authLoading } = useAuth();
  const { isAuthenticated, loading } = useRequireAuth();

  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const setSelectedAddress = useAddressStore((s) => s.setSelectedAddress);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');

  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AddressForm>(INITIAL_FORM);


  const [districtOptions, setDistrictOptions] = useState<FormFieldOption[]>([]);
  const [neighborhoodOptionsByDistrict, setNeighborhoodOptionsByDistrict] =
    useState<Record<string, FormFieldOption[]>>({});

  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const selectMode = Boolean(route.params?.selectMode);

  const selectedAddress = useMemo(
    () => addresses.find((item) => item.id === selectedAddressId) || null,
    [addresses, selectedAddressId],
  );

  const handleSelectAddress = (id: string) => {
    setSelectedAddressId(id);
    const address = addresses.find((a) => a.id === id);
    if (address) setSelectedAddress(address);
  };

  const neighborhoodOptions = useMemo(() => {
    const district = form.district.trim();
    if (!district) return [];
    return neighborhoodOptionsByDistrict[district] || [];
  }, [form.district, neighborhoodOptionsByDistrict]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigation.replace('Login', { redirectTo: 'Addresses' });
    }
  }, [authLoading, user, navigation]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const loadData = async () => {
      setDataLoading(true);
      setErrorMessage('');

      try {
        const supabase = getSupabaseClient();
        const [addressesRes, districtsRes] = await Promise.all([
          supabase
            .from('addresses')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('delivery_zones')
            .select('*')
            .order('district', { ascending: true }),
        ]);

        if (!mounted) return;

        if (addressesRes.error) throw addressesRes.error;

        const normalized = (Array.isArray(addressesRes.data) ? addressesRes.data : [])
          .map((row) => normalizeAddress(row as Record<string, unknown>))
          .filter((address) => address.id);

        setAddresses(normalized);

        if (normalized.length > 0) {
          const resolvedId =
            selectedAddressId && normalized.some((item) => item.id === selectedAddressId)
              ? selectedAddressId
              : normalized[0].id;
          const resolvedAddress = normalized.find((a) => a.id === resolvedId) ?? null;
          setSelectedAddressId(resolvedId);
          setSelectedAddress(resolvedAddress);
        }

        if (districtsRes.error) {
          if (__DEV__) {
            console.warn(
              `[addresses] delivery_zones okunamadı: ${formatSupabaseErrorForDevLog(districtsRes.error)}`,
            );
          }
          setDistrictOptions([]);
          setNeighborhoodOptionsByDistrict({});
        } else {
          const districtSet = new Set<string>();
          const neighborhoodMap = new Map<string, Set<string>>();

          (Array.isArray(districtsRes.data) ? districtsRes.data : []).forEach((row) => {
            const zoneRow = row as Record<string, unknown>;
            const district = readZoneDistrict(zoneRow);
            if (!district) return;
            districtSet.add(district);
            const neighborhood = readZoneNeighborhood(zoneRow);
            if (!neighborhood) return;
            const existing = neighborhoodMap.get(district) || new Set<string>();
            existing.add(neighborhood);
            neighborhoodMap.set(district, existing);
          });

          const normalizedDistrictOptions = Array.from(districtSet)
            .sort((a, b) => a.localeCompare(b, 'tr'))
            .map((district) => ({ label: district, value: district }));

          const normalizedNeighborhoodMap: Record<string, FormFieldOption[]> = {};
          Array.from(neighborhoodMap.entries()).forEach(([district, neighborhoods]) => {
            normalizedNeighborhoodMap[district] = Array.from(neighborhoods)
              .sort((a, b) => a.localeCompare(b, 'tr'))
              .map((neighborhood) => ({ label: neighborhood, value: neighborhood }));
          });

          setDistrictOptions(normalizedDistrictOptions);
          setNeighborhoodOptionsByDistrict(normalizedNeighborhoodMap);
        }
      } catch (error: unknown) {
        if (!mounted) return;
        if (__DEV__) {
          console.warn(`[addresses] yükleme hatası: ${formatSupabaseErrorForDevLog(error)}`);
        }
        setErrorMessage(
          mapSupabaseErrorToUserMessage(error, 'Adresler yüklenemedi. Lütfen tekrar deneyin.'),
        );
      } finally {
        if (mounted) setDataLoading(false);
      }
    };

    loadData();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    const address = addresses.find((a) => a.id === selectedAddressId);
    if (!address?.full_address) { setMapCoords(null); return; }
    let mounted = true;
    setGeocoding(true);
    setMapCoords(null);
    const run = async () => {
      try {
        const apiKey = getGoogleMapsKey();
        if (!apiKey) {
          if (__DEV__) {
            console.warn('[addresses] EXPO_PUBLIC_GOOGLE_MAPS_KEY missing — map disabled');
          }
          return;
        }
        const q = encodeURIComponent(`${address.full_address}, ${address.district}, İzmir, Turkey`);
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${apiKey}`
        );
        const data = await res.json();
        if (mounted && data?.results?.[0]?.geometry?.location) {
          const { lat, lng } = data.results[0].geometry.location;
          setMapCoords({ lat, lng });
        }
      } catch { /* silent */ }
      finally { if (mounted) setGeocoding(false); }
    };
    run();
    return () => { mounted = false; };
  }, [selectedAddressId, addresses]);

  const openCreateForm = () => {
    setEditingId('');
    setForm({ ...INITIAL_FORM, contact_email: user?.email || '' });
    setErrorMessage('');
    setInfoMessage('');
    setFormOpen(true);
  };

  const openEditForm = (address: Address) => {
    setEditingId(address.id);
    setForm({
      title: address.title || '',
      first_name: address.first_name || '',
      last_name: address.last_name || '',
      contact_phone: address.contact_phone || '',
      contact_email: address.contact_email || user?.email || '',
      district: address.district || '',
      neighborhood: address.neighbourhood || '',
      street: (address as any).street || '',
      building_no: address.building_no || '',
      floor: address.floor || '',
      apartment_no: address.apartment_no || '',
      building_name: address.building_name || '',
      full_address: address.full_address || '',
    });
    setErrorMessage('');
    setInfoMessage('');
    setFormOpen(true);
  };

  const resetForm = () => {
    setFormOpen(false);
    setEditingId('');
    setForm(INITIAL_FORM);
  };

  const saveAddress = async () => {
    if (!user) return;

    setErrorMessage('');
    setInfoMessage('');

    if (
      !form.title.trim() ||
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.contact_phone.trim() ||
      !form.contact_email.trim() ||
      !form.district.trim() ||
      !form.neighborhood.trim() ||
      !form.street.trim() ||
      !form.building_no.trim() ||
      !form.floor.trim() ||
      !form.apartment_no.trim()
    ) {
      setErrorMessage('Lütfen zorunlu alanları doldurun.');
      return;
    }

    const selectedDistrict = form.district.trim();
    const selectedNeighborhood = form.neighborhood.trim();
    const validDistrict = districtOptions.some((opt) => opt.value === selectedDistrict);
    if (!validDistrict) {
      setErrorMessage('Lütfen listeden geçerli bir ilçe seçin.');
      return;
    }

    const districtNeighborhoodOptions = neighborhoodOptionsByDistrict[selectedDistrict] || [];
    if (districtNeighborhoodOptions.length === 0) {
      setErrorMessage('Seçilen ilçe için mahalle listesi bulunamadı.');
      return;
    }

    const validNeighborhood = districtNeighborhoodOptions.some(
      (opt) => opt.value === selectedNeighborhood,
    );
    if (!validNeighborhood) {
      setErrorMessage('Lütfen listeden geçerli bir mahalle seçin.');
      return;
    }

    setSaving(true);

    try {
      const supabase = getSupabaseClient();
      const fullAddressAuto = [
        form.street ? `${form.street}` : '',
        form.building_no ? `No:${form.building_no}` : '',
        form.floor ? `Kat:${form.floor}` : '',
        form.apartment_no ? `D:${form.apartment_no}` : '',
        form.building_name ? form.building_name : '',
      ].filter(Boolean).join(' ');

      const payload: Record<string, unknown> = {
        user_id: user.id,
        title: form.title.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        contact_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
        contact_phone: form.contact_phone.trim(),
        contact_email: form.contact_email.trim(),
        district: selectedDistrict,
        neighbourhood: selectedNeighborhood,
        street: form.street.trim(),
        building_no: form.building_no.trim(),
        floor: form.floor.trim(),
        apartment_no: form.apartment_no.trim(),
        building_name: form.building_name.trim() || null,
        full_address: form.full_address.trim() || fullAddressAuto,
        city: 'İzmir',
      };

      if (editingId) {
        const workingPayload = { ...payload };
        delete workingPayload.user_id;
        const droppedColumns = new Set<string>();
        let updatedData: Address | null = null;
        let lastError: unknown = null;

        for (let attempt = 0; attempt < 6; attempt += 1) {
          const { data, error } = await supabase
            .from('addresses')
            .update(workingPayload)
            .eq('id', editingId)
            .eq('user_id', user.id)
            .select('*')
            .single();

          if (!error && data) {
            updatedData = normalizeAddress(data as Record<string, unknown>);
            break;
          }

          const errorText = `${error?.message || ''} ${error?.details || ''}`;
          const missingColumn = getMissingColumnName(errorText);
          lastError = error;

          if (missingColumn && Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)) {
            droppedColumns.add(missingColumn);
            delete workingPayload[missingColumn];
            continue;
          }
          throw error;
        }

        if (!updatedData) throw lastError || new Error('Adres güncellenemedi.');

        if (__DEV__ && droppedColumns.size > 0) {
          console.warn(`[addresses] update fallback applied, dropped columns: ${Array.from(droppedColumns).join(', ')}`);
        }

        setAddresses((prev) =>
          prev.map((item) => (item.id === updatedData?.id ? updatedData : item)),
        );
        setInfoMessage('Adres güncellendi.');
      } else {
        const workingPayload = { ...payload };
        const droppedColumns = new Set<string>();
        let insertedData: Address | null = null;
        let lastError: unknown = null;

        for (let attempt = 0; attempt < 6; attempt += 1) {
          const { data, error } = await supabase
            .from('addresses')
            .insert([workingPayload])
            .select('*')
            .single();

          if (!error && data) {
            insertedData = normalizeAddress(data as Record<string, unknown>);
            break;
          }

          const errorText = `${error?.message || ''} ${error?.details || ''}`;
          const missingColumn = getMissingColumnName(errorText);
          lastError = error;

          if (missingColumn && Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)) {
            droppedColumns.add(missingColumn);
            delete workingPayload[missingColumn];
            continue;
          }
          throw error;
        }

        if (!insertedData) throw lastError || new Error('Adres kaydedilemedi.');

        if (__DEV__ && droppedColumns.size > 0) {
          console.warn(`[addresses] insert fallback applied, dropped columns: ${Array.from(droppedColumns).join(', ')}`);
        }

        setAddresses((prev) => [insertedData as Address, ...prev]);
        handleSelectAddress(insertedData.id);
        setInfoMessage('Adres kaydedildi.');
      }

      resetForm();
    } catch (error: unknown) {
      if (__DEV__) {
        console.warn(`[addresses] kayıt hatası: ${formatSupabaseErrorForDevLog(error)}`);
      }
      setErrorMessage(
        resolveAddressSaveErrorMessage(error, 'Adres kaydedilemedi. Lütfen tekrar deneyin.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteAddress = async (addressId: string) => {
    if (!user) return;

    Alert.alert('Adresi sil', 'Bu adresi silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setErrorMessage('');
          try {
            const supabase = getSupabaseClient();
            const { error } = await supabase
              .from('addresses')
              .delete()
              .eq('id', addressId)
              .eq('user_id', user.id);

            if (error) throw error;
            setAddresses((prev) => prev.filter((item) => item.id !== addressId));
            setInfoMessage('Adres silindi.');
          } catch (error: unknown) {
            if (__DEV__) {
              console.warn(`[addresses] silme hatası: ${formatSupabaseErrorForDevLog(error)}`);
            }
            setErrorMessage(
              mapSupabaseErrorToUserMessage(error, 'Adres silinemedi. Lütfen tekrar deneyin.'),
            );
          }
        },
      },
    ]);
  };

  const handleDistrictChange = (value: string) => {
    const nextDistrict = String(value || '').trim();
    setForm((prev) => {
      const nextNeighborhoodOptions = neighborhoodOptionsByDistrict[nextDistrict] || [];
      const keepNeighborhood = nextNeighborhoodOptions.some((opt) => opt.value === prev.neighborhood);
      return { ...prev, district: nextDistrict, neighborhood: keepNeighborhood ? prev.neighborhood : '' };
    });
  };

  if (loading) return <ActivityIndicator />;
  if (!isAuthenticated) return null;

  return (
    <ScreenContainer edges={['top']} style={s.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <CaretLeft size={22} color="#000000" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Adreslerim</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Sabit Harita */}
        {addresses.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (!mapCoords) return;
              const latLng = `${mapCoords.lat},${mapCoords.lng}`;
              const url = Platform.select({
                ios: `maps:0,0?q=Adresim@${latLng}`,
                android: `geo:0,0?q=${latLng}(Adresim)`,
              });
              Linking.openURL(url || `https://www.google.com/maps/search/?api=1&query=${latLng}`);
            }}
            style={s.mapContainer}
          >
            {mapCoords ? (
              <React.Fragment>
                <Image
                  source={{ uri: `https://maps.googleapis.com/maps/api/staticmap?center=${mapCoords.lat},${mapCoords.lng}&zoom=16&size=800x400&scale=2&markers=color:0xE8431A%7C${mapCoords.lat},${mapCoords.lng}&style=feature:poi%7Cvisibility:off&key=${getGoogleMapsKey()}` }}
                  style={s.mapContainerImg}
                  resizeMode="cover"
                />
                <View style={s.mapBadge}>
                  <MapPin size={11} color="#000" />
                  <Text style={s.mapBadgeText}>Haritada Aç</Text>
                </View>
              </React.Fragment>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }}>
                {geocoding
                  ? <ActivityIndicator color={COLORS.text.secondary} size="small" />
                  : <MapPin size={24} color="#cccccc" />
                }
              </View>
            )}
          </TouchableOpacity>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            s.scroll,
            { paddingBottom: Math.max(100, insets.bottom + 80) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {errorMessage ? <Text style={s.errorText}>{errorMessage}</Text> : null}
          {infoMessage ? <Text style={s.infoText}>{infoMessage}</Text> : null}

          {dataLoading ? (
            <View style={s.centered}>
              <ActivityIndicator color={COLORS.brand.green} size="large" />
            </View>
          ) : (
            <React.Fragment>
              {addresses.map((address) => {
                const isActive = selectedAddress?.id === address.id;
                return (
                  <TouchableOpacity
                    key={address.id}
                    style={[s.addressCard, isActive && s.addressCardActive]}
                    onPress={() => handleSelectAddress(address.id)}
                    activeOpacity={0.85}
                  >
                    <View style={s.addressCardInner}>
                      <View style={[s.addressIcon, isActive && s.addressIconActive]}>
                        <MapPin size={18} color={isActive ? '#000000' : COLORS.text.secondary} />
                      </View>
                      <View style={s.addressInfo}>
                        <View style={s.addressTitleRow}>
                          <Text style={s.addressTitle}>{address.title || 'Adres'}</Text>
                          {isActive && (
                            <View style={s.defaultBadge}>
                              <Text style={s.defaultBadgeText}>Varsayılan</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.addressLine}>{address.full_address}</Text>
                        <Text style={s.addressMeta}>{address.district} • {address.contact_name}</Text>
                      </View>
                    </View>

                    <View style={s.addressActions}>
                      {!isActive && (
                        <TouchableOpacity
                          style={s.defaultBtn}
                          onPress={() => handleSelectAddress(address.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={s.defaultBtnText}>Varsayılan Yap</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={s.iconBtn}
                        onPress={() => openEditForm(address)}
                        activeOpacity={0.8}
                      >
                        <PencilSimple size={14} color="#000000" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.iconBtnDanger}
                        onPress={() => deleteAddress(address.id)}
                        activeOpacity={0.8}
                      >
                        <Trash size={14} color="#d4183d" />
                      </TouchableOpacity>
                    </View>

                    {selectMode && (
                      <TouchableOpacity
                        style={s.selectBtn}
                        onPress={() => navigation.navigate('Checkout', { selectedAddressId: address.id })}
                        activeOpacity={0.85}
                      >
                        <Text style={s.selectBtnText}>Bu Adresi Seç</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}

              {addresses.length === 0 && (
                <View style={s.emptyState}>
                  <MapPin size={48} color="#e0e0e0" weight="thin" />
                  <Text style={s.emptyTitle}>Henüz kayıtlı adresiniz yok</Text>
                  <Text style={s.emptySub}>Sipariş vermek için adres ekleyin</Text>
                </View>
              )}

              {/* Add address button */}
              <TouchableOpacity style={s.addAddressBtn} onPress={openCreateForm} activeOpacity={0.8}>
                <View style={s.addAddressIcon}>
                  <Plus size={16} color="#000000" />
                </View>
                <Text style={s.addAddressBtnText}>Yeni Adres Ekle</Text>
              </TouchableOpacity>

              {/* Form */}
              {formOpen && (
                <View style={s.formCard}>
                  <Text style={s.formTitle}>
                    {editingId ? 'Adresi Düzenle' : 'Yeni Adres'}
                  </Text>

                  <FormField label="Başlık" value={form.title}
                    onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
                    placeholder="Ev / İş" />

                  {/* Ad - Soyad yan yana */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <FormField label="Ad" value={form.first_name}
                        onChangeText={(v) => setForm((p) => ({ ...p, first_name: v }))}
                        placeholder="Adınız" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormField label="Soyad" value={form.last_name}
                        onChangeText={(v) => setForm((p) => ({ ...p, last_name: v }))}
                        placeholder="Soyadınız" />
                    </View>
                  </View>

                  <FormField label="Telefon" value={form.contact_phone}
                    onChangeText={(v) => setForm((p) => ({ ...p, contact_phone: v }))}
                    placeholder="05xx xxx xx xx" keyboardType="phone-pad" />

                  <FormField label="İlçe" value={form.district}
                    onChangeText={handleDistrictChange}
                    type="select" placeholder="İlçe seçiniz"
                    options={districtOptions} editable={districtOptions.length > 0} />
                  {districtOptions.length === 0 && (
                    <Text style={s.noteText}>İlçe listesi yüklenemedi.</Text>
                  )}

                  <FormField label="Mahalle" value={form.neighborhood}
                    onChangeText={(v) => setForm((p) => ({ ...p, neighborhood: v }))}
                    type="select" options={neighborhoodOptions}
                    placeholder={form.district ? 'Mahalle seçiniz' : 'Önce ilçe seçiniz'}
                    editable={Boolean(form.district) && neighborhoodOptions.length > 0} />
                  {Boolean(form.district) && neighborhoodOptions.length === 0 && (
                    <Text style={s.noteText}>Seçilen ilçe için mahalle listesi bulunamadı.</Text>
                  )}

                  <FormField label="Cadde / Sokak" value={form.street}
                    onChangeText={(v) => setForm((p) => ({ ...p, street: v }))}
                    placeholder="Cadde veya sokak adını girin" />

                  {/* No - Kat - Daire yan yana */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <FormField label="No" value={form.building_no}
                        onChangeText={(v) => setForm((p) => ({ ...p, building_no: v }))}
                        placeholder="8" keyboardType="number-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormField label="Kat" value={form.floor}
                        onChangeText={(v) => setForm((p) => ({ ...p, floor: v }))}
                        placeholder="3" keyboardType="number-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormField label="Daire" value={form.apartment_no}
                        onChangeText={(v) => setForm((p) => ({ ...p, apartment_no: v }))}
                        placeholder="10" keyboardType="number-pad" />
                    </View>
                  </View>

                  <FormField label="Apartman Adı (opsiyonel)" value={form.building_name}
                    onChangeText={(v) => setForm((p) => ({ ...p, building_name: v }))}
                    placeholder="Örn: Karabağlar Apt." />

                  <FormField label="Açık Adres (opsiyonel)" value={form.full_address}
                    onChangeText={(v) => setForm((p) => ({ ...p, full_address: v }))}
                    type="textarea" placeholder="Ekstra tarif, sokak adı..." />

                  <View style={s.formBtnsRow}>
                    <TouchableOpacity style={s.cancelBtn} onPress={resetForm} disabled={saving} activeOpacity={0.8}>
                      <Text style={s.cancelBtnText}>Vazgeç</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.saveBtn} onPress={saveAddress} disabled={saving} activeOpacity={0.85}>
                      {saving
                        ? <ActivityIndicator color="#000000" size="small" />
                        : <Text style={s.saveBtnText}>Kaydet</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </React.Fragment>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f6f6' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  centered: { paddingVertical: 40, alignItems: 'center' },

  // Messages
  errorText: { fontSize: 13, color: '#B91C1C', marginBottom: 10 },
  infoText: { fontSize: 13, color: '#16A34A', marginBottom: 10 },

  // Address card
  addressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  addressCardActive: { borderColor: COLORS.brand.green },
  addressCardInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  addressIcon: {
    width: 42, height: 42,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    alignItems: 'center', justifyContent: 'center',
  },
  addressIconActive: { backgroundColor: COLORS.brand.green },
  addressInfo: { flex: 1 },
  addressTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  addressTitle: { fontSize: 15, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  defaultBadge: { backgroundColor: COLORS.brand.green, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  defaultBadgeText: { fontSize: 10, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  addressLine: { fontSize: 13, color: '#000000', marginBottom: 2, lineHeight: 18 },
  addressMeta: { fontSize: 12, color: COLORS.text.tertiary },

  // Address actions
  addressActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  defaultBtn: {
    flex: 1, height: 36, borderRadius: 100,
    backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  defaultBtnText: { fontSize: 12, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: '#000000' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  iconBtnDanger: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(212,24,61,0.1)', alignItems: 'center', justifyContent: 'center' },
  selectBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 100,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center', justifyContent: 'center',
  },
  selectBtnText: { fontSize: 14, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  emptySub: { fontSize: 13, color: COLORS.text.secondary },

  // Add address button
  addAddressBtn: {
    height: 66, borderRadius: 16,
    borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.2)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginBottom: 14,
  },
  addAddressIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center' },
  addAddressBtnText: { fontSize: 14, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: '#000000' },

  // Form
  formCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16 },
  formTitle: { fontSize: 15, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginBottom: 14 },
  formBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: '#000000' },
  saveBtn: {
    flex: 1, height: 48, borderRadius: 100,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  noteText: { fontSize: 12, color: COLORS.text.secondary, marginTop: -6, marginBottom: 8 },

  // Map container
  mapContainer: { height: 180, marginHorizontal: 16, marginBottom: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f0f0f0' },
  mapContainerImg: { width: '100%', height: '100%' },
  mapBadge: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.brand.green, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  mapBadgeText: { fontSize: 11, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
});
