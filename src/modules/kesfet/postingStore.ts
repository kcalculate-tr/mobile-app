// G15-S3 — Final FinPosting: gönderi paylaşım durumu akışta gösterilir.
// Composer "Paylaş"tan sonra kapanır; yükleme + create_post arka planda sürer ve
// akışın üstünde durum satırı görünür:
//   uploading/publishing → "Paylaşılıyor…" (ilerleme çizgisi)
//   reviewing            → "İnceleniyor" (sunucu moderasyonu; gönderi soluk)
//   published            → "Yayında" (birkaç saniye sonra kaybolur)
//   rejected             → sakin kart "Topluluk kurallarına uymadığı için yayınlanmadı"
//   error                → sakin satır + "Tekrar dene" (taslak kaybolmaz: retry kapanışı)
// Gönderim mantığı (yükle → create_post → moderate-content) Composer'da aynen kalır.
import { create } from 'zustand';

export type PostingPhase = 'idle' | 'uploading' | 'publishing' | 'reviewing' | 'published' | 'rejected' | 'error';

interface PostingState {
  phase: PostingPhase;
  postId: string | null;
  error: string | null;
  retry: (() => void) | null;
  set: (phase: PostingPhase, extra?: Partial<Pick<PostingState, 'postId' | 'error' | 'retry'>>) => void;
  clear: () => void;
}

export const usePostingStore = create<PostingState>((set) => ({
  phase: 'idle',
  postId: null,
  error: null,
  retry: null,
  set: (phase, extra = {}) => set((s) => ({ ...s, ...extra, phase })),
  clear: () => set({ phase: 'idle', postId: null, error: null, retry: null }),
}));

/** Durum satırının ilerleme oranı (Final: paylaşılıyor ~%40, inceleniyor ~%80). */
export function postingProgress(phase: PostingPhase): number | null {
  if (phase === 'uploading') return 0.4;
  if (phase === 'publishing') return 0.6;
  if (phase === 'reviewing') return 0.8;
  return null;
}
