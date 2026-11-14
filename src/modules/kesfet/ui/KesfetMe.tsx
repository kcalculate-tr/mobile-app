// G53-S1 md.1 — Keşfet üst çubuğu "kendi profilime hızlı erişim". Sağda kullanıcının kendi profil fotoğrafı
// (yoksa baş harf dairesi), 36 pt yuvarlak, 44 pt dokunma alanı. Dokununca kendi herkese açık profili
// (paylaştığı öğün/tabak ızgarası — `PublicProfile`; kullanıcı adı yoksa kendi profil önizlemesi). Oturum yoksa
// giriş katmanı (AuthSheet = `Login`, G47). VoiceOver: "Profilim, paylaşımlarım".
import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { Avatar } from './Avatar';
import { useMyProfileStore } from '../../profil/myProfileStore';
import { meShortcutTarget } from '../../profil/avatarChange';

type NavLike = { navigate: (name: string, params?: object) => void };

export function useKesfetMe(navigation: NavLike): { url: string | null; name: string; onPress: () => void } {
  const { user } = useAuth();
  const fallbackName = user
    ? String(user.user_metadata?.full_name || '').trim() || String(user.email || '').split('@')[0] || null
    : null;
  useEffect(() => {
    if (user?.id) void useMyProfileStore.getState().load(user.id, fallbackName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  const mine = useMyProfileStore((s) => Boolean(user?.id) && s.userId === user?.id);
  const url = useMyProfileStore((s) => s.avatarUrl);
  const handle = useMyProfileStore((s) => s.handle);
  const storeName = useMyProfileStore((s) => s.name);
  const myUrl = mine ? url : null;
  const myHandle = mine ? handle : null;
  const myName = (mine ? storeName : null) ?? fallbackName;
  const onPress = useCallback(() => {
    const target = meShortcutTarget({ signedIn: !!user, handle: myHandle, name: myName, avatarUrl: myUrl });
    if (target.name === 'Login') navigation.navigate('Login');
    else navigation.navigate(target.name, target.params);
  }, [user, myHandle, myName, myUrl, navigation]);
  return { url: myUrl, name: myName ?? '', onPress };
}

export function KesfetMeButton({ url, name, onPress }: { url: string | null; name: string; onPress: () => void }) {
  const { t: tr } = useT();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={tr('kesfet_me.a11y')} style={styles.btn} testID="kesfet-header-me">
      <Avatar name={name} url={url} size={36} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
