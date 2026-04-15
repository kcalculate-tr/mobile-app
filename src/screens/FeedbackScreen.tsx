import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import React, { useEffect, useRef, useState } from 'react'
import { Animated,
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { CaretLeft, Star, ChatText, CheckCircle } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { useRequireAuth } from '../hooks/useRequireAuth'
import { getSupabaseClient } from '../lib/supabase'
import { RootStackParamList } from '../navigation/types'
import { useAnimatedPress } from '../utils/useAnimatedPress'

type Nav = NativeStackNavigationProp<RootStackParamList>

const CATEGORIES = [
  { key: 'general',   label: 'Genel' },
  { key: 'food',      label: 'Yemek Kalitesi' },
  { key: 'delivery',  label: 'Teslimat' },
  { key: 'app',       label: 'Uygulama' },
  { key: 'service',   label: 'Müşteri Hizmetleri' },
  { key: 'price',     label: 'Fiyat / Ürün' },
]

export default function FeedbackScreen() {
  const navigation = useNavigation<Nav>()
  const insets     = useSafeAreaInsets()
  const { user }   = useAuth()
  const { isAuthenticated, loading } = useRequireAuth()
  const supabase   = getSupabaseClient()

  const [category,  setCategory]  = useState('general')
  const [rating,    setRating]    = useState(0)
  const { animatedScale: submitScale, onPressIn: submitPressIn, onPressOut: submitPressOut } = useAnimatedPress(0.96)
  const starScales = useRef([1,2,3,4,5].map(() => new Animated.Value(1))).current

  const pageOpacity    = useRef(new Animated.Value(0)).current
  const pageTranslateY = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(pageOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(pageTranslateY, { toValue: 0, useNativeDriver: true, speed: 15, bounciness: 4 }),
    ]).start()
  }, [])
  const [message,   setMessage]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color={COLORS.brand.green} size="large" />
  </View>
  if (!isAuthenticated) return null

  const handleSubmit = async () => {
    if (rating === 0) { Alert.alert('Lütfen bir puan verin.'); return }
    if (message.trim().length < 10) { Alert.alert('En az 10 karakter yazın.'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user!.id,
        user_email: user!.email,
        category,
        rating,
        message: message.trim(),
        status: 'new',
      })
      if (error) throw error
      setSubmitted(true)
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Gönderilemedi.')
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return (
      <ScreenContainer edges={['top']} style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
            <CaretLeft size={22} color="#000" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Geri Bildirim</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.successBox}>
          <CheckCircle size={64} color={COLORS.brand.green} weight="fill" />
          <Text style={s.successTitle}>Teşekkürler!</Text>
          <Text style={s.successSub}>Geri bildiriminiz alındı. Değerlendirmeleriniz hizmetimizi geliştirmemize yardımcı oluyor.</Text>
          <TouchableOpacity style={s.backHomeBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={s.backHomeBtnText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer edges={['top']} style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
          <CaretLeft size={22} color="#000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Geri Bildirim</Text>
        <View style={{ width: 36 }} />
      </View>

      <Animated.ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ opacity: pageOpacity, transform: [{ translateY: pageTranslateY }] }}
      >
        {/* Kategori */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Konu</Text>
          <View style={s.catGrid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[s.catChip, category === cat.key && s.catChipActive]}
                onPress={() => setCategory(cat.key)}
                activeOpacity={0.8}
              >
                <Text style={[s.catChipText, category === cat.key && s.catChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Puan */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Değerlendirme</Text>
          <View style={s.starRow}>
            {[1,2,3,4,5].map((i, idx) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  setRating(i);
                  [1,2,3,4,5].forEach((_, idx) => {
                    if (idx < i) {
                      setTimeout(() => {
                        Animated.sequence([
                          Animated.spring(starScales[idx], { toValue: 1.35, useNativeDriver: true, speed: 80, bounciness: 0 }),
                          Animated.spring(starScales[idx], { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 6 }),
                        ]).start();
                      }, idx * 40);
                    }
                  });
                }}
                activeOpacity={0.8}
              >
                <Animated.View style={{ transform: [{ scale: starScales[idx] }] }}>
                <Star
                  size={40}
                  color={i <= rating ? '#F59E0B' : '#E5E7EB'}
                  weight={i <= rating ? 'fill' : 'regular'}
                />
                </Animated.View>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={s.ratingLabel}>
              {rating === 5 ? 'Mükemmel!' : rating === 4 ? 'İyi' : rating === 3 ? 'Orta' : rating === 2 ? 'Kötü' : 'Çok Kötü'}
            </Text>
          )}
        </View>

        {/* Mesaj */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Görüşünüz</Text>
          <TextInput
            style={s.textarea}
            value={message}
            onChangeText={setMessage}
            placeholder="Deneyiminizi, önerilerinizi veya şikayetlerinizi yazın..."
            placeholderTextColor={COLORS.text.disabled}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={s.charCount}>{message.length}/500</Text>
        </View>

        <TouchableOpacity
          style={[s.submitBtn, (saving || rating === 0) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={saving || rating === 0}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#000" />
            : <>
                <ChatText size={18} color="#000" weight="bold" />
                <Text style={s.submitBtnText}>Gönder</Text>
              </>
          }
        </TouchableOpacity>
      </Animated.ScrollView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  content: { padding: SPACING.lg, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  cardTitle: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary, marginBottom: SPACING.md },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  catChip: {
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border.strong,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.background,
  },
  catChipActive: { backgroundColor: COLORS.brand.green, borderColor: COLORS.brand.green },
  catChipText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold', color: '#555' },
  catChipTextActive: { color: COLORS.text.primary, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold'},
  starRow: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center', paddingVertical: SPACING.sm },
  ratingLabel: { textAlign: 'center', fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#F59E0B', marginTop: SPACING.xs },
  textarea: {
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', borderRadius: RADIUS.sm,
    padding: SPACING.md, fontSize: TYPOGRAPHY.size.md, color: COLORS.text.primary, minHeight: 120,
    backgroundColor: '#f9f9f9',
  },
  charCount: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.disabled, textAlign: 'right', marginTop: SPACING.xs },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.brand.green, borderRadius: RADIUS.md, paddingVertical: SPACING.lg, marginTop: SPACING.xs,
  },
  submitBtnText: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text.primary },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING['3xl'], gap: SPACING.lg },
  successTitle: { fontSize: TYPOGRAPHY.size['3xl'], fontWeight: TYPOGRAPHY.weight.black,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text.primary },
  successSub: { fontSize: TYPOGRAPHY.size.md, color: COLORS.text.secondary, textAlign: 'center', lineHeight: 21 },
  backHomeBtn: { backgroundColor: COLORS.brand.green, borderRadius: RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING['3xl'], marginTop: SPACING.sm },
  backHomeBtnText: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text.primary },
})
