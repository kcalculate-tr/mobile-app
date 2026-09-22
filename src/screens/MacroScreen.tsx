import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator, Animated, Image, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Info } from 'phosphor-react-native'
import MacroPointModal from '../components/modals/MacroPointModal'
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme'
import { useAuth } from '../context/AuthContext'
import {
  DEFAULT_MACRO_SETTINGS, MacroProfile, MacroSettings,
  fetchMacroProfile, fetchMacroSettings, macroProgress,
} from '../lib/macros'

const MACRO_COIN = require('../../assets/macro-coin.png')

/** Kazanılmış coin büyük, kazanılmamış küçük ve soluk. */
const COIN_EARNED = 46
const COIN_EMPTY = 28

/**
 * Tek bir coin yuvası.
 *
 * Kazanılmışsa: tam boy, arkasında marka yeşili halesi, yaylı giriş animasyonu.
 * Kazanılmamışsa: küçük, soluk, kesikli çember — "burası dolacak" hissi.
 */
function CoinSlot({ earned, index }: { earned: boolean; index: number }) {
  const scale = useRef(new Animated.Value(earned ? 0.4 : 1)).current
  const glow = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!earned) return
    Animated.sequence([
      Animated.delay(index * 90),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 10 }),
        Animated.timing(glow, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]),
    ]).start()
  }, [earned, index, scale, glow])

  return (
    <View style={s.slot}>
      {earned ? (
        <>
          <Animated.View style={[s.glowOuter, { opacity: glow }]} />
          <Animated.View style={[s.glowInner, { opacity: glow }]} />
          <Animated.Image
            source={MACRO_COIN}
            style={[s.coinEarned, { transform: [{ scale }] }]}
            resizeMode="contain"
          />
        </>
      ) : (
        <View style={s.slotEmpty}>
          <Image source={MACRO_COIN} style={s.coinEmpty} resizeMode="contain" />
        </View>
      )}
    </View>
  )
}

/**
 * Macro ekranı.
 *
 * Bilerek tek bir bölüm: siyah kart içinde MACRO başlığı, 5 coin yuvası ve
 * ilerleme çubuğu. Detaylı anlatım "i" ile açılan alt sayfada (Profil
 * ekranındakiyle AYNI bileşen) — ekranın kendisi kısa kalsın diye.
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
        {/* ── Macro bölümü ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.title}>MACRO</Text>
              <Text style={s.subtitle}>{`${p.mealCost} Macro = 1 ücretsiz öğün`}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setInfoOpen(true)}
              style={s.infoBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Info size={18} color={COLORS.brand.green} weight="bold" />
            </TouchableOpacity>
          </View>

          <View style={s.coinRow}>
            {yuvalar.map((earned, i) => (
              <CoinSlot key={i} earned={earned} index={i} />
            ))}
          </View>

          <View style={s.barGroup}>
            <View style={s.barTrack}>
              <Animated.View
                style={[s.barFill, {
                  width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]}
              />
            </View>

            <View style={s.barMeta}>
              <Text style={s.barCount}>
                <Text style={s.barCountStrong}>{dolu}</Text>
                <Text>{` / ${p.mealCost}`}</Text>
              </Text>
              <Text style={s.barHint}>
                {p.balance === 0 && dolu === 0
                  ? `Her ₺${settings.earnThreshold.toLocaleString('tr-TR')} alışveriş 1 Macro`
                  : `Sıradaki Macro'ya ₺${p.liraToNextMacro.toLocaleString('tr-TR')}`}
              </Text>
            </View>
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
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },

  // ── Siyah macro kartı ──
  card: {
    backgroundColor: '#0D0D0D',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.lg,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: {
    fontSize: 22,
    letterSpacing: 4,
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 3,
    fontSize: TYPOGRAPHY.size.xs,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  infoBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(185,239,20,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Coin yuvaları ──
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  slot: {
    width: COIN_EARNED + 8,
    height: COIN_EARNED + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // İki katmanlı hale: expo-blur olmadan yumuşak ışıma hissi verir.
  glowOuter: {
    position: 'absolute',
    width: COIN_EARNED + 8, height: COIN_EARNED + 8, borderRadius: (COIN_EARNED + 8) / 2,
    backgroundColor: 'rgba(185,239,20,0.10)',
  },
  glowInner: {
    position: 'absolute',
    width: COIN_EARNED - 4, height: COIN_EARNED - 4, borderRadius: (COIN_EARNED - 4) / 2,
    backgroundColor: 'rgba(185,239,20,0.20)',
  },
  coinEarned: { width: COIN_EARNED, height: COIN_EARNED },
  slotEmpty: {
    width: COIN_EMPTY + 12, height: COIN_EMPTY + 12, borderRadius: (COIN_EMPTY + 12) / 2,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  coinEmpty: { width: COIN_EMPTY, height: COIN_EMPTY, opacity: 0.22 },

  // ── İlerleme ──
  // Çubuk ve altındaki iki etiket tek grup: kart genelindeki gap onları
  // birbirinden ayırmasın, birlikte okunsunlar.
  barGroup: { gap: SPACING.sm },
  barTrack: {
    height: 8, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 100, backgroundColor: COLORS.brand.green },
  barMeta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  barCount: {
    fontSize: TYPOGRAPHY.size.xs,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  barCountStrong: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.brand.green,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: '800',
  },
  barHint: {
    fontSize: TYPOGRAPHY.size.xs,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
})
