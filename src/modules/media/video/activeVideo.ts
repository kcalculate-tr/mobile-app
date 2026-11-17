// Aynı anda tek video oynasın — G8-S3.md m.2. Görünür olan FeedVideo kendi
// id'sini "aktif" ilan eder; her örnek yalnız kendi id'si aktifse oynatır.
// Zustand tercih edildi (kesfet/store.ts'teki ile aynı desen).
import { create } from 'zustand';

interface ActiveVideoState {
  activeId: string | null;
  setActive: (id: string | null) => void;
  /** G58: akış ses tercihi oturum boyu ortak (oynatıcı hücre görünmezken sökülür; sesi açan
   *  kullanıcı sonraki videoda yeniden açmak zorunda kalmaz). Her açılışta sessiz başlar. */
  muted: boolean;
  setMuted: (m: boolean) => void;
}

export const useActiveVideoStore = create<ActiveVideoState>((set) => ({
  activeId: null,
  setActive: (id) => set({ activeId: id }),
  muted: true,
  setMuted: (m) => set({ muted: m }),
}));
