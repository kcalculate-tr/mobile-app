// eatkcal v2 (G15-S5 md.1) — FinPrCards: "Kayıtlı kartlarım" yeni görünümü.
//
// YALNIZ `yeni_siparis` açıkken `ProfileSavedCards` rotası bu bileşenle
// kaydolur (routes.tsx `savedCardsScreenFor`); kapalıyken bugünkü
// `src/screens/profile/SavedCardsScreen.tsx` AYNEN (o dosyada diff = 0).
//
// MANTIK AYNI SERVİSTEN (src/lib/cards.ts, değişmedi): syncSavedCards ·
// getCardsFeatureStatus · setDefaultCard · deleteSavedCard; Kart Ekle'den
// dönüşte `consumeCardsStale()` → yenile; mount'ta en fazla 1 otomatik sync
// (SavedCardsScreen.tsx:76-83 ile aynı koruma).
// Final'de görünmeyen ama korunan özellikler (özellik kaybı yok):
//  - Varsayılan yap: varsayılan olmayan karta dokununca onay → setDefaultCard
//  - aşağı çekip yenile · boş durum · hata satırı
//  - "Yeni kart" yalnız kart özelliği bu kullanıcıya açıksa (bugünkü kural).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { EmptyErrorCard, haptic } from '../../../../core/design';
import { CreditCard, Plus, Shield, Trash } from '../../../../components/icons';
import {
  deleteSavedCard,
  getCardsFeatureStatus,
  setDefaultCard,
  syncSavedCards,
  type SavedCard,
} from '../../../../lib/cards';
import { consumeCardsStale } from '../../../../lib/cardVerification';
import { useRequireAuth } from '../../../../hooks/useRequireAuth';
import { EkHeader, EkScreen, ekType, useEk } from '../ui/kit';
import { useEkNav } from '../nav';
import { cardSubtitle, cardTitle } from '../model/cardsModel';

type Params = {
  /** YALNIZ __DEV__ vitrini: servis çağrılmadan bu kartlarla açılır. */
  vitrinCards?: SavedCard[];
};

