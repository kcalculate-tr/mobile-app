import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { CalendarBlank, Tag, Ticket } from 'phosphor-react-native'
import BottomSheet from '../BottomSheet'
import { CachedImage } from '../CachedImage'
import { transformImageUrl, ImagePreset } from '../../lib/imageUrl'
import { formatDate, gradyan, gunKaldi, indirimEtiketi } from '../../lib/campaignVisual'
import {
  Campaign, CouponCartItem, CouponValidationSuccess,
  fetchAvailableCampaigns, getCouponErrorMessage, validateCoupon,
} from '../../lib/offers'
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme'

type Props = {
  visible: boolean
  onClose: () => void
  cartTotal: number
  items: CouponCartItem[]
  onApplied: (result: CouponValidationSuccess) => void
}

/**
 * Sepette "Kupon Ekle"ye basınca açılan kupon seçici.
 *
 * Eskiden müşteri kodu EZBERDEN yazmak zorundaydı. Artık kendisine açık olan
 * kuponlar listeleniyor ve dokununca uygulanıyor; kod alanı ikincil kaldı
 * (sponsor kodları, dışarıdan gelen kodlar için).
 *
 * Uygunluk kontrolü tamamen sunucuda (validate_coupon_v2). Burada satıra
 * dokunulduğunda doğrulama çağrılıyor; geçersizse sebebi O SATIRIN altında
 * gösteriliyor, böylece müşteri neden olmadığını görüyor.
 */
