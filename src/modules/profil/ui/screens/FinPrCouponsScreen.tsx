// G15-S4 — Kampanyalar & Kuponlarım, Final dili (eski OffersAndCouponsScreen'in
// yeniden giydirilmesi). Veri AYNI: fetchAvailableCampaigns + fetchBannerRows;
// kişiye özel/Macro ödülü kuponlar "Kuponlarım"da, kalanı "Kampanyalar"da.
// Detay: core/design Sheet + kod kopyala. Yalnız `yeni_kabuk` açıkken Profil'den
// açılır; eski ekran bayrak kapalı yolda kalır.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clipboard, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { NavigationRouteContext, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sheet, useTheme, FinListSkeleton } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { CachedImage } from '../../../../components/CachedImage';
import { Copy, Ticket } from '../../../../components/icons';
import { Campaign, fetchAvailableCampaigns } from '../../../../lib/offers';
import { BannerCell, fetchBannerRows } from '../../../../lib/banners';
import { resolveNavigation } from '../../../../lib/navigation';
import { formatDate, gunKaldi, indirimEtiketi } from '../../../../lib/campaignVisual';
import { transformImageUrl, ImagePreset } from '../../../../lib/imageUrl';
import { FinHeader, FinScreen, FinCard, FinSegmented, FinSecondaryButton, FinPrimaryButton, body, bodyBold, bodyMedium, bodySemibold, heading } from '../finUi';
import { campaignTerms } from '../../../../lib/campaignTerms';
import { setPendingCoupon } from '../../../eatkcal/v2/model/pendingCoupon';
import { useCartStore } from '../../../../store/cartStore';
import { SCROLL_KEYBOARD } from '../../../../core/design/keyboard';
import { CountPill } from '../../../../core/design/components/CountPill';

