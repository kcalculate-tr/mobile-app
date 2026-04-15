import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CaretLeft, Eye, EyeSlash, Shield } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { getSupabaseClient } from '../../lib/supabase';
import { mapSupabaseErrorToUserMessage } from '../../lib/supabaseErrors';
import { RootStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/theme';

type SecurityNavigationProp = NativeStackNavigationProp<RootStackParamList>;

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={s.fieldGroup}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputWrapper}>
        <TextInput
          style={[s.input, s.inputWithIcon]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.text.tertiary}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={s.eyeBtn} onPress={() => setShow(v => !v)} activeOpacity={0.7}>
          {show ? <EyeSlash size={18} color={COLORS.text.secondary} /> : <Eye size={18} color={COLORS.text.secondary} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SecurityScreen() {
  const navigation = useNavigation<SecurityNavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { isAuthenticated, loading } = useRequireAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChangePassword = async () => {
    setSuccessMessage('');
    setErrorMessage('');

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setErrorMessage('Lütfen tüm alanları doldurun.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Yeni şifre en az 6 karakter olmalı.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Yeni şifreler eşleşmiyor.');
      return;
    }
    if (!user?.email) {
      setErrorMessage('Kullanıcı bilgisi alınamadı.');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        setErrorMessage('Mevcut şifre hatalı.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setSuccessMessage('Şifreniz başarıyla güncellendi.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      setErrorMessage(
        mapSupabaseErrorToUserMessage(error, 'Şifre güncellenemedi. Lütfen tekrar deneyin.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm verileriniz silinir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Hesabı Sil',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Son Onay',
              'Hesabınızı kalıcı olarak silmek istediğinizi onaylıyor musunuz?',
              [
                { text: 'Hayır', style: 'cancel' },
                {
                  text: 'Evet, Sil',
                  style: 'destructive',
                  onPress: async () => {
                    await signOut();
                    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  if (loading) return <ActivityIndicator />;
  if (!isAuthenticated) return null;

  // Password strength
  const strength = newPassword.length === 0 ? 0
    : newPassword.length < 6 ? 1
    : newPassword.length < 10 ? 2
    : 3;
  const strengthColors = ['#e0e0e0', '#EF4444', '#F59E0B', '#22C55E'];
  const strengthLabels = ['', 'Zayıf', 'Orta', 'Güçlü'];

  return (
    <ScreenContainer edges={['top']} style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
          <CaretLeft size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Güvenlik</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: Math.max(32, insets.bottom + 24) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Shield card */}
          <View style={s.shieldCard}>
            <View style={s.shieldIconWrap}>
              <Shield size={24} color="#000000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.shieldTitle}>Hesap Güvenliği</Text>
              <Text style={s.shieldSub}>Şifrenizi düzenli olarak güncelleyin.</Text>
            </View>
          </View>

          {/* Password change card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Şifre Değiştir</Text>

            <PasswordField
              label="Mevcut Şifre"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Mevcut şifreniz"
            />
            <PasswordField
              label="Yeni Şifre"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="En az 6 karakter"
            />

            {/* Strength bars */}
            {newPassword.length > 0 && (
              <View style={s.strengthWrap}>
                <View style={s.strengthBars}>
                  {[1, 2, 3].map((lvl) => (
                    <View
                      key={lvl}
                      style={[
                        s.strengthBar,
                        { backgroundColor: strength >= lvl ? strengthColors[strength] : '#e0e0e0' },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[s.strengthLabel, { color: strengthColors[strength] }]}>
                  {strengthLabels[strength]}
                </Text>
              </View>
            )}

            <PasswordField
              label="Yeni Şifre Tekrar"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Yeni şifrenizi tekrar girin"
            />

            {errorMessage ? <Text style={s.errorText}>{errorMessage}</Text> : null}
            {successMessage ? <Text style={s.successText}>{successMessage}</Text> : null}

            <TouchableOpacity
              style={[s.saveBtn, saving && s.saveBtnDisabled]}
              onPress={handleChangePassword}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={s.saveBtnText}>Şifreyi Güncelle</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Danger zone */}
          <View style={s.dangerCard}>
            <Text style={s.dangerTitle}>Tehlikeli Bölge</Text>
            <Text style={s.dangerSub}>
              Hesabınızı silerseniz tüm verileriniz, siparişleriniz ve adres bilgileriniz kalıcı
              olarak silinir. Bu işlem geri alınamaz.
            </Text>
            <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.85}>
              <Text style={s.deleteBtnText}>Hesabımı Sil</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f6f6' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },

  content: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },

  // Shield card
  shieldCard: {
    backgroundColor: COLORS.brand.green, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  shieldIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  shieldTitle: { fontSize: 15, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  shieldSub: { fontSize: 12, color: 'rgba(0,0,0,0.6)', marginTop: 2 },

  // Password card
  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginBottom: 4 },

  // Field
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '500',
fontFamily: 'PlusJakartaSans_500Medium', color: '#000000' },
  inputWrapper: { position: 'relative' },
  input: {
    height: 52, borderRadius: 100, borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)', backgroundColor: '#ffffff',
    paddingHorizontal: 20, fontSize: 15, color: '#000000',
  },
  inputWithIcon: { paddingRight: 52 },
  eyeBtn: {
    position: 'absolute', right: 18, top: 0, bottom: 0,
    justifyContent: 'center', padding: 4,
  },

  // Strength
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 6 },
  strengthBar: { flex: 1, height: 4, borderRadius: 100 },
  strengthLabel: { fontSize: 12, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', width: 40 },

  errorText: { fontSize: 13, color: '#EF4444' },
  successText: { fontSize: 13, color: '#16A34A' },

  saveBtn: {
    height: 52, borderRadius: 100, backgroundColor: COLORS.brand.green,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 15, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },

  // Danger
  dangerCard: {
    backgroundColor: '#FEF2F2', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#FECACA', gap: 12,
  },
  dangerTitle: { fontSize: 15, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#991B1B' },
  dangerSub: { fontSize: 13, color: '#7F1D1D', lineHeight: 19 },
  deleteBtn: {
    height: 48, borderRadius: 100, backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { color: '#ffffff', fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
});
