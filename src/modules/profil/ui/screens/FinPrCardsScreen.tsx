// G15-S4 — Kayıtlı kartlarım, Final dili (FinPrCards). Eski `SavedCardsScreen`
// (KİMSE) DOKUNULMADI; bu ekran AYNI `lib/cards` işlevlerini çağırır
// (syncSavedCards / setDefaultCard / deleteSavedCard / getCardsFeatureStatus) ve
// `consumeCardsStale` ile "Kart ekle"den dönüşte tazeler — ödeme/kart mantığı
// yeniden yazılmadı. "Yeni kart" → mevcut `ProfileAddCard` (PaynKolay doğrulama,
// KİMSE akışı). Yalnız `yeni_kabuk` açıkken Profil hub'ından açılır.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { CreditCard, Plus, Shield, Trash } from '../../../../components/icons';
import { deleteSavedCard, getCardsFeatureStatus, setDefaultCard, SavedCard, syncSavedCards } from '../../../../lib/cards';
import { consumeCardsStale } from '../../../../lib/cardVerification';
import { FinScreen, FinHeader, FinCard, FinSecondaryButton, body, bodyMedium, bodySemibold, heading } from '../finUi';

const label = (c: SavedCard) => {
  const brand = c.brand?.trim() || 'Kart';
  return c.bank_name?.trim() ? `${c.bank_name.trim()} ${brand}` : brand;
};

export default function FinPrCardsScreen({
  onBack,
  vitrinCards,
}: {
  onBack: () => void;
  /** YALNIZ dev vitrini: Final örneğiyle aynı içerikte kartlar. */
  vitrinCards?: SavedCard[];
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const navigation = useNavigation<any>();

  const [cards, setCards] = useState<SavedCard[]>(vitrinCards ?? []);
  const [loading, setLoading] = useState(!vitrinCards);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [canAdd, setCanAdd] = useState(!!vitrinCards);
  const autoRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (vitrinCards) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const r = await syncSavedCards();
      setCards(r.cards ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('profil.cards_load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tr, vitrinCards]);

  useEffect(() => {
    if (autoRef.current) return;
    autoRef.current = true;
    void load();
  }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (consumeCardsStale()) void load(true);
    });
    return unsub;
  }, [navigation, load]);

  useEffect(() => {
    if (vitrinCards) return;
    let cancelled = false;
    getCardsFeatureStatus()
      .then((r) => {
        if (!cancelled) setCanAdd(r?.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setCanAdd(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vitrinCards]);

  const makeDefault = async (c: SavedCard) => {
    if (c.is_default || busyId) return;
    setBusyId(c.id);
    try {
      await setDefaultCard(c.id);
      setCards((prev) => prev.map((x) => ({ ...x, is_default: x.id === c.id })));
    } catch (e) {
      Alert.alert(tr('profil.cards_title'), e instanceof Error ? e.message : tr('profil.cards_action_failed'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = (c: SavedCard) => {
    if (busyId) return;
    Alert.alert(tr('profil.cards_delete_title'), tr('profil.cards_delete_body', { card: `${label(c)} •••• ${c.last4 ?? ''}` }), [
      { text: tr('profil.cards_cancel'), style: 'cancel' },
      {
        text: tr('profil.cards_delete'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(c.id);
          try {
            await deleteSavedCard(c.id);
            setCards((prev) => prev.filter((x) => x.id !== c.id));
          } catch (e) {
            Alert.alert(tr('profil.cards_title'), e instanceof Error ? e.message : tr('profil.cards_action_failed'));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <FinScreen
      scroll
      contentStyle={{ paddingTop: 0 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.color.ink} onRefresh={() => load(true)} />}
    >
      <FinHeader title={tr('profil.cards_title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 14 }}>
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={t.color.ink} />
          </View>
        ) : cards.length === 0 ? (
          <FinCard style={{ alignItems: 'center', padding: 24, gap: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.color.line, alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={22} color={t.color.ink} />
            </View>
            <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink, textAlign: 'center' }}>{tr('profil.cards_empty_title')}</Text>
            <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center' }}>{tr('profil.cards_empty_body')}</Text>
            {error ? <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{error}</Text> : null}
          </FinCard>
        ) : (
          <View style={{ borderRadius: 20, backgroundColor: t.color.surface, overflow: 'hidden' }}>
            {cards.map((c, i) => (
              <View
                key={c.id}
                style={{
                  minHeight: 64,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.color.line,
                }}
              >
                <CreditCard size={22} color={t.color.ink} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }} numberOfLines={1}>
                    {c.card_alias?.trim() || label(c)} •••• {c.last4 ?? '----'}
                  </Text>
                  {c.is_default ? (
                    <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{tr('profil.cards_default')}</Text>
                  ) : (
                    <Pressable onPress={() => makeDefault(c)} disabled={busyId === c.id} accessibilityRole="button" hitSlop={6}>
                      <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary, textDecorationLine: 'underline' }}>
                        {tr('profil.cards_make_default')}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <Pressable onPress={() => remove(c)} disabled={busyId === c.id} accessibilityRole="button" accessibilityLabel={tr('profil.cards_delete')} hitSlop={8}>
                  {busyId === c.id ? <ActivityIndicator size="small" color={t.color.ink} /> : <Trash size={20} color={t.color.secondary} />}
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {canAdd ? (
          <FinSecondaryButton
            label={tr('profil.cards_new')}
            onPress={() => navigation.navigate('ProfileAddCard')}
            height={52}
            icon={<Plus size={16} color={t.color.ink} weight="bold" />}
          />
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, backgroundColor: t.color.line }}>
          <Shield size={18} color={t.color.secondary} />
          <Text style={{ flex: 1, fontFamily: body, fontSize: 13, lineHeight: 18, color: t.color.secondary }}>{tr('profil.cards_note')}</Text>
        </View>
      </View>
    </FinScreen>
  );
}
