import { create } from 'zustand';

// AppNavigator OnboardingStack <-> MainStack geçişini state-driven yapar.
// AppNavigator AsyncStorage bayraklarını [user?.id] değişiminde okur; canlı
// (aynı session içi) geçiş için `version`'ı dep'e ekliyoruz: refresh() çağrısı
// AppNavigator'ı yeniden değerlendirmeye zorlar (imperative nav.reset yerine).
// pendingRoute: stack geçişi sonrası tek seferlik deep-link (FIX 8).

interface NavGateState {
  version: number;
  pendingRoute: string | null;
  refresh: () => void;
  setPendingRoute: (route: string | null) => void;
}

export const useNavGate = create<NavGateState>((set) => ({
  version: 0,
  pendingRoute: null,
  refresh: () => set((s) => ({ version: s.version + 1 })),
  setPendingRoute: (pendingRoute) => set({ pendingRoute }),
}));
