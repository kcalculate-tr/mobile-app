import React, { useCallback, useEffect, useState } from 'react';
import {
  Animated, Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { BellRinging } from 'phosphor-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';
import { requestPushPermissionOnly, registerForPushNotifications } from '../../lib/notifications';

const STATE_KEY = '@kcal_push_prompt_state';
/** En fazla kaç kez gösterilsin. */
const MAX_SHOWS = 3;
/** İki gösterim arası en az kaç gün geçsin. */
const COOLDOWN_DAYS = 7;
/** Uygulama açıldıktan kaç ms sonra çıksın (splash / zorunlu güncelleme ile çakışmasın). */
const DELAY_MS = 2500;

type PromptState = { shows: number; lastShownAt: number };

const readState = async (): Promise<PromptState> => {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (!raw) return { shows: 0, lastShownAt: 0 };
    const parsed = JSON.parse(raw) as Partial<PromptState>;
    return {
      shows: Number(parsed.shows) || 0,
      lastShownAt: Number(parsed.lastShownAt) || 0,
    };
  } catch {
    return { shows: 0, lastShownAt: 0 };
  }
};

const writeState = async (state: PromptState): Promise<void> => {
  try { await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* yut */ }
};

/**
 * Bildirim izni yoksa uygulamaya girişte çıkan küçük hatırlatma.
 *
 * Sıklık kuralı bilinçli olarak sıkı: en fazla 3 kez, aralarında en az 7 gün.
 * İzin isteme penceresi iOS'ta kullanıcı başına BİR kez açılır; reddedildiyse
 * ikinci kez sistem penceresi gösterilemez, o yüzden buton Ayarlar'a yönlendirir.
 */
export default function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  /** OS izin penceresi bir daha açılabilir mi? false ise Ayarlar'a gitmeli. */
  const [canAsk, setCanAsk] = useState(true);
  const [busy, setBusy] = useState(false);
  const fade = React.useRef(new Animated.Value(0)).current;
  const rise = React.useRef(new Animated.Value(24)).current;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (!Device.isDevice) return;                 // simülatörde gösterme
        const perm = await Notifications.getPermissionsAsync();
        if (perm.status === 'granted') return;         // zaten açık

        const state = await readState();
        if (state.shows >= MAX_SHOWS) return;
        if (Date.now() - state.lastShownAt < COOLDOWN_DAYS * 86_400_000) return;

        if (cancelled) return;
        setCanAsk(perm.canAskAgain !== false);
        setVisible(true);
        await writeState({ shows: state.shows + 1, lastShownAt: Date.now() });
      } catch { /* izin okunamadıysa sessizce vazgeç */ }
    }, DELAY_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4 }),
    ]).start();
  }, [visible, fade, rise]);

  const kapat = useCallback(() => setVisible(false), []);

  const izinIste = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!canAsk) {
        // Sistem penceresi bir daha açılamaz — kullanıcıyı Ayarlar'a al.
        if (Platform.OS === 'ios') await Linking.openURL('app-settings:');
        else await Linking.openSettings();
      } else {
        const status = await requestPushPermissionOnly();
        // İzin verildiyse token'ı hemen kaydet; yoksa push gönderemeyiz.
        if (status === 'granted') await registerForPushNotifications();
      }
    } catch { /* yut */ } finally {
      setBusy(false);
      setVisible(false);
    }
  }, [busy, canAsk]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={kapat}>
      <View style={s.backdrop}>
        <Animated.View style={[s.card, { opacity: fade, transform: [{ translateY: rise }] }]}>
          <View style={s.iconWrap}>
            <BellRinging size={24} color="#000000" weight="fill" />
          </View>

          <Text style={s.title}>Sana özel indirimleri kaçırma</Text>
          <Text style={s.body}>
            Kampanyalar, ücretsiz öğün kuponların ve siparişinin durumu anında bildirim olarak gelsin.
          </Text>

          <TouchableOpacity style={s.primary} onPress={izinIste} activeOpacity={0.85} disabled={busy}>
            <Text style={s.primaryText}>{canAsk ? 'Bildirimleri Aç' : 'Ayarları Aç'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.secondary} onPress={kapat} activeOpacity={0.7}>
            <Text style={s.secondaryText}>Şimdi değil</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl,
  },
  card: {
    width: '100%', maxWidth: 340, backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center',
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.brand.green,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.size.md, color: COLORS.text.primary, textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold', },
  body: {
    marginTop: 6, fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.secondary,
    textAlign: 'center', lineHeight: 18, fontFamily: 'PlusJakartaSans_500Medium',
  },
  primary: {
    marginTop: SPACING.lg, width: '100%', height: 46, borderRadius: 100,
    backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center',
  },
  primaryText: {
    fontSize: TYPOGRAPHY.size.sm, color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold', },
  secondary: { marginTop: 4, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  secondaryText: {
    fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
