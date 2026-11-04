// FinPrMacro — Macro ve Abonelik (final tasarım reskin, G12-S4 madde 4).
//
// VERİ KATMANI: bugünkü MacroScreen.tsx (route 'Subscriptions') ile BİREBİR
// aynı kaynaklar — fetchMacroProfile / fetchMacroSettings / macroProgress /
// fetchMealRewardCoupons / fetchMacroTransactions (src/lib/macros.ts). Bu
// dosya yalnız JSX/stil değiştirir; MacroScreen.tsx'e dokunulmaz, onun
// bileşenleri (CouponRail, SubscriptionBuilder, MacroPointModal) yeniden
// kullanılmaz — görünüm tamamen finUi birincileriyle yeniden çizilir.
//
// Öğün Aboneliği sekmesi: bugün gerçek bir abonelik backend'i YOK (bkz.
// MacroScreen.tsx'teki "Yakında" kartı — admin_allowlist dışındaki herkese
// bu gösterilir). "Teslimat günleri / Duraklat / Yönet" satırları bu yüzden
// uydurulmadı; sade boş-durum (sub_none_title/body) gösterilir.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { CalendarCheck, Gift, X as XIcon } from '../../../../components/icons';
import type { RootStackParamList } from '../../../../navigation/types';
import {
  DEFAULT_MACRO_SETTINGS,
  MacroProfile,
  MacroSettings,
  MacroTransaction,
  MealRewardCoupon,
  fetchMacroProfile,
  fetchMacroSettings,
  fetchMacroTransactions,
  fetchMealRewardCoupons,
  macroProgress,
} from '../../../../lib/macros';
import {
  FinCard,
  FinDisplay,
  FinHeader,
  FinPrimaryButton,
  FinScreen,
  FinSecondaryButton,
  FinSectionLabel,
  FinSegmented,
  body,
  bodyMedium,
  bodySemibold,
  finExtras,
  heading,
} from '../finUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FinPrMacroScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const x = finExtras(t);
  const { t: tr } = useT();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MacroProfile | null>(null);
  const [settings, setSettings] = useState<MacroSettings>(DEFAULT_MACRO_SETTINGS);
  const [coupons, setCoupons] = useState<MealRewardCoupon[]>([]);
  const [transactions, setTransactions] = useState<MacroTransaction[]>([]);
  const [whatOpen, setWhatOpen] = useState(false);

  const load = useCallback(async (silent?: boolean) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    const [p, st, cp, tx] = await Promise.all([
      fetchMacroProfile(user.id),
      fetchMacroSettings(),
      fetchMealRewardCoupons(),
      fetchMacroTransactions(user.id),
    ]);
    setProfile(p);
    setSettings(st);
    setCoupons(cp);
    setTransactions(tx);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  const progress = useMemo(() => macroProgress(profile, settings), [profile, settings]);

  const goOrder = useCallback(() => {
    navigation.navigate('Tabs', { screen: 'Home' });
  }, [navigation]);

  return (
    <FinScreen scroll contentStyle={{ paddingHorizontal: 16, gap: 20 }}>
      <FinHeader title={tr('profil.macro_and_sub')} onBack={onBack} />

      <FinSegmented
        options={[tr('profil.tab_macro'), tr('profil.tab_subscription')]}
        index={tabIndex}
        onChange={setTabIndex}
      />

      {loading ? (
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <ActivityIndicator color={t.color.ink} />
        </View>
      ) : tabIndex === 0 ? (
        <MacroTab
          progress={progress}
          coupons={coupons}
          hasTransactions={transactions.length > 0}
          onOpenWhat={() => setWhatOpen(true)}
          onOrder={goOrder}
        />
      ) : (
        <SubscriptionTab onSubscribe={goOrder} />
      )}

      <Modal visible={whatOpen} transparent animationType="fade" onRequestClose={() => setWhatOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setWhatOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: t.color.surface }]}>
            <View style={styles.sheetHeader}>
              <Text style={{ flex: 1, fontFamily: heading, fontSize: 18, color: t.color.ink }}>
                {tr('profil.macro_what_title')}
              </Text>
              <Pressable
                onPress={() => setWhatOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={tr('common.close')}
                hitSlop={8}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: x.line2, alignItems: 'center', justifyContent: 'center' }}
              >
                <XIcon size={14} color={t.color.ink} weight="bold" />
              </Pressable>
            </View>

            <View style={{ gap: 14 }}>
              {[
                tr('profil.macro_what_1'),
                tr('profil.macro_what_2'),
                tr('profil.macro_what_3'),
                tr('profil.macro_what_4'),
              ].map((line, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: t.color.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 1,
                    }}
                  >
                    <Text style={{ fontFamily: bodySemibold, fontSize: 12, color: t.color.onAccent }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontFamily: body, fontSize: 14, lineHeight: 20, color: t.color.ink }}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>

            <FinPrimaryButton label={tr('profil.got_it')} onPress={() => setWhatOpen(false)} style={{ marginTop: 20 }} />
          </View>
        </View>
      </Modal>
    </FinScreen>
  );
}

