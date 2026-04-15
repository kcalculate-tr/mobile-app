// src/components/PopupModal.tsx
import React from 'react'
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import type { Popup } from '../hooks/usePopups'

interface Props {
  popup: Popup
  total: number
  index: number
  onClose: () => void
  onNext: () => void
  onCta?: (link: string) => void
}

export default function PopupModal({ popup, total, index, onClose, onNext, onCta }: Props) {
  const { width } = useWindowDimensions()
  const isLast = index === total - 1

  const handleCta = () => {
    if (onCta) {
      onCta(popup.button_navigate_to || popup.button_link || '')
    }
    onNext()
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Card */}
      <View style={[styles.card, { width: Math.min(width - 48, 360) }]}>

        {/* Kapat butonu */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={10}>
          <Text style={styles.closeX}>✕</Text>
        </TouchableOpacity>

        {/* Görsel */}
        {popup.image_url ? (
          <Image
            source={{ uri: popup.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : null}

        {/* İçerik */}
        <View style={styles.body}>
          {popup.title ? (
            <Text style={styles.title}>{popup.title}</Text>
          ) : null}

          {popup.description ? (
            <Text style={styles.desc}>{popup.description}</Text>
          ) : null}

          {/* Sayfalama göstergesi */}
          {total > 1 && (
            <View style={styles.dots}>
              {Array.from({ length: total }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === index && styles.dotActive]}
                />
              ))}
            </View>
          )}

          {/* Butonlar */}
          <View style={styles.actions}>
            {popup.button_label ? (
              <TouchableOpacity style={styles.ctaBtn} onPress={handleCta}>
                <Text style={styles.ctaText}>{popup.button_label}</Text>
              </TouchableOpacity>
            ) : null}

            {/* Sonraki / Kapat */}
            <TouchableOpacity style={styles.skipBtn} onPress={onNext}>
              <Text style={styles.skipText}>
                {isLast ? 'Kapat' : 'Sonraki →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -180 }, { translateY: -220 }],
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  body: {
    padding: 20,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0f172a',
    lineHeight: 24,
  },
  desc: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#84cc16',
  },
  actions: {
    marginTop: 8,
    gap: 8,
  },
  ctaBtn: {
    backgroundColor: '#84cc16',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: '#84cc16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
})
