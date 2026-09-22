import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator, Animated, Image, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { CrownSimple, Info } from 'phosphor-react-native'
import AnimatedNumberText from '../components/AnimatedNumberText'
import MacroPointModal from '../components/modals/MacroPointModal'
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme'
import { useAuth } from '../context/AuthContext'
import {
  DEFAULT_MACRO_SETTINGS, MacroProfile, MacroSettings,
  fetchMacroProfile, fetchMacroSettings, macroProgress,
} from '../lib/macros'

const MACRO_COIN = require('../../assets/macro-coin.png')

/** İlerleme çubuğunun üzerinde duran coin boyutu. */
const DOT = 26

/**
 * Çubuğun üzerindeki tek coin.
 *
 * Kazanılmışsa tam renk + yeşil hale, sırayla yaylı giriş; değilse soluk.
 * Profil kartındaki düz çubuğun Macro sayfasına özel zenginleştirilmiş hâli.
 */
function ProgressCoin({ earned, index }: { earned: boolean; index: number }) {
  const scale = useRef(new Animated.Value(earned ? 0.4 : 1)).current

  useEffect(() => {
    if (!earned) return
    Animated.sequence([
      Animated.delay(index * 80),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 13, bounciness: 11 }),
    ]).start()
  }, [earned, index, scale])

  return (
    <View style={s.dotCell}>
      {earned && <View style={s.dotGlow} />}
      <Animated.Image
        source={MACRO_COIN}
        resizeMode="contain"
        style={[s.dotImg, !earned && s.dotImgOff, { transform: [{ scale }] }]}
      />
    </View>
  )
}

/**
 * Macro ekranı.
 *
 * Kart, Profil ekranındaki Macro kartıyla birebir aynı: aynı ölçüler, aynı
 * tipografi, aynı "i" butonu. Tek fark, ilerleme çubuğunun üzerinde duran
 * macro coin'ler — bu sayfaya özel.
 *
 * Profil ekranına DOKUNULMAZ; oradaki kart düz çubuk olarak kalır.
 */
export default function MacroScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const [profile, setProfile] = useState<MacroProfile | null>(null)
  const [settings, setSettings] = useState<MacroSettings>(DEFAULT_MACRO_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  const barAnim = useRef(new Animated.Value(0)).current

  const load = useCallback(async (isRefresh = false) => {
    if (!user?.id) { setLoading(false); return }
    if (isRefresh) setRefreshing(true); else setLoading(true)
    const [p, st] = await Promise.all([fetchMacroProfile(user.id), fetchMacroSettings()])
    setProfile(p); setSettings(st)
    Animated.spring(barAnim, {
      toValue: macroProgress(p, st).mealProgress,
      useNativeDriver: false, speed: 9, bounciness: 2,
    }).start()
    setLoading(false); setRefreshing(false)
  }, [user?.id, barAnim])

  useEffect(() => { load() }, [load])
  useFocusEffect(useCallback(() => { load(true) }, [load]))

  const p = macroProgress(profile, settings)
  const dolu = p.balance % p.mealCost
  const yuvalar = useMemo(
    () => Array.from({ length: p.mealCost }, (_, i) => i < dolu),
    [p.mealCost, dolu],
  )

  if (loading) {
    return (
      <View style={[s.root, s.centered]}>
        <ActivityIndicator color={COLORS.brand.green} size="large" />
      </View>
    )
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.brand.green} />
        }
      >
        {/* ── Macro kartı (Profil kartıyla birebir) ── */}
        <View style={s.macroCard}>
          <View style={s.macroCoinRow}>
            <Image source={MACRO_COIN} style={s.macroCoinImg} resizeMode="contain" />

            <View style={s.macroCoinInfo}>
              <View style={s.macroTitleRow}>
                <Text style={s.macroCoinScore}>MACRO</Text>
                {p.balance > 0 && (
                  <View style={[s.macroBadge, { flexShrink: 1 }]}>
                    <CrownSimple size={14} color="#1A1A1A" weight="fill" />
                    <Text style={s.macroBadgeText} numberOfLines={1}>{`${p.balance} Macro`}</Text>
                  </View>
                )}
              </View>
              <AnimatedNumberText
                style={s.macroCoinLabel}
                value={
                  profile
                    ? `Bir sonraki Macro'ya ₺${p.liraToNextMacro}`
                    : `Her ₺${settings.earnThreshold} alışverişe 1 Macro`
                }
              />
            </View>

            <TouchableOpacity style={s.macroInfoBtn} onPress={() => setInfoOpen(true)} activeOpacity={0.7}>
              <Info size={16} color="#E8431A" />
            </TouchableOpacity>
          </View>

          {/* Çubuk + üzerindeki coin'ler */}
          <View style={s.progressWrap}>
            <View style={s.macroProgressBg}>
              <Animated.View
                style={[s.macroProgressFill, {
                  width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]}
              />
            </View>
            <View style={s.dotRow} pointerEvents="none">
              {yuvalar.map((earned, i) => (
                <ProgressCoin key={i} earned={earned} index={i} />
              ))}
            </View>
          </View>

          <View style={s.macroProgressLabels}>
            <AnimatedNumberText
              style={s.macroProgressLeft}
              value={`${dolu} / ${p.mealCost} — Ücretsiz Öğün`}
            />
            <AnimatedNumberText
              style={s.macroProgressRight}
              value={`${p.macrosToNextMeal} macro kaldı`}
            />
          </View>
        </View>

        {/* Buraya Macro ile öğün aboneliği bölümü gelecek. */}
      </ScrollView>

      <MacroPointModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        macroProfile={profile}
        macroSettings={settings}
        onNavigateToProfile={() => setInfoOpen(false)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, gap: SPACING.md },

  // ── Kart: ProfileScreen.styles.macroCard ile birebir ──
  // (marginHorizontal orada; burada ScrollView'in paddingHorizontal'ı veriyor)
  macroCard: {
    backgroundColor: '#0D0D0D',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  macroCoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  },
  macroCoinImg: { width: 72, height: 72 },
  macroCoinInfo: { flex: 1, minWidth: 0, gap: SPACING.xs },
  macroTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap',
  },
  macroCoinScore: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontWeight: TYPOGRAPHY.weight.black,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 1,
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
  macroCoinLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: TYPOGRAPHY.weight.medium,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  macroInfoBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(232,67,26,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Çubuk + coin'ler ──
  // Coin'ler çubuğun üstünde yüzer; sarmalayıcı coin yüksekliğinde, çubuk
  // dikeyde ortalanır. Karta eklenen toplam yükseklik: DOT − çubuk = 20px.
  progressWrap: {
    height: DOT,
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  macroProgressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  macroProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.brand.green,
  },
  dotRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Her coin eşit bölmenin ortasında: %10, %30, %50, %70, %90.
  // Böylece sonuncusu çubuğun dışına taşmaz.
  dotCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dotGlow: {
    position: 'absolute',
    width: DOT + 6, height: DOT + 6, borderRadius: (DOT + 6) / 2,
    backgroundColor: 'rgba(185,239,20,0.18)',
  },
  dotImg: { width: DOT, height: DOT },
  dotImgOff: { opacity: 0.28 },

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
})
