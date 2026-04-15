import React, { useCallback, useEffect, useState, useRef } from 'react'
import { Animated, StatusBar } from 'react-native'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Check, ArrowRight, Minus, Plus, CrownIcon } from 'phosphor-react-native'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme'
import { useAuth } from '../context/AuthContext'
import { RootStackParamList } from '../navigation/types'
import {
  MACRO_PRICE,
  MEMBERSHIP_THRESHOLD,
  MacroProfile,
  fetchMacroProfile,
  isPrivileged,
  privilegedDaysLeft,
  privilegedUntilFormatted,
  createMacroPurchaseOrder,
} from '../lib/macros'
import { useAnimatedPress } from '../utils/useAnimatedPress'

const MACRO_COIN = require('../../assets/macro-coin.png')
const RED = '#DC2626'
const RED_DARK = '#991B1B'
const RED_LIGHT = '#FEF2F2'
const RED_MID = '#FCA5A5'

type Nav = NativeStackNavigationProp<RootStackParamList>

const QUICK_PACKS = [
  { qty: 15, label: '1 Ay',  price: 18750, popular: false },
  { qty: 30, label: '2 Ay',  price: 30000, popular: false },
  { qty: 45, label: '3 Ay',  price: 39900, popular: true  },
  { qty: 60, label: '4 Ay',  price: 47500, popular: false },
]

const BENEFITS = [
  { title: 'Diyetisyen Görüşmesi',       desc: 'Online veya yüz yüze özel beslenme danışmanlığı' },
  { title: 'Kişisel Beslenme Planı',       desc: 'Sana özel hazırlanmış haftalık beslenme ve takip programı' },
  { title: 'Öncelikli & Hızlı Teslimat',  desc: '0-30 dakika içinde öncelikli teslimat garantisi' },
  { title: 'Sonuç Raporlandırması',        desc: 'Aylık detaylı sağlık ve beslenme ilerleme raporu' },
  { title: 'Tüm Siparişlerde İndirim',     desc: 'Her siparişte otomatik ekstra indirim fırsatı' },
  { title: 'Özel Atıştırmalık Ara Öğün',  desc: 'Sana özel seçilmiş sağlıklı atıştırmalık hediyeler' },
]



