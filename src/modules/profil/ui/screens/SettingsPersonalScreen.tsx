/**
 * G12-S4 — Kişisel Bilgiler (Final FinPrPersonal panosu).
 *
 * Backend mantığı `src/screens/PersonalInfoScreen.tsx`'ten birebir yeniden
 * kullanılır: profilin full_name/first_name/last_name/phone okuma+yazma kuralı
 * (full_name boşsa first+last'tan türet; kaydederken üç kolonu da senkron tut)
 * ve e-posta değişimi `auth.updateUser({ email }, { emailRedirectTo })`.
 *
 * Avatar: `../../avatarUpload.ts`'in `pickAndUploadAvatar` yardımcısı — eski
 * `ProfileScreen.tsx`'teki `pickAvatar` ile AYNI mekanik (expo-image-picker +
 * expo-file-system/legacy base64 → `avatars` kovası), sonucu `profiles.avatar_url`'a
 * yazılır. Kullanıcı adı: `../../handle.ts` + `../../useHandleClaim.ts`'teki kayıt
 * akışıyla AYNI biçim doğrulama + debounce'lu canlı müsaitlik kontrolü
 * (`check_handle`); kaydederken `claim_handle` ile nihai sahiplenme (sunucu
 * benzersizliği denetler, idempotent). Bio: `update_public_profile` RPC'sinin
 * `p_bio` parametresi (profiles.bio, 160 karakter sunucu sınırı).
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { Check, CameraIcon, User } from '../../../../components/icons';
import { pickAndUploadAvatar } from '../../avatarUpload';
import { getProfilClient } from '../../client';
import { useHandleClaim } from '../../useHandleClaim';
import {
  FinScreen,
  FinHeader,
  FinCard,
  FinPrimaryButton,
  FinFieldError,
  useFinShake,
  bodyMedium,
  bodySemibold,
} from '../finUi';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words';
  editable?: boolean;
  error?: string | null;
  hint?: string | null;
  shakeStyle?: any;
  multiline?: boolean;
  maxLength?: number;
};

function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
  error,
  hint,
  shakeStyle,
  multiline,
  maxLength,
}: FieldProps) {
  const t = useTheme();
  return (
    <Animated.View style={[{ gap: 6 }, shakeStyle]}>
      <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={t.color.secondary}
        style={{
          height: multiline ? 90 : 52,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 10 : 0,
          backgroundColor: t.color.surface,
          borderWidth: 1,
          borderColor: error ? t.color.danger : t.color.line,
          fontFamily: bodyMedium,
          fontSize: 15,
          color: editable ? t.color.ink : t.color.secondary,
        }}
      />
      {error ? (
        <FinFieldError>{error}</FinFieldError>
      ) : hint ? (
        <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.secondary }}>{hint}</Text>
      ) : null}
    </Animated.View>
  );
}

export default function SettingsPersonalScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const nameShake = useFinShake();
  const phoneShake = useFinShake();

  // Kullanıcı adı — kayıt akışıyla AYNI debounce'lu biçim + müsaitlik kontrolü.
  const handleClaim = useHandleClaim('');
  const [initialHandle, setInitialHandle] = useState('');

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setEmail(user.email || '');
    supabase
      .from('profiles')
      .select('full_name, first_name, last_name, phone, bio, avatar_url, handle')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          // PersonalInfoScreen ile AYNI okuma kuralı: full_name boşsa first+last.
          const ad =
            String(data.full_name || '').trim() ||
            [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
          setFullName(ad);
          setPhone(String(data.phone || '').trim());
          setBio(String(data.bio || ''));
          setAvatarUrl(data.avatar_url || null);
          const h = String(data.handle || '');
          setInitialHandle(h);
          handleClaim.setValue(h);
        }
        setLoading(false);
      });
    // Profil kullanıcı kimliği değişince bir kez okunur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handlePickAvatar = async () => {
    if (!user?.id || avatarUploading) return;
    setAvatarUploading(true);
    try {
      const url = await pickAndUploadAvatar(user.id);
      if (url) {
        setAvatarUrl(url);
        await getProfilClient().updatePublicProfile({ displayName: fullName || null as any, bio: null, avatarUrl: url });
      }
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert(tr('profil.personal_title'));
      return;
    }
    setNameError(null);
    setPhoneError(null);
    const ad = fullName.trim();
    const tel = phone.trim().replace(/\s/g, '');
    // FinMoShake: yalnız form alanı doğrulama hatasında — ağ/limit/red hatası
    // (aşağıdaki catch bloğu) titremez, Alert ile kalır.
    if (ad.length < 2) {
      setNameError(tr('profil.field_name_invalid'));
      nameShake.shake();
      return;
    }
    if (tel && tel.replace(/\D/g, '').length < 10) {
      setPhoneError(tr('profil.field_phone_invalid'));
      phoneShake.shake();
      return;
    }

    setSaving(true);
    try {
      // CheckoutScreen/PersonalInfoScreen bölme kuralı — üç kolon da senkron.
      const [first, ...rest] = ad.split(/\s+/).filter(Boolean);
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: ad,
          first_name: first || null,
          last_name: rest.join(' ') || null,
          phone: tel || null,
        })
        .eq('id', user.id);
      if (error) throw error;

      // Bio — update_public_profile RPC (NULL = değiştirme). Boş string de yazılabilir.
      const { error: bioErr } = await supabase
        .from('profiles')
        .update({ bio: bio.trim() || null })
        .eq('id', user.id);
      if (bioErr) throw bioErr;

      // Kullanıcı adı değiştiyse — kayıt akışıyla AYNI claim_handle (idempotent,
      // sunucu benzersizliği denetler). Biçim geçersiz/alınmışsa submit engellenir.
      const nextHandle = handleClaim.normalized;
      if (nextHandle && nextHandle !== initialHandle) {
        if (handleClaim.status === 'invalid' || handleClaim.status === 'taken') {
          setSaving(false);
          return;
        }
        const claim = await getProfilClient().claimHandle({ handle: nextHandle });
        if (!claim.ok) {
          Alert.alert(tr('profil.personal_title'), tr('profil.handle_taken'));
          setSaving(false);
          return;
        }
        setInitialHandle(nextHandle);
      }

      // E-posta değiştiyse onay akışı — tek onay gerektiren alan.
      const nextEmail = email.trim().toLowerCase();
      const currentEmail = (user.email || '').trim().toLowerCase();
      if (nextEmail && nextEmail !== currentEmail) {
        const { error: emailErr } = await supabase.auth.updateUser(
          { email: nextEmail },
          { emailRedirectTo: ExpoLinking.createURL('auth-callback') },
        );
        if (emailErr) throw emailErr;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e: any) {
      Alert.alert(tr('profil.personal_title'), e?.message || '');
    } finally {
      setSaving(false);
    }
  };

  const handleHint =
    handleClaim.status === 'checking'
      ? null
      : handleClaim.messageKey
        ? tr(handleClaim.messageKey)
        : null;
  const handleError =
    handleClaim.status === 'invalid' || handleClaim.status === 'taken' ? handleHint : null;
  const handleOkHint = handleClaim.status === 'available' ? handleHint : null;

  return (
    <FinScreen scroll contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.personal_title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={t.color.accent} size="large" />
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Pressable onPress={handlePickAvatar} disabled={avatarUploading} accessibilityRole="button">
                <View
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 42,
                    backgroundColor: t.color.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {avatarUploading ? (
                    <ActivityIndicator color={t.color.accent} />
                  ) : avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={{ width: 84, height: 84 }} />
                  ) : (
                    <User size={36} color={t.color.secondary} weight="bold" />
                  )}
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: t.color.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CameraIcon size={14} color={t.color.onAccent} weight="bold" />
                  </View>
                </View>
              </Pressable>
              <Pressable onPress={handlePickAvatar} disabled={avatarUploading}>
                <Text style={{ fontFamily: bodySemibold, fontSize: 13, color: t.color.accent }}>
                  {tr('profil.avatar_change')}
                </Text>
              </Pressable>
            </View>

            <FinCard style={{ gap: 16 }}>
              <Field
                label={tr('profil.field_name')}
                value={fullName}
                onChangeText={text => {
                  setFullName(text);
                  if (nameError) setNameError(null);
                }}
                autoCapitalize="words"
                error={nameError}
                shakeStyle={nameShake.style}
              />
              <Field
                label={tr('profil.handle_label')}
                value={handleClaim.value}
                onChangeText={handleClaim.setValue}
                autoCapitalize="none"
                error={handleError}
                hint={handleOkHint}
              />
              <Field
                label={tr('profil.bio')}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={160}
              />
              <Field
                label={tr('profil.field_email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              <Field
                label={tr('profil.field_phone')}
                value={phone}
                onChangeText={text => {
                  setPhone(text);
                  if (phoneError) setPhoneError(null);
                }}
                keyboardType="phone-pad"
                error={phoneError}
                shakeStyle={phoneShake.style}
              />
            </FinCard>

            {saved ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: t.color.accent,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <Check size={18} color={t.color.onAccent} weight="bold" />
                <Text style={{ fontFamily: bodySemibold, fontSize: 14, color: t.color.onAccent }}>
                  {tr('profil.saved')}
                </Text>
              </View>
            ) : null}

            <FinPrimaryButton
              label={tr('profil.save_changes')}
              onPress={handleSave}
              disabled={saving}
              icon={saving ? <ActivityIndicator color={t.color.bg} /> : undefined}
            />
          </>
        )}
      </View>
    </FinScreen>
  );
}
