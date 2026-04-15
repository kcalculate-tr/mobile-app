import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'

interface Props {
  size?: 'sm' | 'md'
}

export default function PrivilegedBadge({ size = 'md' }: Props) {
  const isSmall = size === 'sm'
  return (
    <View style={[styles.badge, isSmall && styles.badgeSm]}>
      <Image
        source={require('../../assets/macro-coin.png')}
        style={[styles.icon, isSmall && styles.iconSm]}
        resizeMode="contain"
      />
      <Text style={[styles.text, isSmall && styles.textSm]}>Ayrıcalıklı Üye</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(198,240,79,0.15)',
    borderRadius: 100,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#C6F04F',
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  icon: { width: 14, height: 14 },
  iconSm: { width: 11, height: 11 },
  text: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  textSm: {
    fontSize: 9,
  },
})
