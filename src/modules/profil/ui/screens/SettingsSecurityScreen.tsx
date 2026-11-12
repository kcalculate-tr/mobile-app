/**
 * G12-S4 — Final `FinPrSecurity`.
 *
 * Şifre değiştirme + iki adımlı hesap silme. Backend davranışı mevcut
 * `src/screens/profile/SecurityScreen.tsx` ile AYNI:
 *  - şifre: signInWithPassword (mevcut doğrulama) → updateUser (min 6)
 *  - silme: `delete-account` edge function → unregisterPushToken → signOut
 *
 * Tasarım notu: kırmızı titreme / kırmızı hata halkası YOK. Alan hataları
 * ikincil renkte yardımcı metin olarak gösterilir. `danger` token'ı yalnız
 * sil butonu kenar/metninde kullanılır.
 *
 * "Yeni şifre tekrar" alanı yalnız İSTEMCİ TARAFI eşleşme denetimi — backend'e
 * ayrı bir alan gitmiyor (updateUser hâlâ tek `newPassword` alır). "Açık
 * oturumlar" satırı: bu kod tabanında çok-cihaz oturum LİSTELEME RPC'si yok
 * (grep: "sessions" ilgili bir Supabase çağrısı bulunamadı) — bu yüzden sahte
 * çok-cihaz verisi ÜRETİLMEZ; `supabase.auth.getSession()` ile yalnız "bu
 * cihazda oturum açık mı" dürüstçe gösterilir (1 cihaz = bu cihaz).
 *
 * G25-S1 md.6 (A9): silme onayında abonelik uyarısı — "aktif abonelik mağazada sürer, önce iptal et"
 * + "Aboneliği yönet" (iOS App Store abonelikleri, Android Play abonelikler derin bağlantısı).
 * Onay kartı büyük metinde kaydırılır (Dynamic Type'ta düğmeler kırpılmaz).
 */
import React, { useEffect, useState } from 'react';
import { useFeature } from '../../../../core/flags';
import { resetToSignedOut } from '../../../../navigation/signOutReset';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { manageSubUrl } from '../../../../lib/subscription/storeLinks';
import { openLegalWeb } from '../../../../lib/legal/openLegal';
import { FinText as Text } from '../../../../core/design/components/FinText';
import {
  FinScreen,
  FinHeader,
  FinSectionLabel,
  FinCard,
  FinPrimaryButton,
  FinSecondaryButton,
  finExtras,
  body,
  bodyMedium,
  bodySemibold,
  bodyBold,
} from '../finUi';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { ArrowSquareOut, Trash, Phone } from '../../../../components/icons';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { unregisterPushToken } from '../../../../core/notifications';
import { mapSupabaseErrorToUserMessage } from '../../../../lib/supabaseErrors';
import { SCROLL_KEYBOARD } from '../../../../core/design/keyboard';

function SecureField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  const t = useTheme();
  const x = finExtras(t);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: bodyMedium, fontSize: 14, color: t.color.ink }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={t.color.secondary}
        style={{
          height: 52,
          borderRadius: 14,
          backgroundColor: t.color.line,
          paddingHorizontal: 16,
          fontFamily: body,
          fontSize: 15,
          color: t.color.ink,
        }}
      />
    </View>
  );
}

