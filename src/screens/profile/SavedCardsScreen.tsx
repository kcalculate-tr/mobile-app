import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CaretLeft, CreditCard, Lock, Star, Trash } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ScreenContainer';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { RootStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/theme';
import { deleteSavedCard, setDefaultCard, SavedCard, syncSavedCards } from '../../lib/cards';
import { haptic } from '../../utils/haptics';

type SavedCardsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

function cardLabel(card: SavedCard): string {
  const brand = card.brand?.trim() || 'Kart';
  const bank = card.bank_name?.trim();
  return bank ? `${bank} ${brand}` : brand;
}

export default function SavedCardsScreen() {
  const navigation = useNavigation<SavedCardsNavigationProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, loading: authLoading } = useRequireAuth();

  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const result = await syncSavedCards();
      setCards(result.cards ?? []);
      // TEST ASAMASI TESHISI: CardStorageCardList yetkisinin ("00" mi degil mi)
      // gozle kontrolu icin — token/kart bilgisi YOK, sadece durum kodu.
      if (__DEV__) {
        console.log('[SavedCards] sync', {
          synced: result.synced,
          procReturnCode: result.procReturnCode,
          errMsg: result.errMsg,
          cardCount: result.cards?.length ?? 0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kartlar yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // StrictMode/yeniden-render'a karsi guard: ekran mount'unda syncSavedCards
  // EN FAZLA 1 kez otomatik cagrilir (manuel "asagi cekip yenile" bu guard'in
  // disinda, her zaman calisir).
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !autoLoadedRef.current) {
      autoLoadedRef.current = true;
      load();
    }
  }, [isAuthenticated, load]);

  const handleSetDefault = async (card: SavedCard) => {
    if (card.is_default || busyId) return;
    setBusyId(card.id);
    try {
      await setDefaultCard(card.id);
      haptic.success();
      setCards((prev) => prev.map((c) => ({ ...c, is_default: c.id === card.id })));
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (card: SavedCard) => {
    if (busyId) return;
    Alert.alert(
      'Kartı sil',
      `${cardLabel(card)} •••• ${card.last4 ?? ''} kartını silmek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setBusyId(card.id);
            try {
              await deleteSavedCard(card.id);
              haptic.success();
              setCards((prev) => prev.filter((c) => c.id !== card.id));
            } catch (err) {
              Alert.alert('Hata', err instanceof Error ? err.message : 'Kart silinemedi.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  if (authLoading) return <ActivityIndicator />;
  if (!isAuthenticated) return null;

  return (
    <ScreenContainer edges={['top']} style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
          <CaretLeft size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Kayıtlı Kartlarım</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: Math.max(32, insets.bottom + 24) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.brand.green} />
        ) : cards.length === 0 ? (
          <>
            <View style={s.mockCard}>
              <View style={s.mockCardCircle1} />
              <View style={s.mockCardCircle2} />
              <CreditCard size={28} color="rgba(255,255,255,0.4)" />
              <Text style={s.mockCardLabel}>Kart Eklenmemiş</Text>
              <Text style={s.mockCardSub}>Ödeme sırasında "Kartımı kaydet" seçeneğiyle kart ekleyebilirsiniz</Text>
            </View>
            <Text style={s.emptyTitle}>Kayıtlı kart bulunmuyor</Text>
            <Text style={s.emptySub}>
              Ödeme kartlarınızı ekleyerek hızlıca ödeme yapabilirsiniz.
            </Text>
            {error ? <Text style={s.errorText}>{error}</Text> : null}
          </>
        ) : (
          <View style={{ width: '100%', gap: 12 }}>
            {cards.map((card) => (
              <View key={card.id} style={s.cardRow}>
                <View style={s.cardIconWrap}>
                  <CreditCard size={20} color="#000000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{cardLabel(card)}</Text>
                  <Text style={s.cardSub}>•••• {card.last4 ?? '----'}</Text>
                </View>
                {card.is_default ? (
                  <View style={s.defaultBadge}>
                    <Star size={12} color="#1a3d00" weight="fill" />
                    <Text style={s.defaultBadgeText}>Varsayılan</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleSetDefault(card)}
                    disabled={busyId === card.id}
                    style={s.actionBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={s.actionBtnText}>Varsayılan Yap</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleDelete(card)}
                  disabled={busyId === card.id}
                  style={s.deleteBtn}
                  activeOpacity={0.7}
                >
                  {busyId === card.id ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Trash size={18} color="#EF4444" />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={s.securityNote}>
          <Lock size={14} color={COLORS.text.secondary} />
          <Text style={s.securityText}>
            Kart bilgileriniz KCAL'da saklanmaz; lisanslı ödeme kuruluşu
            PaynKolay'ın altyapısında tutulur.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
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

  content: { paddingHorizontal: 16, paddingTop: 8, alignItems: 'center', gap: 14 },

  // Mock card (empty state)
  mockCard: {
    width: '100%', height: 160, borderRadius: 20,
    backgroundColor: '#1a1a1a', overflow: 'hidden',
    alignItems: 'flex-start', justifyContent: 'flex-end',
    padding: 20, gap: 4, marginTop: 4,
  },
  mockCardCircle1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -40,
  },
  mockCardCircle2: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)', top: 20, right: 60,
  },
  mockCardLabel: { fontSize: 16, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: 'rgba(255,255,255,0.6)' },
  mockCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 12 },

  emptyTitle: { fontSize: 16, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', textAlign: 'center' },
  emptySub: { fontSize: 13, color: COLORS.text.secondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },
  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center' },

  // Card row (populated state)
  cardRow: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffffff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  cardSub: { fontSize: 12, color: COLORS.text.secondary, marginTop: 2 },
  defaultBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.brand.green, borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  defaultBadgeText: { fontSize: 11, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#1a3d00' },
  actionBtn: {
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#f0f0f0',
  },
  actionBtnText: { fontSize: 11, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.secondary },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },

  securityNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)', width: '100%', marginTop: 8,
  },
  securityText: { flex: 1, fontSize: 12, color: COLORS.text.secondary, lineHeight: 18 },
});
