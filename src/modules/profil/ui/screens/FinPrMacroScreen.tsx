// FinPrMacro — Macro ve Abonelik (final tasarım reskin, G12-S4 madde 4; G15-S4 ince ayar).
//
// VERİ KATMANI: bugünkü MacroScreen.tsx (route 'Subscriptions') ile BİREBİR
// aynı kaynaklar — fetchMacroProfile / fetchMacroSettings / macroProgress /
// fetchMealRewardCoupons / fetchMacroTransactions (src/lib/macros.ts). Bu
// dosya yalnız JSX/stil değiştirir; MacroScreen.tsx'e dokunulmaz.
//
// G15-S4: bakiye kartı sola dayalı + 5 nokta, "Macro nedir?" gerçek alttan
// sayfa (Sheet), ödül kartları (Ticket + "Kullan"), "Macro geçmişi" AYRI
// ekran (FinPrMacroHistoryEmpty; kayıt varsa liste), "Siparişlerim" satırı.
//
// Öğün Aboneliği sekmesi: bugün gerçek bir abonelik backend'i YOK (bkz.
// MacroScreen.tsx'teki "Yakında" kartı). "Teslimat günleri / Duraklat / Yönet"
// satırları uydurulmadı; sade boş-durum gösterilir.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Sheet, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { CalendarCheck, ClockCounterClockwise, Coins, Info, Receipt, Ticket } from '../../../../components/icons';
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
  FinRow,
  FinRowGroup,
  FinScreen,
  FinSegmented,
  body,
  bodyBold,
  bodyMedium,
  bodySemibold,
  heading,
} from '../finUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export type MacroVitrinData = { balance: number; coupons: MealRewardCoupon[] };

export default function FinPrMacroScreen({
  onBack,
  vitrinWhatOpen,
  vitrinHistory,
  vitrinData,
  initialTab = 0,
}: {
  onBack: () => void;
  /** 0 = Macro, 1 = Öğün Aboneliği ("Macro aboneliğim" girişi). */
  initialTab?: number;
  /** YALNIZ dev vitrini (`__DEV__`): "Macro nedir?" sheet'i açık başlar. Üretimde geçilmez. */
  vitrinWhatOpen?: boolean;
  /** YALNIZ dev vitrini: "Macro geçmişi" ekranı açık başlar. */
  vitrinHistory?: boolean;
  /** YALNIZ dev vitrini: Final örneğiyle aynı içerikte bakiye + kuponlar. */
  vitrinData?: MacroVitrinData;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  const [tabIndex, setTabIndex] = useState(initialTab);
  const [loading, setLoading] = useState(!vitrinData);
  const [profile, setProfile] = useState<MacroProfile | null>(null);
  const [settings, setSettings] = useState<MacroSettings>(DEFAULT_MACRO_SETTINGS);
  const [coupons, setCoupons] = useState<MealRewardCoupon[]>(vitrinData?.coupons ?? []);
  const [transactions, setTransactions] = useState<MacroTransaction[]>([]);
  const [whatOpen, setWhatOpen] = useState(!!vitrinWhatOpen);
  const [historyOpen, setHistoryOpen] = useState(!!vitrinHistory);

  const load = useCallback(
    async (silent?: boolean) => {
      if (vitrinData) return;
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
    },
    [user?.id, vitrinData],
  );

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  const progress = useMemo(() => {
    const base = macroProgress(profile, settings);
    if (!vitrinData) return base;
    const inCycle = vitrinData.balance % base.mealCost;
    return {
      ...base,
      balance: vitrinData.balance,
      macrosToNextMeal: base.mealCost - inCycle,
      mealProgress: inCycle / base.mealCost,
    };
  }, [profile, settings, vitrinData]);

  const goOrder = useCallback(() => {
    navigation.navigate('Tabs', { screen: 'Home' });
  }, [navigation]);

  if (historyOpen) {
    return (
      <MacroHistoryScreen
        onBack={() => setHistoryOpen(false)}
        transactions={transactions}
        onOrder={goOrder}
      />
    );
  }

  const whatLines = [
    tr('profil.macro_what_1'),
    tr('profil.macro_what_2'),
    tr('profil.macro_what_3'),
    tr('profil.macro_what_4'),
  ];

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
          onOpenWhat={() => setWhatOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenOrders={() => navigation.navigate('ProfileOrders')}
        />
      ) : (
        <SubscriptionTab onSubscribe={goOrder} />
      )}

      {/* FinPrMacroWhat — alttan sayfa: başlık sol + kapat, numaralı satırlar, siyah "Anladım". */}
      <Sheet
        visible={whatOpen}
        onClose={() => setWhatOpen(false)}
        title={tr('profil.macro_what_title')}
        footer={
          <FinPrimaryButton
            label={tr('profil.got_it')}
            onPress={() => setWhatOpen(false)}
            style={{ marginTop: 12 }}
          />
        }
      >
        <View>
          {whatLines.map((line, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.color.line,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: t.color.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: bodySemibold, fontSize: 13, color: t.color.ink }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontFamily: body, fontSize: 15, lineHeight: 21, color: t.color.ink }}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      </Sheet>
    </FinScreen>
  );
}

