// G19-S1 md.1 — Analiz sürerken Tara kapatılırsa (X / geri / arka plan) sonuç
// KAYBOLMAZ: hak zaten düşmüştür, sonuç modül belleğinde 10 dk tutulur ve Tara
// yeniden açılınca doğrudan sonuç ekranı (FinPhotoR1) gösterilir. Tek kullanım.
// SAF (native yok) — birim testi: __tests__/orphanResult.test.ts
import type { ScanEstimate } from './types';

export const ORPHAN_TTL_MS = 10 * 60 * 1000;

export interface OrphanResult {
  userId: string;
  scanRef: string;
  photoUri: string;
  note: string;
  estimate: Omit<ScanEstimate, 'isEstimate'>;
  at: number;
}

let orphan: OrphanResult | null = null;

export function keepOrphanResult(r: Omit<OrphanResult, 'at'>, now: number = Date.now()): void {
  orphan = { ...r, at: now };
}

/** Bu kullanıcının taze sahipsiz sonucunu alır ve SİLER (tek kullanım). */
export function takeOrphanResult(userId: string | null | undefined, now: number = Date.now()): OrphanResult | null {
  const o = orphan;
  if (!o || !userId) return null;
  if (o.userId !== userId || now - o.at > ORPHAN_TTL_MS) {
    if (now - o.at > ORPHAN_TTL_MS || o.userId !== userId) orphan = null;
    return null;
  }
  orphan = null;
  return o;
}

export function clearOrphanResult(): void {
  orphan = null;
}