export default function FinPrCouponsScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { t: tr } = useT();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  // G58-S2 md.4: kupon bildirimi "Gör" → Kuponlarım sekmesi (`tab: 'mine'`).
  const tabParam = (React.useContext(NavigationRouteContext)?.params as { tab?: string } | undefined)?.tab;
  const [tab, setTab] = useState(tabParam === 'mine' ? 1 : 0);
  const [banners, setBanners] = useState<BannerCell[]>([]);
  const [all, setAll] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [code, setCode] = useState('');
  const [hint, setHint] = useState('');
  const [copied, setCopied] = useState('');
  // 16 Kas: "Kodu tanımla" — sepet doluysa sepete gider (orada doğrulanıp uygulanır);
  // boşsa kod bekletilir, ilk sepette otomatik uygulanır.
  const [defined, setDefined] = useState('');
  const cartCount = useCartStore((s) => s.items.length);
  const defineCode = (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setPendingCoupon(c);
    if (cartCount > 0) {
      setSelected(null);
      setDefined('');
      navigation.navigate('EkCart', { couponCode: c });
    } else {
      setDefined(c);
    }
  };

  // YALNIZ __DEV__ vitrini (G58-S2): örnek ücretsiz öğün kuponları (İzmir teklifi ×2 + davet), ilki açık.
  const vitrinFreeMeal = __DEV__ && (React.useContext(NavigationRouteContext)?.params as { vitrinFreeMeal?: boolean } | undefined)?.vitrinFreeMeal === true;
  const load = useCallback(async (isRefresh = false) => {
    if (vitrinFreeMeal) {
      const end = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const start = new Date().toISOString().slice(0, 10);
      const fm = (id: string, code: string, badge: string, source: string): Campaign => ({
        id, title: '1 Öğün Ücretsiz', description: 'Sepetteki en pahalı 1 ana öğün ücretsiz. İçecek ve yan ürünler hariç. Tek kullanımlık.',
        code, badge, is_active: true, start_date: start, end_date: end, min_cart_total: 0, discount_type: 'free_item', discount_value: 0,
        max_discount: 0, max_uses_per_user: 1, user_id: user?.id ?? 'vitrin', source, excluded_categories: ['Detoks & Shake', 'Soslar', 'Koliye Özel Fırsatlar'],
      });
      const list = [fm('v-fm1', 'OGUN261117K7M3Q', 'İzmir teklifi', 'izmir_fresh'), fm('v-fm2', 'OGUN261117X9P2D', 'İzmir teklifi', 'izmir_fresh'), fm('v-fm3', 'OGUN261117B4TQW', 'Davet', 'referral')];
      setAll(list);
      setSelected(list[0]);
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [bannerData, c] = await Promise.all([fetchBannerRows(), fetchAvailableCampaigns()]);
      setBanners(bannerData.hero.flatMap((r) => r.cells));
      setAll(c);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : tr('profil.coupons_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tr, vitrinFreeMeal, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // G56-S1: banner hedefi `Campaign:<id>` → bu ekran, o kampanyanın detayı açık (bir kez).
  // Gezgin dışında da (alt sayfa / test) güvenli: rota bağlamı yoksa parametre yok.
  const campaignParam = (React.useContext(NavigationRouteContext)?.params as { campaignId?: string } | undefined)?.campaignId;
  const openedParam = React.useRef(false);
  useEffect(() => {
    if (!campaignParam || openedParam.current || all.length === 0) return;
    const hit = all.find((c) => String(c.id) === String(campaignParam));
    if (hit) {
      openedParam.current = true;
      setSelected(hit);
    }
  }, [campaignParam, all]);

  const { offers, mine } = useMemo(() => {
    const personal = (c: Campaign) =>
      c.source === 'macro_reward' ||
      c.source === 'cart_recovery_personal' ||
      (c.user_id != null && c.user_id === user?.id) ||
      (c.profile_id != null && c.profile_id === user?.id);
    return { offers: all.filter((c) => !personal(c)), mine: all.filter(personal) };
  }, [all, user?.id]);
  const list = tab === 0 ? offers : mine;

  const copy = (c: string) => {
    Clipboard.setString(c);
    setCopied(c);
  };

  return (
    // G17-S1 md.5: TEK dikey kaydırma (başlık dahil) — iç içe flex ScrollView
    // yerine FinScreen'in kaydırması; sonda güvenli alan + 16.
    // G21-S1 md.10: FinScreen scroll klavyeye duyarlı (iOS içerik içeri alınır,
    // Android kap küçülür) + keyboardShouldPersistTaps="handled" → kod alanı
    // klavye açıkken görünür ve sayfa kaydırılabilir.
    <FinScreen
      scroll
      contentStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={t.color.ink} />}
    >
      <FinHeader title={tr('profil.coupons_title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 14 }}>
        <FinSegmented options={[tr('profil.coupons_tab_offers'), tr('profil.coupons_tab_mine')]} index={tab} onChange={setTab} />

        {loading ? (
          <FinListSkeleton rows={4} style={{ paddingHorizontal: 0, paddingTop: 0 }} />
        ) : error ? (
          <FinCard style={{ alignItems: 'center', gap: 12, padding: 20 }}>
            <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center' }}>{error}</Text>
            <FinSecondaryButton label={tr('profil.coupons_retry')} onPress={() => load()} />
          </FinCard>
        ) : (
          <>
            {tab === 0 && banners.length > 0 ? (
              <ScrollView {...SCROLL_KEYBOARD} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} style={{ marginHorizontal: -16, flexGrow: 0, height: 140 }}>
                <View style={{ width: 4 }} />
                {banners.map((b) => (
                  <Pressable key={b.id} onPress={() => resolveNavigation(navigation, b.navigate_to, 'Offers')}>
                    <CachedImage
                      uri={transformImageUrl(b.image_url ?? '', ImagePreset.bannerLarge) ?? (b.image_url ?? '')}
                      style={{ width: 300, height: 140, borderRadius: 20 }}
                    />
                  </Pressable>
                ))}
                <View style={{ width: 4 }} />
              </ScrollView>
            ) : null}

            {tab === 1 ? (
              <FinCard style={{ gap: 10, padding: 16 }}>
                <Text style={{ fontFamily: heading, fontSize: 17, color: t.color.ink }}>{tr('profil.coupons_add_code')}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={code}
                    onChangeText={(v) => {
                      setCode(v.toUpperCase());
                      setHint('');
                    }}
                    placeholder={tr('profil.coupons_code_ph')}
                    placeholderTextColor={t.color.secondary}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    accessibilityLabel={tr('profil.coupons_code_ph')}
                    testID="pr-coupon-code"
                    style={{ flex: 1, height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: t.color.line, fontFamily: bodyMedium, fontSize: 15, color: t.color.ink }}
                  />
                  <Pressable
                    onPress={() => {
                      if (!code.trim()) {
                        setHint(tr('profil.coupons_enter_code'));
                        return;
                      }
                      defineCode(code);
                      setHint(cartCount > 0 ? '' : tr('profil.coupons_defined'));
                    }}
                    accessibilityRole="button"
                    style={{ height: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: t.color.ink, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.bg }}>{tr('profil.coupons_apply')}</Text>
                  </Pressable>
                </View>
                {hint ? <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{hint}</Text> : null}
              </FinCard>
            ) : null}

            {/* G38 md.4: "Tüm kampanyalar (3)" yerine başlık + sayı hapı. */}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              accessible
              accessibilityRole="header"
              accessibilityLabel={`${tab === 0 ? tr('profil.coupons_all_offers') : tr('profil.coupons_tab_mine')}, ${list.length}`}
              testID="coupons-list-title"
            >
              <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }}>
                {tab === 0 ? tr('profil.coupons_all_offers') : tr('profil.coupons_tab_mine')}
              </Text>
              <CountPill count={list.length} bg={t.color.ink} fg={t.color.bg} testID="coupons-list-count" />
            </View>

            {list.length === 0 ? (
              <FinCard style={{ alignItems: 'center', padding: 24, gap: 8 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.color.line, alignItems: 'center', justifyContent: 'center' }}>
                  <Ticket size={22} color={t.color.ink} />
                </View>
                <Text style={{ fontFamily: heading, fontSize: 18, color: t.color.ink }}>
                  {tab === 0 ? tr('profil.coupons_empty_offers') : tr('profil.coupons_empty_mine')}
                </Text>
              </FinCard>
            ) : (
              list.map((c) => {
                const left = gunKaldi(c.end_date);
                return (
                  <Pressable key={c.id} onPress={() => setSelected(c)} accessibilityRole="button">
                    <FinCard style={{ gap: 4, padding: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ticket size={18} color={t.color.ink} />
                        <Text style={{ fontFamily: heading, fontSize: 18, color: t.color.ink, flex: 1 }} numberOfLines={1}>
                          {indirimEtiketi(c)}
                        </Text>
                        {left != null && left <= 7 ? (
                          <View style={{ height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: t.color.accent, justifyContent: 'center' }}>
                            <Text style={{ fontFamily: bodyBold, fontSize: 11, color: t.color.onAccent }}>{tr('profil.coupons_days_left', { n: left })}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }} numberOfLines={2}>{c.title}</Text>
                      {c.min_cart_total != null && Number(c.min_cart_total) > 0 ? (
                        <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
                          {tr('profil.coupons_min_cart', { n: Number(c.min_cart_total) })}
                        </Text>
                      ) : null}
                    </FinCard>
                  </Pressable>
                );
              })
            )}
          </>
        )}
      </View>

      <Sheet
        visible={!!selected}
        onClose={() => {
          setSelected(null);
          setCopied('');
          setDefined('');
        }}
        title={selected?.title}
        scroll
      >
        {selected ? (
          <View style={{ gap: 12 }}>
            <Text style={{ fontFamily: heading, fontSize: 24, color: t.color.ink }}>{indirimEtiketi(selected)}</Text>
            {selected.description ? (
              <Text style={{ fontFamily: body, fontSize: 15, lineHeight: 21, color: t.color.ink }}>{selected.description}</Text>
            ) : null}
            <View style={{ gap: 8 }} testID="coupon-terms">
              <Text style={{ fontFamily: bodyBold, fontSize: 15, color: t.color.ink }} accessibilityRole="header">
                {tr('profil.coupons_terms')}
              </Text>
              {campaignTerms(selected, (d) => formatDate(d)).map((term) => (
                <View key={term.key} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontFamily: body, fontSize: 14, lineHeight: 20, color: t.color.secondary }}>•</Text>
                  <Text style={{ fontFamily: body, fontSize: 14, lineHeight: 20, color: t.color.ink, flex: 1 }}>
                    {tr(`profil.${term.key}`, term.params)}
                  </Text>
                </View>
              ))}
            </View>
            {selected.code ? (
              <Pressable
                onPress={() => copy(selected.code!)}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 56, borderRadius: 16, paddingHorizontal: 16, backgroundColor: t.color.line }}
              >
                <Text style={{ fontFamily: bodyBold, fontSize: 16, color: t.color.ink }}>{selected.code}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Copy size={16} color={t.color.ink} />
                  <Text style={{ fontFamily: bodySemibold, fontSize: 14, color: t.color.ink }}>
                    {copied === selected.code ? tr('profil.coupons_copied') : tr('profil.coupons_copy')}
                  </Text>
                </View>
              </Pressable>
            ) : null}
            {selected.code ? (
              defined === selected.code.toUpperCase() ? (
                <View style={{ gap: 10 }} testID="coupon-defined">
                  <Text style={{ fontFamily: bodyMedium, fontSize: 14, lineHeight: 20, color: t.color.ink }}>{tr('profil.coupons_defined')}</Text>
                  <FinPrimaryButton
                    label={tr('profil.coupons_shop')}
                    tone="lime"
                    onPress={() => {
                      setSelected(null);
                      setDefined('');
                      navigation.navigate('Home');
                    }}
                    testID="coupon-shop"
                  />
                </View>
              ) : (
                <FinPrimaryButton label={tr('profil.coupons_define')} tone="lime" onPress={() => defineCode(selected.code!)} testID="coupon-define" />
              )
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </FinScreen>
  );
}