/** FinPrMacroHistoryEmpty — ayrı "Macro geçmişi" ekranı (kayıt varsa liste, yoksa boş durum). */
function MacroHistoryScreen({
  onBack,
  transactions,
  onOrder,
}: {
  onBack: () => void;
  transactions: MacroTransaction[];
  onOrder: () => void;
}) {
  const t = useTheme();
  const { t: tr, lang } = useT();
  return (
    <FinScreen scroll contentStyle={{ paddingHorizontal: 16, gap: 16 }}>
      <FinHeader title={tr('profil.macro_history')} onBack={onBack} />
      {transactions.length === 0 ? (
        <View style={{ paddingTop: 120 }}>
          <FinCard style={{ alignItems: 'center', padding: 16, gap: 10 }}>
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
              <Coins size={22} color={t.color.ink} />
            </View>
            <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink, textAlign: 'center' }}>
              {tr('profil.macro_empty_title')}
            </Text>
            <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center' }}>
              {tr('profil.macro_empty_body')}
            </Text>
            <FinPrimaryButton
              label={tr('profil.order_now')}
              onPress={onOrder}
              style={{ marginTop: 6, alignSelf: 'stretch' }}
            />
          </FinCard>
        </View>
      ) : (
        <FinRowGroup>
          {transactions.map((tx, i) => (
            <View
              key={tx.id}
              style={{
                minHeight: 52,
                paddingHorizontal: 14,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.color.line,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: bodyMedium, fontSize: 15, color: t.color.ink }} numberOfLines={1}>
                  {tx.note || tx.type}
                </Text>
                <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
                  {new Date(tx.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}>
                {tx.amount > 0 ? '+' : ''}
                {tx.amount} Macro
              </Text>
            </View>
          ))}
        </FinRowGroup>
      )}
    </FinScreen>
  );
}

function MacroTab({
  progress,
  coupons,
  onOpenWhat,
  onOpenHistory,
  onOpenOrders,
}: {
  progress: ReturnType<typeof macroProgress>;
  coupons: MealRewardCoupon[];
  onOpenWhat: () => void;
  onOpenHistory: () => void;
  onOpenOrders: () => void;
}) {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const filled = Math.round(progress.mealProgress * progress.mealCost);
  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long' })
      : null;

  return (
    <View style={{ gap: 20 }}>
      {/* Bakiye kartı: sola dayalı, sağda öğün başına nokta (dolu = koyu yeşil), "Macro nedir?" bağlantısı. */}
      <FinCard style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text style={{ fontFamily: bodySemibold, fontSize: 13, color: t.color.secondary }}>
              {tr('profil.macro_balance')}
            </Text>
            <FinDisplay size={36}>{String(progress.balance)}</FinDisplay>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, paddingTop: 22 }}>
            {Array.from({ length: progress.mealCost }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: i < filled ? t.color.accentLine : t.color.line,
                }}
              />
            ))}
          </View>
        </View>
        <Text style={{ fontFamily: bodyMedium, fontSize: 15, color: t.color.ink }}>
          {tr('profil.to_next_free', { n: progress.macrosToNextMeal })}
        </Text>
        <Text style={{ fontFamily: body, fontSize: 13, lineHeight: 18, color: t.color.secondary }}>
          {tr('profil.macro_rule')}
        </Text>
        <Pressable
          onPress={onOpenWhat}
          accessibilityRole="button"
          style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }}
        >
          <Info size={18} color={t.color.ink} />
          <Text style={{ fontFamily: bodySemibold, fontSize: 14, color: t.color.ink }}>
            {tr('profil.what_is_macro')}
          </Text>
        </Pressable>
      </FinCard>

      <View style={{ gap: 10 }}>
        <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }}>{tr('profil.rewards_coupons')}</Text>
        {coupons.length === 0 ? (
          <FinCard style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
              {tr('profil.macro_empty_body')}
            </Text>
          </FinCard>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
            style={{ marginHorizontal: -16 }}
          >
            {coupons.map((c) => {
              const until = fmtDate(c.end_date);
              return (
                <FinCard key={c.id} style={{ width: 228, padding: 16, gap: 6, alignItems: 'flex-start' }}>
                  <Ticket size={20} color={t.color.ink} />
                  <Text
                    style={{ fontFamily: bodyBold, fontSize: 15, color: t.color.ink, marginTop: 4 }}
                    numberOfLines={2}
                  >
                    {c.description ?? c.code}
                  </Text>
                  <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }} numberOfLines={1}>
                    {tr('profil.macro_cost_until', { n: progress.mealCost, date: until ?? '—' })}
                  </Text>
                  <FinPrimaryButton
                    label={tr('profil.use_reward')}
                    style={{ height: 32, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 6 }}
                  />
                </FinCard>
              );
            })}
          </ScrollView>
        )}
      </View>

      <FinRowGroup>
        <FinRow
          first
          icon={<ClockCounterClockwise size={18} color={t.color.ink} />}
          label={tr('profil.macro_history')}
          onPress={onOpenHistory}
        />
        <FinRow icon={<Receipt size={18} color={t.color.ink} />} label={tr('profil.orders')} onPress={onOpenOrders} />
      </FinRowGroup>
    </View>
  );
}

function SubscriptionTab({ onSubscribe }: { onSubscribe: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();

  // Bugün gerçek bir abonelik backend'i yok — bkz. dosya başı not. Sade
  // boş-durum + "Abone ol" CTA'sı gerçek sipariş akışına gider.
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
      <Text style={{ fontFamily: heading, fontSize: 18, color: t.color.ink }}>{tr('profil.sub_none_title')}</Text>
      <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center' }}>
        {tr('profil.sub_none_body')}
      </Text>
      <FinPrimaryButton
        label={tr('profil.subscribe_cta')}
        onPress={onSubscribe}
        style={{ marginTop: 10, alignSelf: 'stretch' }}
      />
    </FinCard>
  );
}
