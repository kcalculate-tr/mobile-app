import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import * as Linking from 'expo-linking'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { CaretLeft, Check, EnvelopeSimple, Phone, User } from 'phosphor-react-native'
import ScreenContainer from '../components/ScreenContainer'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'
import { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

/**
 * Kişisel Bilgiler.
 *
 * 08.10.2026 — üç ayrı sorun birden kapatıldı:
 *
 * 1. AD SOYAD YANLIŞ KOLONA YAZILIYORDU. Bu ekran yalnız `full_name` okuyup
 *    yazıyordu; kayıt akışı ve CheckoutScreen ise `first_name`/`last_name`
 *    dolduruyor. Canlıda 640 profilin yalnız 59'unda full_name var, 367'sinde
 *    first_name. Yani çoğu müşteri bu ekranı açtığında adını BOŞ görüyor,
 *    yazıp kaydediyor, Checkout'ta eski ad çıkmaya devam ediyor — "güncellenmiyor"
 *    şikâyeti buradan. Artık okurken full_name yoksa first+last'tan türetiyoruz,
 *    yazarken üçünü birden güncelliyoruz (CheckoutScreen'deki bölme kuralının aynısı).
 *
 * 2. TELEFON WHATSAPP OTP İSTİYORDU. Supabase Phone Auth hiç yapılandırılmamış:
 *    645 kullanıcının HİÇBİRİNDE auth.users.phone dolu değil, doğrulanmış telefon 0.
 *    Yani akış hiç çalışmadı. Üretimde "OTP gönderilemedi" verip telefonu hiç
 *    kaydetmiyordu. OTP tamamen kaldırıldı; telefon artık ad soyadla aynı
 *    düğmeden, düz güncelleme ile kaydediliyor.
 *
 * 3. E-POSTA ONAY BAĞLANTISI UYGULAMAYA DÖNMÜYORDU. updateUser'a emailRedirectTo
 *    verilmediği için bağlantı projenin Site URL'ine düşüyordu. Artık
 *    kcal://auth-callback'e dönüyor ve AuthContext'teki dinleyici oturumu
 *    tazeleyip yeni e-postayı uyguluyor.
 */

// ── E-posta değişimi — tek yer, onay gerektiren tek alan ─────────────────────
function EmailChangeSection({ currentEmail }: { currentEmail: string }) {
  const [editing,  setEditing]  = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [sent,     setSent]     = useState(false)

  const handleSend = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email.includes('@') || email.length < 5) {
      Alert.alert('Geçersiz e-posta', 'Lütfen geçerli bir e-posta adresi girin.'); return
    }
    if (email === currentEmail.trim().toLowerCase()) {
      Alert.alert('Aynı adres', 'Yeni e-posta mevcut e-postayla aynı.'); return
    }
    setLoading(true)
    try {
      const { error } = await getSupabaseClient().auth.updateUser(
        { email },
        { emailRedirectTo: Linking.createURL('auth-callback') },
      )
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
        <View style={s.fieldIcon}><EnvelopeSimple size={18} color={COLORS.brand.green} /></View>
        <View style={s.fieldBody}>
          <Text style={s.fieldLabel}>E-posta</Text>
          <Text style={[s.fieldReadOnly, { color: COLORS.brand.green }]}>Doğrulama e-postası gönderildi</Text>
          <Text style={s.fieldHint}>
            {newEmail} adresine bir bağlantı gönderdik. Bağlantıya tıkladığında
            e-postan değişecek ve uygulamaya geri döneceksin.
          </Text>
          <TouchableOpacity onPress={() => { setSent(false); setEditing(false); setNewEmail('') }}>
            <Text style={s.linkText}>Geri dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (!editing) {
    return (
      <View style={s.fieldCard}>
        <View style={s.fieldIcon}><EnvelopeSimple size={18} color={COLORS.text.secondary} /></View>
        <View style={s.fieldBody}>
          <Text style={s.fieldLabel}>E-posta</Text>
          <Text style={s.fieldReadOnly}>{currentEmail || '—'}</Text>
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={s.linkText}>Değiştir</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={s.fieldCard}>
      <View style={s.fieldIcon}><EnvelopeSimple size={18} color={COLORS.text.secondary} /></View>
      <View style={s.fieldBody}>
        <Text style={s.fieldLabel}>Yeni e-posta</Text>
        <TextInput
          style={s.fieldInput}
          value={newEmail}
          onChangeText={setNewEmail}
          placeholder="ornek@eposta.com"
          placeholderTextColor={COLORS.text.disabled}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={s.fieldHint}>
          Güvenlik gereği yalnızca e-posta değişikliği onay gerektirir.
        </Text>
        <View style={s.rowBtns}>
          <TouchableOpacity
            style={[s.smallBtn, loading && { opacity: 0.5 }]}
            onPress={handleSend}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={s.smallBtnText}>Onay gönder</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setEditing(false); setNewEmail('') }}>
            <Text style={s.linkText}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

// ── Ana ekran ────────────────────────────────────────────────────────────────
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
      .select('full_name, first_name, last_name, phone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          // AddressesScreen/CheckoutScreen ile AYNI okuma kuralı: full_name
          // boşsa first+last'tan türet. Aksi halde adı olan müşteri bu ekranı
          // boş görüyordu.
          const ad =
            String(data.full_name || '').trim() ||
            [data.first_name, data.last_name].filter(Boolean).join(' ').trim()
          setFullName(ad)
          setPhone(String(data.phone || '').trim())
        }
        setLoading(false)
      })
    // Profil bir kez, kullanıcı KİMLİĞİ değişince okunur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Oturum bulunamadı', 'Lütfen çıkış yapıp tekrar giriş yapın.')
      return
    }
    const ad = fullName.trim()
    const tel = phone.trim().replace(/\s/g, '')
    if (ad.length < 2) { Alert.alert('Eksik bilgi', 'Lütfen ad soyad girin.'); return }
    if (tel && tel.replace(/\D/g, '').length < 10) {
      Alert.alert('Geçersiz telefon', 'Lütfen geçerli bir telefon numarası girin.'); return
    }

    setSaving(true)
    try {
      // CheckoutScreen'deki bölme kuralının aynısı — üç kolon da senkron kalsın.
      const [first, ...rest] = ad.split(/\s+/).filter(Boolean)
      const { error } = await supabase.from('profiles').update({
        full_name: ad,
        first_name: first || null,
        last_name: rest.join(' ') || null,
        phone: tel || null,
      }).eq('id', user.id)
      if (error) throw error
      Alert.alert('Kaydedildi', 'Bilgilerin güncellendi.')
      navigation.goBack()
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message || 'Lütfen tekrar deneyin.')
    } finally { setSaving(false) }
  }

  return (
    <ScreenContainer style={s.root} edges={['top']}>
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
            : <Check size={18} color="#000" weight="bold" />}
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
            {/* Ad Soyad — düz güncelleme */}
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

            {/* Telefon — düz güncelleme, OTP yok */}
            <View style={s.fieldCard}>
              <View style={s.fieldIcon}><Phone size={18} color={COLORS.text.secondary} /></View>
              <View style={s.fieldBody}>
                <Text style={s.fieldLabel}>Telefon</Text>
                <TextInput
                  style={s.fieldInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="5XX XXX XX XX"
                  placeholderTextColor={COLORS.text.disabled}
                  keyboardType="phone-pad"
                  maxLength={20}
                />
                <Text style={s.fieldHint}>Kurye seni bu numaradan arar.</Text>
              </View>
            </View>

            {/* E-posta — tek onay gerektiren alan */}
            <EmailChangeSection currentEmail={email} />

            <TouchableOpacity
              style={[s.saveFullBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#000" />
                : <Text style={s.saveFullBtnText}>Kaydet</Text>}
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
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg, fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary, letterSpacing: -0.4,
  },
  saveBtn: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center',
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  fieldCard: {
    flexDirection: 'row', gap: SPACING.md,
    backgroundColor: COLORS.white, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    padding: SPACING.lg, marginBottom: SPACING.md,
  },
  fieldIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  fieldBody: { flex: 1 },
  fieldLabel: {
    fontSize: TYPOGRAPHY.size.sm, fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.secondary, marginBottom: 2,
  },
  fieldInput: {
    fontSize: TYPOGRAPHY.size.md, fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.primary, paddingVertical: 4,
  },
  fieldReadOnly: {
    fontSize: TYPOGRAPHY.size.md, fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.primary, paddingVertical: 4,
  },
  fieldHint: {
    fontSize: TYPOGRAPHY.size.xs, fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text.tertiary, marginTop: 2, lineHeight: 15,
  },
  linkText: {
    fontSize: TYPOGRAPHY.size.sm, fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.brand.green, marginTop: SPACING.xs,
  },
  rowBtns: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.sm },
  smallBtn: {
    backgroundColor: COLORS.brand.green, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    alignItems: 'center', justifyContent: 'center', minWidth: 120,
  },
  smallBtnText: { fontSize: TYPOGRAPHY.size.sm, fontFamily: 'PlusJakartaSans_700Bold', color: '#000' },
  saveFullBtn: {
    backgroundColor: COLORS.brand.green, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg, alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  saveFullBtnText: { fontSize: TYPOGRAPHY.size.md, fontFamily: 'PlusJakartaSans_700Bold', color: '#000' },
})
