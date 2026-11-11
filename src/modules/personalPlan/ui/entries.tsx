// G34-S1 md.5 · Tur 26o — 4 giriş noktası (04 panosu): Profil (Hedefim + Kişisel planım TEK kart),
// Ana sayfa tek seferlik kart (halkanın altında), Koç ilk açılış öneri çipi, satın alma teşekkür
// ekranı ikincil satırı. Hepsi `kisisel_plan` bayrağı arkasında (varsayılan KAPALI); Onboarding'de YOK.
// Planı olan kullanıcıda giriş "Kişisel planım"a gider; akışı yarıda bırakan "Kaldığın yerden"de açılır.
import React, { useContext, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContext } from '@react-navigation/native';
import { AppText } from '../../../core/design/components/AppText';
import { haptic } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { useFeature } from '../../../core/flags';
import { useAuth } from '../../../core/AuthContext';
import { CaretRight, Sparkle, X } from '../../../components/icons';
import { fmtDate } from '../format';
import { effectiveTargets } from '../types';
import { useMyPlanStore } from '../useMyPlan';
import type { PpOrigin } from '../store';
import { GLASS, usePp } from './parts';

export const HOME_CARD_KEY = '@kcal_pp_home_card_dismissed';

type Nav = { navigate: (n: string, p?: object) => void };

const NO_NAV = React.createContext<unknown>(undefined);

/** Gezinme bağlamı yoksa (izole bileşen testleri, sahte gezinme modülü) düşmeden boş döner. */
function useNavSafe(): Nav | undefined {
  return useContext((NavigationContext as React.Context<unknown> | undefined) ?? NO_NAV) as Nav | undefined;
}

/** Oturum kimliği; AuthProvider dışında (izole testler) null — giriş noktaları gizli kalır. */
function useUidSafe(): string | null {
  try {
    return useAuth().user?.id ?? null;
  } catch {
    return null;
  }
}

/** Bayrak + oturum + kayıtlı plan. Plan yüklü değilse arka planda yükler. */
export function usePersonalPlanEntry() {
  const enabled = useFeature('kisisel_plan');
  const uid = useUidSafe();
  const saved = useMyPlanStore((s) => s.saved);
  const loaded = useMyPlanStore((s) => s.loaded);
  const load = useMyPlanStore((s) => s.load);
  useEffect(() => {
    if (enabled && uid) void load(uid);
  }, [enabled, uid, load]);
  return { enabled: enabled && !!uid, hasPlan: !!saved, loaded, saved };
}

export function useOpenPersonalPlan() {
  const nav = useNavSafe();
  const { hasPlan } = usePersonalPlanEntry();
  return (origin: PpOrigin) => {
    haptic('light');
    if (hasPlan) nav?.navigate('PersonalPlanMine');
    else nav?.navigate('PersonalPlan', { origin });
  };
}

/** Profil › Kcalculate AI: Hedefim kartının içindeki satır (TEK kart; ayrı bölüm yok). */
export function ProfilePlanRow({ testID = 'pp-entry-profile' }: { testID?: string }) {
  const i18n = useT();
  const P = usePp();
  const { enabled, hasPlan, saved } = usePersonalPlanEntry();
  const open = useOpenPersonalPlan();
  if (!enabled) return null;
  const lang = i18n.lang === 'en' ? 'en' : 'tr';
  const t = saved ? effectiveTargets(saved) : null;
  const title = hasPlan ? i18n.t('pp.entry_my_plan') : i18n.t('pp.entry_profile');
  const sub = hasPlan && t ? (saved?.targetDate ? i18n.t('pp.entry_my_plan_sub', { kcal: t.calories, date: fmtDate(saved.targetDate, lang) }) : `${t.calories} ${i18n.t('pp.kcal')}`) : i18n.t('pp.entry_profile_sub');
  return (
    <Pressable onPress={() => open('profile')} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} style={styles.row} testID={testID}>
      <Image source={GLASS.trophy} style={{ width: 28, height: 26 }} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
          {title}
        </AppText>
        <AppText textRole="helper" style={{ color: P.sec }}>
          {sub}
        </AppText>
      </View>
      <View style={[styles.go, { backgroundColor: P.accent }]}>
        <CaretRight size={14} color={P.onAccent} weight="bold" />
      </View>
    </Pressable>
  );
}