export default function MacroScreen() {
  const nav     = useNavigation<Nav>()
  const safeArea = useSafeAreaInsets()
  const { user } = useAuth()

  const [profile,  setProfile]  = useState<MacroProfile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [qty,      setQty]      = useState(15)
  const [buying,   setBuying]   = useState(false)
  const { animatedScale: buyScale, onPressIn: buyPressIn, onPressOut: buyPressOut } = useAnimatedPress(0.96)
  const [error,    setError]    = useState('')

  // Pack selection bounce scales
  const packScales = useRef(QUICK_PACKS.map(() => new Animated.Value(1))).current

  const selectPack = (index: number, packQty: number) => {
    setQty(packQty)
    packScales.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: i === index ? 1.06 : 1,
        useNativeDriver: true,
        speed: 30,
        bounciness: 8,
      }).start(() => {
        if (i === index) {
          Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }).start()
        }
      })
    })
  }

  // Page entrance animation
  const pageOpacity   = useRef(new Animated.Value(0)).current
  const pageTranslateY = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(pageOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(pageTranslateY, { toValue: 0, useNativeDriver: true, speed: 15, bounciness: 4 }),
    ]).start()
  }, [])

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current

  const fetchProfile = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    setLoading(true)
    const p = await fetchMacroProfile(user.id)
    setProfile(p)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const balance    = profile?.macro_balance ?? 0
  const privileged = isPrivileged(profile)
  const daysLeft   = privilegedDaysLeft(profile)
  const neededForMembership = Math.max(0, MEMBERSHIP_THRESHOLD - balance)
  const selectedPack = QUICK_PACKS.find(p => p.qty === qty)
  const totalPrice = selectedPack?.price ?? qty * MACRO_PRICE

  useEffect(() => {
    if (loading) return
    const progressValue = Math.min(balance / MEMBERSHIP_THRESHOLD, 1)
    Animated.spring(progressAnim, {
      toValue: progressValue,
      useNativeDriver: false,
      speed: 8,
      bounciness: 2,
    }).start()
  }, [balance, loading])

  const handleBuy = async () => {
    if (!user?.id) { nav.navigate('Login', {}); return }
    setError('')
    setBuying(true)
    try {
      const result = await createMacroPurchaseOrder({
        userId: user.id,
        quantity: qty,
        totalAmount: totalPrice,
      })
      if (!result) { setError('Sipariş oluşturulamadı. Lütfen tekrar deneyin.'); return }
      nav.navigate('PaymentScreen', {
        orderId: result.orderId,
        amount: totalPrice,
        orderCode: result.orderCode,
        noticeMessage: `${qty} Macro satın alınıyor`,
      })
    } catch (e) {
      setError('Bir hata oluştu.')
    } finally {
      setBuying(false)
    }
  }

  return (
    <View style={[styles.root, { paddingTop: safeArea.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: safeArea.bottom + 120, backgroundColor: '#fafafa' }}
        style={{ opacity: pageOpacity, transform: [{ translateY: pageTranslateY }] }}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          {/* Glow */}
          <View style={styles.glow} />

          {/* Balance ring */}
          <View style={styles.heroContent}>
            {loading ? (
              <ActivityIndicator color={COLORS.brand.green} size="large" />
            ) : (
              <>
                <View style={styles.coinWrapper}>
                  <Image source={MACRO_COIN} style={styles.heroCoin} resizeMode="contain" />
                  <View style={styles.coinGlow} />
                </View>

                <Text style={styles.heroTitle}>MACRO</Text>
                <Text style={styles.heroSub}>Her macro, sağlıklı yaşamında bir adım</Text>

                {/* Balance badge */}
                <View style={styles.balanceBadge}>
                  <Image source={MACRO_COIN} style={{ width: 18, height: 18 }} resizeMode="contain" />
                  <Text style={styles.balanceText}>{balance} Macro</Text>
                  <View style={styles.balanceDivider} />
                  {privileged ? (
                    <View style={{ alignItems: 'center', gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <CrownIcon size={12} color="#C6F04F" weight="fill" />
                        <Text style={styles.privilegedTag}>Ayrıcalıklı Üye • {daysLeft} gün</Text>
                      </View>
                      <Text style={[styles.privilegedTag, { fontSize: 10, opacity: 0.8 }]}>{privilegedUntilFormatted(profile)}'a kadar</Text>
                    </View>
                  ) : (
                    <Text style={styles.neededTag}>{neededForMembership} macro ile üye ol</Text>
                  )}
                </View>
              </>
            )}
          </View>

          {/* Progress bar */}
          {!loading && !privileged && (
            <View style={styles.progressWrapper}>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, {
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabelLeft}>{balance}/{MEMBERSHIP_THRESHOLD} Macro</Text>
                <Text style={styles.progressLabelRight}>Ayrıcalıklı Üyelik</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Satın Alma ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Macro Satın Al</Text>
          <Text style={styles.sectionSub}>Aylık paket seçin veya özel miktar belirleyin</Text>

          {/* Quick packs */}
          <View style={styles.packRow}>
            {QUICK_PACKS.map((pack, index) => (
              <Animated.View key={pack.qty} style={{ flex: 1, transform: [{ scale: packScales[index] }] }}>
              <TouchableOpacity
                onPress={() => selectPack(index, pack.qty)}
                activeOpacity={0.8}
                style={[styles.packCard, qty === pack.qty && styles.packCardActive]}
              >
                <Image source={MACRO_COIN} style={styles.packCoin} resizeMode="contain" />
                <Text style={[styles.packQty, qty === pack.qty && styles.packQtyActive]}>{pack.qty}</Text>
                <Text style={[styles.packLabel, qty === pack.qty && styles.packLabelActive]}>{pack.label}</Text>
                <Text style={[styles.packPrice, qty === pack.qty && styles.packPriceActive]}>
                  ₺{pack.price.toLocaleString('tr-TR')}
                </Text>
              </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          {/* Custom qty */}
          <View style={styles.customQtyCard}>
            <Text style={styles.customQtyLabel}>Özel Miktar</Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity
                onPress={() => setQty(q => Math.max(1, q - 1))}
                style={styles.qtyBtn}
                activeOpacity={0.8}
              >
                <Minus size={18} color="#fff" weight="bold" />
              </TouchableOpacity>
              <View style={styles.qtyDisplay}>
                <Image source={MACRO_COIN} style={{ width: 22, height: 22 }} resizeMode="contain" />
                <Text style={styles.qtyNumber}>{qty}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setQty(q => q + 1)}
                style={styles.qtyBtn}
                activeOpacity={0.8}
              >
                <Plus size={18} color="#fff" weight="bold" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Buy button */}
          <Animated.View style={{ transform: [{ scale: buyScale }] }}>
            <TouchableOpacity
            onPress={handleBuy}
            disabled={buying}
            onPressIn={buyPressIn}
            onPressOut={buyPressOut}
            style={[styles.buyBtn, buying && { opacity: 0.6 }]}
            activeOpacity={0.85}

          >
            {buying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Image source={MACRO_COIN} style={{ width: 22, height: 22 }} resizeMode="contain" />
                <Text style={styles.buyBtnText}>
                  {qty} Macro Al — ₺{totalPrice.toLocaleString('tr-TR')}
                </Text>
              </>
            )}
          </TouchableOpacity>
          </Animated.View>
        </View>

        {/* ── Ayrıcalıklı Üyelik ── */}
        <View style={styles.section}>
          <View style={styles.membershipHeader}>
            <View style={styles.membershipBadgeIcon}>
              <Image source={MACRO_COIN} style={{ width: 28, height: 28 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.membershipTitle}>Ayrıcalıklı Üyelik</Text>
              <Text style={styles.membershipDesc}>
                Ayda {MEMBERSHIP_THRESHOLD} Macro topla, {30} gün boyunca tüm ayrıcalıklardan yararlan
              </Text>
            </View>
          </View>

          <View style={styles.benefitsList}>
            {BENEFITS.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={styles.benefitCheck}>
                  <Check size={14} color={RED} weight="bold" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitDesc}>{b.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Macro nedir ── */}
        <View style={[styles.section, styles.infoSection]}>
          <Text style={styles.infoTitle}>Macro Coin Nedir?</Text>
          <Text style={styles.infoText}>
            Macro Coin, KCAL ekosisteminin özel dijital birimidir. Her sipariş sonrası Macro kazanır,
            dilediğinde satın alabilirsin. Ayda 15 Macro biriktirdiğinde 30 gün boyunca tüm ayrıcalıklı
            üyelik haklarından ücretsiz yararlanırsın.
          </Text>
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardNum}>₺{MACRO_PRICE.toLocaleString('tr-TR')}</Text>
              <Text style={styles.infoCardLabel}>1 Macro Fiyatı</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardNum}>{MEMBERSHIP_THRESHOLD}</Text>
              <Text style={styles.infoCardLabel}>Üyelik İçin Macro</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardNum}>30</Text>
              <Text style={styles.infoCardLabel}>Üyelik Gün</Text>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Hero
  hero: {
    backgroundColor: '#000000',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING['2xl'],
    paddingHorizontal: SPACING.xl,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: RED,
    opacity: 0.08,
    top: -100,
    alignSelf: 'center',
  },
  heroContent: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },
  coinWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  heroCoin: {
    width: 80,
    height: 80,
  },
  coinGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: RED,
    opacity: 0.2,
    zIndex: -1,
  },
  heroTitle: {
    fontSize: TYPOGRAPHY.size['4xl'],
    fontWeight: TYPOGRAPHY.weight.black,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: TYPOGRAPHY.size.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  balanceText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#ffffff',
  },
  balanceDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  privilegedTag: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FCD34D',
  },
  neededTag: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(255,255,255,0.5)',
  },

  // Progress
  progressWrapper: {
    marginTop: SPACING.xl,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: RED,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  progressLabelLeft: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#fff',
  },
  progressLabelRight: {
    fontSize: TYPOGRAPHY.size.xs,
    color: 'rgba(255,255,255,0.4)',
  },

  // Section
  section: {
    marginTop: SPACING.xl,
    marginHorizontal: SPACING.lg,
    backgroundColor: '#fff',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0f172a',
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#64748b',
    marginBottom: SPACING.lg,
  },

  // Packs
  packRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  packCard: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#f8fafc',
    gap: SPACING.xs,
    position: 'relative',
  },
  packCardActive: {
    borderColor: COLORS.brand.green,
    borderWidth: 2,
    backgroundColor: '#F7FEE7',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    maxWidth: 70,
  },
  popularText: {
    fontSize: 8,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000',
    letterSpacing: 0,
  },
  packCoin: {
    width: 28,
    height: 28,
  },
  packQty: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontWeight: TYPOGRAPHY.weight.black,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0f172a',
  },
  packQtyActive: {
    color: RED_DARK,
  },
  packLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94a3b8',
  },
  packLabelActive: {
    color: RED,
  },
  packPrice: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748b',
  },
  packPriceActive: {
    color: RED_DARK,
  },

  // Custom qty
  customQtyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  customQtyLabel: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0f172a',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minWidth: 60,
    justifyContent: 'center',
  },
  qtyNumber: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontWeight: TYPOGRAPHY.weight.black,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0f172a',
  },

  // Membership hint
  membershipHint: {
    backgroundColor: '#FEF9C3',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  membershipHintText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#854D0E',
    textAlign: 'center',
  },

  // Error
  errorText: {
    color: RED,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },

  // Buy button
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.md,
    minHeight: 56,
    paddingVertical: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 6,
  },
  buyBtnText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.black,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.3,
  },

  // Membership section
  membershipHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  membershipBadgeIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: RED_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0f172a',
  },
  membershipDesc: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#64748b',
    lineHeight: 18,
    marginTop: 2,
  },
  benefitsList: {
    gap: SPACING.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  benefitCheck: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm,
    backgroundColor: RED_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  benefitTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0f172a',
  },
  benefitDesc: {
    fontSize: TYPOGRAPHY.size.sm,
    color: '#64748b',
    lineHeight: 17,
    marginTop: 2,
  },

  // Info section
  infoSection: {
    backgroundColor: '#000000',
  },
  infoTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#fff',
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  infoRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  infoCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  infoCardNum: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.weight.black,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: RED,
  },
  infoCardLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    textAlign: 'center',
  },
})
