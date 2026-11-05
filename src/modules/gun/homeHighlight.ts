// homeHighlight — Ana sayfa "Logla izi B" (FinMoLogB) vurgu hedefi seçimi.
// SAF; RN importu YOK (tsx ile birim test edilir).
//
// Akış: başka sekmeden `kcal:logFlight` gelir → Ana sayfa bugünün kayıtlarını
// tazeler → yeni kaydı BİR KEZ vurgular (nokta → öğün satırı → halka).
// `kcal:logUndo` gelince vurgu geri alınır.

export interface HighlightRow {
  id: string;
  consumed_at: string; // ISO
}

/**
 * Vurgulanacak kayıt. Öncelik:
 *  1. Yükte `id` varsa ve tazelenen listede o kayıt duruyorsa → o.
 *  2. Aksi halde uçuştan ÖNCE listede olmayan kayıtların en yenisi.
 *  3. Yeni kayıt yoksa null (uydurma vurgu yok).
 * `alreadyHighlighted` içindeki kayıt bir daha vurgulanmaz ("bir kez").
 */
export function pickHighlightTarget(
  rows: readonly HighlightRow[],
  prevIds: ReadonlySet<string>,
  payloadId?: string | null,
  alreadyHighlighted?: ReadonlySet<string>,
): string | null {
  const seen = alreadyHighlighted ?? new Set<string>();
  if (payloadId && rows.some((r) => r.id === payloadId)) {
    return seen.has(payloadId) ? null : payloadId;
  }
  let best: HighlightRow | null = null;
  let bestT = -Infinity;
  for (const r of rows) {
    if (prevIds.has(r.id) || seen.has(r.id)) continue;
    const t = new Date(r.consumed_at).getTime();
    const tt = Number.isFinite(t) ? t : 0;
    if (best === null || tt > bestT) {
      best = r;
      bestT = tt;
    }
  }
  return best ? best.id : null;
}

/** Vurgu evresi: nokta iner → satır yanar (success) → halka dolar → söner. */
export type HighlightPhase = 'dot' | 'row' | 'ring';

/**
 * Geri al olayı mevcut vurguyu geri almalı mı? Yükteki id vurgulanan kayda
 * eşitse ya da vurgu id'si henüz bilinmiyorsa (tazeleme sürerken) → evet.
 */
export function undoClearsHighlight(currentId: string | null, undoId: string | null | undefined): boolean {
  if (currentId === null) return true;
  if (!undoId) return true;
  return currentId === undoId;
}
