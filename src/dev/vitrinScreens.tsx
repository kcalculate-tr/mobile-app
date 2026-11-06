// G14-S1 — Vitrin sahneleri (component/motion hedefleri). YALNIZ __DEV__.
//
// Rota hedefleri gerçek AppNavigator'la açılır (VitrinGate). Burada yalnız
// rota olmayan yüzeyler var: sheet'ler, overlay'ler, profil alt ekranları,
// tekil kartlar. Hepsi ÜRETİM bileşenlerinin kendisidir; yalnız mock props/veri
// verilir (görsel karşılaştırma için).
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../core/design';
import { useT } from '../core/i18n';
import { getKesfetClient } from '../modules/kesfet';
import type { FeedPost } from '../modules/kesfet/types';
import { postCardModel } from '../modules/kesfet/ui/format';
import { PostCard } from '../modules/kesfet/ui/PostCard';
import { RulesSheet } from '../modules/kesfet/ui/RulesSheet';
import { CommentsSheet } from '../modules/kesfet/ui/CommentsSheet';
import { NotificationsSheet } from '../modules/kesfet/ui/NotificationsSheet';
import { AddToDaySheet } from '../modules/kesfet/ui/AddToDaySheet';
import { AddToast } from '../modules/kesfet/ui/AddToast';
import { PostMenu } from '../modules/kesfet/ui/PostMenu';
import { getGunClient, type DayRing } from '../modules/gun';
import { GunViewer, GunEmpty } from '../modules/gun/ui';
import { PrivacySheet } from '../modules/profil/ui';
import SettingsPersonalScreen from '../modules/profil/ui/screens/SettingsPersonalScreen';
import SettingsNotifyScreen from '../modules/profil/ui/screens/SettingsNotifyScreen';
import SettingsSecurityScreen from '../modules/profil/ui/screens/SettingsSecurityScreen';
import SettingsPrivacyScreen from '../modules/profil/ui/screens/SettingsPrivacyScreen';
import SettingsAgreementsScreen from '../modules/profil/ui/screens/SettingsAgreementsScreen';
import SettingsSupportScreen from '../modules/profil/ui/screens/SettingsSupportScreen';
import SettingsFeedbackScreen from '../modules/profil/ui/screens/SettingsFeedbackScreen';
import FinPrCardsScreen from '../modules/profil/ui/screens/FinPrCardsScreen';
import FinPrReviewsScreen from '../modules/profil/ui/screens/FinPrReviewsScreen';
import FinPrCouponsScreen from '../modules/profil/ui/screens/FinPrCouponsScreen';
import FinPrMeasurementsScreen from '../modules/profil/ui/screens/FinPrMeasurementsScreen';
import FinPrMacroScreen from '../modules/profil/ui/screens/FinPrMacroScreen';
import FinPrProgressScreen from '../modules/profil/ui/screens/ProgressScreen';
import BadgesScreen from '../modules/profil/ui/screens/BadgesScreen';
import CollectionScreen from '../modules/profil/ui/screens/CollectionScreen';
import PublicPreviewScreen from '../modules/profil/ui/screens/PublicPreviewScreen';
import SignupAIScreen from '../modules/profil/ui/screens/SignupAIScreen';
import SignupEatScreen from '../modules/profil/ui/screens/SignupEatScreen';
import FinPhotoResult from '../modules/ai/scan/ui/FinPhotoResult';
import FinScanErrorSheet from '../modules/ai/scan/ui/FinScanErrorSheet';
import ScanLimitSheet from '../modules/ai/scan/ui/ScanLimitSheet';
import { EkInfoSheet } from '../modules/eatkcal/v2/ui/InfoSheet';
import { EkErrorCard } from '../modules/eatkcal/v2/ui/ErrorCard';
import { addressSaveError, couponError, priceError, stockError } from '../modules/eatkcal/v2/model/errors';
import { CelebrateOverlay } from '../modules/celebrate/CelebrateOverlay';
import { NotifyPermissionSheet } from '../modules/celebrate/NotifyPermissionSheet';
import { CollectionWon } from '../modules/collection/CollectionWon';

const noop = () => {};
const P = (props: Record<string, unknown> | undefined) => (props ?? {}) as any;