export default function SettingsSecurityScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const x = finExtras(t);
  const { t: tr, lang } = useT();
  const yeniOnboardingFlag = useFeature('yeni_onboarding');
  const { user, signOut } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldHint, setFieldHint] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Oturum özeti — yalnız bu cihaz (çok-cihaz listeleme RPC'si yok, bkz. üst not).
  const [hasActiveSession, setHasActiveSession] = useState<boolean | null>(null);

  // Silme onayı (ekran içi overlay)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const deleteWord = tr('profil.delete_confirm_word');
  const canDelete = confirmText.trim().toLocaleUpperCase() === deleteWord.trim().toLocaleUpperCase();

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasActiveSession(!!data.session);
    });
  }, []);

  const handleChangePassword = async () => {
    setFieldHint('');
    setSuccessMessage('');

    if (!currentPassword.trim() || !newPassword.trim() || !newPasswordConfirm.trim()) {
      setFieldHint(tr('profil.password_min'));
      return;
    }
    if (newPassword.length < 6) {
      setFieldHint(tr('profil.password_min'));
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setFieldHint(tr('profil.security_new_password_confirm_mismatch'));
      return;
    }
    if (!user?.email) {
      setFieldHint(tr('profil.password_min'));
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
        setFieldHint(tr('profil.current_password'));
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setSuccessMessage(tr('profil.password_changed'));
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (error: unknown) {
      setFieldHint(mapSupabaseErrorToUserMessage(error, tr('profil.password_min')));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('delete-account');
      if (error || !(data as { ok?: boolean } | null)?.ok) {
        Alert.alert(
          tr('profil.delete_account'),
          ((data as { error?: string } | null)?.error) || tr('profil.delete_confirm_body'),
        );
        return;
      }
      await unregisterPushToken();
      await signOut();
      // G21-S1 md.8 (#D4): yığın oturumsuz soğuk açılışla aynı ilk ekrana sıfırlanır
      // (önce oturumsuz Profil sekmesi + üstüne Login kalıyordu).
      resetToSignedOut(yeniOnboardingFlag);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : tr('profil.delete_confirm_body');
      Alert.alert(tr('profil.delete_account'), msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <FinScreen scroll>
      <FinHeader title={tr('profil.security_title')} onBack={onBack} />

      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        {/* Şifre değiştir */}
        <FinSectionLabel>{tr('profil.change_password')}</FinSectionLabel>
        <FinCard style={{ gap: 12, padding: 14 }}>
          <SecureField
            label={tr('profil.current_password')}
            value={currentPassword}
            onChangeText={(v) => {
              setCurrentPassword(v);
              setFieldHint('');
              setSuccessMessage('');
            }}
          />
          <SecureField
            label={tr('profil.new_password')}
            value={newPassword}
            onChangeText={(v) => {
              setNewPassword(v);
              setFieldHint('');
              setSuccessMessage('');
            }}
            placeholder={tr('profil.password_min').replace(/\.$/, '')}
          />
          <SecureField
            label={tr('profil.security_new_password_confirm')}
            value={newPasswordConfirm}
            onChangeText={(v) => {
              setNewPasswordConfirm(v);
              setFieldHint('');
              setSuccessMessage('');
            }}
          />

          {fieldHint ? (
            <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
              {fieldHint}
            </Text>
          ) : null}
          {successMessage ? (
            <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.ink }}>
              {successMessage}
            </Text>
          ) : null}

          <FinPrimaryButton
            label={tr('profil.update_password')}
            disabled={saving}
            onPress={handleChangePassword}
            icon={saving ? <ActivityIndicator size="small" color={t.color.bg} /> : undefined}
          />
        </FinCard>

        {/* Oturumlar — yalnız bu cihaz (dürüst kapsam, bkz. dosya başı notu) */}
        <FinSectionLabel>{tr('profil.security_sessions_title')}</FinSectionLabel>
        <FinCard style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 22, alignItems: 'center' }}>
            <Phone size={20} color={t.color.ink} />
          </View>
          <Text style={{ flex: 1, fontFamily: bodyMedium, fontSize: 15, color: t.color.ink }}>
            {tr('profil.security_active_sessions')}
          </Text>
          <Text style={{ fontFamily: bodyMedium, fontSize: 14, color: t.color.secondary }}>
            {hasActiveSession === null
              ? '—'
              : hasActiveSession
                ? tr('profil.security_this_device_only')
                : '0'}
          </Text>
        </FinCard>

        {/* Hesabı sil — Final: beyaz tam genişlik düğme, kırmızı çöp + metin. Silme akışı (onay + edge function) aynen. */}
        <Pressable
          onPress={() => {
            setConfirmText('');
            setConfirmOpen(true);
          }}
          accessibilityRole="button"
          style={({ pressed }) => ({
            height: 52,
            borderRadius: 20,
            backgroundColor: t.color.surface,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Trash size={18} color={t.color.danger} />
          <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.danger }}>
            {tr('profil.delete_account')}
          </Text>
        </Pressable>
      </View>

      {/* Silme onay overlay'i */}
      {confirmOpen ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: x.scrim,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <ScrollView {...SCROLL_KEYBOARD}
            style={{ width: '100%', maxHeight: '100%' }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            bounces={false}
          >
          <View
            style={{
              width: '100%',
              backgroundColor: t.color.surface,
              borderRadius: 20,
              padding: 20,
              gap: 14,
            }}
            testID="delete-confirm"
          >
            <Text style={{ fontFamily: bodyBold, fontSize: 18, color: t.color.ink }} accessibilityRole="header">
              {tr('profil.delete_confirm_title')}
            </Text>
            <Text
              style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, lineHeight: 20 }}
            >
              {tr('profil.delete_account_desc')}
            </Text>
            <View
              style={{ borderRadius: 14, backgroundColor: t.color.bg, padding: 14, gap: 4 }}
              testID="delete-sub-note"
            >
              <Text style={{ fontFamily: body, fontSize: 14, color: t.color.ink, lineHeight: 20 }}>
                {tr(Platform.OS === 'android' ? 'profil.delete_sub_note_android' : 'profil.delete_sub_note_ios')}
              </Text>
              <Pressable
                onPress={() => void Linking.openURL(manageSubUrl(Platform.OS)).catch(() => {})}
                accessibilityRole="link"
                accessibilityLabel={tr('profil.delete_sub_manage')}
                testID="delete-sub-manage"
                style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
              >
                <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink, textDecorationLine: 'underline' }}>
                  {tr('profil.delete_sub_manage')}
                </Text>
                <ArrowSquareOut size={16} color={t.color.ink} />
              </Pressable>
            </View>
            {/* G28-S1 md.7: silme süreci ve saklanan veriler legal.eatkcal.com/account-deletion */}
            <Pressable
              onPress={() => void openLegalWeb('accountDeletion', lang)}
              accessibilityRole="link"
              accessibilityLabel={tr('profil.delete_info_link')}
              testID="delete-info-link"
              style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
            >
              <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink, textDecorationLine: 'underline' }}>
                {tr('profil.delete_info_link')}
              </Text>
              <ArrowSquareOut size={16} color={t.color.ink} />
            </Pressable>
            <Text
              style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, lineHeight: 20 }}
            >
              {tr('profil.delete_confirm_body')}
            </Text>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={deleteWord}
              placeholderTextColor={x.placeholderText}
              style={{
                height: 52,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: t.color.line,
                backgroundColor: t.color.bg,
                paddingHorizontal: 16,
                fontFamily: bodySemibold,
                fontSize: 15,
                color: t.color.ink,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <FinSecondaryButton
                label={tr('common.cancel')}
                height={52}
                style={{ flex: 1 }}
                onPress={() => setConfirmOpen(false)}
              />
              <FinPrimaryButton
                label={tr('profil.delete_confirm_cta')}
                disabled={!canDelete || deleting}
                onPress={handleConfirmDelete}
                style={{ flex: 1, backgroundColor: t.color.danger }}
                icon={
                  deleting ? <ActivityIndicator size="small" color="#FFFFFF" /> : undefined
                }
              />
            </View>
          </View>
          </ScrollView>
        </View>
      ) : null}
    </FinScreen>
  );
}
