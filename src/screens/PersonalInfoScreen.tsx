import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  CaretLeft, Check, EnvelopeSimple, Phone, User,
  WhatsappLogo, PencilSimple, X,
} from 'phosphor-react-native'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'
import { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

// ── E-posta değişim modal ─────────────────────────────────────────────────────
function EmailChangeSection({ currentEmail }: { currentEmail: string }) {
  const { user } = useAuth()
  const [editing,   setEditing]   = useState(false)
  const [newEmail,  setNewEmail]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [sent,      setSent]      = useState(false)

  const handleSend = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email.includes('@')) { Alert.alert('Geçersiz e-posta adresi.'); return }
    if (email === currentEmail) { Alert.alert('Yeni e-posta mevcut e-postayla aynı.'); return }
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.updateUser({ email })
      if (error) throw error
      setSent(true)
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'E-posta değiştirilemedi.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <View style={s.fieldCard}>
        <View style={s.fieldIcon}><EnvelopeSimple size={18} color="#16a34a" /></View>
        <View style={s.fieldBody}>
          <Text style={s.fieldLabel}>E-posta</Text>
          <Text style={[s.fieldReadOnly, { color: '#16a34a' }]}>Doğrulama e-postası gönderildi!</Text>
          <Text style={s.fieldHint}>
            {newEmail} adresine doğrulama bağlantısı gönderildi. Bağlantıya tıkladıktan sonra e-postanız değişecektir.
          </Text>
          <TouchableOpacity onPress={() => { setSent(false); setEditing(false); setNewEmail('') }}>
            <Text style={[s.fieldHint, { color: COLORS.brand.green, marginTop: SPACING.xs }]}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (editing) {
    return (
      <View style={s.fieldCard}>
        <View style={s.fieldIcon}><EnvelopeSimple size={18} color={COLORS.text.secondary} /></View>
        <View style={s.fieldBody}>
          <Text style={s.fieldLabel}>Yeni E-posta</Text>
          <TextInput
            style={s.fieldInput}
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="yeni@eposta.com"
            placeholderTextColor={COLORS.text.disabled}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm }}>
            <TouchableOpacity
              style={[s.miniBtn, { backgroundColor: COLORS.brand.green }]}
              onPress={handleSend}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={[s.miniBtnText, { color: COLORS.text.primary }]}>Doğrulama Gönder</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={s.miniBtn} onPress={() => { setEditing(false); setNewEmail('') }} activeOpacity={0.8}>
              <X size={14} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={s.fieldCard}>
      <View style={s.fieldIcon}><EnvelopeSimple size={18} color={COLORS.text.secondary} /></View>
      <View style={s.fieldBody}>
        <Text style={s.fieldLabel}>E-posta</Text>
        <Text style={s.fieldReadOnly}>{currentEmail}</Text>
      </View>
      <TouchableOpacity onPress={() => setEditing(true)} style={s.editIconBtn} activeOpacity={0.7}>
        <PencilSimple size={16} color={COLORS.text.tertiary} />
      </TouchableOpacity>
    </View>
  )
}

