import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Clipboard, Dimensions, FlatList, RefreshControl,
  NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarBlank, CaretLeft, Copy, ForkKnife, Tag, Ticket } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStaggerAnimation } from '../hooks/useStaggerAnimation';
import { Toast } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import BottomSheet from '../components/BottomSheet';
import { CachedImage } from '../components/CachedImage';
import { transformImageUrl, ImagePreset } from '../lib/imageUrl';
import FloatingCartPill from '../components/FloatingCartPill';
import { FLOATING_PILL_GAP, FLOATING_PILL_HEIGHT } from '../constants/layout';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/AuthContext';
import { Campaign, fetchAvailableCampaigns } from '../lib/offers';
import { BannerCell, fetchBannerRows } from '../lib/banners';
import { resolveNavigation } from '../lib/navigation';
import { RootStackParamList } from '../navigation/types';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
type Nav = NativeStackNavigationProp<RootStackParamList>;

/** İki kolon + kenar boşlukları + aradaki boşluk. */
const GRID_GAP = 12;
const TILE_WIDTH = (SCREEN_WIDTH - SPACING.lg * 2 - GRID_GAP) / 2;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

const gunKaldi = (iso?: string | null): number | null => {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
};

/** Kartın üzerindeki büyük indirim yazısı. */
const indirimEtiketi = (c: Campaign): string => {
  if (c.discount_type === 'free_item') return 'ÜCRETSİZ\nÖĞÜN';
  if (c.discount_value == null) return c.title.toUpperCase();
  if (c.discount_type === 'percent') return `%${Number(c.discount_value)}\nİNDİRİM`;
  return `${Number(c.discount_value)}₺\nİNDİRİM`;
};

/**
 * Görsel yoksa marka renklerinden kart üret. Kampanya görseli hazırlanana
 * kadar ekran boş/çirkin görünmesin diye: her kampanyanın en azından
 * okunabilir, markaya uygun bir kartı olur.
 */
const gradyan = (c: Campaign): [string, string, string] => {
  if (c.color_from && c.color_to) {
    return [c.color_from, c.color_via ?? c.color_from, c.color_to];
  }
  if (c.source === 'macro_reward') return ['#0D0D0D', '#14260A', '#1F3D0C'];
  if (c.discount_type === 'percent') return ['#0D0D0D', '#1A1A1A', '#2A2A2A'];
  return ['#123F1E', '#1B5E2A', '#2E7D32'];
};

/** Koyu gradyan üzerinde neon, açık görselde siyah — okunaklılık için. */
const METIN_RENGI = COLORS.brand.green;

// ── Kampanya / kupon karosu ───────────────────────────────────────────────────
function CampaignTile({ campaign, onPress }: { campaign: Campaign; onPress: () => void }) {
  const gorsel = campaign.image_url
    ? (transformImageUrl(campaign.image_url, ImagePreset.bannerLarge) ?? campaign.image_url)
    : null;
  const kalan = gunKaldi(campaign.end_date);
  const odul = campaign.source === 'macro_reward';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.tile, pressed && s.tilePressed]}>
      <View style={s.tileMedia}>
        {gorsel ? (
          <CachedImage uri={gorsel} style={s.tileImage} />
        ) : (
          <LinearGradient colors={gradyan(campaign)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tileImage}>
            {odul && <ForkKnife size={22} color={METIN_RENGI} weight="fill" style={{ marginBottom: 6 }} />}
            <Text style={s.tileDiscount} numberOfLines={2}>{indirimEtiketi(campaign)}</Text>
            {campaign.min_cart_total != null && Number(campaign.min_cart_total) > 0 && (
              <Text style={s.tileMinCart}>{`₺${Number(campaign.min_cart_total)} üzeri`}</Text>
            )}
          </LinearGradient>
        )}

        {campaign.badge ? (
          <View style={s.tileBadge}><Text style={s.tileBadgeText} numberOfLines={1}>{campaign.badge}</Text></View>
        ) : null}

        {kalan != null && kalan <= 7 ? (
          <View style={s.tileUrgent}><Text style={s.tileUrgentText}>{`Son ${kalan} gün`}</Text></View>
        ) : null}
      </View>

      <View style={s.tileFooter}>
        <Text style={s.tileTitle} numberOfLines={2}>{campaign.title}</Text>
      </View>
    </Pressable>
  );
}