/** Mock Keşfet akışından ilk uygun gönderi. */
function useMockPost(pick: (p: FeedPost) => boolean): FeedPost | null {
  const [post, setPost] = useState<FeedPost | null>(null);
  useEffect(() => {
    let alive = true;
    void getKesfetClient()
      .getFeed({ tab: 'for_you' as any, lang: 'tr' })
      .then((page) => {
        if (!alive) return;
        setPost(page.items.find(pick) ?? page.items[0] ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return post;
}

function Backdrop({ children }: { children?: React.ReactNode }) {
  const t = useTheme();
  return <View style={[styles.fill, { backgroundColor: t.color.bg }]}>{children}</View>;
}

function PostCardScene({ variant }: { variant?: string }) {
  const { lang } = useT();
  const insets = useSafeAreaInsets();
  const post = useMockPost((p: any) =>
    variant === 'activity'
      ? !!p.activity_card
      : variant === 'video'
        ? (p.media ?? []).some((m: any) => m.kind === 'video')
        : !p.activity_card,
  );
  if (!post) return <Backdrop />;
  const model = postCardModel(
    variant === 'liked' ? ({ ...post, me: { ...(post as any).me, liked: true } } as FeedPost) : post,
    Date.now(),
    lang as any,
  );
  return (
    <Backdrop>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12 }}>
        <PostCard {...({ model, index: 0, isVisible: true, showComment: true } as any)} />
      </ScrollView>
    </Backdrop>
  );
}

function SheetOver({ children }: { children: React.ReactNode }) {
  return (
    <Backdrop>
      <PostCardScene />
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </View>
    </Backdrop>
  );
}

function AddToDayScene() {
  const post = useMockPost((p: any) => !!p.meal);
  const meal = (post as any)?.meal ?? null;
  return (
    <SheetOver>
      <AddToDaySheet visible onClose={noop} meal={meal} authorHandle={(post as any)?.author?.handle ?? ''} onAdd={noop} />
    </SheetOver>
  );
}

function GunViewerScene({ end, done }: { end?: boolean; done?: boolean }) {
  const [rings, setRings] = useState<DayRing[]>([]);
  useEffect(() => {
    void getGunClient().getDayRings().then(setRings).catch(() => {});
  }, []);
  if (!rings.length) return <Backdrop />;
  return (
    <Backdrop>
      <GunViewer
        {...({ vitrinSlide: end || done ? 'summary' : undefined, vitrinDone: done } as any)}
        visible
        rings={rings}
        startUserId={(rings[0] as any).user?.id}
        onClose={noop}
        onAddToDay={noop}
      />
    </Backdrop>
  );
}

// Final FinPrMacro örneğiyle aynı içerik: 3/5 Macro, iki ödül kuponu.
const MACRO_MOCK = {
  balance: 3,
  coupons: [
    { id: 'c1', code: 'MACRO-1', description: 'Ücretsiz öğün', end_date: '2026-12-31T00:00:00Z' },
    { id: 'c2', code: 'MACRO-2', description: 'Ücretsiz öğün', end_date: '2027-01-15T00:00:00Z' },
  ],
};

function ProfileSubScene({ sub, what, history, mock }: { sub: string; what?: boolean; history?: boolean; mock?: boolean }) {
  switch (sub) {
    case 'personal':
      return <SettingsPersonalScreen onBack={noop} />;
    case 'notify':
      return <SettingsNotifyScreen onBack={noop} />;
    case 'security':
      return <SettingsSecurityScreen onBack={noop} />;
    case 'privacy':
      return <SettingsPrivacyScreen onBack={noop} />;
    case 'agreements':
      return <SettingsAgreementsScreen onBack={noop} />;
    case 'support':
      return <SettingsSupportScreen onBack={noop} />;
    case 'cards':
      return (
        <FinPrCardsScreen
          {...({
            onBack: noop,
            // Final FinPrCards örneği: iki kart, biri varsayılan.
            vitrinCards: [
              { id: 'k1', last4: '4242', brand: 'Kart', bank_name: null, card_alias: null, is_default: true, created_at: '2026-10-01' },
              { id: 'k2', last4: '1881', brand: 'Kart', bank_name: null, card_alias: null, is_default: false, created_at: '2026-10-02' },
            ],
          } as any)}
        />
      );
    case 'reviews':
      return <FinPrReviewsScreen onBack={noop} />;
    case 'coupons':
      return <FinPrCouponsScreen onBack={noop} />;
    case 'measurements':
      return <FinPrMeasurementsScreen onBack={noop} />;
    case 'feedback':
      return <SettingsFeedbackScreen onBack={noop} />;
    case 'macro':
      return (
        <FinPrMacroScreen
          {...({
            onBack: noop,
            vitrinWhatOpen: what,
            vitrinHistory: history,
            vitrinData: mock ? MACRO_MOCK : undefined,
          } as any)}
        />
      );;
    case 'progress':
      return (
        <FinPrProgressScreen
          {...({
            onBack: noop,
            goalKcal: 2000,
            targets: { protein: 140, carbs: 250, fat: 70 },
            onAddMeasurement: noop,
            // Final FinPrProgress örneği: uygun · üstü · uygun · altı · uygun · üstü · uygun.
            vitrinDays: [2010, 2480, 1960, 1380, 2040, 2520, 1990].map((kcal, i) => ({
              date: `2026-11-0${i + 1}`,
              kcal,
              protein: kcal * 0.07,
              carbs: kcal * 0.12,
              fat: kcal * 0.034,
            })),
            vitrinMeasurements: [{ date: '2026-11-01', waist_cm: 78, hip_cm: 96, chest_cm: 92 }],
          } as any)}
        />
      );
    case 'badges':
      return <BadgesScreen onBack={noop} handle="deniz" />;
    case 'collection':
      return <CollectionScreen onBack={noop} />;
    case 'public':
      return (
        <PublicPreviewScreen
          {...({
            onBack: noop,
            handle: 'dytisyen',
            displayName: 'Dyt. Ayşe Soyad',
            avatarUrl: null,
            isPrivate: false,
            vitrinProfile: {
              id: 'vitrin-public',
              display_name: 'Dyt. Ayşe Soyad',
              handle: 'dytisyen',
              avatar_url: null,
              bio: 'İzmir’de diyetisyen, hafta sonları koşucu. Pratik tabaklar, mevsim sebzeleri ve hafta içi hazırlanabilen tarifler.',
              role: 'dietitian',
              verified: true,
              is_private: false,
              followers: 12400,
              following: 180,
              posts: 86,
              me_following: 'none',
            },
            vitrinPosts: [128, 96, 211, 74, 52, 33].map((adds, i) => ({ id: `v${i}`, photoUrl: null, adds })),
          } as any)}
        />
      );
    default:
      return <Backdrop />;
  }
}

function EkErrorsScene() {
  const insets = useSafeAreaInsets();
  const errors = [
    couponError({ ok: false, reason: 'expired' } as any),
    stockError(['Tavuk kinoa bowl']),
    priceError({ changed: true, names: ['Tavuk kinoa bowl'] }, 245, 265),
    addressSaveError(),
  ].filter(Boolean) as any[];
  return (
    <Backdrop>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, gap: 12 }}>
        {errors.map((e, i) => (
          <EkErrorCard key={i} error={e} onAction={noop} />
        ))}
      </ScrollView>
    </Backdrop>
  );
}

const SAMPLE_ESTIMATE = {
  name: 'Tavuk kinoa bowl',
  kcal: 520,
  protein_g: 38,
  carbs_g: 52,
  fat_g: 16,
  isEstimate: true,
  portion: 1,
  photo_url: null,
  ingredients: [
    { name: 'Tavuk göğsü', grams: 150, kcal: 248 },
    { name: 'Kinoa', grams: 120, kcal: 144 },
    { name: 'Avokado', grams: 60, kcal: 96 },
    { name: 'Sebzeler', grams: 80, kcal: 32 },
  ],
};

const SAMPLE_CARD = {
  id: 'c-43',
  no: 43,
  name: 'Tavuk kinoa bowl',
  meal: 'lunch',
  dateISO: '2026-11-06T12:30:00.000+03:00',
  photoUri: null,
  kcal: 520,
  protein_g: 38,
  carbs_g: 52,
  firstTime: true,
};

export const VITRIN_SCENES: Record<string, React.ComponentType<any>> = {
  postCard: (p) => <PostCardScene {...P(p)} />,
  rulesSheet: () => (
    <SheetOver>
      <RulesSheet visible onAccept={noop} onClose={noop} />
    </SheetOver>
  ),
  commentsSheet: () => (
    <SheetOver>
      <CommentsSheet visible postId="post-1" currentUser={{ id: '00000000-0000-4000-8000-00000000a14e', handle: 'deniz', display_name: 'Deniz Kaya' } as any} onClose={noop} />
    </SheetOver>
  ),
  notificationsSheet: () => (
    <SheetOver>
      <NotificationsSheet visible onClose={noop} onOpenPost={noop} onOpenProfile={noop} />
    </SheetOver>
  ),
  addToDaySheet: () => <AddToDayScene />,
  addToast: () => (
    <SheetOver>
      <AddToast toast={{ message: "Öğle'ye loglandı", actionLabel: 'Geri al' } as any} onDismiss={noop} />
    </SheetOver>
  ),
  postMenu: ({ step }: { step?: string }) => (
    <SheetOver>
      <PostMenu
        {...({ vitrinStep: step } as any)}
        visible
        onClose={noop}
        authorName="Dyt. Ece"
        onCopyLink={noop}
        onReport={() => true}
        onBlock={noop}
      />
    </SheetOver>
  ),
  gunViewer: (p) => <GunViewerScene {...P(p)} />,
  gunEmpty: () => (
    <Backdrop>
      <GunEmpty onLogMeal={noop} onShared={noop} />
    </Backdrop>
  ),
  photoResult: () => (
    <FinPhotoResult
      {...({
        estimate: SAMPLE_ESTIMATE,
        photoUri: null,
        mealType: 'lunch',
        saving: false,
        saved: false,
        lang: 'tr',
        onChangeMealType: noop,
        onSave: noop,
        onRetry: noop,
      } as any)}
    />
  ),
  scanError: ({ kind }: { kind?: string }) => (
    <Backdrop>
      <FinScanErrorSheet
        {...({ visible: true, kind: kind ?? 'failed', remaining: 2, onClose: noop, onManualEntry: noop, onRetry: noop } as any)}
      />
    </Backdrop>
  ),
  scanLimit: () => (
    <Backdrop>
      <ScanLimitSheet visible onClose={noop} onManualEntry={noop} />
    </Backdrop>
  ),
  profileSub: (p) => <ProfileSubScene {...P(p)} />,
  privacySheet: () => (
    <Backdrop>
      <PrivacySheet visible isPrivate={false} onClose={noop} onChanged={noop as any} />
    </Backdrop>
  ),
  ekInfo: () => (
    <Backdrop>
      <EkInfoSheet visible onClose={noop} />
    </Backdrop>
  ),
  ekErrors: () => <EkErrorsScene />,
  signupAI: () => <SignupAIScreen onSkip={noop} />,
  signupEat: () => <SignupEatScreen onBack={noop} onAllowed={noop} />,
  celebrate: ({ kind }: { kind?: 'first' | 'streak3' | 'streak7' }) => (
    <Backdrop>
      <CelebrateOverlay
        visible
        moment={kind ?? 'first'}
        dateLabel="6 Kasım"
        cardTitle="Tavuk kinoa bowl"
        cardSub="520 kcal"
        onShare={noop}
        onDone={noop}
      />
    </Backdrop>
  ),
  notifySheet: () => (
    <Backdrop>
      <NotifyPermissionSheet visible onClose={noop} />
    </Backdrop>
  ),
  collectWon: () => (
    <Backdrop>
      <CollectionWon visible card={SAMPLE_CARD as any} onViewCard={noop} onShare={noop} onClose={noop} />
    </Backdrop>
  ),
  components: () => {
    const DesignShowcase = require('../screens/DesignShowcaseScreen').default;
    return <DesignShowcase />;
  },
  tokens: () => {
    const DesignShowcase = require('../screens/DesignShowcaseScreen').default;
    return <DesignShowcase />;
  },
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
