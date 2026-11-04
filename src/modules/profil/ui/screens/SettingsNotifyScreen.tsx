/**
 * G12-S4 — Bildirim Tercihleri (Final FinPrNotify panosu).
 *
 * Backend mantığı `src/screens/profile/NotificationPreferencesScreen.tsx`'ten
 * birebir yeniden kullanılır: `notification_preferences` tablosunun 4 kolonu
 * (transactional_enabled, marketing_enabled, reminder_enabled,
 * behavioral_enabled), satır yoksa insert, toggle'da update({ [key]: next }),
 * ve `expo-notifications` ile OS izin durumu bannerı. Panodaki "social" satırı
 * mevcut `behavioral_enabled` kolonuna eşlenir.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Switch, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { supabase } from '../../../../core/supabase';
import {
  FinScreen,
  FinHeader,
  FinCard,
  FinRowGroup,
  FinSecondaryButton,
  bodyMedium,
  bodySemibold,
} from '../finUi';

type PrefKey =
  | 'transactional_enabled'
  | 'marketing_enabled'
  | 'reminder_enabled'
  | 'behavioral_enabled';

type Prefs = Record<PrefKey, boolean>;

const DEFAULT_PREFS: Prefs = {
  transactional_enabled: true,
  marketing_enabled: true,
  reminder_enabled: true,
  behavioral_enabled: true,
};

export default function SettingsNotifyScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const { user } = useAuth();

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PrefKey | null>(null);
  const [systemStatus, setSystemStatus] =
    useState<'granted' | 'denied' | 'undetermined' | null>(null);

  const loadPrefs = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notification_preferences')
        .select(
          'transactional_enabled, marketing_enabled, reminder_enabled, behavioral_enabled',
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setPrefs({
          transactional_enabled: data.transactional_enabled ?? true,
          marketing_enabled: data.marketing_enabled ?? true,
          reminder_enabled: data.reminder_enabled ?? true,
          behavioral_enabled: data.behavioral_enabled ?? true,
        });
      } else {
        // Trigger sayesinde satır olmalı; yoksa oluştur (mevcut ekranla aynı).
        await supabase
          .from('notification_preferences')
          .insert({ user_id: user.id })
          .select()
          .maybeSingle();
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  useEffect(() => {
    Notifications.getPermissionsAsync()
      .then((res) => setSystemStatus(res.status as 'granted' | 'denied' | 'undetermined'))
      .catch(() => setSystemStatus(null));
  }, []);

  const handleToggle = async (key: PrefKey, next: boolean) => {
    if (!user?.id) return;
    setPrefs((p) => ({ ...p, [key]: next }));
    setSaving(key);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [key]: next })
        .eq('user_id', user.id);
      if (error) {
        setPrefs((p) => ({ ...p, [key]: !next }));
        Alert.alert(tr('profil.notify_title'), error.message);
      }
    } finally {
      setSaving(null);
    }
  };

  const openSystemSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert(tr('profil.notify_title'));
    });
  };

  const rows: {
    key: PrefKey;
    label: string;
    hint: string;
    locked?: boolean;
  }[] = [
    {
      key: 'transactional_enabled',
      label: tr('profil.notify_transactional'),
      hint: tr('profil.notify_transactional_hint'),
      locked: true,
    },
    {
      key: 'reminder_enabled',
      label: tr('profil.notify_reminder'),
      hint: tr('profil.notify_reminder_hint'),
    },
    {
      key: 'marketing_enabled',
      label: tr('profil.notify_marketing'),
      hint: tr('profil.notify_marketing_hint'),
    },
    {
      key: 'behavioral_enabled',
      label: tr('profil.notify_social'),
      hint: tr('profil.notify_social_hint'),
    },
  ];

  const showSystemOff = systemStatus === 'denied';

  return (
    <FinScreen scroll contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.notify_title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        {showSystemOff ? (
          <FinCard style={{ gap: 12 }}>
            <Text style={{ fontFamily: bodyMedium, fontSize: 14, color: t.color.ink }}>
              {tr('profil.notify_system_off')}
            </Text>
            <FinSecondaryButton
              label={tr('profil.notify_open_settings')}
              onPress={openSystemSettings}
            />
          </FinCard>
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={t.color.accent} size="large" />
          </View>
        ) : (
          <FinRowGroup>
            {rows.map((row, idx) => {
              const value = prefs[row.key];
              return (
                <View
                  key={row.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    minHeight: 52,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderTopWidth: idx > 0 ? 1 : 0,
                    borderTopColor: t.color.line,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text
                        style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}
                      >
                        {row.label}
                      </Text>
                      {row.locked ? (
                        <View
                          style={{
                            backgroundColor: t.color.accent,
                            borderRadius: 999,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: bodySemibold,
                              fontSize: 10,
                              color: t.color.onAccent,
                            }}
                          >
                            {tr('profil.notify_recommended')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}
                    >
                      {row.hint}
                    </Text>
                  </View>
                  <Switch
                    value={row.locked ? true : value}
                    disabled={row.locked || saving === row.key}
                    onValueChange={(next) => handleToggle(row.key, next)}
                    trackColor={{ false: t.color.line, true: t.color.accent }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={t.color.line}
                  />
                </View>
              );
            })}
          </FinRowGroup>
        )}

        {!loading ? (
          <Text
            style={{
              fontFamily: bodyMedium,
              fontSize: 12,
              color: t.color.secondary,
              textAlign: 'center',
              paddingHorizontal: 8,
            }}
          >
            {tr('profil.notify_footer_hint')}
          </Text>
        ) : null}
      </View>
    </FinScreen>
  );
}
