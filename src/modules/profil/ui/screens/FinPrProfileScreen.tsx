/**
 * G12-S4 — Profil (kendi), FinPrProfile paneli (madde 2).
 *
 * Kilo/boy/BMI YOK. Bölümler: Kcalculate AI (Hedefim/İlerleme/Koleksiyon),
 * eatkcal (Macro ve Abonelik/Siparişlerim/Adreslerim/Kayıtlı kartlarım/
 * Kuponlarım/Değerlendirmelerim — mevcut ekranlara GERÇEK navigasyon),
 * Ayarlar (S4'ün yeni Fin* ekranları; G21-S1 md.9: kök yığında `ProfileSub`, sağdan kayar),
 * Destek, Çıkış. `src/screens/ProfileScreen.tsx` yalnız `yeni_kabuk` AÇIKKEN
 * bu bileşeni render eder; kapalıyken kendi eski JSX'i bayt bayt aynı kalır.
 *
 * "Herkese açık profilim" ve "Rozetler" satırları G12-S4.md madde 2 listesinde
 * yok ama madde 6'nın ekranlarının (FinProfilePublic/FinBadges) bir giriş
 * noktası olması gerekiyor — kimlik bloğunun altına eklendi (IA kararı, LOG'da).
 * "Hedefim" → TakibeBasla { editGoal:true } (S1 entegrasyon); "Koleksiyon" →
 * S3'ün `collection` modülü ekranı (G12-S6 entegrasyonda bağlandı; fotoğraf
 * akışı Dalga 2 — bkz. CollectionScreen.tsx).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { useNutritionSummary } from '../../../../hooks/useNutritionSummary';
import { getCardsFeatureStatus } from '../../../../lib/cards';
import {
  DEFAULT_MACRO_SETTINGS,
  MacroProfile,
  MacroSettings,
  fetchMacroProfile,
  fetchMacroSettings,
  macroProgress,
} from '../../../../lib/macros';
import { unregisterPushToken } from '../../../../core/notifications';
import { useNavGate } from '../../../../store/navGateStore';
import { RootStackParamList } from '../../../../navigation/types';
import { ProfileSocialHeader } from '../ProfileSocialHeader';
import { PrivacySheet } from '../PrivacySheet';
import {
  Target,
  ChartLine,
  TrophyIcon,
  CrownSimpleIcon,
  Package,
  MapPin,
  CreditCard,
  Tag,
  Star,
  User,
  Bell,
  LockSimple,
  Shield,
  FileText,
  Headset,
  ChatText,
  SignOut,
  MapTrifold,
  Translate,
  SealCheck,
} from '../../../../components/icons';
import { AppText } from '../../../../core/design';
import { EkInfoSheet } from '../../../eatkcal/v2/ui/InfoSheet';
import {
  FinScreen,
  FinSectionLabel,
  FinRowGroup,
  FinRow,
  FinSecondaryButton,
} from '../finUi';
import type { ProfileSubName, ProfileSubParams } from './profileSub';
import { loadCollection, markWon, ProfileCollectionRow, type CollectionStamp } from '../../../collection';
import { HomeInkToast } from '../../../../screens/tracker/HomeInkToast';
import { tabBarContentInset } from '../../../shell';
import { useFeature } from '../../../../core/flags';
import { resetToSignedOut } from '../../../../navigation/signOutReset';
import { ProfileSubRow } from '../../../subscription/ui/ProfileSubSection';
import { CoachProfileRow } from '../../../coach/ui/entries';
import { ProfilePlanRows } from '../../../plan/ui/ProfilePlanRows';
import { useSubscriptionEnabled } from '../../../../lib/subscription/useSubscriptionBootstrap';
import { SCROLL_KEYBOARD } from '../../../../core/design/keyboard';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function FinPrProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const { t: tr, lang, pref: langPref } = useT();
  const { user, signOut } = useAuth();
  const [infoOpen, setInfoOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const yeniSiparis = useFeature('yeni_siparis' as any);
  const yeniOnboardingFlag = useFeature('yeni_onboarding');
  // G25-S1 md.3 (A4): "Macro aboneliğim" yalnız "Öğün Aboneliği" (yakında) sekmesini açıyor →
  // `yakinda_satirlari` kapalıyken satır gizli (Macro bakiyesi "Macro" satırından açılır).
  const yakindaSatirlari = useFeature('yakinda_satirlari');
  // G22-S1 md.4: kcalAI › Abonelik + Yakında (FinSubProfileSoon) — bayrak + RevenueCat.
  const aboneligiGoster = useSubscriptionEnabled();

  // G21-S1 md.9: alt sayfalar kök yığında `ProfileSub` rotası (sağdan kayar, iOS
  // kenar jesti, Android geri tuşu yığından). Önceki sekme içi `setSub` + tab bar
  // gizleme + BackHandler kalktı. Kimlik alanları açık profil / rozetler için taşınır.
  const openSub = useCallback(
    (sub: ProfileSubName, extra?: Omit<ProfileSubParams, 'sub'>) =>
      (navigation as any).navigate('ProfileSub', { sub, ...(extra ?? {}) }),
    [navigation],
  );
  // G15-S2: koleksiyon şeridi — yerel katalog atamalarından son kartlar (en yeni önce).
  const [collectionStamps, setCollectionStamps] = useState<CollectionStamp[]>([]);
  const [collectionNew, setCollectionNew] = useState(false);
  const [collectionToast, setCollectionToast] = useState(false);
  useFocusEffect(
    useCallback(() => {
    let alive = true;
    loadCollection()
      .then((s) => {
        if (!alive) return;
        const entries = Object.entries(s.assignments).sort((a, b) => b[1] - a[1]);
        setCollectionStamps(entries.map(([, no]) => ({ no })));
        // "Yeni": en son kart henüz kazanılmış/görülmüş olarak işaretlenmedi.
        const isNew = entries.length > 0 && !s.won.includes(entries[0][0]);
        setCollectionNew(isNew);
        // FinCollectEntry: yeni kart için bir kez "Koleksiyonuna eklendi · Gör"; görüldü işaretlenir.
        if (isNew) {
          setCollectionToast(true);
          void markWon(entries[0][0]);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []),
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [savedCardsEnabled, setSavedCardsEnabled] = useState(false);
  // G33-S1 md.1: Hedefim kartında hedef özeti ("Kilo ver") — user_nutrition_profiles.goal.
  const [goalType, setGoalType] = useState<string | null>(null);
  const [macroProfile, setMacroProfile] = useState<MacroProfile | null>(null);
  const [macroSettings, setMacroSettings] = useState<MacroSettings>(DEFAULT_MACRO_SETTINGS);
  const { summary } = useNutritionSummary();

  const userName =
    String(user?.user_metadata?.full_name || '').trim() ||
    String(user?.email || 'Kcal Misafir').split('@')[0];

  const fetchIdentity = useCallback(async () => {
    if (!user?.id) return;
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url, handle, is_private')
      .eq('id', user.id)
      .maybeSingle();
    void supabase
      .from('user_nutrition_profiles')
      .select('goal')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data: np }) => setGoalType(((np as { goal?: string | null } | null)?.goal as string | null) ?? null), () => {});
    if (data) {
      setAvatarUrl((data as { avatar_url?: string | null }).avatar_url ?? null);
      setHandle((data as { handle?: string | null }).handle ?? null);
      setIsPrivate(Boolean((data as { is_private?: boolean }).is_private));
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchIdentity();
    }, [fetchIdentity]),
  );

  const fetchMacro = useCallback(async () => {
    if (!user?.id) return;
    const [p, st] = await Promise.all([fetchMacroProfile(user.id), fetchMacroSettings()]);
    setMacroProfile(p);
    setMacroSettings(st);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchMacro();
    }, [fetchMacro]),
  );

  const macroProgressInfo = macroProgress(macroProfile, macroSettings);

  useEffect(() => {
    let cancelled = false;
    getCardsFeatureStatus()
      .then((status) => {
        if (!cancelled) setSavedCardsEnabled(status.enabled);
      })
      .catch(() => {
        if (!cancelled) setSavedCardsEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await unregisterPushToken();
    await signOut();
    await AsyncStorage.multiRemove(['@kcal_onboarding_done', '@kcal_needs_nutrition_profile']);
    useNavGate.getState().refresh();
    // G21-S1 md.8 (#D4): oturumsuz soğuk açılışla aynı ilk ekrana sıfırla.
    resetToSignedOut(yeniOnboardingFlag);
  };

  // Hedef halkası: bugünkü tüketim / hedef (veri yoksa boş halka).
  const goalRatio =
    summary?.targetKcal && summary.targetKcal > 0
      ? Math.max(0, Math.min(1, (summary.consumedKcal ?? 0) / summary.targetKcal))
      : 0;
  const RING_C = 2 * Math.PI * 17;

  return (
    <FinScreen>
      <ScrollView {...SCROLL_KEYBOARD}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: tabBarContentInset(insets.bottom) + 14, gap: 18 }}
      >
        <ProfileSocialHeader
          name={userName}
          avatarUrl={avatarUrl}
          onAvatarPress={() => openSub('public', { handle, displayName: userName, avatarUrl, isPrivate })}
          onOpenSubscriptions={() => openSub('macro')}
        />

        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          <FinSectionLabel>{tr('profil.section_ai')}</FinSectionLabel>
          <FinRowGroup>
            {/* G33-S1 md.1 (Tur 26n FinPrProfile) — TEK kart: halka + "Hedefim" + hedef özeti + "Hedefi düzenle".
                Kişisel plan (26o) gelince aynı karta bağlanır. */}
            <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }} testID="profile-goal-card">
              <Svg width={44} height={44}>
                <Circle cx={22} cy={22} r={17} fill="none" stroke={t.color.line} strokeWidth={5} />
                {goalRatio > 0 ? (
                  <Circle
                    cx={22}
                    cy={22}
                    r={17}
                    fill="none"
                    stroke={t.color.accentLine}
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeDasharray={`${RING_C * goalRatio} ${RING_C}`}
                    transform="rotate(-90 22 22)"
                  />
                ) : null}
              </Svg>
              <View style={{ flex: 1 }}>
                <AppText tone="secondary" style={{ fontSize: 13, lineHeight: 17, fontWeight: '600' }}>
                  {tr('profil.my_goal')}
                </AppText>
                <AppText variant="heading" style={{ fontSize: 18, lineHeight: 23 }}>
                  {summary?.targetKcal ? tr('profil.goal_per_day', { n: summary.targetKcal }) : '—'}
                </AppText>
                {goalType ? (
                  <AppText tone="secondary" style={{ fontSize: 13, lineHeight: 17 }} testID="profile-goal-type">
                    {tr(goalType === 'lose_weight' ? 'tb.goal.lose' : goalType === 'gain_weight' ? 'tb.goal.gain' : 'tb.goal.maintain')}
                  </AppText>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('TakibeBasla', { editGoal: true })}
                accessibilityRole="button"
                style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: t.color.line, justifyContent: 'center' }}
              >
                <AppText style={{ fontSize: 14, fontWeight: '600' }}>{tr('profil.edit_goal')}</AppText>
              </TouchableOpacity>
            </View>
            {/* Abonelik (özel yeşil cam ikon + mevcut plan) ve AI Koç (Balance hapı) — ayrı kcalAI bölümü YOK. */}
            {aboneligiGoster ? <ProfileSubRow onOpen={() => (navigation as any).navigate('SubProfile')} /> : null}
            <CoachProfileRow />
            <FinRow
              icon={<ChartLine size={18} color={t.color.ink} />}
              label={tr('profil.progress')}
              onPress={() => openSub('progress')}
            />
            {/* G15-S2 (FinCollectEntry): en az 1 tabak kartı varsa koleksiyon şeridi. */}
            {collectionStamps.length > 0 ? (
              <ProfileCollectionRow
                count={collectionStamps.length}
                recent={collectionStamps}
                isNew={collectionNew}
                onPress={() => openSub('collection')}
              />
            ) : (
              <FinRow
                icon={<TrophyIcon size={18} color={t.color.ink} />}
                label={tr('profil.collection')}
                onPress={() => openSub('collection')}
              />
            )}
            {/* G33-S1: Alışveriş listesi + Öğün planı (`ogun_plani` bayrağı; değerler bu haftanın planından). */}
            <ProfilePlanRows onOpen={(route) => (navigation as any).navigate(route)} />
          </FinRowGroup>
          {/* G31 kararı: "Yakında · Egzersiz ve fitness rehberi" satırı YOK. */}
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <FinSectionLabel>{tr('profil.section_eatkcal')}</FinSectionLabel>
          <FinRowGroup>
            <FinRow
              first
              icon={<CrownSimpleIcon size={18} color={t.color.ink} />}
              label={tr('profil.macro_and_sub')}
              value={macroProgressInfo.balance > 0 ? `${macroProgressInfo.balance} Macro` : undefined}
              onPress={() => openSub('macro')}
            />
            <FinRow
              icon={<Package size={18} color={t.color.ink} />}
              label={tr('profil.orders')}
              onPress={() => (yeniSiparis ? (navigation as any).navigate('EkOrders') : navigation.navigate('ProfileOrders'))}
            />
            <FinRow
              icon={<MapPin size={18} color={t.color.ink} />}
              label={tr('profil.addresses')}
              onPress={() => (yeniSiparis ? (navigation as any).navigate('EkAddresses') : navigation.navigate('Addresses'))}
            />
            {savedCardsEnabled ? (
              <FinRow
                icon={<CreditCard size={18} color={t.color.ink} />}
                label={tr('profil.saved_cards')}
                onPress={() => openSub('cards')}
              />
            ) : null}
            <FinRow
              icon={<Tag size={18} color={t.color.ink} />}
              label={tr('profil.coupons')}
              onPress={() => openSub('coupons')}
            />
            <FinRow
              icon={<Star size={18} color={t.color.ink} />}
              label={tr('profil.reviews')}
              onPress={() => openSub('reviews')}
            />
          </FinRowGroup>
        </View>

        {/* G15-S4 — G14'ün kaldırdığı "Macro aboneliğim" ve "Hesap gizliliği" satırları
            geri geldi (özellik kaybı yok) + "Rozetlerim" girişi (FinBadges). */}
        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          <FinSectionLabel>{tr('profil.section_account')}</FinSectionLabel>
          <FinRowGroup>
            {yakindaSatirlari ? (
              <FinRow
                first
                icon={<CrownSimpleIcon size={18} color={t.color.ink} />}
                label={tr('profil.macro_subscription')}
                onPress={() => openSub('macroSub')}
              />
            ) : null}
            <FinRow
              first={!yakindaSatirlari}
              icon={<LockSimple size={18} color={t.color.ink} />}
              label={tr('profil.privacy_title')}
              value={isPrivate ? tr('profil.private_account') : tr('profil.privacy_public')}
              onPress={() => setPrivacyOpen(true)}
            />
            <FinRow
              icon={<SealCheck size={18} color={t.color.ink} />}
              label={tr('profil.my_badges')}
              onPress={() => openSub('badges', { handle })}
            />
          </FinRowGroup>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          <FinSectionLabel>{tr('profil.section_settings')}</FinSectionLabel>
          <FinRowGroup>
            <FinRow first icon={<User size={18} color={t.color.ink} />} label={tr('profil.personal')} onPress={() => openSub('personal')} />
            <FinRow icon={<Bell size={18} color={t.color.ink} />} label={tr('profil.notify')} onPress={() => openSub('notify')} />
            <FinRow icon={<LockSimple size={18} color={t.color.ink} />} label={tr('profil.privacy_row')} onPress={() => openSub('privacy')} />
            <FinRow icon={<Shield size={18} color={t.color.ink} />} label={tr('profil.security')} onPress={() => openSub('security')} />
            <FinRow
              icon={<Translate size={18} color={t.color.ink} />}
              label={tr('profil.language')}
              value={langPref === 'system' ? tr('profil.lang_system') : tr(lang === 'en' ? 'profil.lang_en' : 'profil.lang_tr')}
              onPress={() => openSub('language')}
            />
            <FinRow icon={<FileText size={18} color={t.color.ink} />} label={tr('profil.agreements')} onPress={() => openSub('agreements')} />
          </FinRowGroup>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          <FinSectionLabel>{tr('profil.section_support')}</FinSectionLabel>
          <FinRowGroup>
            <FinRow first icon={<Headset size={18} color={t.color.ink} />} label={tr('profil.help_support')} onPress={() => openSub('support')} />
            <FinRow icon={<ChatText size={18} color={t.color.ink} />} label={tr('profil.feedback')} onPress={() => openSub('feedback')} />
            <FinRow icon={<MapTrifold size={18} color={t.color.ink} />} label={tr('profil.delivery_where')} onPress={() => setInfoOpen(true)} />
          </FinRowGroup>
        </View>

        {user ? (
          <View style={{ paddingHorizontal: 16 }}>
            <FinSecondaryButton
              label={tr('profil.logout')}
              onPress={handleLogout}
              icon={<SignOut size={18} color={t.color.ink} />}
            />
          </View>
        ) : null}
      </ScrollView>
      <PrivacySheet
        visible={privacyOpen}
        isPrivate={isPrivate}
        onClose={() => setPrivacyOpen(false)}
        onChanged={(next) => setIsPrivate(next)}
      />
      <EkInfoSheet visible={infoOpen} onClose={() => setInfoOpen(false)} />
      <HomeInkToast
        visible={collectionToast}
        dot
        message={tr('collection.added_toast')}
        bottom={tabBarContentInset(insets.bottom) + 8}
        onView={() => {
          setCollectionToast(false);
          openSub('collection');
        }}
        onDismiss={() => setCollectionToast(false)}
        autoHideMs={__DEV__ && collectionNew ? 0 : 4000}
      />
    </FinScreen>
  );
}