/** Ana sayfa: halkanın altında TEK SEFERLİK kart (× ile kapanır; plan kurulunca görünmez). */
export function HomePlanCard() {
  const i18n = useT();
  const P = usePp();
  const { enabled, hasPlan, loaded } = usePersonalPlanEntry();
  const open = useOpenPersonalPlan();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    void AsyncStorage.getItem(HOME_CARD_KEY)
      .then((v) => setDismissed(v === '1'))
      .catch(() => setDismissed(false));
  }, []);
  if (!enabled || !loaded || hasPlan || dismissed !== false) return null;
  const close = () => {
    haptic('light');
    setDismissed(true);
    void AsyncStorage.setItem(HOME_CARD_KEY, '1').catch(() => undefined);
  };
  return (
    <View style={[styles.home, { backgroundColor: P.surface, borderColor: P.surfaceEdge }]} testID="pp-entry-home">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Image source={GLASS.trophy} style={{ width: 34, height: 30 }} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
            {i18n.t('pp.entry_home_title')}
          </AppText>
          <AppText textRole="helper" style={{ color: P.sec, marginTop: 2 }}>
            {i18n.t('pp.entry_home_sub')}
          </AppText>
        </View>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={i18n.t('pp.entry_home_close')} hitSlop={10} style={styles.x} testID="pp-entry-home-close">
          <X size={14} color={P.sec} />
        </Pressable>
      </View>
      <Pressable
        onPress={() => {
          close();
          open('home');
        }}
        accessibilityRole="button"
        style={[styles.cta, { backgroundColor: P.ink }]}
        testID="pp-entry-home-cta"
      >
        <AppText textRole="helper" style={{ color: P.onInk, fontWeight: '700' }}>
          {i18n.t('pp.entry_home_cta')}
        </AppText>
      </Pressable>
    </View>
  );
}

/** Koç ilk açılış: hazır soru çiplerinin başında öneri çipi (plan yoksa). */
export function CoachPlanChip({ onBeforeOpen }: { onBeforeOpen?: () => void }) {
  const i18n = useT();
  const P = usePp();
  const { enabled, hasPlan, loaded } = usePersonalPlanEntry();
  const nav = useNavSafe();
  if (!enabled || !loaded || hasPlan) return null;
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onBeforeOpen?.();
        nav?.navigate('PersonalPlan', { origin: 'coach' });
      }}
      accessibilityRole="button"
      accessibilityLabel={i18n.t('pp.entry_coach')}
      style={[styles.chip, { borderColor: P.accent, backgroundColor: P.surface }]}
      testID="pp-entry-coach"
    >
      <Image source={GLASS.trophy} style={{ width: 20, height: 18 }} resizeMode="contain" />
      <AppText textRole="helper" style={{ color: P.ink, fontWeight: '600', flexShrink: 1 }}>
        {i18n.t('pp.entry_coach')}
      </AppText>
      <View style={[styles.go, { backgroundColor: P.accent, width: 22, height: 22 }]}>
        <CaretRight size={12} color={P.onAccent} weight="bold" />
      </View>
    </Pressable>
  );
}

/** Satın alma teşekkür ekranı: ikincil satır "Kişisel planımı oluştur". */
export function PurchasePlanRow() {
  const i18n = useT();
  const P = usePp();
  const { enabled, hasPlan, loaded } = usePersonalPlanEntry();
  const nav = useNavSafe();
  if (!enabled || !loaded || hasPlan) return null;
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        nav?.navigate('PersonalPlan', { origin: 'purchase' });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${i18n.t('pp.entry_purchase')}. ${i18n.t('pp.entry_purchase_sub')}`}
      style={[styles.purchase, { backgroundColor: P.field }]}
      testID="pp-entry-purchase"
    >
      <Sparkle size={16} color={P.ink} />
      <View style={{ flex: 1 }}>
        <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
          {i18n.t('pp.entry_purchase')}
        </AppText>
        <AppText textRole="helper" style={{ color: P.sec }}>
          {i18n.t('pp.entry_purchase_sub')}
        </AppText>
      </View>
      <CaretRight size={16} color={P.sec} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  go: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  home: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12, marginHorizontal: 16, marginTop: 12 },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -12, marginRight: -12 },
  cta: { alignSelf: 'flex-start', minHeight: 44, borderRadius: 22, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 12, minHeight: 44, alignSelf: 'flex-start' },
  purchase: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, minHeight: 56, marginTop: 12 },
});
