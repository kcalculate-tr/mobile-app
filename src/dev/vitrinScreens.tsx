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
        startUserId={((end || done ? rings[0] : rings[1] ?? rings[0]) as any).user?.id}
        onClose={noop}
        onAddToDay={noop}
      />
    </Backdrop>
  );
}

function ProfileSubScene({ sub, what }: { sub: string; what?: boolean }) {
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
    case 'feedback':
      return <SettingsFeedbackScreen onBack={noop} />;
    case 'macro':
      return <FinPrMacroScreen {...({ onBack: noop, vitrinWhatOpen: what } as any)} />;
    case 'progress':
      return <FinPrProgressScreen {...({ onBack: noop, goalKcal: 2000, onAddMeasurement: noop } as any)} />;
    case 'badges':
      return <BadgesScreen onBack={noop} handle="deniz" />;
    case 'collection':
      return <CollectionScreen onBack={noop} />;
    case 'public':
      return (
        <PublicPreviewScreen
          {...({ onBack: noop, handle: 'deniz', displayName: 'Deniz Kaya', avatarUrl: null, isPrivate: false } as any)}
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

/** G15-S2 — FinPhotoR1 / FinPhotoEN örneği (460 kcal · P24 K62 Y13; kayıt sonrası toast açık). */
function PhotoResultScene({ reduced }: { reduced?: boolean }) {
  const { lang } = useT();
  const en = lang === 'en';
  const estimate = reduced
    ? SAMPLE_ESTIMATE
    : {
        name: en ? 'Ezogelin soup, rice pilaf, ayran' : 'Ezogelin çorbası, pilav, ayran',
        kcal: 460,
        protein_g: 24,
        carbs_g: 62,
        fat_g: 13,
        isEstimate: true,
        portion: 1,
        photo_url: null,
        ingredients: [
          { name: en ? 'Ezogelin soup' : 'Ezogelin çorbası', grams: 250, kcal: 180 },
          { name: en ? 'Rice pilaf' : 'Pilav', grams: 150, kcal: 210 },
          { name: en ? 'Ayran (yogurt drink)' : 'Ayran', grams: 200, kcal: 70 },
        ],
      };
  return (
    <FinPhotoResult
      {...({
        estimate,
        photoUri: null,
        mealType: 'lunch',
        saving: false,
        saved: !reduced,
        lang: en ? 'en' : 'tr',
        onChangeMealType: noop,
        onSave: noop,
        onRetry: noop,
        onUndo: noop,
        onView: noop,
      } as any)}
    />
  );
}

/** G15-S2 — FinCelebrate/Streak örneği: kart metinleri HomeCelebrations ile aynı anahtarlar. */
function CelebrateScene({ kind }: { kind: 'first' | 'streak3' | 'streak7' }) {
  const { t } = useT();
  const sub =
    kind === 'first' ? t('celebrate.card_sub_first', { name: 'Menemen', kcal: 320 }) : t(`celebrate.card_sub_${kind}`);
  return (
    <Backdrop>
      <CelebrateOverlay
        visible
        moment={kind}
        dateLabel="6 Kasım"
        cardTitle={t(`celebrate.card_${kind}`)}
        cardSub={sub}
        onShare={noop}
        onDone={noop}
      />
    </Backdrop>
  );
}

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
  photoResult: (p) => <PhotoResultScene {...P(p)} />,
  scanError: ({ kind }: { kind?: string }) => (
    <Backdrop>
      <FinScanErrorSheet
        {...({
          visible: true,
          kind: kind ?? 'failed',
          remaining: kind === 'limit' ? 0 : 2,
          onClose: noop,
          onManualEntry: noop,
          onRetry: noop,
          onOpenSettings: noop,
          onGallery: noop,
        } as any)}
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
  celebrate: ({ kind }: { kind?: 'first' | 'streak3' | 'streak7' }) => <CelebrateScene kind={kind ?? 'first'} />,
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
