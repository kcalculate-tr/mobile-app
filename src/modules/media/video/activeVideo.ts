// Aynı anda tek video oynasın — G8-S3.md m.2. Görünür olan FeedVideo kendi
// id'sini "aktif" ilan eder; her örnek yalnız kendi id'si aktifse oynatır.
// Zustand tercih edildi (kesfet/store.ts'teki ile aynı desen).
import { create } from 'zustand';

interface ActiveVideoState {
  activeId: string | null;
  setActive: (id: string | null) => void;
}

export const useActiveVideoStore = create<ActiveVideoState>((set) => ({
  activeId: null,
  setActive: (id) => set({ activeId: id }),
}));
