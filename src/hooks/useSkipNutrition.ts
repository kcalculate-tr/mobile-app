import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavGate } from '../store/navGateStore';

// Beslenme adımını atla: onboarding'i bitir, beslenme gerekmez işaretle,
// AppNavigator'ı yeniden değerlendirmeye zorla (state-driven; imperative
// nav.reset YOK — o OnboardingStack scope'unda patlıyordu). 5 nutrition
// ekranında ortak kullanılır.
export function useSkipNutrition() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skip = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await AsyncStorage.multiSet([
        ['@kcal_onboarding_done', 'true'],
        ['@kcal_needs_nutrition_profile', 'false'],
      ]);
      // Kayıt alt-akışından gelindiyse `registering`'i de temizle — aksi
      // halde gate kullanıcıyı OnboardingStack'te tutar, MainStack'e
      // geçemezdi (BUG B). Kayıt dışı girişte zaten false; no-op.
      useNavGate.getState().setRegistering(false);
      useNavGate.getState().refresh();
    } catch (err: any) {
      console.error('Skip nutrition error:', err);
      setError(err?.message ?? 'Atlanamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { skip, loading, error };
}
