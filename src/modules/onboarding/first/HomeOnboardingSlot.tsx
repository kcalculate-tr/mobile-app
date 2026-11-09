// G18-S1 md.5 — `HomeOnboardingSlot`: Ana sayfaya TEK satırla bağlanır.
//   · "Profilini oluşturalım" kartı (FinHomeProfileCard): yalnız hedefi olmayan
//     hesapta ve kart kapatılmadıysa/tamamlanmadıysa. "Profilini oluştur" →
//     Takibe başla (FinTbGoal…FinTbResult) → "Profil hazır" (FinCelebrateProfile)
//     → oryantasyon. X → kart bir daha zorla açılmaz; oryantasyon yine başlar.
//   · "Profil hazır" sahnesi (Takibe başla sonucundan kuyruğa alınır).
// `yeni_onboarding` kapalıyken HİÇBİR ŞEY çizmez ve hiçbir sorgu atmaz.
import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { useAuth } from '../../../core/AuthContext';
import { useFeature } from '../../../core/flags';
import { getSupabaseClient } from '../../../core/supabase';
import { hasNutritionGoal, type GoalClient } from '../v2/loginLogic';
import { CelebrateProfile } from './CelebrateProfile';
import { ProfileCard } from './ProfileCard';
import { showProfileCard } from './state';
import { useOnbFirst } from './store';
import { useOverlayGate } from './overlayGate';

export function HomeOnboardingSlot() {
  const enabled = useFeature('yeni_onboarding');
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  // YALNIZ vitrin (FinHomeProfileCard): hedefsiz hesap durumu; üretimde parametre yok.
  const vitrinHasGoal: boolean | undefined = __DEV__ && route?.params?.vitrinProfileCard === true ? false : undefined;
  const hydrate = useOnbFirst((s) => s.hydrate);
  const hydrated = useOnbFirst((s) => s.hydrated);
  const card = useOnbFirst((s) => s.synced.profileCard);
  const celebrate = useOnbFirst((s) => s.celebrate);
  const setCard = useOnbFirst((s) => s.setCard);
  const startOrient = useOnbFirst((s) => s.startOrient);
  const clearCelebrate = useOnbFirst((s) => s.clearCelebrate);
  const [hasGoal, setHasGoal] = useState<boolean | undefined>(__DEV__ ? vitrinHasGoal : undefined);
  useOverlayGate(celebrate != null);

  useEffect(() => {
    if (enabled) void hydrate(user?.id ?? null);
  }, [enabled, user?.id, hydrate]);

  // Hedef var mı — her odakta (Takibe başla'dan dönünce kart kendiliğinden kalkar).
  // Hata/emin değil → `true` (kart gösterilmez; yanlış teklif yok).
  useFocusEffect(
    useCallback(() => {
      if (!enabled || !user?.id || (__DEV__ && vitrinHasGoal !== undefined)) return;
      let alive = true;
      void hasNutritionGoal(async () => getSupabaseClient() as unknown as GoalClient, user.id).then((v) => {
        if (alive) setHasGoal(v);
      });
      return () => {
        alive = false;
      };
    }, [enabled, user?.id, vitrinHasGoal]),
  );

  if (!enabled) return null;
  return (
    <>
      {hydrated && showProfileCard(card, hasGoal) ? (
        <ProfileCard
          onCreate={() => navigation.navigate('TakibeBasla')}
          onDismiss={() => {
            setCard('dismissed');
            startOrient();
          }}
        />
      ) : null}
      <CelebrateProfile
        visible={celebrate != null}
        kcal={celebrate?.kcal ?? null}
        onDone={() => {
          clearCelebrate();
          startOrient();
        }}
      />
    </>
  );
}
