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
 * Macro'nun ne işe yaradığını anlatan pazarlama bölümü.
 *
 * Bilerek "ne kazanırsın" dilinde yazıldı, mekanik anlatımı değil —
 * mekanik zaten "Nasıl çalışır" bilgi sayfasında.
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
      metin: `Her ₺${earnThreshold.toLocaleString('tr-TR')} alışverişte 1 Macro. ${mealCost} Macro'da bir öğün bizden — kuponun hesabına otomatik düşer.`,
    },
    {
      Icon: Sparkle,
      renk: '#B45309',
      zemin: '#FFF7E6',
      baslik: 'Sana özel indirimler',
      metin: 'Macro biriktirdikçe yalnızca sana tanımlı kuponlar ve kişiye özel fırsatlar açılır.',
    },
    {
      Icon: Gift,
      renk: '#BE185D',
      zemin: '#FDF2F8',
      baslik: 'Sürpriz hediyeler',
      metin: 'Yeni çıkan ürünler, detokslar ve ara öğünler zaman zaman hediye olarak hesabına eklenir.',
    },
    {
      Icon: Handshake,
      renk: '#1D4ED8',
      zemin: '#EFF6FF',
      baslik: 'İş birlikleri ve sponsorluklar',
      metin: 'Anlaşmalı markalardan gelen avantajlar önce Macro biriktiren müşterilere açılır.',
    },
  ]

  return (
    <View style={s.root}>
      <Text style={s.baslik}>Macro ile neler kazanıyorsun?</Text>
      <Text style={s.altBaslik}>
        Her sipariş biriktirir. Biriktikçe sadece sana açılan bir avantaj listesi oluşur.
      </Text>

      <View style={s.liste}>
        {avantajlar.map((a, i) => (
          <View key={a.baslik} style={[s.satir, i < avantajlar.length - 1 && s.satirAyrac]}>
            <View style={[s.ikon, { backgroundColor: a.zemin }]}>
              <a.Icon size={18} color={a.renk} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.satirBaslik}>{a.baslik}</Text>
              <Text style={s.satirMetin}>{a.metin}</Text>
            </View>
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
  baslik: {
    fontSize: TYPOGRAPHY.size.lg, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_800ExtraBold', fontWeight: '800',
  },
  altBaslik: {
    marginTop: 4, fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.secondary, lineHeight: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  liste: { marginTop: SPACING.md },
  satir: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  satirAyrac: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  ikon: {
    width: 36, height: 36, borderRadius: RADIUS.xs,
    alignItems: 'center', justifyContent: 'center',
  },
  satirBaslik: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  satirMetin: {
    marginTop: 3, fontSize: 12, color: COLORS.text.secondary, lineHeight: 17,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
})
