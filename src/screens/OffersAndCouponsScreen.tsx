import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Clipboard, Dimensions, FlatList, RefreshControl,
  NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useStaggerAnimation } from '../hooks/useStaggerAnimation';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CaretLeft, Clock, Copy, Tag, Ticket } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CachedImage } from '../components/CachedImage';
import { transformImageUrl, ImagePreset } from '../lib/imageUrl';
import FloatingCartPill from '../components/FloatingCartPill';
import { FLOATING_PILL_GAP, FLOATING_PILL_HEIGHT } from '../constants/layout';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/AuthContext';
import { Campaign, fetchCampaigns } from '../lib/offers';
import { BannerCell, fetchBannerRows } from '../lib/banners';
import { resolveNavigation } from '../lib/navigation';
import { getSupabaseClient } from '../lib/supabase';
import { formatSupabaseErrorForDevLog } from '../lib/supabaseErrors';
import { RootStackParamList } from '../navigation/types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
type Nav = NativeStackNavigationProp<RootStackParamList>;

type UserCoupon = {
  id: string; code: string; description: string | null;
  discount_amount: number | null; discount_percent: number | null;
  expires_at: string | null;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
};

// ── Kampanya kartı ─────────────────────────────────────────────────────────────
function CampaignCard({ campaign, onCopy }: { campaign: Campaign; onCopy?: (code: string) => void }) {
  const discountLabel = campaign.discount_value != null
    ? campaign.discount_type === 'percent' ? `%${campaign.discount_value}` : `${campaign.discount_value}₺`
    : null;

  const handleCopy = (code: string) => {
    Clipboard.setString(code);
    onCopy?.(code);
  };

  return (
    <View style={s.campaignCard}>
      <View style={s.accentBar} />
      <View style={s.campaignInner}>
        <View style={s.campaignHeader}>
          <View style={s.campaignIconWrap}><Tag size={16} color="#000" /></View>
          {discountLabel && (
            <View style={s.discountBadge}><Text style={s.discountBadgeText}>{discountLabel} İndirim</Text></View>
          )}
          {campaign.badge && (
            <View style={s.campaignBadge}><Text style={s.campaignBadgeText}>{campaign.badge}</Text></View>
          )}
        </View>
        <Text style={s.campaignTitle}>{campaign.title}</Text>
        {(campaign as any).description && <Text style={s.campaignDesc}>{(campaign as any).description}</Text>}
        <View style={s.dashedSep} />
        <View style={s.metaRow}>
          {campaign.min_cart_total != null && <Text style={s.metaText}>Min. {campaign.min_cart_total}₺</Text>}
          {campaign.end_date && (
            <View style={s.expiryRow}>
              <Clock size={11} color={COLORS.text.tertiary} />
              <Text style={s.metaText}>{formatDate(campaign.end_date)}</Text>
            </View>
          )}
        </View>
        {campaign.code && (
          <TouchableOpacity onPress={() => handleCopy(campaign.code!)} style={s.codeBox} activeOpacity={0.8}>
            <Text style={s.codeText}>{campaign.code}</Text>
            <View style={s.copyBtnRow}>
              <Copy size={12} color="#000" />
              <Text style={s.copyText}>Kopyala</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Kupon kartı ────────────────────────────────────────────────────────────────
function CouponCard({ coupon, onCopy }: { coupon: UserCoupon; onCopy?: (code: string) => void }) {
  const handleCopy = () => {
    Clipboard.setString(coupon.code);
    onCopy?.(coupon.code);
  };
  return (
    <View style={s.couponCard}>
      <View style={s.couponAccent} />
      <View style={s.couponIconWrap}><Tag size={16} color="#000" /></View>
      <View style={s.couponBody}>
        <Text style={s.couponCode}>{coupon.code}</Text>
        {coupon.description && <Text style={s.couponDesc}>{coupon.description}</Text>}
        <View style={s.dashedSep} />
        <View style={s.couponMeta}>
          {coupon.discount_amount != null && (
            <View style={s.discountBadge}><Text style={s.discountBadgeText}>₺{coupon.discount_amount.toFixed(0)} İndirim</Text></View>
          )}
          {coupon.discount_percent != null && (
            <View style={s.discountBadge}><Text style={s.discountBadgeText}>%{coupon.discount_percent} İndirim</Text></View>
          )}
          {coupon.expires_at && (
            <View style={s.expiryRow}>
              <Clock size={11} color={COLORS.text.tertiary} />
              <Text style={s.metaText}>{formatDate(coupon.expires_at)}</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity onPress={handleCopy} style={s.copyBtn} activeOpacity={0.8}>
        <Copy size={14} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

// ── Ana ekran ──────────────────────────────────────────────────────────────────
export default function OffersAndCouponsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tab, setTab] = useState<'offers' | 'coupons'>('offers');
  const { toast, show: showToast, hide: hideToast } = useToast();

  // Kampanya state
  const [banners,      setBanners]      = useState<BannerCell[]>([]);
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError,  setOffersError]  = useState('');
  const [bannerIndex,  setBannerIndex]  = useState(0);
  const bannerRef = useRef<FlatList<BannerCell>>(null);

  // Kupon state
  const [coupons,      setCoupons]      = useState<UserCoupon[]>([]);

  const { getStyle: getCampaignStyle } = useStaggerAnimation(campaigns.length);
  const { getStyle: getCouponStyle } = useStaggerAnimation(coupons.length);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [inputCode,    setInputCode]    = useState('');
  const [applyLoading, setApplyLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false);
  const [applyError,   setApplyError]   = useState('');
  const [applyMessage, setApplyMessage] = useState('');

  const loadOffers = useCallback(async () => {
    setOffersLoading(true); setOffersError('');
    try {
      const [bannerData, c] = await Promise.all([fetchBannerRows(), fetchCampaigns()]);
      setBanners(bannerData.hero.flatMap((r) => r.cells));
      setCampaigns(c);
    } catch (err: unknown) {
      setOffersError(err instanceof Error ? err.message : 'Veriler yüklenemedi.');
    } finally { setOffersLoading(false); }
  }, []);

  const loadCoupons = useCallback(async () => {
    setCouponsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('campaigns')
        .select('id,code,title,discount_value,discount_type,end_date')
        .eq('is_active', true)
        .not('code', 'is', null)
        .order('order', { ascending: true });
      if (error && __DEV__) console.warn('[coupons]', formatSupabaseErrorForDevLog(error));
      setCoupons((Array.isArray(data) ? data : []).filter(row => row.code).map(row => ({
        id: String(row.id ?? ''),
        code: String(row.code ?? '').toUpperCase(),
        description: row.title ? String(row.title) : null,
        discount_amount: row.discount_type === 'fixed' ? Number(row.discount_value ?? 0) : null,
        discount_percent: row.discount_type === 'percent' ? Number(row.discount_value ?? 0) : null,
        expires_at: row.end_date ? String(row.end_date) : null,
      })));
    } catch (e) {
      if (__DEV__) console.warn('[coupons] error', e);
    } finally { setCouponsLoading(false); }
  }, []);

  useEffect(() => { loadOffers(); }, [loadOffers]);
  useEffect(() => { if (tab === 'coupons') loadCoupons(); }, [tab, loadCoupons]);

  // Banner auto-scroll
  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => {
      setBannerIndex(prev => {
        const next = (prev + 1) % banners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(id);
  }, [banners.length]);

  const handleApply = async () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) { setApplyError('Kupon kodu girin.'); return; }
    setApplyError(''); setApplyMessage(''); setApplyLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setApplyLoading(false);
    setApplyError('Kuponu sepette uygulayabilirsiniz. Checkout ekranında "Kupon" alanını kullanın.');
  };

  const totalSavings = coupons.reduce((s, c) => s + (c.discount_amount ?? 0), 0);

  return (
    <View style={[s.root, { flex: 1, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
          <CaretLeft size={22} color="#000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Fırsatlar & Kuponlar</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'offers' && s.tabBtnActive]}
          onPress={() => setTab('offers')}
          activeOpacity={0.8}
        >
          <Tag size={14} color={tab === 'offers' ? '#000' : COLORS.text.tertiary} />
          <Text style={[s.tabLabel, tab === 'offers' && s.tabLabelActive]}>Kampanyalar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'coupons' && s.tabBtnActive]}
          onPress={() => setTab('coupons')}
          activeOpacity={0.8}
        >
          <Ticket size={14} color={tab === 'coupons' ? '#000' : COLORS.text.tertiary} />
          <Text style={[s.tabLabel, tab === 'coupons' && s.tabLabelActive]}>Kuponlarım</Text>
          {coupons.length > 0 && (
            <View style={s.tabBadge}><Text style={s.tabBadgeText}>{coupons.length}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Kampanyalar ── */}
      {tab === 'offers' && (
        offersLoading ? (
          <View style={s.centered}><ActivityIndicator color={COLORS.brand.green} size="large" /></View>
        ) : offersError ? (
          <ErrorState message={offersError} onAction={loadOffers} />
        ) : (
          <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadCoupons(); setRefreshing(false); }} tintColor={COLORS.brand.green} />} showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + FLOATING_PILL_HEIGHT + FLOATING_PILL_GAP + 48 }]}
          >
            {banners.length > 0 && (
              <View style={s.bannerSection}>
                <FlatList
                  keyboardShouldPersistTaps="handled"
                  ref={bannerRef}
                  data={banners}
                  keyExtractor={item => item.id}
                  horizontal pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    setBannerIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
                  }}
                  renderItem={({ item }) => (
                    <Pressable onPress={() => resolveNavigation(navigation, item.navigate_to, 'Offers')} style={s.bannerSlide}>
                      <CachedImage uri={transformImageUrl(item.image_url ?? '', ImagePreset.bannerLarge) ?? (item.image_url ?? '')} style={s.bannerImage} />
                    </Pressable>
                  )}
                />
                {banners.length > 1 && (
                  <View style={s.dotRow}>
                    {banners.map((_, i) => <View key={i} style={[s.dot, i === bannerIndex && s.dotActive]} />)}
                  </View>
                )}
              </View>
            )}
            <Text style={s.sectionTitle}>Aktif Kampanyalar</Text>
            {campaigns.length === 0
              ? <EmptyState title="Aktif kampanya yok" message="Şu an aktif kampanya bulunmuyor." />
              : campaigns.map((c, i) => (
                  <Animated.View key={c.id} style={getCampaignStyle(i)}>
                    <CampaignCard campaign={c} onCopy={code => showToast(`${code} kopyalandı`, 'info')} />
                  </Animated.View>
                ))
            }
          </ScrollView>
        )
      )}

      {/* ── Kuponlarım ── */}
      {tab === 'coupons' && (
        <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadCoupons(); setRefreshing(false); }} tintColor={COLORS.brand.green} />} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + FLOATING_PILL_HEIGHT + FLOATING_PILL_GAP + 48 }]}
        >
          {/* Stats */}
          <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statValue}>{coupons.length}</Text>
                <Text style={s.statLabel}>Aktif Kupon</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statValue}>₺{totalSavings.toFixed(0)}</Text>
                <Text style={s.statLabel}>Toplam Tasarruf</Text>
              </View>
            </View>

          {/* Kupon ekle */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Kupon Kodu Ekle</Text>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={inputCode}
                onChangeText={v => setInputCode(v.toUpperCase())}
                placeholder="KODUNUZ"
                placeholderTextColor={COLORS.text.tertiary}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity style={s.applyBtn} onPress={handleApply} disabled={applyLoading} activeOpacity={0.8}>
                {applyLoading ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.applyBtnText}>Uygula</Text>}
              </TouchableOpacity>
            </View>
            {applyError  && <Text style={s.errorText}>{applyError}</Text>}
            {applyMessage && <Text style={s.successText}>{applyMessage}</Text>}
          </View>

          {/* Liste */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Aktif Kuponlarım</Text>
            {couponsLoading ? (
              <ActivityIndicator color={COLORS.brand.green} style={{ marginVertical: SPACING.lg }} />
            ) : coupons.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
                <Tag size={48} color="#e0e0e0" weight="thin" />
                <Text style={{ fontSize: 16, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000' }}>Kuponunuz Yok</Text>
                <Text style={{ fontSize: 14, color: COLORS.text.tertiary, textAlign: 'center', lineHeight: 21 }}>Henüz aktif kuponunuz bulunmuyor.</Text>
              </View>
            ) : (
              coupons.map((coupon, i) => (
                <Animated.View key={coupon.id} style={getCouponStyle(i)}>
                  <CouponCard coupon={coupon} onCopy={code => showToast(`${code} kopyalandı`, 'info')} />
                </Animated.View>
              ))
            )}
          </View>
        </ScrollView>
      )}
      <Toast {...toast} onHide={hideToast} />

      <FloatingCartPill />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },

  tabBar: {
    flexDirection: 'row', marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
    backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.xs, gap: SPACING.xs,
    ...SHADOWS.sm,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm,
  },
  tabBtnActive: { backgroundColor: COLORS.brand.green },
  tabLabel: { fontSize: 13, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.tertiary },
  tabLabelActive: { color: COLORS.text.primary, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold'},
  tabBadge: {
    backgroundColor: '#000', borderRadius: RADIUS.pill, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xs,
  },
  tabBadgeText: { color: COLORS.brand.green, fontSize: 10, fontWeight: '800',
fontFamily: 'PlusJakartaSans_800ExtraBold'},

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingTop: SPACING.xs },

  bannerSection: { marginBottom: SPACING.sm },
  bannerSlide: { width: SCREEN_WIDTH },
  bannerImage: { width: SCREEN_WIDTH, height: 180 },
  dotRow: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB' },
  dotActive: { backgroundColor: COLORS.brand.green, width: 18 },

  sectionTitle: { fontSize: 16, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },

  // Campaign card
  campaignCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md, marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
    flexDirection: 'row', overflow: 'hidden',
    ...SHADOWS.sm,
  },
  accentBar: { width: 4, backgroundColor: COLORS.brand.green },
  campaignInner: { flex: 1, padding: SPACING.md, gap: SPACING.sm },
  campaignHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  campaignIconWrap: { width: 32, height: 32, borderRadius: RADIUS.xs, backgroundColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center' },
  discountBadge: { backgroundColor: COLORS.brand.green, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  discountBadgeText: { fontSize: 11, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  campaignBadge: { backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  campaignBadgeText: { fontSize: 11, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.primary },
  campaignTitle: { fontSize: 15, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  campaignDesc: { fontSize: 13, color: COLORS.text.secondary, lineHeight: 18 },

  dashedSep: { height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', marginVertical: 2 },
  metaRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  metaText: { fontSize: 12, color: COLORS.text.tertiary },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.background, borderRadius: RADIUS.xs, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border.medium,
  },
  codeText: { fontSize: 14, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary, letterSpacing: 2 },
  copyBtnRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  copyText: { fontSize: 12, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.primary },

  // Coupon card
  couponCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9',
    borderRadius: RADIUS.sm, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)',
    gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  couponAccent: { width: 4, alignSelf: 'stretch', backgroundColor: COLORS.brand.green },
  couponIconWrap: { width: 36, height: 36, borderRadius: RADIUS.xs, backgroundColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  couponBody: { flex: 1, paddingVertical: SPACING.md, gap: SPACING.xs },
  couponCode: { fontSize: 14, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  couponDesc: { fontSize: 12, color: COLORS.text.secondary },
  couponMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  copyBtn: { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },

  // Coupon form
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginHorizontal: SPACING.lg, marginBottom: SPACING.md },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg, alignItems: 'center', gap: SPACING.xs },
  statValue: { fontSize: 22, fontWeight: '800',
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text.primary },
  statLabel: { fontSize: 12, color: COLORS.text.tertiary },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg, gap: SPACING.md, marginHorizontal: SPACING.lg, marginBottom: SPACING.md },
  cardTitle: { fontSize: 15, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  inputRow: { flexDirection: 'row', gap: SPACING.sm },
  input: { flex: 1, height: 48, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border.strong, backgroundColor: COLORS.background, paddingHorizontal: SPACING.lg, fontSize: 14, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.primary },
  applyBtn: { height: 48, borderRadius: RADIUS.pill, backgroundColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  applyBtnText: { color: COLORS.text.primary, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  errorText: { fontSize: 12, color: '#EF4444' },
  successText: { fontSize: 12, color: '#16A34A' },
  emptyState: { alignItems: 'center', paddingVertical: SPACING['2xl'], gap: SPACING.sm },
  emptyText: { color: COLORS.text.tertiary, fontSize: 14 },
});
