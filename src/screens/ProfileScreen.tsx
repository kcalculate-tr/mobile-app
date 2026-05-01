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
import { useNavigation } from '@react-navigation/native';
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
import { fetchMacroProfile, isPrivileged, privilegedDaysLeft, privilegedUntilFormatted, MacroProfile, MEMBERSHIP_THRESHOLD } from '../lib/macros';
import { useModal } from '../hooks/useModal';
import { useAuth } from '../context/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { transformImageUrl, ImagePreset } from '../lib/imageUrl';
import { unregisterPushToken } from '../lib/notifications';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { PAYMENT_PROVIDER } from '../config/payment';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type NutritionProfile = {
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
  daily_calories_goal: number | null;
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

const BAR_MAX_H = 44;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { isAuthenticated, loading } = useRequireAuth();
  const macroModal = useModal();
  const [macroProfile, setMacroProfile] = useState<MacroProfile | null>(null);
  const macroProgressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user?.id) return;
    fetchMacroProfile(user.id).then(p => {
      setMacroProfile(p);
      const progressValue = Math.min(((p?.macro_balance ?? 0) / MEMBERSHIP_THRESHOLD), 1);
      Animated.spring(macroProgressAnim, {
        toValue: progressValue,
        useNativeDriver: false,
        speed: 8,
        bounciness: 2,
      }).start();
    });
  }, [user?.id]);

  const [dataLoading, setDataLoading] = useState(true);
  const [nutrition, setNutrition] = useState<NutritionProfile>({
    height_cm: null,
    weight_kg: null,
    age: null,
    daily_calories_goal: null,
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
    setDataLoading(true);
    try {
      const sevenDaysAgo = getLast7Days()[0];

      const [nutritionRes, mealLogsRes] = await Promise.all([
        supabase
          .from('user_nutrition_profiles')
          .select('height_cm, weight_kg, age, daily_calories_goal')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('meal_logs')
          .select('logged_at, calories')
          .eq('user_id', user.id)
          .gte('logged_at', sevenDaysAgo)
          .order('logged_at', { ascending: true }),
      ]);

      if (nutritionRes.data) setNutrition(nutritionRes.data);

      if (mealLogsRes.data) {
        const map: Record<string, number> = {};
        for (const log of mealLogsRes.data) {
          const date = String(log.logged_at).split('T')[0];
          map[date] = (map[date] ?? 0) + (log.calories ?? 0);
        }
        const days = getLast7Days();
        setWeeklyKcal(days.map(date => ({ date, kcal: map[date] ?? 0 })));
      } else {
        setWeeklyKcal(getLast7Days().map(date => ({ date, kcal: 0 })));
      }
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    // Push token'ı önce deaktive et — signOut'tan sonra auth.uid() kaybolur
    await unregisterPushToken();
    await signOut();
    await AsyncStorage.removeItem('@kcal_onboarding_done');
    await AsyncStorage.removeItem('@kcal_needs_nutrition_profile');
    navigation.navigate('Tabs', { screen: 'Home' });
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

  const goal = nutrition.daily_calories_goal ?? 2000;
  const hasWeekData = weeklyKcal.some(d => d.kcal > 0);

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
        {dataLoading ? (
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
                  {nutrition.daily_calories_goal ? `${nutrition.daily_calories_goal}` : '—'}
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

        {dataLoading ? (
          <View style={styles.skeletonWeek} />
        ) : (
          <View style={styles.weekCard}>
            {!hasWeekData && (
              <Text style={styles.weekEmptyText}>
                Henüz veri yok — sipariş ver veya kalori ekle
              </Text>
            )}
            <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRow}>
              {weeklyKcal.map((day) => {
                const dayObj = new Date(day.date + 'T00:00:00');
                const dayName = DAY_SHORT[dayObj.getDay()];
                const ratio = hasWeekData && day.kcal > 0 ? day.kcal / goal : 0;
                const barH = hasWeekData
                  ? day.kcal > 0
                    ? Math.max(6, Math.min(BAR_MAX_H, ratio * BAR_MAX_H))
                    : 8
                  : BAR_MAX_H * 0.2;

                let barColor = '#D1D5DB';
                if (day.kcal > 0) {
                  const pct = day.kcal / goal;
                  if (pct < 0.85) barColor = '#3B82F6';
                  else if (pct <= 1.15) barColor = '#22C55E';
                  else barColor = '#EF4444';
                }

                return (
                  <View key={day.date} style={styles.dayCol}>
                    <Text style={styles.dayKcal}>
                      {day.kcal > 0 ? `${Math.round(day.kcal / 1000 * 10) / 10}k` : ''}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          { height: barH, backgroundColor: barColor },
                        ]}
                      />
                    </View>
                    <Text style={styles.dayName}>{dayName}</Text>
                  </View>
                );
              })}
            </ScrollView>
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
                {isPrivileged(macroProfile) && (
                  <View style={[styles.macroBadge, { flexShrink: 1 }]}>
                    <CrownSimpleIcon size={14} color="#1A1A1A" weight="fill" />
                    <Text style={styles.macroBadgeText} numberOfLines={1}>Ayrıcalıklı Üye</Text>
                  </View>
                )}
              </View>
              <AnimatedNumberText
                style={styles.macroCoinLabel}
                value={
                  macroProfile
                    ? isPrivileged(macroProfile)
                      ? `${privilegedDaysLeft(macroProfile)} gün (${privilegedUntilFormatted(macroProfile)}'a kadar)`
                      : `Bu ay ${macroProfile.macro_balance} macro biriktirdin`
                    : 'Macro Coin kazan'
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
              value={`${macroProfile?.macro_balance ?? 0} / ${MEMBERSHIP_THRESHOLD} — Ayrıcalıklı Üye`}
            />
            {!isPrivileged(macroProfile) && (
              <AnimatedNumberText
                style={styles.macroProgressRight}
                value={`${Math.max(0, MEMBERSHIP_THRESHOLD - (macroProfile?.macro_balance ?? 0))} macro kaldı`}
              />
            )}
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
          {PAYMENT_PROVIDER !== 'paytr_iframe' && (
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
            <SignOut color="#0A1F0F" size={18} />
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
    backgroundColor: '#F3F4F6',
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
    color: '#111111',
  },
  statLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#F3F4F6',
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
    paddingHorizontal: SPACING.sm,
    ...SHADOWS.sm,
  },
  weekEmptyText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  dayCol: {
    width: 36,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  dayKcal: {
    fontSize: TYPOGRAPHY.size.xs,
    color: '#9CA3AF',
    height: 12,
  },
  barTrack: {
    height: BAR_MAX_H,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 16,
    borderRadius: 4,
    minHeight: 6,
  },
  dayName: {
    fontSize: TYPOGRAPHY.size.xs,
    color: '#6B7280',
    fontWeight: TYPOGRAPHY.weight.medium,
    fontFamily: 'PlusJakartaSans_500Medium',
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
    backgroundColor: 'transparent',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: '#0A1F0F',
    gap: SPACING.sm,
  },
  logoutText: {
    color: '#0A1F0F',
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
