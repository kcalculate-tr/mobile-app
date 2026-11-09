// G18-S1 — tam ekran katman kapısı: kutlama / bildirim izni sheet'i / "Profil hazır"
// açıkken oryantasyon ipucu GÖSTERİLMEZ (üst üste binme yok). Katmanlar
// `useOverlayGate(visible)` ile bir satırda kaydolur; OrientHost sayaç 0 olunca
// (kısa yerleşme beklemesiyle) ipucunu açar.
import { useEffect } from 'react';
import { create } from 'zustand';

interface GateStore {
  open: number;
  inc: () => void;
  dec: () => void;
}

export const useGateStore = create<GateStore>((set) => ({
  open: 0,
  inc: () => set((s) => ({ open: s.open + 1 })),
  dec: () => set((s) => ({ open: Math.max(0, s.open - 1) })),
}));

export function useOverlayGate(visible: boolean): void {
  useEffect(() => {
    if (!visible) return;
    useGateStore.getState().inc();
    return () => useGateStore.getState().dec();
  }, [visible]);
}