// ── Detay sayfası (alt sayfa) ─────────────────────────────────────────────────
function CampaignSheet({
  campaign, visible, onClose, onCopy,
}: { campaign: Campaign | null; visible: boolean; onClose: () => void; onCopy: (code: string) => void }) {
  if (!campaign) return null;
  const gorsel = campaign.image_url
    ? (transformImageUrl(campaign.image_url, ImagePreset.bannerLarge) ?? campaign.image_url)
    : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} showCloseButton maxHeight="80%">
      <View style={s.sheetMedia}>
        {gorsel ? (
          <CachedImage uri={gorsel} style={s.sheetImage} />
        ) : (
          <LinearGradient colors={gradyan(campaign)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sheetImage}>
            <Text style={s.sheetDiscount} numberOfLines={2}>{indirimEtiketi(campaign)}</Text>
          </LinearGradient>
        )}
      </View>

      <Text style={s.sheetTitle}>{campaign.title}</Text>
      {campaign.description ? <Text style={s.sheetDesc}>{campaign.description}</Text> : null}

      <View style={s.sheetMetaBox}>
        {campaign.min_cart_total != null && Number(campaign.min_cart_total) > 0 && (
          <View style={s.sheetMetaRow}>
            <Tag size={14} color={COLORS.text.tertiary} />
            <Text style={s.sheetMetaText}>{`₺${Number(campaign.min_cart_total)} ve üzeri sepetlerde geçerli`}</Text>
          </View>
        )}
        {campaign.end_date && (
          <View style={s.sheetMetaRow}>
            <CalendarBlank size={14} color={COLORS.text.tertiary} />
            <Text style={s.sheetMetaText}>{`${formatDate(campaign.end_date)} tarihine kadar`}</Text>
          </View>
        )}
        {campaign.discount_type === 'free_item' && (
          <View style={s.sheetMetaRow}>
            <ForkKnife size={14} color={COLORS.text.tertiary} />
            <Text style={s.sheetMetaText}>Tek öğünde geçerli — koli ve çoklu tabaklar hariç</Text>
          </View>
        )}
      </View>

      {campaign.code ? (
        <TouchableOpacity style={s.sheetCode} onPress={() => onCopy(campaign.code!)} activeOpacity={0.85}>
          <View>
            <Text style={s.sheetCodeLabel}>Kupon kodu</Text>
            <Text style={s.sheetCodeText}>{campaign.code}</Text>
          </View>
          <View style={s.sheetCopyBtn}>
            <Copy size={14} color="#000" />
            <Text style={s.sheetCopyText}>Kopyala</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <Text style={s.sheetHint}>Kodu sepet ekranındaki "Kupon Kodu Ekle" alanına yapıştır.</Text>
    </BottomSheet>
  );
}