// ── Telefon OTP modal ─────────────────────────────────────────────────────────
function PhoneChangeSection({ currentPhone, onSaved }: { currentPhone: string; onSaved: (p: string) => void }) {
  const { user } = useAuth()
  const [editing,   setEditing]   = useState(false)
  const [step,      setStep]      = useState<'input' | 'otp'>('input')
  const [newPhone,  setNewPhone]  = useState('')
  const [otp,       setOtp]       = useState('')
  const [loading,   setLoading]   = useState(false)

  // OTP gönder — Supabase SMS / mock
  const handleSendOtp = async () => {
    const phone = newPhone.trim().replace(/\s/g, '')
    if (phone.length < 10) { Alert.alert('Geçerli bir telefon numarası girin.'); return }
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      // Supabase phone OTP (SMS / WhatsApp via Twilio)
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone.startsWith('+') ? phone : `+90${phone.replace(/^0/, '')}`,
      })
      if (error) throw error
      setStep('otp')
    } catch (e: any) {
      // Supabase phone auth aktif değilse profil direkt güncelle (geliştirme modu)
      if (__DEV__) {
        Alert.alert('Test Modu', 'Supabase Phone Auth aktif değil. Telefon kaydediliyor.')
        await savePhone(newPhone)
      } else {
        Alert.alert('Hata', e?.message || 'OTP gönderilemedi.')
      }
    } finally {
      setLoading(false) }
  }

  const handleVerifyOtp = async () => {
    const phone = newPhone.trim().replace(/\s/g, '')
    const formatted = phone.startsWith('+') ? phone : `+90${phone.replace(/^0/, '')}`
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.verifyOtp({
        phone: formatted, token: otp.trim(), type: 'sms',
      })
      if (error) throw error
      await savePhone(newPhone)
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Kod doğrulanamadı.')
    } finally {
      setLoading(false)
    }
  }

  const savePhone = async (phone: string) => {
    const supabase = getSupabaseClient()
    await supabase.from('profiles').update({ phone: phone.trim() }).eq('id', user?.id)
    onSaved(phone.trim())
    setEditing(false); setStep('input'); setNewPhone(''); setOtp('')
    Alert.alert('Başarılı', 'Telefon numarası güncellendi.')
  }

  if (!editing) {
    return (
      <View style={s.fieldCard}>
        <View style={s.fieldIcon}><Phone size={18} color={COLORS.text.secondary} /></View>
        <View style={s.fieldBody}>
          <Text style={s.fieldLabel}>Telefon</Text>
          <Text style={s.fieldReadOnly}>{currentPhone || 'Telefon eklenmemiş'}</Text>
        </View>
        <TouchableOpacity onPress={() => setEditing(true)} style={s.editIconBtn} activeOpacity={0.7}>
          <PencilSimple size={16} color={COLORS.text.tertiary} />
        </TouchableOpacity>
      </View>
    )
  }

  if (step === 'input') {
    return (
      <View style={s.fieldCard}>
        <View style={s.fieldIcon}><WhatsappLogo size={18} color="#25D366" /></View>
        <View style={s.fieldBody}>
          <Text style={s.fieldLabel}>Yeni Telefon</Text>
          <TextInput
            style={s.fieldInput}
            value={newPhone}
            onChangeText={setNewPhone}
            placeholder="+90 5xx xxx xx xx"
            placeholderTextColor={COLORS.text.disabled}
            keyboardType="phone-pad"
            autoFocus
          />
          <Text style={s.fieldHint}>WhatsApp üzerinden doğrulama kodu gönderilecektir.</Text>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm }}>
            <TouchableOpacity
              style={[s.miniBtn, { backgroundColor: '#25D366' }]}
              onPress={handleSendOtp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <WhatsappLogo size={14} color="#fff" />
                    <Text style={[s.miniBtnText, { color: COLORS.white }]}>Kod Gönder</Text>
                  </>
              }
            </TouchableOpacity>
            <TouchableOpacity style={s.miniBtn} onPress={() => { setEditing(false); setNewPhone('') }} activeOpacity={0.8}>
              <X size={14} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={s.fieldCard}>
      <View style={s.fieldIcon}><WhatsappLogo size={18} color="#25D366" /></View>
      <View style={s.fieldBody}>
        <Text style={s.fieldLabel}>Doğrulama Kodu</Text>
        <Text style={s.fieldHint}>{newPhone} numarasına WhatsApp kodu gönderildi.</Text>
        <TextInput
          style={[s.fieldInput, { marginTop: SPACING.sm, letterSpacing: 6, fontSize: TYPOGRAPHY.size['2xl'], fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold'}]}
          value={otp}
          onChangeText={setOtp}
          placeholder="000000"
          placeholderTextColor={COLORS.text.disabled}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />
        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm }}>
          <TouchableOpacity
            style={[s.miniBtn, { backgroundColor: COLORS.brand.green }]}
            onPress={handleVerifyOtp}
            disabled={loading || otp.length < 6}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator size="small" color="#000" />
              : <>
                  <Check size={14} color="#000" weight="bold" />
                  <Text style={[s.miniBtnText, { color: COLORS.text.primary }]}>Doğrula</Text>
                </>
            }
          </TouchableOpacity>
          <TouchableOpacity style={s.miniBtn} onPress={() => setStep('input')} activeOpacity={0.8}>
            <Text style={[s.miniBtnText, { color: COLORS.text.tertiary }]}>Geri</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

// ── Ana ekran ─────────────────────────────────────────────────────────────────
export default function PersonalInfoScreen() {
  const navigation = useNavigation<Nav>()
  const insets     = useSafeAreaInsets()
  const { user }   = useAuth()
  const supabase   = getSupabaseClient()

  const [fullName, setFullName] = useState('')
  const [phone,    setPhone]    = useState('')
  const [email,    setEmail]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!user?.id) return
    setEmail(user.email || '')
    supabase.from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setFullName(data.full_name || ''); setPhone(data.phone || '') }
        setLoading(false)
      })
  }, [user?.id])

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName.trim(),
      }).eq('id', user.id)
      if (error) throw error
      Alert.alert('Başarılı', 'Ad soyad güncellendi.')
      navigation.goBack()
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Güncelleme başarısız.')
    } finally { setSaving(false) }
  }

  return (
    <ScreenContainer style={s.root} edges={['top']}>
      {/* Header — SecurityScreen ile aynı stil */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
          <CaretLeft size={22} color="#000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Kişisel Bilgiler</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[s.saveBtn, saving && { opacity: 0.5 }]}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#000" />
            : <Check size={18} color="#000" weight="bold" />
          }
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={COLORS.brand.green} size="large" /></View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Ad Soyad */}
            <View style={s.fieldCard}>
              <View style={s.fieldIcon}><User size={18} color={COLORS.text.secondary} /></View>
              <View style={s.fieldBody}>
                <Text style={s.fieldLabel}>Ad Soyad</Text>
                <TextInput
                  style={s.fieldInput}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Adınız Soyadınız"
                  placeholderTextColor={COLORS.text.disabled}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* E-posta — değiştirilebilir */}
            <EmailChangeSection currentEmail={email} />

            {/* Telefon — WhatsApp OTP */}
            <PhoneChangeSection
              currentPhone={phone}
              onSaved={(p) => setPhone(p)}
            />

            <TouchableOpacity
              style={[s.saveFullBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#000" />
                : <Text style={s.saveFullBtnText}>Ad Soyadı Kaydet</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  saveBtn: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center',
  },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.md },

  fieldCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md,
    backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  fieldIcon: {
    width: 36, height: 36, borderRadius: RADIUS.xs, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  fieldBody: { flex: 1 },
  fieldLabel: {
    fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.tertiary,
    marginBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  fieldInput: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.medium,
fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.text.primary, paddingVertical: 0 },
  fieldReadOnly: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.medium,
fontFamily: 'PlusJakartaSans_500Medium', color: '#555' },
  fieldHint: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.disabled, marginTop: SPACING.xs, lineHeight: 15 },

  editIconBtn: {
    width: 32, height: 32, borderRadius: RADIUS.xs, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },

  miniBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  miniBtnText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold'},

  saveFullBtn: {
    marginTop: SPACING.sm, backgroundColor: COLORS.brand.green, borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg, alignItems: 'center',
  },
  saveFullBtnText: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text.primary },
})