export default function CouponPickerSheet({ visible, onClose, cartTotal, items, onApplied }: Props) {
  const [list, setList] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ code: string; message: string } | null>(null)
  const [manualCode, setManualCode] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await fetchAvailableCampaigns()
      setList(all.filter((c) => !!c.code))
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    setRowError(null)
    setManualCode('')
    load()
  }, [visible, load])

  const uygula = useCallback(async (code: string) => {
    if (busyCode) return
    setBusyCode(code)
    setRowError(null)
    const result = await validateCoupon(code, cartTotal, items)
    setBusyCode(null)
    if (!result.valid) {
      setRowError({ code, message: getCouponErrorMessage(result) })
      return
    }
    onApplied(result)
    onClose()
  }, [busyCode, cartTotal, items, onApplied, onClose])

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Kuponlarım" showCloseButton maxHeight="85%">
      {/* Kod ile ekleme — ikincil */}
      <View style={s.kodSatir}>
        <TextInput
          style={s.kodInput}
          value={manualCode}
          onChangeText={(v) => { setManualCode(v.toUpperCase()); setRowError(null) }}
          placeholder="Kupon kodun varsa yaz"
          placeholderTextColor={COLORS.text.tertiary}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[s.kodBtn, !manualCode.trim() && s.kodBtnPasif]}
          onPress={() => uygula(manualCode.trim().toUpperCase())}
          disabled={!manualCode.trim() || busyCode != null}
          activeOpacity={0.85}
        >
          {busyCode === manualCode.trim().toUpperCase()
            ? <ActivityIndicator size="small" color="#000" />
            : <Text style={s.kodBtnText}>Uygula</Text>}
        </TouchableOpacity>
      </View>
      {rowError && rowError.code === manualCode.trim().toUpperCase() ? (
        <Text style={s.hata}>{rowError.message}</Text>
      ) : null}

      {loading ? (
        <View style={s.yukleniyor}><ActivityIndicator color={COLORS.brand.green} /></View>
      ) : list.length === 0 ? (
        <View style={s.bos}>
          <View style={s.bosIkon}><Ticket size={22} color={COLORS.text.tertiary} /></View>
          <Text style={s.bosBaslik}>Şu an kullanabileceğin kupon yok</Text>
          <Text style={s.bosMetin}>
            Macro biriktirdikçe ücretsiz öğün kuponların burada görünecek.
          </Text>
        </View>
      ) : (
        <ScrollView style={s.liste} showsVerticalScrollIndicator={false}>
          {list.map((c) => {
            const gorsel = c.image_url
              ? (transformImageUrl(c.image_url, ImagePreset.bannerLarge) ?? c.image_url)
              : null
            const kalan = gunKaldi(c.end_date)
            const busy = busyCode === c.code
            const hatali = rowError?.code === c.code
            return (
              <View key={c.id}>
                <TouchableOpacity
                  style={[s.satir, hatali && s.satirHatali]}
                  onPress={() => c.code && uygula(c.code)}
                  activeOpacity={0.85}
                  disabled={busyCode != null}
                >
                  <View style={s.gorselKutu}>
                    {gorsel ? (
                      <CachedImage uri={gorsel} style={s.gorsel} />
                    ) : (
                      <LinearGradient
                        colors={gradyan(c)}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.gorsel}
                      >
                        <Text style={s.gorselYazi} numberOfLines={2}>{indirimEtiketi(c)}</Text>
                      </LinearGradient>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={s.satirBaslik} numberOfLines={2}>{c.title}</Text>
                    <View style={s.metaSatir}>
                      {c.min_cart_total != null && Number(c.min_cart_total) > 0 && (
                        <View style={s.meta}>
                          <Tag size={11} color={COLORS.text.tertiary} />
                          <Text style={s.metaText}>{`Min. ₺${Number(c.min_cart_total)}`}</Text>
                        </View>
                      )}
                      {c.end_date && (
                        <View style={s.meta}>
                          <CalendarBlank size={11} color={COLORS.text.tertiary} />
                          <Text style={s.metaText}>
                            {kalan != null && kalan <= 7 ? `Son ${kalan} gün` : formatDate(c.end_date)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={s.uygulaBtn}>
                    {busy
                      ? <ActivityIndicator size="small" color="#000" />
                      : <Text style={s.uygulaBtnText}>Uygula</Text>}
                  </View>
                </TouchableOpacity>
                {hatali && rowError ? <Text style={s.satirHata}>{rowError.message}</Text> : null}
              </View>
            )
          })}
        </ScrollView>
      )}
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  kodSatir: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  kodInput: {
    flex: 1, height: 44, borderRadius: RADIUS.pill,
    backgroundColor: '#F4F4F4', paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  kodBtn: {
    height: 44, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center',
  },
  kodBtnPasif: { opacity: 0.4 },
  kodBtnText: {
    fontSize: TYPOGRAPHY.size.sm, color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold', },
  hata: {
    marginTop: SPACING.xs, fontSize: 12, color: '#DC2626',
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  yukleniyor: { paddingVertical: SPACING['3xl'], alignItems: 'center' },
  bos: { paddingVertical: SPACING['2xl'], alignItems: 'center', gap: 6 },
  bosIkon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F2F2F2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  bosBaslik: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_700Bold', },
  bosMetin: {
    fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary, textAlign: 'center',
    lineHeight: 17, paddingHorizontal: SPACING.lg,
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  liste: { marginTop: SPACING.md },
  satir: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  satirHatali: { borderBottomColor: 'rgba(220,38,38,0.25)' },
  gorselKutu: {
    width: 54, height: 54, borderRadius: RADIUS.sm,
    overflow: 'hidden', backgroundColor: '#0D0D0D',
  },
  gorsel: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 4 },
  gorselYazi: {
    fontSize: 10, lineHeight: 12, textAlign: 'center', color: COLORS.brand.green,
    fontFamily: 'PlusJakartaSans_800ExtraBold', },
  satirBaslik: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.primary, lineHeight: 18,
    fontFamily: 'PlusJakartaSans_700Bold', },
  metaSatir: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: {
    fontSize: 11, color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  uygulaBtn: {
    minWidth: 68, height: 34, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center', justifyContent: 'center',
  },
  uygulaBtnText: {
    fontSize: 12, color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold', },
  satirHata: {
    paddingBottom: SPACING.sm, fontSize: 11, color: '#DC2626',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
})
