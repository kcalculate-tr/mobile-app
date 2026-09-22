import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Animated, Clipboard, Image, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { CalendarBlank, Copy, ForkKnife, ShoppingCart, Ticket } from 'phosphor-react-native'
import AnimatedNumberText from '../components/AnimatedNumberText'
import { Toast } from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme'
import { useAuth } from '../context/AuthContext'
import {
  DEFAULT_MACRO_SETTINGS, MacroProfile, MacroSettings, MacroTransaction,
  MealRewardCoupon, fetchMacroProfile, fetchMacroSettings, fetchMacroTransactions,
  fetchMealRewardCoupons, macroProgress,
} from '../lib/macros'

const MACRO_COIN = require('../../assets/macro-coin.png')

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

const gunKaldi = (iso: string | null): number | null => {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

/**
 * Macro ekranı — model v2.
 *
 * Kazanım ve kupon üretimi sunucuda (orders trigger'ı). Bu ekran yalnızca
 * durumu gösterir: bakiye, bir sonraki ücretsiz öğüne kalan yol, üretilmiş
 * kuponlar ve hareket geçmişi. Burada hiçbir yazma işlemi YOK.
 */
export default function MacroScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { toast, show: showToast, hide: hideToast } = useToast()

  const [profile, setProfile] = useState<MacroProfile | null>(null)
  const [settings, setSettings] = useState<MacroSettings>(DEFAULT_MACRO_SETTINGS)
  const [coupons, setCoupons] = useState<MealRewardCoupon[]>([])
  const [history, setHistory] = useState<MacroTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const progressAnim = useRef(new Animated.Value(0)).current

  const load = useCallback(async (isRefresh = false) => {
    if (!user?.id) { setLoading(false); return }
    if (isRefresh) setRefreshing(true); else setLoading(true)
    const [p, s, c, h] = await Promise.all([
      fetchMacroProfile(user.id),
      fetchMacroSettings(),
      fetchMealRewardCoupons(),
      fetchMacroTransactions(user.id),
    ])
    setProfile(p); setSettings(s); setCoupons(c); setHistory(h)
    Animated.spring(progressAnim, {
      toValue: macroProgress(p, s).mealProgress,
      useNativeDriver: false, speed: 10, bounciness: 3,
    }).start()
    setLoading(false); setRefreshing(false)
  }, [user?.id, progressAnim])

  useEffect(() => { load() }, [load])
  useFocusEffect(useCallback(() => { load(true) }, [load]))

  const p = macroProgress(profile, settings)
  const esik = settings.earnThreshold.toLocaleString('tr-TR')

  const kopyala = (code: string) => {
    Clipboard.setString(code)
    showToast(`${code} kopyalandı`)
  }

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
        {/* ── Bakiye ── */}
        <View style={s.heroCard}>
          <Image source={MACRO_COIN} style={s.heroCoin} resizeMode="contain" />
          <AnimatedNumberText style={s.heroBalance} value={String(p.balance)} />
          <Text style={s.heroUnit}>Macro</Text>
          <Text style={s.heroSub}>{`Her ₺${esik} alışveriş 1 Macro · ${settings.mealCost} Macro 1 ücretsiz öğün`}</Text>
        </View>

        {/* ── Bir sonraki öğün ── */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>Bir sonraki ücretsiz öğün</Text>
            <Text style={s.progressCount}>{`${p.balance % p.mealCost} / ${p.mealCost}`}</Text>
          </View>
          <View style={s.progressTrack}>
            <Animated.View
              style={[s.progressFill, {
                width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }]}
            />
          </View>
          <Text style={s.progressHint}>
            {p.macrosToNextMeal === p.mealCost && p.balance === 0
              ? `İlk siparişinle başlıyor — ₺${esik} harcama 1 Macro`
              : `${p.macrosToNextMeal} macro kaldı · bir sonraki macro'ya ₺${p.liraToNextMacro}`}
          </Text>
        </View>

        {/* ── Ücretsiz öğün kuponları ── */}
        <Text style={s.sectionTitle}>Ücretsiz Öğün Kuponların</Text>
        {coupons.length === 0 ? (
          <View style={s.emptyCard}>
            <View style={s.emptyIcon}><Ticket size={22} color={COLORS.text.tertiary} /></View>
            <Text style={s.emptyTitle}>Henüz kuponun yok</Text>
            <Text style={s.emptySub}>
              {`${settings.mealCost} Macro biriktirdiğinde ücretsiz öğün kuponun otomatik olarak burada belirir.`}
            </Text>
          </View>
        ) : (
          coupons.map((c) => {
            const kalan = gunKaldi(c.end_date)
            return (
              <View key={c.id} style={s.couponCard}>
                <View style={s.couponIcon}><ForkKnife size={20} color="#000" weight="fill" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.couponTitle}>1 Ücretsiz Öğün</Text>
                  <Text style={s.couponDesc} numberOfLines={2}>
                    {c.description ?? 'Tek öğün hediye. Koli ve çoklu tabaklarda geçerli değildir.'}
                  </Text>
                  {c.end_date && (
                    <View style={s.couponMeta}>
                      <CalendarBlank size={12} color={COLORS.text.tertiary} />
                      <Text style={s.couponMetaText}>
                        {kalan != null && kalan <= 14
                          ? `Son ${kalan} gün · ${formatDate(c.end_date)}`
                          : `${formatDate(c.end_date)} tarihine kadar`}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => kopyala(c.code)} style={s.couponCode} activeOpacity={0.8}>
                  <Text style={s.couponCodeText}>{c.code}</Text>
                  <Copy size={12} color="#000" />
                </TouchableOpacity>
              </View>
            )
          })
        )}

        {/* ── Nasıl çalışır ── */}
        <Text style={s.sectionTitle}>Nasıl çalışır?</Text>
        <View style={s.card}>
          {[
            { Icon: ShoppingCart, t: `Her ₺${esik} harcama = 1 Macro`, d: 'Küsurat birikir, kaybolmaz. Macro siparişin teslim edilince yüklenir.' },
            { Icon: Ticket, t: `${settings.mealCost} Macro = 1 kupon`, d: 'Eşiği doldurduğunda ücretsiz öğün kuponun otomatik üretilir.' },
            { Icon: ForkKnife, t: 'Dilediğin öğünde kullan', d: 'kcal., tera ve Breaking Fast farketmez. Koli ve çoklu tabaklar hariç.' },
          ].map((x, i, arr) => (
            <View key={i} style={[s.stepRow, i < arr.length - 1 && s.stepDivider]}>
              <View style={s.stepIcon}><x.Icon size={18} color="#000" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>{x.t}</Text>
                <Text style={s.stepDesc}>{x.d}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Hareketler ── */}
        {history.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Hareketler</Text>
            <View style={s.card}>
              {history.map((h, i) => (
                <View key={h.id} style={[s.histRow, i < history.length - 1 && s.stepDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.histNote} numberOfLines={2}>{h.note ?? h.type}</Text>
                    <Text style={s.histDate}>{formatDate(h.created_at)}</Text>
                  </View>
                  <Text style={[s.histAmount, h.amount < 0 && s.histAmountNeg]}>
                    {h.amount > 0 ? `+${h.amount}` : String(h.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Toast visible={toast.visible} message={toast.message} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F6F6' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },

  // Hero
  heroCard: {
    backgroundColor: '#0D0D0D', borderRadius: RADIUS.lg,
    alignItems: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg, gap: 2,
  },
  heroCoin: { width: 56, height: 56, marginBottom: SPACING.sm },
  heroBalance: {
    fontSize: 48, lineHeight: 54, color: COLORS.brand.green,
    fontFamily: 'PlusJakartaSans_800ExtraBold', fontWeight: '800',
  },
  heroUnit: {
    fontSize: TYPOGRAPHY.size.sm, color: 'rgba(255,255,255,0.65)',
    fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 1.5,
  },
  heroSub: {
    marginTop: SPACING.sm, fontSize: TYPOGRAPHY.size.xs, textAlign: 'center',
    color: 'rgba(255,255,255,0.5)', fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 17,
  },

  // Ortak kart
  card: {
    backgroundColor: '#FFFFFF', borderRadius: RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', gap: SPACING.sm,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: {
    fontSize: TYPOGRAPHY.size.md, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.md, color: COLORS.text.primary, marginTop: SPACING.sm,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },

  // İlerleme
  progressCount: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.secondary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  progressTrack: { height: 10, borderRadius: 100, backgroundColor: '#EFEFEF', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 100, backgroundColor: COLORS.brand.green },
  progressHint: {
    fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  // Kupon
  couponCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: '#FFFFFF', borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  couponIcon: {
    width: 40, height: 40, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center',
  },
  couponTitle: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  couponDesc: {
    fontSize: 11, color: COLORS.text.tertiary, marginTop: 2,
    fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 15,
  },
  couponMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  couponMetaText: {
    fontSize: 11, color: COLORS.text.tertiary, fontFamily: 'PlusJakartaSans_500Medium',
  },
  couponCode: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F2F2F2', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  couponCodeText: {
    fontSize: 11, color: '#000000', fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },

  // Boş durum
  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', alignItems: 'center', gap: 6,
  },
  emptyIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F2F2F2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  emptySub: {
    fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary, textAlign: 'center',
    fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 17,
  },

  // Adımlar
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, paddingVertical: SPACING.sm },
  stepDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  stepIcon: {
    width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: '#F2FBE8',
    alignItems: 'center', justifyContent: 'center',
  },
  stepTitle: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  stepDesc: {
    fontSize: 11, color: COLORS.text.tertiary, marginTop: 2,
    fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 15,
  },

  // Hareketler
  histRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  histNote: {
    fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_500Medium', lineHeight: 17,
  },
  histDate: {
    fontSize: 11, color: COLORS.text.tertiary, marginTop: 2,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  histAmount: {
    fontSize: TYPOGRAPHY.size.sm, color: '#16A34A',
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  histAmountNeg: { color: COLORS.text.secondary },
})
