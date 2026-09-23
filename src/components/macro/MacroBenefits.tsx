import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Gift, Handshake, Sparkle, Ticket } from 'phosphor-react-native'
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme'

type Avantaj = {
  Icon: typeof Gift
  renk: string
  zemin: string
  baslik: string
  metin: string
}

/**
 * "MACRO NEDİR?" bölümü.
 *
 * Dört avantaj, 2 sütun × 2 satır. Kartlar sayfanın gri zemini üzerinde
 * KENDİ beyaz kartları olarak duruyor — daha önce beyaz bir kabın içinde gri
 * kutular vardı, iki katmanlı zemin ekranın geri kalanıyla uyuşmuyordu.
 *
 * Başlık bilinçli olarak küçük ve sessiz: bu ekranda her şey bir kartın
 * içinde, dolayısıyla çıplak zeminde duran büyük kalın bir başlık desteksiz
 * görünüyordu ve hemen üstündeki siyah karttaki "MACRO" yazısıyla
 * yarışıyordu. Harf aralıklı küçük etiket, içerik gibi değil AYRAÇ gibi
 * okunur — kendi kartı olmasına gerek kalmaz.
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
        <View style={s.cizgi} />
        <Text style={s.baslik}>MACRO NEDİR?</Text>
        <View style={s.cizgi} />
      </View>

      <View style={s.izgara}>
        {avantajlar.map((a) => (
          <View key={a.baslik} style={s.kart}>
            <View style={[s.ikon, { backgroundColor: a.zemin }]}>
              <a.Icon size={18} color={a.renk} weight="fill" />
            </View>
            <Text style={s.kartBaslik}>{a.baslik}</Text>
            <Text style={s.kartMetin}>{a.metin}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: SPACING.sm },
  basligSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: 2,
  },
  baslik: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
  },
  // Etiketin iki yanındaki saç teli çizgiler: eşit flex olduğu için etiket
  // tam ortada kalıyor, bölümün başladığı yer de başlığı büyütmeden belli
  // oluyor.
  cizgi: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },

  // 2 sütun × 2 satır — her kutu kendi beyaz kartı
  izgara: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  kart: {
    // %50'nin biraz altı: aradaki boşluk için pay.
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  ikon: {
    width: 38, height: 38, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  kartBaslik: {
    fontSize: 14, color: COLORS.text.primary, lineHeight: 18,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  kartMetin: {
    fontSize: 11.5, color: COLORS.text.secondary, lineHeight: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
})
