import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowRight,
  Bell,
  CaretRight,
  ChartLine,
  CreditCard,
  FileText,
  ChatText,
  Headset,
  Info,
  Lock,
  MapPin,
  Package,
  Question,
  Ruler,
  SignOut,
  Tag,
  Target,
  User,
  CrownSimpleIcon,
  CameraIcon,
} from 'phosphor-react-native';
import ScreenContainer from '../components/ScreenContainer';
import AnimatedNumberText from '../components/AnimatedNumberText';
import { TAB_BAR_TOTAL } from '../constants/layout';
import MacroPointModal from '../components/modals/MacroPointModal';
import { fetchMacroProfile, fetchMacroSettings, macroProgress, MacroProfile, MacroSettings, DEFAULT_MACRO_SETTINGS } from '../lib/macros';
import { useModal } from '../hooks/useModal';
import { useNutritionSummary } from '../hooks/useNutritionSummary';
import { useAuth } from '../context/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { RootStackParamList } from '../navigation/types';
import { useNavGate } from '../store/navGateStore';
import { supabase } from '../lib/supabase';
import { transformImageUrl, ImagePreset } from '../lib/imageUrl';
import { unregisterPushToken } from '../lib/notifications';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { PAYMENT_PROVIDER } from '../config/payment';
import { getCardsFeatureStatus } from '../lib/cards';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type NutritionProfile = {
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
};

type DayCalorie = {
  date: string; // YYYY-MM-DD
  kcal: number;
};

function getBmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Zayıf', color: '#3B82F6' };
  if (bmi < 25)   return { label: 'Normal', color: '#22C55E' };
  if (bmi < 30)   return { label: 'Fazla Kilolu', color: '#F59E0B' };
  return { label: 'Obez', color: '#EF4444' };
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