export default function EkSavedCardsScreen() {
  const { c, t, theme } = useEk();
  const navigation = useEkNav();
  const { session } = useRequireAuth();
  const params = (useRoute<RouteProp<{ R: Params | undefined }, 'R'>>().params ?? {}) as Params;
  const vitrinCards = __DEV__ ? params.vitrinCards : undefined;

  const [cards, setCards] = useState<SavedCard[]>(vitrinCards ?? []);
  const [loading, setLoading] = useState(!vitrinCards);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [canAddCard, setCanAddCard] = useState(!!vitrinCards);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await syncSavedCards();
      setCards(result.cards ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('eatkcal.v2.cards.load_failed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (vitrinCards || !session || autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    load();
  }, [session, load, vitrinCards]);

  useEffect(() => {
    if (vitrinCards) return;
    const unsub = navigation.addListener('focus', () => {
      if (consumeCardsStale()) load(true);
    });
    return unsub;
  }, [navigation, load, vitrinCards]);

  useEffect(() => {
    if (vitrinCards || !session) return;
    let cancelled = false;
    getCardsFeatureStatus()
      .then((r) => {
        if (!cancelled) setCanAddCard(r?.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setCanAddCard(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, vitrinCards]);

  const doSetDefault = async (card: SavedCard) => {
    setBusyId(card.id);
    try {
      await setDefaultCard(card.id);
      haptic('success');
      setCards((prev) => prev.map((x) => ({ ...x, is_default: x.id === card.id })));
    } catch (err) {
      Alert.alert(t('eatkcal.v2.cards.error_title'), err instanceof Error ? err.message : t('eatkcal.v2.cards.action_failed'));
    } finally {
      setBusyId(null);
    }
  };

  const onRowPress = (card: SavedCard) => {
    if (card.is_default || busyId) return;
    Alert.alert(t('eatkcal.v2.cards.default_title'), cardTitle(card, t), [
      { text: t('eatkcal.v2.cards.cancel'), style: 'cancel' },
      { text: t('eatkcal.v2.cards.default_confirm'), onPress: () => doSetDefault(card) },
    ]);
  };

  const onDelete = (card: SavedCard) => {
    if (busyId) return;
    Alert.alert(t('eatkcal.v2.cards.delete_title'), t('eatkcal.v2.cards.delete_body', { card: cardTitle(card, t) }), [
      { text: t('eatkcal.v2.cards.cancel'), style: 'cancel' },
      {
        text: t('eatkcal.v2.cards.delete_confirm'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(card.id);
          try {
            await deleteSavedCard(card.id);
            haptic('success');
            setCards((prev) => prev.filter((x) => x.id !== card.id));
          } catch (err) {
            Alert.alert(t('eatkcal.v2.cards.error_title'), err instanceof Error ? err.message : t('eatkcal.v2.cards.delete_failed'));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const outline = theme.isDark ? 'rgba(255,255,255,0.22)' : '#C3C7CC';

  return (
    <EkScreen
      testID="ek-saved-cards"
      header={<EkHeader title={t('eatkcal.v2.cards.title')} onBack={() => navigation.goBack()} />}
      refreshControl={vitrinCards ? undefined : <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      contentStyle={styles.content}
    >
      {loading ? (
        <ActivityIndicator style={styles.loader} color={c.ink} />
      ) : cards.length === 0 ? (
        <EmptyErrorCard
          icon={<CreditCard size={24} color={c.ink} />}
          title={t('eatkcal.v2.cards.empty_title')}
          description={t('eatkcal.v2.cards.empty_body')}
          testID="ek-cards-empty"
        />
      ) : (
        <View style={[styles.group, { backgroundColor: c.surface }]}>
          {cards.map((card, i) => (
            <Pressable
              key={card.id}
              onPress={() => onRowPress(card)}
              disabled={card.is_default || busyId === card.id}
              accessibilityRole="button"
              accessibilityLabel={`${cardTitle(card, t)}, ${cardSubtitle(card, t)}`}
              accessibilityHint={card.is_default ? undefined : t('eatkcal.v2.cards.default_hint')}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}
              testID={`ek-card-${card.id}`}
            >
              <CreditCard size={24} color={c.ink} />
              <View style={styles.rowText}>
                <Text style={[ekType.b15s, { color: c.ink }]} numberOfLines={1}>
                  {cardTitle(card, t)}
                </Text>
                {cardSubtitle(card, t) ? (
                  <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={1}>
                    {cardSubtitle(card, t)}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => onDelete(card)}
                disabled={busyId === card.id}
                accessibilityRole="button"
                accessibilityLabel={t('eatkcal.v2.cards.delete_a11y')}
                style={styles.iconBtn}
                hitSlop={4}
              >
                {busyId === card.id ? (
                  <ActivityIndicator size="small" color={c.secondary} />
                ) : (
                  <Trash size={22} color={c.secondary} />
                )}
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}

      {error ? <Text style={[ekType.c13, { color: c.danger, textAlign: 'center' }]}>{error}</Text> : null}

      {canAddCard ? (
        <Pressable
          onPress={() => {
            haptic('selection');
            navigation.navigate('ProfileAddCard');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.addBtn, { borderColor: outline }, pressed && { opacity: 0.7 }]}
          testID="ek-cards-add"
        >
          <Plus size={20} color={c.ink} />
          <Text style={[ekType.b15s, { color: c.ink }]}>{t('eatkcal.v2.cards.add')}</Text>
        </Pressable>
      ) : null}

      <View style={[styles.note, { backgroundColor: c.line }]}>
        <Shield size={20} color={c.secondary} />
        <Text style={[ekType.c13, { color: c.secondary, flex: 1 }]}>{t('eatkcal.v2.cards.note')}</Text>
      </View>
    </EkScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  loader: { marginTop: 40 },
  group: { borderRadius: 20, overflow: 'hidden' },
  row: { minHeight: 64, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16 },
});
