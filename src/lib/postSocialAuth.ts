import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from './supabase';
import { useOnboardingStore } from '../store/onboardingStore';
import { useNavGate } from '../store/navGateStore';

export type PostSocialAuthOutcome = 'new_user' | 'returning_user' | 'error';

// Apple/Google girişi hem YENİ kayıt hem de dönen kullanıcı için tek bir kapı —
// e-posta/OTP adımı zaten sağlayıcı tarafından doğrulanmış, ama telefon numarası
// (zorunlu, teslimat için) hiçbir sağlayıcıdan gelmez. `profiles.phone` boşsa
// kayıt eksik sayılır ve RegisterIdentity'ye yönlendirilir (RegisterEmail +
// VerifyOtp adımları atlanır); doluysa mevcut LoginScreen ile aynı state-driven
// geçiş (AsyncStorage bayrakları + navGate refresh) kullanılır.
export async function resolvePostSocialAuth(params: {
  email?: string;
  givenName?: string;
  familyName?: string;
}): Promise<{ outcome: PostSocialAuthOutcome; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (userErr || !uid) {
      return { outcome: 'error', error: userErr?.message ?? 'Oturum bulunamadı.' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', uid)
      .maybeSingle();
    const needsProfile = !profile?.phone;

    if (needsProfile) {
      const email = params.email ?? userRes.user.email ?? '';
      useOnboardingStore.getState().setAuth(email, '');
      if (params.givenName || params.familyName) {
        useOnboardingStore.getState().setIdentity(params.givenName ?? '', params.familyName ?? '', '');
      }
      useNavGate.getState().setRegistering(true);
      return { outcome: 'new_user' };
    }

    await AsyncStorage.multiSet([
      ['@kcal_onboarding_done', 'true'],
      ['@kcal_needs_nutrition_profile', 'false'],
    ]);
    useNavGate.getState().setRegistering(false);
    useNavGate.getState().refresh();
    return { outcome: 'returning_user' };
  } catch (err: any) {
    return { outcome: 'error', error: err?.message ?? 'Bir hata oluştu.' };
  }
}
