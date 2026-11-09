// G21-S1 md.9 — Profil alt sayfaları native stack ekranı (`ProfileSub`).
//
// Önceden FinPrProfileScreen sekme içinde `setSub` ile ekran değiştiriyordu (geçiş
// yok, iOS kenar jesti yok, tab bar elle gizleniyordu). Artık her alt sayfa kök
// yığına itilir: sağdan kayar, geri jesti/geri düğmesi soldan kapatır (AppNavigator
// `pushTransition`). Alt sayfadan alt sayfaya (Gizlilik → Güvenlik / Veri izinleri,
// İlerleme → Ölçümler) aynı rota yeni kimlikle üstüne itilir → geri doğal olarak
// bir önceki sayfaya döner.
import React from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../../../core/AuthContext';
import { useNutritionSummary } from '../../../../hooks/useNutritionSummary';
import SettingsPersonalScreen from './SettingsPersonalScreen';
import SettingsNotifyScreen from './SettingsNotifyScreen';
import SettingsSecurityScreen from './SettingsSecurityScreen';
import SettingsPrivacyScreen from './SettingsPrivacyScreen';
import SettingsAgreementsScreen from './SettingsAgreementsScreen';
import SettingsDataConsentScreen from './SettingsDataConsentScreen';
import SettingsSupportScreen from './SettingsSupportScreen';
import SettingsFeedbackScreen from './SettingsFeedbackScreen';
import FinPrMacroScreen from './FinPrMacroScreen';
import FinPrProgressScreen from './ProgressScreen';
import BadgesScreen from './BadgesScreen';
import CollectionScreen from './CollectionScreen';
import PublicPreviewScreen from './PublicPreviewScreen';
import FinPrReviewsScreen from './FinPrReviewsScreen';
import FinPrCouponsScreen from './FinPrCouponsScreen';
import FinPrCardsScreen from './FinPrCardsScreen';
import FinPrMeasurementsScreen from './FinPrMeasurementsScreen';
import { isProfileSub, type ProfileSubName, type ProfileSubParams } from './profileSub';

type Nav = {
  goBack: () => void;
  canGoBack: () => boolean;
  navigate: (name: string, params?: object) => void;
};

/** İlerleme sayfası hedefleri bugünkü özetten (eski kökteki ile aynı kaynak). */
function ProgressSub({ onBack, open }: { onBack: () => void; open: (sub: ProfileSubName) => void }) {
  const { summary } = useNutritionSummary();
  return (
    <FinPrProgressScreen
      onBack={onBack}
      goalKcal={summary?.targetKcal}
      targets={{
        protein: summary?.targetProtein,
        carbs: summary?.targetCarb,
        fat: summary?.targetFat,
      }}
      onAddMeasurement={() => open('measurements')}
    />
  );
}

export default function ProfileSubRoute() {
  const navigation = useNavigation() as unknown as Nav;
  const params = (useRoute().params ?? {}) as Partial<ProfileSubParams>;
  const { user } = useAuth();
  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs', { screen: 'Profile' }));
  const open = (sub: ProfileSubName) => navigation.navigate('ProfileSub', { sub });
  const sub = isProfileSub(params.sub) ? params.sub : null;

  switch (sub) {
    case 'personal':
      return <SettingsPersonalScreen onBack={back} />;
    case 'notify':
      return <SettingsNotifyScreen onBack={back} />;
    case 'security':
      return <SettingsSecurityScreen onBack={back} />;
    case 'privacy':
      return (
        <SettingsPrivacyScreen
          onBack={back}
          onOpenSecurity={() => open('security')}
          onOpenDataConsent={() => open('dataConsent')}
        />
      );
    case 'dataConsent':
      return <SettingsDataConsentScreen onBack={back} />;
    case 'agreements':
      return <SettingsAgreementsScreen onBack={back} />;
    case 'support':
      return <SettingsSupportScreen onBack={back} />;
    case 'feedback':
      return <SettingsFeedbackScreen onBack={back} />;
    case 'macro':
      return <FinPrMacroScreen onBack={back} />;
    case 'macroSub':
      // "Macro aboneliğim": Final Macro ve Abonelik'in "Öğün Aboneliği" sekmesi.
      return <FinPrMacroScreen onBack={back} initialTab={1} />;
    case 'progress':
      return <ProgressSub onBack={back} open={open} />;
    case 'badges':
      return <BadgesScreen onBack={back} handle={params.handle ?? null} />;
    case 'collection':
      return <CollectionScreen onBack={back} />;
    case 'reviews':
      return <FinPrReviewsScreen onBack={back} />;
    case 'cards':
      return <FinPrCardsScreen onBack={back} />;
    case 'coupons':
      return <FinPrCouponsScreen onBack={back} />;
    case 'measurements':
      return <FinPrMeasurementsScreen onBack={back} />;
    case 'public': {
      const fallbackName =
        String(user?.user_metadata?.full_name || '').trim() || String(user?.email || 'Kcal Misafir').split('@')[0];
      return (
        <PublicPreviewScreen
          onBack={back}
          handle={params.handle ?? null}
          displayName={params.displayName ?? fallbackName}
          avatarUrl={params.avatarUrl ?? null}
          isPrivate={params.isPrivate === true}
        />
      );
    }
    default:
      // Bilinmeyen/eksik parametre: boş ekran yerine Profil'e dön.
      return <SettingsFallback onBack={back} />;
  }
}

function SettingsFallback({ onBack }: { onBack: () => void }) {
  React.useEffect(() => {
    onBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
