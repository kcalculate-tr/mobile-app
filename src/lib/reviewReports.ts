// Yorum şikayeti (Apple 1.2 UGC) — anasayfa "Müşteri Yorumları" şeridindeki
// onaylı yorumlar için in-app "Bildir". review_reports tablosuna yazar; RLS
// yalnızca oturum sahibinin KENDİ adına eklemesine izin verir.
import { getSupabaseClient } from '../core/supabase';

export type ReviewReportReason = 'spam' | 'offensive' | 'irrelevant' | 'fake' | 'other';

export const REPORT_REASONS: { key: ReviewReportReason; label: string }[] = [
  { key: 'offensive', label: 'Hakaret / uygunsuz içerik' },
  { key: 'spam', label: 'Spam veya reklam' },
  { key: 'fake', label: 'Sahte / yanıltıcı yorum' },
  { key: 'irrelevant', label: 'Ürünle ilgisiz' },
  { key: 'other', label: 'Diğer' },
];

export type ReviewReportInput = {
  contentId: string;
  kaynak: 'siparis' | 'uygulama';
  reason: ReviewReportReason;
  note?: string;
};

export type ReviewReportResult =
  | { ok: true }
  | { ok: false; needsAuth?: boolean; error: string };

/**
 * Bir yorumu şikayet eder. Oturum yoksa { ok:false, needsAuth:true } döner
 * (çağıran kullanıcıyı girişe yönlendirebilir). Aynı içeriği ikinci kez
 * bildirmek unique kısıtına takılır → kullanıcıya "zaten bildirdin" denir.
 */
export async function yorumBildir(input: ReviewReportInput): Promise<ReviewReportResult> {
  try {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      return { ok: false, needsAuth: true, error: 'Bildirmek için giriş yapmalısın.' };
    }

    const { error } = await supabase.from('review_reports').insert({
      reporter_user_id: userId,
      content_kaynak: input.kaynak,
      content_id: input.contentId,
      reason: input.reason,
      note: input.note?.trim() || null,
    });

    if (error) {
      // 23505 = unique_violation → kullanıcı bu yorumu zaten bildirmiş.
      if ((error as { code?: string }).code === '23505') {
        return { ok: false, error: 'Bu yorumu zaten bildirdin.' };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? 'Gönderilemedi.' };
  }
}