const DAY_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const BAR_MAX_H = 92;
/** Gün adı satırının yüksekliği — hedef çizgisi bu kadar yukarıdan başlar. */
const LABEL_H = 18;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { isAuthenticated, loading } = useRequireAuth();
  const macroModal = useModal();
  const [macroProfile, setMacroProfile] = useState<MacroProfile | null>(null);
  const [macroSettings, setMacroSettings] = useState<MacroSettings>(DEFAULT_MACRO_SETTINGS);
  const macroProgressAnim = useRef(new Animated.Value(0)).current;
  // Kayıtlı Kartlarım menü satırı: özellik test aşamasında (admin_allowlist
  // dışı + flag kapalı) false gelir — bu durumda satır HİÇ gösterilmez.
  const [savedCardsEnabled, setSavedCardsEnabled] = useState(false);

  useEffect(() => {
    if (PAYMENT_PROVIDER === 'paytr_iframe') return; // satir zaten gizli, istek atmaya gerek yok
    let cancelled = false;
    (async () => {
      try {
        const status = await getCardsFeatureStatus();
        if (!cancelled) setSavedCardsEnabled(status.enabled);
      } catch {
        if (!cancelled) setSavedCardsEnabled(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    Promise.all([fetchMacroProfile(user.id), fetchMacroSettings()]).then(([p, st]) => {
      if (cancelled) return;
      setMacroProfile(p);
      setMacroSettings(st);
      Animated.spring(macroProgressAnim, {
        toValue: macroProgress(p, st).mealProgress,
        useNativeDriver: false,
        speed: 8,
        bounciness: 2,
      }).start();
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const { summary: nutritionSummary, refetch: refetchNutritionSummary } = useNutritionSummary();

  const [dataLoading, setDataLoading] = useState(true);
  /** İlk veri geldi mi — iskelet yalnızca ilk yüklemede gösterilsin diye. */
  const ilkVeriGeldi = useRef(false);
  const [nutrition, setNutrition] = useState<NutritionProfile>({
    height_cm: null,
    weight_kg: null,
    age: null,
  });
  const [weeklyKcal, setWeeklyKcal] = useState<DayCalorie[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url as string);
      });
  }, [user?.id]);

  const pickAvatar = async () => {
    if (!user?.id) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Galeriye erişim izni gerekiyor.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (result.canceled || !result.assets[0]) return;

    try {
      const uri = result.assets[0].uri;
      const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `${user.id}.${ext}`;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64), {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true,
        });

      if (error) {
        if (__DEV__) console.warn('Avatar upload error:', error);
        return;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(publicUrl);

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
    } catch (err) {
      if (__DEV__) console.warn('Avatar upload error:', err);
    }
  };

  const email = user?.email || 'misafir@kcal.com';
  const userName =
    String(user?.user_metadata?.full_name || '').trim() ||
    String(user?.email || 'Kcal Misafir').split('@')[0];
  const initial = userName.charAt(0).toUpperCase();

  const fetchData = useCallback(async () => {
    if (!user) return;
    // İskelet YALNIZCA ilk yüklemede. Bu ekran her odaklandığında
    // fetchData çağrılıyor; her seferinde dataLoading'i açmak profil
    // kartını gri iskelete çeviriyor ve sekmeye her girişte "yükleniyor"
    // hissi veriyordu. Sonraki tazelemeler sessiz yapılır: eldeki veri
    // ekranda kalır, yenisi gelince yerine geçer.
    if (!ilkVeriGeldi.current) setDataLoading(true);
    try {
      const sevenDaysAgo = getLast7Days()[0];

      const [nutritionRes, consumptionsRes] = await Promise.all([
        supabase
          .from('user_nutrition_profiles')
          .select('height, weight, age')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('meal_consumptions')
          .select('consumed_at, calories')
          .eq('user_id', user.id)
          .gte('consumed_at', `${sevenDaysAgo}T00:00:00.000Z`)
          .order('consumed_at', { ascending: true }),
      ]);

      if (nutritionRes.data) {
        setNutrition({
          height_cm: nutritionRes.data.height,
          weight_kg: nutritionRes.data.weight,
          age: nutritionRes.data.age,
        });
      }

      if (consumptionsRes.data) {
        const map: Record<string, number> = {};
        for (const row of consumptionsRes.data) {
          const date = String(row.consumed_at).split('T')[0];
          map[date] = (map[date] ?? 0) + (row.calories ?? 0);
        }
        const days = getLast7Days();
        setWeeklyKcal(days.map(date => ({ date, kcal: map[date] ?? 0 })));
      } else {
        setWeeklyKcal(getLast7Days().map(date => ({ date, kcal: 0 })));
      }
    } finally {
      ilkVeriGeldi.current = true;
      setDataLoading(false);
    }
  }, [user]);

  // Ekran her odaklandığında (ilk açılış dahil) hem beden ölçüleri/haftalık
  // grafik hem de günlük özet yeniden çekilir — profil güncellenip geri
  // dönüldüğünde rakamlar tazelenir.
  useFocusEffect(
    useCallback(() => {
      fetchData();
      refetchNutritionSummary();
    }, [fetchData, refetchNutritionSummary]),
  );

  const handleLogout = async () => {
    // Push token'ı önce deaktive et — signOut'tan sonra auth.uid() kaybolur
    await unregisterPushToken();
    await signOut();
    // Onboarding bayraklarını temizle, sonra AppNavigator'ı yeniden
    // değerlendirmeye zorla. Imperative navigate YOK — signOut user'ı null
    // yapınca AppNavigator state-driven olarak AuthGateway/Welcome'a geçer.
    // (FIX 7 prensibi: stack scope dışına çıkan nav.navigate patlıyordu.)
    await AsyncStorage.multiRemove(['@kcal_onboarding_done', '@kcal_needs_nutrition_profile']);
    useNavGate.getState().refresh();
  };

  // BMI
  const bmi =
    nutrition.height_cm && nutrition.weight_kg
      ? nutrition.weight_kg / Math.pow(nutrition.height_cm / 100, 2)
      : null;
  const bmiDisplay = bmi ? bmi.toFixed(1) : '—';
  const bmiCategory = bmi ? getBmiCategory(bmi) : null;

  // Weekly average
  const weekAvg =
    weeklyKcal.filter(d => d.kcal > 0).length > 0
      ? Math.round(
          weeklyKcal.filter(d => d.kcal > 0).reduce((s, d) => s + d.kcal, 0) /
            weeklyKcal.filter(d => d.kcal > 0).length
        )
      : null;

  const goal = nutritionSummary?.targetKcal || 2000;
  const hasWeekData = weeklyKcal.some(d => d.kcal > 0);
  const kayitliGun = weeklyKcal.filter(d => d.kcal > 0).length;

  // Elde veri varken iskelet gösterme — bkz. fetchData'daki not.
  const iskeletGoster = dataLoading && weeklyKcal.length === 0;

  // Grafiğin tepesi: hedefin biraz üstü ya da en yüksek gün — hangisi
  // büyükse. Hedef çizgisi hep tepeye yapışmasın diye 1.2 katsayısı var.
  const tavan = Math.max(goal * 1.2, ...weeklyKcal.map(d => d.kcal), 1);
  const hedefY = (goal / tavan) * BAR_MAX_H;
  const hedefYuzdesi = goal > 0 && weekAvg ? Math.round((weekAvg / goal) * 100) : 0;

  if (loading) return null;
  if (!isAuthenticated) return null;

  return (
    <ScreenContainer edges={['top']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top > 0 ? 0 : 8, paddingBottom: insets.bottom + TAB_BAR_TOTAL + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Üst Profil Kartı ─── */}
        {/* İskelet YALNIZCA elde hiç veri yokken. dataLoading tek başına
            yeterli değil: ekran her odaklandığında tazelendiği için, veri
            eldeyken de kısa bir an true olabiliyor ve kart "yükleniyor"
            gibi yanıp sönüyordu. */}
        {iskeletGoster ? (
          <View style={styles.skeletonCard} />
        ) : (
          <View style={styles.profileCard}>
            {/* Row: Avatar + Info */}
            <View style={styles.profileRow}>
              <TouchableOpacity style={styles.avatarContainer} onPress={pickAvatar} activeOpacity={0.85}>
                {avatarUrl ? (
                  <Image source={{ uri: transformImageUrl(avatarUrl, ImagePreset.avatarSmall) ?? avatarUrl }} style={styles.avatarCircle} />
                ) : (
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>{initial}</Text>
                  </View>
                )}
                <View style={styles.cameraIcon}>
                  <CameraIcon size={12} color="#FFF" weight="fill" />
                </View>
              </TouchableOpacity>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{userName}</Text>
                <Text style={styles.profileEmail}>{email}</Text>
                {(nutrition.height_cm || nutrition.weight_kg || nutrition.age) ? (
                  <Text style={styles.profileStats}>
                    {[
                      nutrition.height_cm ? `${nutrition.height_cm} cm` : null,
                      nutrition.weight_kg ? `${nutrition.weight_kg} kg` : null,
                      nutrition.age ? `${nutrition.age} yaş` : null,
                    ]
                      .filter(Boolean)
                      .join('  •  ')}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* 3-kolon stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{bmiDisplay}</Text>
                {bmiCategory ? (
                  <View style={[styles.bmiBadge, { backgroundColor: bmiCategory.color + '20' }]}>
                    <Text style={[styles.bmiBadgeText, { color: bmiCategory.color }]}>
                      {bmiCategory.label}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.statLabel}>BMI</Text>
                )}
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValue}>
                  {nutritionSummary?.targetKcal ? `${nutritionSummary.targetKcal}` : '—'}
                </Text>
                <Text style={styles.statLabel}>Günlük Hedef</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{weekAvg ?? '—'}</Text>
                <Text style={styles.statLabel}>Bu Hafta Ort.</Text>
              </View>
            </View>
          </View>
        )}

        {/* ─── Son 7 Gün ─── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Son 7 Gün</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Tabs', { screen: 'Tracker' })} activeOpacity={0.7}>
            <Text style={styles.sectionLink}>Detay →</Text>
          </TouchableOpacity>
        </View>

        {iskeletGoster ? (
          <View style={styles.skeletonWeek} />
        ) : (
          <View style={styles.weekCard}>
            {!hasWeekData ? (
              <Text style={styles.weekEmptyText}>
                Henüz veri yok. Sipariş ver ya da Kcalculate'ten kalori ekle.
              </Text>
            ) : null}

            <View style={styles.weekChart}>
              {/* Hedef çizgisi — grafiğin tek başına anlattığı şey "şu gün şu
                  kadar yedim" idi. Asıl merak edilen "hedefimin neresindeydim";
                  çizgi bu karşılaştırmayı tek bakışta veriyor. */}
              {hasWeekData ? (
                <View pointerEvents="none" style={[styles.hedefCizgi, { bottom: LABEL_H + hedefY }]}>
                  <View style={styles.hedefCizgiKesik} />
                  <View style={styles.hedefRozet}><Text style={styles.hedefRozetText}>Hedef</Text></View>
                </View>
              ) : null}

              {weeklyKcal.map((day) => {
                const dayObj = new Date(day.date + 'T00:00:00');
                const dayName = DAY_SHORT[dayObj.getDay()];
                const oran = day.kcal > 0 ? day.kcal / tavan : 0;
                const barH = day.kcal > 0 ? Math.max(8, oran * BAR_MAX_H) : 4;

                const yuzde = goal > 0 ? day.kcal / goal : 0;
                let barColor = '#EDEDED';
                if (day.kcal > 0) {
                  if (yuzde > 1.15) barColor = '#F59E0B';
                  else if (yuzde >= 0.85) barColor = COLORS.brand.green;
                  else barColor = '#DCEF9B';
                }

                return (
                  <View key={day.date} style={styles.dayCol}>
                    <Text style={styles.dayKcal} numberOfLines={1}>
                      {day.kcal > 0 ? `${(Math.round(day.kcal / 100) / 10).toFixed(1)}k` : ''}
                    </Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { height: barH, backgroundColor: barColor }]} />
                    </View>
                    <Text style={styles.dayName}>{dayName}</Text>
                  </View>
                );
              })}
            </View>

            {hasWeekData ? (
              <Text style={styles.weekOzet}>
                {`${kayitliGun} günde kayıt · ortalama ${weekAvg?.toLocaleString('tr-TR')} kcal · hedefin %${hedefYuzdesi}'i`}
              </Text>
            ) : null}
          </View>
        )}

        {/* ─── Hızlı Erişim 2x2 Grid ─── */}
        <View style={styles.gridRow}>
          <QuickBtn
            icon={<Ruler size={20} color="#3B82F6" />}
            bgColor="#EFF6FF"
            title="Geçmiş Ölçümler"
            onPress={() => navigation.navigate('MeasurementHistory')}
          />
          <QuickBtn
            icon={<Target size={20} color="#22C55E" />}
            bgColor="#F0FDF4"
            title="Hedef Düzenle"
            onPress={() => navigation.navigate('NutritionProfile')}
          />
        </View>
        <View style={styles.gridRow}>
          <QuickBtn
            icon={<Package size={20} color="#F59E0B" />}
            bgColor="#FFFBEB"
            title="Siparişlerim"
            onPress={() => navigation.navigate('ProfileOrders')}
          />
          <QuickBtn
            icon={<Headset size={20} color="#8B5CF6" />}
            bgColor="#F5F3FF"
            title="Destek"
            onPress={() => navigation.navigate('ProfileSupport')}
          />
        </View>

        {/* ─── Macro Coin Kartı ─── */}
        <TouchableOpacity
          style={styles.macroCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Subscriptions' as any)}
        >
          <View style={styles.macroCoinRow}>
            <Image
              source={require('../../assets/macro-coin.png')}
              style={styles.macroCoinImg}
              resizeMode="contain"
            />
            <View style={styles.macroCoinInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' }}>
                <Text style={styles.macroCoinScore}>MACRO</Text>
                {macroProgress(macroProfile, macroSettings).balance > 0 && (
                  <View style={[styles.macroBadge, { flexShrink: 1 }]}>
                    <CrownSimpleIcon size={14} color="#1A1A1A" weight="fill" />
                    <Text style={styles.macroBadgeText} numberOfLines={1}>
                      {`${macroProgress(macroProfile, macroSettings).balance} Macro`}
                    </Text>
                  </View>
                )}
              </View>
              <AnimatedNumberText
                style={styles.macroCoinLabel}
                value={
                  macroProfile
                    ? `Bir sonraki Macro'ya ₺${macroProgress(macroProfile, macroSettings).liraToNextMacro}`
                    : `Her ₺${macroSettings.earnThreshold} alışverişe 1 Macro`
                }
              />
            </View>
            <TouchableOpacity style={styles.macroInfoBtn} onPress={macroModal.open} activeOpacity={0.7}>
              <Info size={16} color="#E8431A" />
            </TouchableOpacity>
          </View>
          <View style={styles.macroProgressBg}>
            <Animated.View style={[styles.macroProgressFill, {
              width: macroProgressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]} />
          </View>
          <View style={styles.macroProgressLabels}>
            <AnimatedNumberText
              style={styles.macroProgressLeft}
              value={`${macroProgress(macroProfile, macroSettings).balance % macroSettings.mealCost} / ${macroSettings.mealCost} — Ücretsiz Öğün`}
            />
            <AnimatedNumberText
              style={styles.macroProgressRight}
              value={`${macroProgress(macroProfile, macroSettings).macrosToNextMeal} macro kaldı`}
            />
          </View>
        </TouchableOpacity>

        {/* ─── Menü Kartı ─── */}
        <View style={styles.menuCard}>
          <MenuItem
            icon={<User color={COLORS.text.secondary} size={18} />}
            title="Kişisel Bilgilerim"
            onPress={() => navigation.navigate('PersonalInfo')}
          />
          <MenuItem
            icon={<MapPin color={COLORS.text.secondary} size={18} />}
            title="Adreslerim"
            onPress={() => navigation.navigate('Addresses')}
            showBorder
          />
          {PAYMENT_PROVIDER !== 'paytr_iframe' && savedCardsEnabled && (
            <MenuItem
              icon={<CreditCard color={COLORS.text.secondary} size={18} />}
              title="Kayıtlı Kartlarım"
              onPress={() => navigation.navigate('ProfileSavedCards')}
              showBorder
            />
          )}
          <MenuItem
            icon={<Tag color={COLORS.text.secondary} size={18} />}
            title="Kuponlarım"
            onPress={() => navigation.navigate('ProfileCoupons')}
            showBorder
          />
          <MenuItem
            icon={<Bell color={COLORS.text.secondary} size={18} />}
            title="Bildirim Tercihleri"
            onPress={() => navigation.navigate('ProfileNotificationPreferences')}
            showBorder
          />
          <MenuItem
            icon={<Lock color={COLORS.text.secondary} size={18} />}
            title="Güvenlik"
            onPress={() => navigation.navigate('ProfileSecurity')}
            showBorder
          />
          <MenuItem
            icon={<Question color={COLORS.text.secondary} size={18} />}
            title="Yardım & Destek"
            onPress={() => navigation.navigate('ProfileSupport')}
            showBorder
          />
          <MenuItem
            icon={<ChatText color={COLORS.text.secondary} size={18} />}
            title="Öneri & Görüş"
            onPress={() => navigation.navigate('Feedback')}
            showBorder
          />
          <MenuItem
            icon={<FileText color={COLORS.text.secondary} size={18} />}
            title="Sözleşmeler"
            onPress={() => navigation.navigate('ProfileContracts')}
            showBorder
          />
        </View>

        {/* ─── Çıkış / Auth ─── */}
        {user ? (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
            <SignOut color="#FFFFFF" size={18} />
            <Text style={styles.logoutText}>Çıkış Yap</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.authButtonsRow}>
            <TouchableOpacity
              style={styles.authButton}
              onPress={() => navigation.navigate('Login', { redirectTo: 'Tabs' })}
              activeOpacity={0.85}
            >
              <Text style={styles.authButtonText}>Giriş Yap</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authButton, styles.authButtonSecondary]}
              onPress={() => navigation.navigate('Register', { redirectTo: 'Tabs' })}
              activeOpacity={0.85}
            >
              <Text style={styles.authButtonTextSecondary}>Kayıt Ol</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footerBrand}>
          <Image
            source={require('../../assets/kcal-logo.png')}
            style={{ height: 24, width: 100 }}
            resizeMode="contain"
          />
          <Text style={styles.footerText}>Tüm Hakları Saklıdır.</Text>
        </View>
      </ScrollView>

      <MacroPointModal
        visible={macroModal.visible}
        onClose={macroModal.close}
        macroProfile={macroProfile}
        macroSettings={macroSettings}
        onNavigateToProfile={() => {
          macroModal.close();
          navigation.navigate('NutritionProfile');
        }}
      />
    </ScreenContainer>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const QuickBtn = ({
  icon,
  bgColor,
  title,
  onPress,
}: {
  icon: React.ReactNode;
  bgColor: string;
  title: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.quickBtn} onPress={onPress} activeOpacity={0.85}>
    <View style={[styles.quickBtnIcon, { backgroundColor: bgColor }]}>{icon}</View>
    <Text style={styles.quickBtnText}>{title}</Text>
    <ArrowRight size={15} color="#C0C0C0" />
  </TouchableOpacity>
);

const MenuItem = ({
  icon,
  title,
  onPress,
  showBorder,
}: {
  icon: React.ReactNode;
  title: string;
  onPress?: () => void;
  showBorder?: boolean;
}) => (
  <Pressable
    style={({ pressed }) => [
      styles.menuItem,
      showBorder && styles.menuItemBorder,
      pressed && styles.menuItemPressed,
    ]}
    onPress={onPress}
  >
    <View style={styles.menuIconWrap}>{icon}</View>
    <Text style={styles.menuText}>{title}</Text>
    <CaretRight color="#d0d0d0" size={18} />
  </Pressable>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  contentContainer: {
    gap: 0,
  },

  // ── Skeleton ──
  skeletonCard: {
    height: 180,
    backgroundColor: '#E5E7EB',
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    opacity: 0.6,
  },
  skeletonWeek: {
    height: 110,
    backgroundColor: '#E5E7EB',
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    opacity: 0.6,
  },

  // ── Profile Card ──
  profileCard: {
    backgroundColor: '#000000',
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    position: 'relative',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#ffffff',
  },
  profileEmail: {
    fontSize: TYPOGRAPHY.size.sm,
    color: 'rgba(255,255,255,0.6)',
  },
  profileStats: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#9CA3AF',
    marginTop: SPACING.xs,
  },
  divider: {
    height: 1,
    // Kart arka plani #000 — acik gri ayirici burada beyaz bir cizgi gibi
    // patliyordu; koyu zeminde dogru olan dusuk-opaklikli beyaz.
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginBottom: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statValue: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    // Siyah kart uzerinde #111 pratikte gorunmuyordu (BMI / Gunluk Hedef /
    // Bu Hafta Ort. okunmuyordu) — 21.09.2026 kontrast duzeltmesi.
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bmiBadge: {
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  bmiBadgeText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },

  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#111111',
  },
  sectionLink: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1A1A1A',
  },

  // ── Week chart ──
  weekCard: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    ...SHADOWS.sm,
  },
  // Sütunlar flex:1 — 7 gün kartın genişliğini TAM doldurur. Eskiden sabit
  // genişlikli sütunlar yatay ScrollView içindeydi ve sağda boşluk kalıyordu.
  weekChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.xs,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    height: BAR_MAX_H,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '62%',
    maxWidth: 26,
    borderRadius: 6,
  },
  dayKcal: {
    fontSize: 11,
    height: 14,
    color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  dayName: {
    height: LABEL_H,
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.text.tertiary,
    fontWeight: TYPOGRAPHY.weight.medium,
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  // Hedef çizgisi
  hedefCizgi: {
    position: 'absolute',
    left: SPACING.xs,
    right: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hedefCizgiKesik: {
    flex: 1,
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.18)',
  },
  hedefRozet: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 100,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  hedefRozetText: {
    fontSize: 9,
    color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  weekOzet: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  weekEmptyText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },

  // ── Quick access grid ──
  gridRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  quickBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#111111',
  },

  // ── Macro card ──
  macroCard: {
    backgroundColor: '#0D0D0D',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  macroInfoBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(232,67,26,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroCoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  },
  macroCoinImg: {
    width: 72,
    height: 72,
  },
  macroCoinInfo: {
    flex: 1,
    minWidth: 0,
    gap: SPACING.xs,
  },
  macroCoinScore: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontWeight: TYPOGRAPHY.weight.black,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  macroCoinLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: TYPOGRAPHY.weight.medium,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  macroProgressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  macroProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.brand.green,
  },
  macroProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroProgressLeft: {
    fontSize: TYPOGRAPHY.size.sm,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: TYPOGRAPHY.weight.medium,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  macroProgressRight: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.brand.green,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },

  // ── Menu card ──
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  menuItemBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  menuItemPressed: {
    backgroundColor: '#fafafa',
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f6f6f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
  },

  // ── Logout ──
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.lg,
    backgroundColor: '#000000',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: TYPOGRAPHY.size.md,
  },

  // ── Auth buttons ──
  authButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.lg,
  },
  authButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authButtonSecondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  authButtonText: {
    color: '#000000',
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  authButtonTextSecondary: {
    color: '#374151',
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // ── Footer ──
  footerBrand: {
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
    gap: SPACING.sm,
    opacity: 0.4,
  },
  footerText: {
    fontSize: TYPOGRAPHY.size.xs,
    color: '#000000',
    fontWeight: TYPOGRAPHY.weight.medium,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  macroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#A3E635',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  macroBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1A1A1A',
  },
});
