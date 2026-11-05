// eatkcal v2 (G13-S2 md.5) — Adreslerim (FinEkAddresses, FinEkAddressesEmpty).
// Yalnız `yeni_siparis` açıkken kayıtlı rota (`EkAddresses`).
//
// MANTIK AYNEN — src/screens/AddressesScreen.tsx:
//  - liste sorgusu + normalize (:327-347), varsayılan seçim kuralı (:349-363)
//  - varsayılan yap: önce hepsi false, sonra seçilen true; hata → geri al (:237-289)
//  - sil: id + user_id (:810-841)
//  - seçim: `useAddressStore.setSelectedAddress` (:227-231)
// `selectMode` → seçilen adresle Sipariş özetine döner (EkCheckout).
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { EmptyErrorCard, Sheet, Toast, haptic } from '../../../../core/design';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { PencilSimple, Plus, Trash } from '../../../../components/icons';
import { normalizeAddress } from '../../../../lib/addresses';
import { formatSupabaseErrorForDevLog, mapSupabaseErrorToUserMessage } from '../../../../lib/supabaseErrors';
import { useAddressStore } from '../../../../store/addressStore';
import type { Address } from '../../../../types';
import { useEkNav, type EkV2ParamList } from '../nav';
import { EkButton, EkHeader, EkScreen, ekType, useEk } from '../ui/kit';
import { MapThumb } from '../ui/address/fields';
import { formatAddressLine } from '../model/addressModel';
import { deleteAddress, fetchUserAddressRows, setDefaultAddress } from '../model/addressSave';

type Route = RouteProp<EkV2ParamList, 'EkAddresses'>;

