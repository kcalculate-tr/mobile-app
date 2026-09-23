import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { Gift, Handshake, Sparkle, Ticket } from 'phosphor-react-native'
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme'

const MACRO_COIN = require('../../../assets/macro-coin.png')

type Avantaj = {
  Icon: typeof Gift
  renk: string
  zemin: string
  baslik: string
  metin: string
}

/**
 * Macro'nun ne işe yaradığını anlatan pazarlama bölümü.
 *
 * 2 sütun × 2 satır kare düzen: dört avantaj yan yana taranabiliyor, uzun
 * bir liste gibi okunmuyor. Dil bilerek "ne kazanırsın" ekseninde; mekanik
 * anlatımı "Nasıl çalışır" bilgi sayfasında duruyor.
 */
export default function MacroBenefits({ earnThreshold, mealCost }: {
  earnThreshold: number
  mealCost: number
}) {
  const avantajlar: Avantaj[] = [
    {
      Icon: Ticket,
      renk: '#3F6212',
      zemin: '#F2FBE8',
      baslik: 'Ücretsiz öğün kazan',
      metin: `Her ₺${earnThreshold.toLocaleString('tr-TR')} alışverişte 1 Macro. ${mealCost} Macro'da bir öğün bizden.`,
    },
    {
      Icon: Sparkle,
      renk: '#B45309',
      zemin: '#FFF7E6',
      baslik: 'Sana özel indirimler',
      metin: 'Macro biriktirdikçe yalnızca sana tanımlı kuponlar ve fırsatlar açılır.',
    },
    {
      Icon: Gift,
      renk: '#BE185D',
      zemin: '#FDF2F8',
      baslik: 'Sürpriz hediyeler',
      metin: 'Yeni ürünler, detokslar ve ara öğünler zaman zaman hesabına eklenir.',
    },
    {
      Icon: Handshake,
      renk: '#1D4ED8',
      zemin: '#EFF6FF',
      baslik: 'İş birlikleri',
      metin: 'Anlaşmalı markaların avantajları önce Macro biriktirenlere açılır.',
    },
  ]

  return (
    <View style={s.root}>
      <View style={s.basligSatir}>
        <Text style={s.baslik}>MACRO ne işe yarar?</Text>
        <Image source={MACRO_COIN} style={s.coin} resizeMode="contain" />
      </View>
      <Text style={s.altBaslik}>
        Her sipariş biriktirir. Biriktikçe sadece sana açılan bir avantaj listesi oluşur.
      </Text>

      <View style={s.izgara}>
        {avantajlar.map((a) => (
          <View key={a.baslik} style={s.kare}>
            <View style={[s.ikon, { backgroundColor: a.zemin }]}>
              <a.Icon size={18} color={a.renk} weight="fill" />
            </View>
            <Text style={s.kareBaslik}>{a.baslik}</Text>
            <Text style={s.kareMetin}>{a.metin}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  basligSatir: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  baslik: {
    fontSize: TYPOGRAPHY.size.lg, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_800ExtraBold', fontWeight: '800',
  },
  coin: { width: 22, height: 22 },
  altBaslik: {
    marginTop: 4, fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.secondary, lineHeight: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  // 2 sütun × 2 satır
  izgara: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  kare: {
    // %50'den biraz az: aradaki boşluk için pay bırakıyoruz.
    width: '48.5%',
    backgroundColor: '#FAFAFA',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    padding: SPACING.md,
    gap: 6,
  },
  ikon: {
    width: 34, height: 34, borderRadius: RADIUS.xs,
    alignItems: 'center', justifyContent: 'center',
  },
  kareBaslik: {
    fontSize: 13, color: COLORS.text.primary, lineHeight: 17,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  kareMetin: {
    fontSize: 11, color: COLORS.text.secondary, lineHeight: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
})
