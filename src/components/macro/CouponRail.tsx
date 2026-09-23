import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useFocusEffect } from '@react-navigation/native'
import { CaretRight } from 'phosphor-react-native'
import { CachedImage } from '../CachedImage'
import { transformImageUrl, ImagePreset } from '../../lib/imageUrl'
import { Campaign, fetchAvailableCampaigns } from '../../lib/offers'
import { gradyan, gunKaldi, indirimEtiketi } from '../../lib/campaignVisual'
import { RootStackParamList } from '../../navigation/types'
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme'

type Nav = NativeStackNavigationProp<RootStackParamList>

const TILE = 148

/**
 * Kuponlar ve indirimler — yatay kaydırmalı şerit.
 *
 * Hiç kampanya yoksa hiçbir şey render edilmez; boş bir şerit göstermek
 * ekranı kalabalıklaştırmaktan başka işe yaramaz.
 */
export default function CouponRail() {
  const navigation = useNavigation<Nav>()
  const [items, setItems] = useState<Campaign[]>([])

  const load = useCallback(async () => {
    try {
      const all = await fetchAvailableCampaigns()
      setItems(all.filter((c) => !!c.code))
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => { load() }, [load])
  useFocusEffect(useCallback(() => { load() }, [load]))

  if (items.length === 0) return null

  return (
    <View style={s.root}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.baslik}>Kuponlar & İndirimler</Text>
          <Text style={s.altBaslik}>{`${items.length} fırsat seni bekliyor`}</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('Offers')}
          style={s.tumu}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.tumuText}>Tümünü Gör</Text>
          <CaretRight size={12} color={COLORS.text.primary} weight="bold" />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rail}
      >
        {items.map((c) => {
          const gorsel = c.image_url
            ? (transformImageUrl(c.image_url, ImagePreset.bannerLarge) ?? c.image_url)
            : null
          const kalan = gunKaldi(c.end_date)
          return (
            <Pressable
              key={c.id}
              onPress={() => navigation.navigate('Offers')}
              style={({ pressed }) => [s.tile, pressed && { opacity: 0.85 }]}
            >
              <View style={s.tileMedia}>
                {gorsel ? (
                  <CachedImage uri={gorsel} style={s.tileImage} />
                ) : (
                  <LinearGradient
                    colors={gradyan(c)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.tileImage}
                  >
                    <Text style={s.tileDiscount} numberOfLines={2}>{indirimEtiketi(c)}</Text>
                  </LinearGradient>
                )}
                {c.badge ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText} numberOfLines={1}>{c.badge}</Text>
                  </View>
                ) : null}
                {kalan != null && kalan <= 7 ? (
                  <View style={s.urgent}><Text style={s.urgentText}>{`Son ${kalan} gün`}</Text></View>
                ) : null}
              </View>
              <Text style={s.tileTitle} numberOfLines={2}>{c.title}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: SPACING.md,
  },
  head: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, gap: SPACING.sm,
  },
  baslik: {
    fontSize: TYPOGRAPHY.size.lg, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_800ExtraBold', fontWeight: '800',
  },
  altBaslik: {
    marginTop: 2, fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  tumu: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tumuText: {
    fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },

  rail: { paddingHorizontal: SPACING.lg, gap: SPACING.md },
  tile: { width: TILE },
  tileMedia: {
    width: TILE, height: TILE, borderRadius: RADIUS.md,
    overflow: 'hidden', backgroundColor: '#0D0D0D',
  },
  tileImage: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center', padding: SPACING.sm,
  },
  tileDiscount: {
    fontSize: 18, lineHeight: 22, textAlign: 'center', color: COLORS.brand.green,
    fontFamily: 'PlusJakartaSans_800ExtraBold', fontWeight: '800',
  },
  badge: {
    position: 'absolute', top: 6, left: 6, maxWidth: '85%',
    backgroundColor: COLORS.brand.green, borderRadius: 100,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeText: { fontSize: 9, color: '#000000', fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700' },
  urgent: {
    position: 'absolute', bottom: 6, right: 6,
    backgroundColor: 'rgba(220,38,38,0.92)', borderRadius: 100,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  urgentText: { fontSize: 9, color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700' },
  tileTitle: {
    marginTop: SPACING.sm, fontSize: 12, lineHeight: 16, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
})