export default function EkAddressesScreen() {
  const navigation = useEkNav();
  const route = useRoute<Route>();
  const selectMode = Boolean(route.params?.selectMode);
  const { c, t } = useEk();
  const { user, authLoading } = useAuth();
  const setSelectedAddress = useAddressStore((s) => s.setSelectedAddress);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [askDelete, setAskDelete] = useState<Address | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string>('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigation.replace('Login', { redirectTo: 'Tabs' });
  }, [authLoading, user, navigation]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'focus') => {
      if (!user) return;
      if (mode === 'refresh') setRefreshing(true);
      setErrorMessage('');
      try {
        const rows = await fetchUserAddressRows(getSupabaseClient(), user.id);
        const list = rows.map((r) => normalizeAddress(r)).filter((a) => a.id);
        setAddresses(list);
        // Seçili adres store'da yoksa / silindiyse DB varsayılanı (AddressesScreen:349-363).
        const current = useAddressStore.getState().selectedAddress;
        if (list.length > 0 && (!current || !list.some((a) => a.id === current.id))) {
          const def = list.find((a) => a.is_default) ?? list[0];
          setSelectedAddress(def);
        }
      } catch (error: unknown) {
        if (__DEV__) console.warn(`[EkAddresses] yükleme hatası: ${formatSupabaseErrorForDevLog(error)}`);
        setErrorMessage(mapSupabaseErrorToUserMessage(error, t('eatkcal.v2.address.load_failed')));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, setSelectedAddress, t],
  );

  // Adres ekle/düzenle ekranından dönünce liste tazelenir.
  useFocusEffect(
    useCallback(() => {
      load('focus');
    }, [load]),
  );

  const handlePick = useCallback(
    (address: Address) => {
      haptic('selection');
      setSelectedAddress(address);
      navigation.navigate('EkCheckout', { selectedAddressId: address.id });
    },
    [navigation, setSelectedAddress],
  );

  const handleSetDefault = useCallback(
    async (address: Address) => {
      if (!user || address.is_default) return;
      const previous = addresses;
      setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === address.id })));
      setSelectedAddress({ ...address, is_default: true });
      try {
        await setDefaultAddress(getSupabaseClient(), address.id, user.id);
        haptic('success');
        setToast(
          address.title
            ? t('eatkcal.v2.address.default_set', { title: address.title })
            : t('eatkcal.v2.address.default_set_generic'),
        );
      } catch (error: unknown) {
        setAddresses(previous);
        const prevDefault = previous.find((a) => a.is_default);
        if (prevDefault) setSelectedAddress(prevDefault);
        haptic('warning');
        setToast(t('eatkcal.v2.address.default_failed'));
        if (__DEV__) console.warn(`[EkAddresses] set default error: ${formatSupabaseErrorForDevLog(error)}`);
      }
    },
    [user, addresses, setSelectedAddress, t],
  );

  const confirmDelete = useCallback(async () => {
    if (!user || !askDelete) return;
    const target = askDelete;
    setDeleting(true);
    try {
      await deleteAddress(getSupabaseClient(), target.id, user.id);
      setAddresses((prev) => prev.filter((a) => a.id !== target.id));
      // Silinen adres siparişte seçili kalmasın.
      if (useAddressStore.getState().selectedAddress?.id === target.id) setSelectedAddress(null);
      haptic('success');
      setAskDelete(null);
    } catch (error: unknown) {
      if (__DEV__) console.warn(`[EkAddresses] silme hatası: ${formatSupabaseErrorForDevLog(error)}`);
      setAskDelete(null);
      setErrorMessage(mapSupabaseErrorToUserMessage(error, t('eatkcal.v2.address.delete_failed')));
    } finally {
      setDeleting(false);
    }
  }, [user, askDelete, setSelectedAddress, t]);

  const openAdd = () => navigation.navigate('EkAddressAdd', selectMode ? { selectMode: true } : undefined);

  if (authLoading || !user) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  return (
    <View style={{ flex: 1 }}>
    <EkScreen
      header={
        <EkHeader
          title={t('eatkcal.v2.address.title_list')}
          onBack={() => navigation.goBack()}
          right={<View style={{ width: 44 }} />}
        />
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
      testID="ek-addresses"
    >
      <View style={styles.list}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={c.ink} />
          </View>
        ) : addresses.length === 0 && !errorMessage ? (
          <EmptyErrorCard
            tone="empty"
            title={t('eatkcal.v2.address.empty_title')}
            description={t('eatkcal.v2.address.empty_body')}
            actionLabel={t('eatkcal.v2.address.empty_action')}
            onAction={openAdd}
            testID="ek-addresses-empty"
          />
        ) : (
          <>
            {errorMessage ? (
              <Text style={[ekType.c13, { color: c.danger }]} accessibilityRole="alert">
                {errorMessage}
              </Text>
            ) : null}
            {addresses.map((a) => {
              const line = formatAddressLine(a);
              return (
                <View key={a.id} style={[styles.card, { backgroundColor: c.surface }]} testID={`ek-address-${a.id}`}>
                  <Pressable
                    onPress={() => (selectMode ? handlePick(a) : handleSetDefault(a))}
                    accessibilityRole="button"
                    accessibilityLabel={`${a.title}${a.is_default ? `, ${t('eatkcal.v2.address.default_badge')}` : ''}, ${line}`}
                    accessibilityHint={selectMode ? t('eatkcal.v2.address.select_hint') : t('eatkcal.v2.address.set_default_hint')}
                    style={styles.cardMain}
                  >
                    <MapThumb label={t('eatkcal.v2.address.map_preview')} />
                    <View style={styles.cardText}>
                      <View style={styles.titleRow}>
                        <Text style={[ekType.b15s, { color: c.ink }]} numberOfLines={1}>
                          {a.title}
                        </Text>
                        {a.is_default ? (
                          <View style={[styles.badge, { backgroundColor: c.line }]}>
                            <Text style={[ekType.c13s, { color: c.ink }]}>{t('eatkcal.v2.address.default_badge')}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={2}>
                        {line}
                      </Text>
                    </View>
                  </Pressable>
                  <View>
                    <Pressable
                      onPress={() => navigation.navigate('EkAddressAdd', { addressId: a.id, selectMode })}
                      accessibilityRole="button"
                      accessibilityLabel={t('eatkcal.v2.address.edit')}
                      style={styles.iconBtn}
                    >
                      <PencilSimple size={20} color={c.ink} />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        haptic('selection');
                        setAskDelete(a);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('eatkcal.v2.address.delete')}
                      style={styles.iconBtn}
                      testID={`ek-address-delete-${a.id}`}
                    >
                      <Trash size={20} color={c.secondary} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <Pressable
              onPress={openAdd}
              accessibilityRole="button"
              style={[styles.addBtn, { borderColor: c.line }]}
              testID="ek-addresses-add"
            >
              <Plus size={18} color={c.ink} />
              <Text style={[ekType.b15s, { color: c.ink }]}>{t('eatkcal.v2.address.add_new')}</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* "Adres silinsin mi?" — ortak Sheet (dialog, kapat 44×44) */}
      <Sheet
        visible={askDelete != null}
        onClose={() => setAskDelete(null)}
        title={t('eatkcal.v2.address.delete_title')}
        product="eat"
      >
        <Text style={[ekType.b15, { color: c.secondary, marginBottom: 12 }]}>
          {askDelete ? formatAddressLine(askDelete) : ''}
        </Text>
        <View style={styles.dialogRow}>
          <EkButton
            label={t('eatkcal.v2.address.delete_cancel')}
            variant="secondary"
            onPress={() => setAskDelete(null)}
            style={styles.dialogBtn}
          />
          <EkButton
            label={t('eatkcal.v2.address.delete_confirm')}
            onPress={confirmDelete}
            disabled={deleting}
            style={styles.dialogBtn}
            testID="ek-address-delete-confirm"
          />
        </View>
      </Sheet>
    </EkScreen>
      <View pointerEvents="box-none" style={styles.toastWrap}>
        <Toast visible={Boolean(toast)} message={toast} onDismiss={() => setToast('')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  card: { borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 80 },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { minHeight: 20, paddingHorizontal: 8, borderRadius: 10, justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  dialogRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dialogBtn: { flex: 1 },
  toastWrap: { position: 'absolute', left: 16, right: 16, bottom: 32 },
});
