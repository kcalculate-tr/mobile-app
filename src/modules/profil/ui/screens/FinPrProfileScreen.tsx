/**
 * G12-S4 — Profil (kendi), FinPrProfile paneli (madde 2).
 *
 * Kilo/boy/BMI YOK. Bölümler: Kcalculate AI (Hedefim/İlerleme/Koleksiyon),
 * eatkcal (Macro ve Abonelik/Siparişlerim/Adreslerim/Kayıtlı kartlarım/
 * Kuponlarım/Değerlendirmelerim — mevcut ekranlara GERÇEK navigasyon),
 * Ayarlar (S4'ün yeni Fin* ekranları, yerel alt-yığın — `onBack` ile geri),
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
import SettingsPersonalScreen from './SettingsPersonalScreen';
import SettingsNotifyScreen from './SettingsNotifyScreen';
import SettingsSecurityScreen from './SettingsSecurityScreen';
import SettingsPrivacyScreen from './SettingsPrivacyScreen';
import SettingsAgreementsScreen from './SettingsAgreementsScreen';
import SettingsSupportScreen from './SettingsSupportScreen';
import SettingsFeedbackScreen from './SettingsFeedbackScreen';
import FinPrMacroScreen from './FinPrMacroScreen';
import FinPrProgressScreen from './ProgressScreen';
import BadgesScreen from './BadgesScreen';
import CollectionScreen from './CollectionScreen';
import { loadCollection, markWon, ProfileCollectionRow, type CollectionStamp } from '../../../collection';
import { HomeInkToast } from '../../../../screens/tracker/HomeInkToast';
import { TAB_BAR_R3_HEIGHT } from '../../../shell';
import PublicPreviewScreen from './PublicPreviewScreen';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type SubScreen =
  | 'root'
  | 'personal'
  | 'notify'
  | 'security'
  | 'privacy'
  | 'agreements'
  | 'support'
  | 'feedback'
  | 'macro'
  | 'progress'
  | 'badges'
  | 'collection'
  | 'public';

export default function FinPrProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const { t: tr, lang, setLang } = useT();
  const { user, signOut } = useAuth();
  const [infoOpen, setInfoOpen] = useState(false);

  const [sub, setSub] = useState<SubScreen>('root');
  // G15-S2: koleksiyon şeridi — yerel katalog atamalarından son kartlar (en yeni önce).
  const [collectionStamps, setCollectionStamps] = useState<CollectionStamp[]>([]);
  const [collectionNew, setCollectionNew] = useState(false);
  const [collectionToast, setCollectionToast] = useState(false);
  useEffect(() => {
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
  }, [sub]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [savedCardsEnabled, setSavedCardsEnabled] = useState(false);
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
  };

  if (sub === 'personal') return <SettingsPersonalScreen onBack={() => setSub('root')} />;
  if (sub === 'notify') return <SettingsNotifyScreen onBack={() => setSub('root')} />;
  if (sub === 'security') return <SettingsSecurityScreen onBack={() => setSub('root')} />;
  if (sub === 'privacy') return <SettingsPrivacyScreen onBack={() => setSub('root')} />;
  if (sub === 'agreements') return <SettingsAgreementsScreen onBack={() => setSub('root')} />;
  if (sub === 'support') return <SettingsSupportScreen onBack={() => setSub('root')} />;
  if (sub === 'feedback') return <SettingsFeedbackScreen onBack={() => setSub('root')} />;
  if (sub === 'macro') return <FinPrMacroScreen onBack={() => setSub('root')} />;
  if (sub === 'progress') {
    return (
      <FinPrProgressScreen
        onBack={() => setSub('root')}
        goalKcal={summary?.targetKcal}
        onAddMeasurement={() => navigation.navigate('MeasurementHistory')}
      />
    );
  }
  if (sub === 'badges') return <BadgesScreen onBack={() => setSub('root')} handle={handle} />;
  if (sub === 'collection') return <CollectionScreen onBack={() => setSub('root')} />;
  if (sub === 'public') {
    return (
      <PublicPreviewScreen
        onBack={() => setSub('root')}
        handle={handle}
        displayName={userName}
        avatarUrl={avatarUrl}
        isPrivate={isPrivate}
      />
    );
  }

  // Hedef halkası: bugünkü tüketim / hedef (veri yoksa boş halka).
  const goalRatio =
    summary?.targetKcal && summary.targetKcal > 0
      ? Math.max(0, Math.min(1, (summary.consumedKcal ?? 0) / summary.targetKcal))
      : 0;
  const RING_C = 2 * Math.PI * 17;

  return (
    <FinScreen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120, gap: 18 }}
      >
        <ProfileSocialHeader
          name={userName}
          avatarUrl={avatarUrl}
          onAvatarPress={() => setSub('public')}
          onOpenSubscriptions={() => setSub('macro')}
        />

        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          <FinSectionLabel>{tr('profil.section_ai')}</FinSectionLabel>
          <FinRowGroup>
            {/* G14-S1 — Hedefim kartı (FinPrProfile): halka + hedef + "Hedefi düzenle". */}
            <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('TakibeBasla', { editGoal: true })}
                accessibilityRole="button"
                style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: t.color.line, justifyContent: 'center' }}
              >
                <AppText style={{ fontSize: 14, fontWeight: '600' }}>{tr('profil.edit_goal')}</AppText>
              </TouchableOpacity>
            </View>
            <FinRow
              icon={<ChartLine size={18} color={t.color.ink} />}
              label={tr('profil.progress')}
              onPress={() => setSub('progress')}
            />
            {/* G15-S2 (FinCollectEntry): en az 1 tabak kartı varsa koleksiyon şeridi. */}
            {collectionStamps.length > 0 ? (
              <ProfileCollectionRow
                count={collectionStamps.length}
                recent={collectionStamps}
                isNew={collectionNew}
                onPress={() => setSub('collection')}
              />
            ) : (
              <FinRow
                icon={<TrophyIcon size={18} color={t.color.ink} />}
                label={tr('profil.collection')}
                onPress={() => setSub('collection')}
              />
            )}
          </FinRowGroup>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <FinSectionLabel>{tr('profil.section_eatkcal')}</FinSectionLabel>
          <FinRowGroup>
            <FinRow
              first
              icon={<CrownSimpleIcon size={18} color={t.color.ink} />}
              label={tr('profil.macro_and_sub')}
              value={macroProgressInfo.balance > 0 ? `${macroProgressInfo.balance} Macro` : undefined}
              onPress={() => setSub('macro')}
            />
            <FinRow
              icon={<Package size={18} color={t.color.ink} />}
              label={tr('profil.orders')}
              onPress={() => navigation.navigate('ProfileOrders')}
            />
            <FinRow
              icon={<MapPin size={18} color={t.color.ink} />}
              label={tr('profil.addresses')}
              onPress={() => navigation.navigate('Addresses')}
            />
            {savedCardsEnabled ? (
              <FinRow
                icon={<CreditCard size={18} color={t.color.ink} />}
                label={tr('profil.saved_cards')}
                onPress={() => navigation.navigate('ProfileSavedCards')}
              />
            ) : null}
            <FinRow
              icon={<Tag size={18} color={t.color.ink} />}
              label={tr('profil.coupons')}
              onPress={() => navigation.navigate('ProfileCoupons')}
            />
            <FinRow
              icon={<Star size={18} color={t.color.ink} />}
              label={tr('profil.reviews')}
              onPress={() => navigation.navigate('ProfileReviews')}
            />
          </FinRowGroup>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          <FinSectionLabel>{tr('profil.section_settings')}</FinSectionLabel>
          <FinRowGroup>
            <FinRow first icon={<User size={18} color={t.color.ink} />} label={tr('profil.personal')} onPress={() => setSub('personal')} />
            <FinRow icon={<Bell size={18} color={t.color.ink} />} label={tr('profil.notify')} onPress={() => setSub('notify')} />
            <FinRow icon={<LockSimple size={18} color={t.color.ink} />} label={tr('profil.privacy_row')} onPress={() => setSub('privacy')} />
            <FinRow icon={<Shield size={18} color={t.color.ink} />} label={tr('profil.security')} onPress={() => setSub('security')} />
            <FinRow
              icon={<Translate size={18} color={t.color.ink} />}
              label={tr('profil.language')}
              value={tr(lang === 'en' ? 'profil.lang_en' : 'profil.lang_tr')}
              onPress={() => setLang(lang === 'en' ? 'tr' : 'en')}
            />
            <FinRow icon={<FileText size={18} color={t.color.ink} />} label={tr('profil.agreements')} onPress={() => setSub('agreements')} />
          </FinRowGroup>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          <FinSectionLabel>{tr('profil.section_support')}</FinSectionLabel>
          <FinRowGroup>
            <FinRow first icon={<Headset size={18} color={t.color.ink} />} label={tr('profil.help_support')} onPress={() => setSub('support')} />
            <FinRow icon={<ChatText size={18} color={t.color.ink} />} label={tr('profil.feedback')} onPress={() => setSub('feedback')} />
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
      <EkInfoSheet visible={infoOpen} onClose={() => setInfoOpen(false)} />
      <HomeInkToast
        visible={collectionToast}
        dot
        message={tr('collection.added_toast')}
        bottom={insets.bottom + TAB_BAR_R3_HEIGHT + 8}
        onView={() => {
          setCollectionToast(false);
          setSub('collection');
        }}
        onDismiss={() => setCollectionToast(false)}
        autoHideMs={__DEV__ && collectionNew ? 0 : 4000}
      />
    </FinScreen>
  );
}
