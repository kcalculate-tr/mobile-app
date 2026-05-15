import { create } from 'zustand';

// AppNavigator OnboardingStack <-> MainStack geçişini state-driven yapar.
// AppNavigator AsyncStorage bayraklarını [user?.id] değişiminde okur; canlı
// (aynı session içi) geçiş için `version`'ı dep'e ekliyoruz: refresh() çağrısı
// AppNavigator'ı yeniden değerlendirmeye zorlar (imperative nav.reset yerine).
// pendingRoute: stack geçişi sonrası tek seferlik deep-link (FIX 8).
// registering: kayıt alt-akışı (RegisterEmail -> VerifyOtp -> Identity ->
// Address) sırasında true. VerifyOtp başarınca Supabase session yaratılır
// (user null -> set); o anda `@kcal_onboarding_done` bayatsa AppNavigator
// gate'i OnboardingStack'i söküp MainStack'e geçiyordu ve devam eden
// imperative nav.navigate patlıyordu (FIX 7 sınıfı). Bu bayrak true iken
// gate kullanıcıyı OnboardingStack'te tutar; Address tamamlanınca temizlenir.

interface NavGateState {
  version: number;
  pendingRoute: string | null;
  registering: boolean;
  refresh: () => void;
  setPendingRoute: (route: string | null) => void;
  setRegistering: (registering: boolean) => void;
}

export const useNavGate = create<NavGateState>((set) => ({
  version: 0,
  pendingRoute: null,
  registering: false,
  refresh: () => set((s) => ({ version: s.version + 1 })),
  setPendingRoute: (pendingRoute) => set({ pendingRoute }),
  setRegistering: (registering) => set({ registering }),
}));