function MacroTab({
  progress,
  coupons,
  hasTransactions,
  onOpenWhat,
  onOrder,
}: {
  progress: ReturnType<typeof macroProgress>;
  coupons: MealRewardCoupon[];
  hasTransactions: boolean;
  onOpenWhat: () => void;
  onOrder: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();

  return (
    <View style={{ gap: 20 }}>
      <FinCard style={{ alignItems: 'center', paddingVertical: 24, gap: 6 }}>
        <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}>
          {tr('profil.macro_balance')}
        </Text>
        <FinDisplay size={40}>{String(progress.balance)}</FinDisplay>
        <Text style={{ fontFamily: bodyMedium, fontSize: 14, color: t.color.ink }}>
          {tr('profil.to_next_free', { n: progress.macrosToNextMeal })}
        </Text>
        <Text style={{ fontFamily: body, fontSize: 12, color: t.color.secondary, marginTop: 4, textAlign: 'center' }}>
          {tr('profil.macro_rule')}
        </Text>

        <Pressable
          onPress={onOpenWhat}
          accessibilityRole="button"
          style={{ marginTop: 10, paddingVertical: 6, paddingHorizontal: 4 }}
        >
          <Text style={{ fontFamily: bodySemibold, fontSize: 13, color: t.color.ink, textDecorationLine: 'underline' }}>
            {tr('profil.what_is_macro')}
          </Text>
        </Pressable>
      </FinCard>

      <View style={{ gap: 10 }}>
        <FinSectionLabel>{tr('profil.rewards_coupons')}</FinSectionLabel>
        {coupons.length === 0 ? (
          <FinCard style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
              {tr('profil.macro_empty_body')}
            </Text>
          </FinCard>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {coupons.map((c) => (
              <FinCard key={c.id} style={{ width: 180, gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: t.color.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Gift size={18} color={t.color.onAccent} weight="fill" />
                </View>
                <Text style={{ fontFamily: bodySemibold, fontSize: 14, color: t.color.ink }} numberOfLines={2}>
                  {c.description ?? c.code}
                </Text>
                <FinSecondaryButton label={tr('profil.use_reward')} height={40} />
              </FinCard>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={{ gap: 10 }}>
        <FinSectionLabel>{tr('profil.macro_history')}</FinSectionLabel>
        {hasTransactions ? null : (
          <FinCard style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: t.color.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Gift size={22} color={t.color.secondary} weight="fill" />
            </View>
            <Text style={{ fontFamily: heading, fontSize: 17, color: t.color.ink }}>
              {tr('profil.macro_empty_title')}
            </Text>
            <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary, textAlign: 'center' }}>
              {tr('profil.macro_empty_body')}
            </Text>
            <FinPrimaryButton label={tr('profil.order_now')} onPress={onOrder} style={{ marginTop: 6, alignSelf: 'stretch' }} />
          </FinCard>
        )}
      </View>
    </View>
  );
}

function SubscriptionTab({ onSubscribe }: { onSubscribe: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();

  // Bugün gerçek bir abonelik backend'i yok — bkz. dosya başı not. "Teslimat
  // günleri / Duraklat / Yönet" satırları bu yüzden gösterilmez (ölü satır
  // olmasın); sade boş-durum + "Abone ol" CTA'sı gerçek sipariş akışına gider.
  return (
    <FinCard style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: t.color.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CalendarCheck size={24} color={t.color.onAccent} weight="fill" />
      </View>
      <Text style={{ fontFamily: heading, fontSize: 18, color: t.color.ink }}>
        {tr('profil.sub_none_title')}
      </Text>
      <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center' }}>
        {tr('profil.sub_none_body')}
      </Text>
      <FinPrimaryButton label={tr('profil.subscribe_cta')} onPress={onSubscribe} style={{ marginTop: 10, alignSelf: 'stretch' }} />
    </FinCard>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
});
