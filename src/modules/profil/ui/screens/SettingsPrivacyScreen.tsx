/**
 * G12-S4 — Gizlilik (Final FinPrPrivacySettings panosu).
 *
 * "Hesap gizliliği" bölümü `../PrivacySheet.tsx` ile AYNI mantığı inline render
 * eder (iki seçenek: Herkese açık / Gizli hesap; `getProfilClient().setPrivacy`
 * → `set_profile_privacy` RPC → `profiles.is_private`). Modal/BottomSheet
 * SARILMAZ — bu sayfa kendi kendine yeten bir ekran (G12-S4 kapsamı).
 *
 * "Engellenenler": `user_blocks` tablosu GERÇEK ve sorgulanabilir (RLS:
 * `blocker_id = auth.uid()`, bkz. supabase/migrations/20261104000200_feed_tables.sql).
 * Sayım `select count(*) from user_blocks where blocker_id = <me>` ile GERÇEK veri —
 * sahte/placeholder sayı DEĞİL. Engellenen hesapların LİSTESİ/yönetimi (aç/kapa)
 * bu ekranın kapsamında değil — yalnız sayaç satırı (başka bir ekranda genişletilir).
 *
 * "Hesabı sil" — SettingsSecurityScreen.tsx'teki akışın AYNISI tekrar inşa
 * edilmez; bu ekran yalnız giriş noktasıdır (onBack ile geri dönüp Security
 * ekranındaki mevcut iki-adımlı silme akışına yönlendirilir — spesifikasyon
 * "delete account görünür hem Security hem Privacy'de" der, mantık tek yerde).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { getProfilClient } from '../../client';
import { Prohibit } from '../../../../components/icons';
import {
  FinScreen,
  FinHeader,
  FinSectionLabel,
  FinSecondaryButton,
  body,
  bodyMedium,
  bodySemibold,
} from '../finUi';

const flatGroup = (t: ReturnType<typeof useTheme>) => ({
  borderTopWidth: 1,
  borderBottomWidth: 1,
  borderColor: t.color.line,
  marginHorizontal: -16,
  paddingHorizontal: 2,
});

function PrivacyOption({
  selected,
  onPress,
  title,
  subtitle,
  first,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
  first?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.color.line,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: selected ? bodySemibold : bodyMedium, fontSize: 15, color: t.color.ink }}>{title}</Text>
        <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}>
          {subtitle}
        </Text>
      </View>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: selected ? t.color.ink : t.color.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.color.ink }} /> : null}
      </View>
    </Pressable>
  );
}

export default function SettingsPrivacyScreen({
  onBack,
  onOpenSecurity,
}: {
  onBack: () => void;
  /** "Hesabı sil" — silme akışı Güvenlik ekranında (tek yerde). */
  onOpenSecurity?: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockedCount, setBlockedCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    supabase
      .from('profiles')
      .select('is_private')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setIsPrivate(!!data.is_private);
        setLoading(false);
      });
    // Gerçek engel sayısı — user_blocks RLS: blocker_id = auth.uid().
    supabase
      .from('user_blocks')
      .select('blocked_id', { count: 'exact', head: true })
      .eq('blocker_id', user.id)
      .then(({ count, error }) => setBlockedCount(!error && typeof count === 'number' ? count : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSelect = async (next: boolean) => {
    if (next === isPrivate || saving) return;
    setSaving(true);
    try {
      await getProfilClient().setPrivacy({ isPrivate: next });
      setIsPrivate(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FinScreen scroll contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.privacy_settings_title')} onBack={onBack} align="left" />
      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={t.color.accent} size="large" />
          </View>
        ) : (
          <>
            <FinSectionLabel>{tr('profil.privacy_who_can_see')}</FinSectionLabel>
            <View style={flatGroup(t)}>
              <PrivacyOption
                first
                selected={!isPrivate}
                onPress={() => handleSelect(false)}
                title={tr('profil.public_account')}
                subtitle={tr('profil.privacy_public_hint')}
              />
              <PrivacyOption
                selected={isPrivate}
                onPress={() => handleSelect(true)}
                title={tr('profil.private_account_badge')}
                subtitle={tr('profil.privacy_private_hint')}
              />
            </View>
            {saving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
                <ActivityIndicator size="small" color={t.color.accent} />
                <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.secondary }}>
                  {tr('profil.saved')}
                </Text>
              </View>
            ) : null}

            <FinSectionLabel>{tr('profil.privacy_blocked_section')}</FinSectionLabel>
            <View style={[flatGroup(t), { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14 }]}>
              <Prohibit size={20} color={t.color.ink} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}>
                  {tr('profil.privacy_blocked_accounts_row')}
                </Text>
                <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
                  {tr('profil.privacy_blocked_sub')}
                </Text>
              </View>
              <Text style={{ fontFamily: bodyMedium, fontSize: 15, color: t.color.secondary }}>
                {blockedCount === null ? '—' : String(blockedCount)}
              </Text>
            </View>

            <FinSecondaryButton label={tr('profil.delete_account')} onPress={onOpenSecurity ?? onBack} height={52} />

            <Text
              style={{
                fontFamily: bodyMedium,
                fontSize: 12,
                color: t.color.secondary,
                textAlign: 'center',
                paddingHorizontal: 8,
              }}
            >
              {tr('profil.privacy_delete_footnote')}
            </Text>

          </>
        )}
      </View>
    </FinScreen>
  );
}