// ── Ana ekran ─────────────────────────────────────────────────────────────────
export default function OffersAndCouponsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [tab, setTab] = useState<'offers' | 'coupons'>('offers');
  const [banners, setBanners] = useState<BannerCell[]>([]);
  const [all, setAll] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef<FlatList<BannerCell>>(null);

  const [secili, setSecili] = useState<Campaign | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [applyError, setApplyError] = useState('');

  // Kişiye özel atanmış kuponlar ve Macro ödülleri "Kuponlarım"da; geri kalan
  // herkese açık kampanyalar "Kampanyalar" sekmesinde. RLS zaten kullanıcının
  // göremeyeceği kuponları hiç göndermiyor.
  const { kampanyalar, kuponlar } = useMemo(() => {
    const kisisel = (c: Campaign) =>
      c.source === 'macro_reward' || (c.user_id != null && c.user_id === user?.id);
    return {
      kampanyalar: all.filter((c) => !kisisel(c)),
      kuponlar: all.filter(kisisel),
    };
  }, [all, user?.id]);

  const { getStyle: getTileStyle } = useStaggerAnimation(Math.max(kampanyalar.length, kuponlar.length));

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [bannerData, c] = await Promise.all([fetchBannerRows(), fetchAvailableCampaigns()]);
      setBanners(bannerData.hero.flatMap((r) => r.cells));
      setAll(c);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Veriler yüklenemedi.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => {
      setBannerIndex((prev) => {
        const next = (prev + 1) % banners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(id);
  }, [banners.length]);

  const kopyala = (code: string) => {
    Clipboard.setString(code);
    showToast(`${code} kopyalandı`, 'info');
  };

  const handleApply = () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) { setApplyError('Kupon kodu girin.'); return; }
    setApplyError('Kuponu sepette uygulayabilirsin — sepet ekranındaki "Kupon Kodu Ekle" alanını kullan.');
  };

  const liste = tab === 'offers' ? kampanyalar : kuponlar;

  const grid = (
    <View style={s.grid}>
      {liste.map((c, i) => (
        <Animated.View key={c.id} style={[{ width: TILE_WIDTH }, getTileStyle(i)]}>
          <CampaignTile campaign={c} onPress={() => setSecili(c)} />
        </Animated.View>
      ))}
    </View>
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
          <CaretLeft size={22} color="#000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Kampanyalar & Kuponlar</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'offers' && s.tabBtnActive]}
          onPress={() => setTab('offers')}
          activeOpacity={0.8}
        >
          <Tag size={14} color={tab === 'offers' ? '#000' : COLORS.text.tertiary} />
          <Text style={[s.tabLabel, tab === 'offers' && s.tabLabelActive]}>Kampanyalar</Text>
          {kampanyalar.length > 0 && (
            <View style={s.tabBadge}><Text style={s.tabBadgeText}>{kampanyalar.length}</Text></View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'coupons' && s.tabBtnActive]}
          onPress={() => setTab('coupons')}
          activeOpacity={0.8}
        >
          <Ticket size={14} color={tab === 'coupons' ? '#000' : COLORS.text.tertiary} />
          <Text style={[s.tabLabel, tab === 'coupons' && s.tabLabelActive]}>Kuponlarım</Text>
          {kuponlar.length > 0 && (
            <View style={s.tabBadge}><Text style={s.tabBadgeText}>{kuponlar.length}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={COLORS.brand.green} size="large" /></View>
      ) : error ? (
        <ErrorState message={error} onAction={() => load()} />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.brand.green} />
          }
          contentContainerStyle={[
            s.scrollContent,
            { paddingBottom: insets.bottom + FLOATING_PILL_HEIGHT + FLOATING_PILL_GAP + 48 },
          ]}
        >
          {tab === 'offers' && banners.length > 0 && (
            <View style={s.bannerSection}>
              <FlatList
                ref={bannerRef}
                data={banners}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  setBannerIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
                }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => resolveNavigation(navigation, item.navigate_to, 'Offers')}
                    style={s.bannerSlide}
                  >
                    <CachedImage
                      uri={transformImageUrl(item.image_url ?? '', ImagePreset.bannerLarge) ?? (item.image_url ?? '')}
                      style={s.bannerImage}
                    />
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

          {tab === 'coupons' && (
            <View style={s.codeCard}>
              <Text style={s.codeCardTitle}>Kupon Kodu Ekle</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={inputCode}
                  onChangeText={(v) => { setInputCode(v.toUpperCase()); setApplyError(''); }}
                  placeholder="KODUNUZ"
                  placeholderTextColor={COLORS.text.tertiary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity style={s.applyBtn} onPress={handleApply} activeOpacity={0.8}>
                  <Text style={s.applyBtnText}>Uygula</Text>
                </TouchableOpacity>
              </View>
              {applyError ? <Text style={s.hintText}>{applyError}</Text> : null}
            </View>
          )}

          <Text style={s.sectionTitle}>
            {tab === 'offers' ? `Tüm Kampanyalar (${kampanyalar.length})` : `Kuponlarım (${kuponlar.length})`}
          </Text>

          {liste.length === 0 ? (
            <EmptyState
              title={tab === 'offers' ? 'Aktif kampanya yok' : 'Kuponun yok'}
              message={
                tab === 'offers'
                  ? 'Şu an aktif kampanya bulunmuyor. Yakında yenileri burada.'
                  : 'Macro biriktirdikçe ücretsiz öğün kuponların burada görünecek.'
              }
            />
          ) : grid}
        </ScrollView>
      )}

      <CampaignSheet
        campaign={secili}
        visible={secili != null}
        onClose={() => setSecili(null)}
        onCopy={kopyala}
      />

      <Toast {...toast} onHide={hideToast} />
      <FloatingCartPill />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17, color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },

  // Sekmeler
  tabBar: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 40, borderRadius: 100, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  tabBtnActive: { backgroundColor: COLORS.brand.green, borderColor: COLORS.brand.green },
  tabLabel: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_600SemiBold', fontWeight: '600',
  },
  tabLabelActive: { color: '#000000', fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700' },
  tabBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: 'rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  tabBadgeText: { fontSize: 10, color: '#000000', fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700' },

  // Banner
  bannerSection: { gap: SPACING.sm },
  bannerSlide: { width: SCREEN_WIDTH - SPACING.lg * 2, marginRight: 0 },
  bannerImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: RADIUS.md },
  dotRow: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.15)' },
  dotActive: { width: 18, backgroundColor: COLORS.brand.green },

  sectionTitle: {
    fontSize: TYPOGRAPHY.size.md, color: COLORS.text.primary, marginTop: SPACING.xs,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },

  // Izgara
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: {
    backgroundColor: '#FFFFFF', borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  tilePressed: { opacity: 0.85 },
  tileMedia: { width: '100%', aspectRatio: 1, backgroundColor: '#0D0D0D' },
  tileImage: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center', padding: SPACING.md,
  },
  tileDiscount: {
    fontSize: 22, lineHeight: 26, textAlign: 'center', color: METIN_RENGI,
    fontFamily: 'PlusJakartaSans_800ExtraBold', fontWeight: '800',
  },
  tileMinCart: {
    marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.6)',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  tileBadge: {
    position: 'absolute', top: 8, left: 8, maxWidth: '80%',
    backgroundColor: COLORS.brand.green, borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tileBadgeText: { fontSize: 10, color: '#000000', fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700' },
  tileUrgent: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(220,38,38,0.92)', borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tileUrgentText: { fontSize: 10, color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700' },
  tileFooter: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm, minHeight: 52 },
  tileTitle: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.primary, lineHeight: 18,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },

  // Kod girişi
  codeCard: {
    backgroundColor: '#FFFFFF', borderRadius: RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', gap: SPACING.sm,
  },
  codeCardTitle: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  inputRow: { flexDirection: 'row', gap: SPACING.sm },
  input: {
    flex: 1, height: 44, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md,
    backgroundColor: '#F4F4F4', color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: TYPOGRAPHY.size.sm,
  },
  applyBtn: {
    height: 44, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: TYPOGRAPHY.size.sm, color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  hintText: {
    fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary, lineHeight: 17,
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  // Detay sayfası
  sheetMedia: { width: '100%', aspectRatio: 16 / 9, borderRadius: RADIUS.md, overflow: 'hidden' },
  sheetImage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  sheetDiscount: {
    fontSize: 32, lineHeight: 36, textAlign: 'center', color: METIN_RENGI,
    fontFamily: 'PlusJakartaSans_800ExtraBold', fontWeight: '800',
  },
  sheetTitle: {
    marginTop: SPACING.lg, fontSize: TYPOGRAPHY.size.lg, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  sheetDesc: {
    marginTop: 6, fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.secondary, lineHeight: 20,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  sheetMetaBox: {
    marginTop: SPACING.lg, gap: SPACING.sm,
    backgroundColor: '#F6F6F6', borderRadius: RADIUS.sm, padding: SPACING.md,
  },
  sheetMetaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sheetMetaText: {
    flex: 1, fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.secondary, lineHeight: 17,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  sheetCode: {
    marginTop: SPACING.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: RADIUS.sm, padding: SPACING.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.2)',
  },
  sheetCodeLabel: {
    fontSize: 11, color: COLORS.text.tertiary, fontFamily: 'PlusJakartaSans_500Medium',
  },
  sheetCodeText: {
    marginTop: 2, fontSize: TYPOGRAPHY.size.md, color: COLORS.text.primary, letterSpacing: 1,
    fontFamily: 'PlusJakartaSans_800ExtraBold', fontWeight: '800',
  },
  sheetCopyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.brand.green, borderRadius: 100,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  sheetCopyText: {
    fontSize: TYPOGRAPHY.size.xs, color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  sheetHint: {
    marginTop: SPACING.md, marginBottom: SPACING.lg,
    fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary, textAlign: 'center',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});
