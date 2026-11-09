// AI tarama kota durumu — bellek içi (kalıcı DEĞİL). İlke (G6-S4 md.3):
// "ekranı açılışında salt okunur değer yoksa çipi gizle" — yani uygulama
// yeniden açıldığında veya bu oturumda hiç tarama/rezervasyon yapılmadıysa
// kalan hak BİLİNMEZ, çip gizlenir. Bir `reserve_ai_scan` sonucu geldiğinde
// (başarılı veya kota dolu) bilinen hâle gelir ve çip görünür.
//
// AsyncStorage'a YAZILMAZ: tahmini bir sayıyı diskte tutup sunucudan
// bağımsızlaşmak, günlük sıfırlamadan sonra yanlış "kalan hak" göstermek
// riski taşır. Bilinmiyorsa gizlemek, yanlış bilgi göstermekten güvenlidir.
import { useEffect, useState } from 'react';
import { create } from 'zustand';

export interface ScanQuotaState {
  remaining: number | null;
  resetAt: string | null;
  /** reserve_ai_scan/runAiScan sonucunu kaydeder (ok veya quota_exhausted). */
  recordQuota: (remaining: number, resetAt: string) => void;
  clear: () => void;
}

export const useScanQuotaStore = create<ScanQuotaState>((set) => ({
  remaining: null,
  resetAt: null,
  recordQuota: (remaining, resetAt) => set({ remaining, resetAt }),
  clear: () => set({ remaining: null, resetAt: null }),
}));

/**
 * G19-S1 md.2 — gün sınırı. `reset_at` (sunucunun Europe/Istanbul gece yarısı) geçtiyse
 * bilinen sayı ARTIK GEÇERSİZ: dünün "0/3"ü bugün gösterilmez → bilinmiyor (null),
 * çip gizlenir; bir sonraki rezervasyon doğru sayıyı getirir. SAF (test eder).
 */
export function effectiveRemaining(
  s: Pick<ScanQuotaState, 'remaining' | 'resetAt'>,
  now: number = Date.now(),
): number | null {
  if (s.remaining == null) return null;
  if (s.resetAt) {
    const reset = Date.parse(s.resetAt);
    if (Number.isFinite(reset) && now >= reset) return null;
  }
  return s.remaining;
}

/** Ekranda kalan hak: gece yarısı geçince kendiliğinden gizlenir (zamanlayıcıyla yeniden çizer). */
export function useScanRemaining(): number | null {
  const remaining = useScanQuotaStore((s) => s.remaining);
  const resetAt = useScanQuotaStore((s) => s.resetAt);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!resetAt) return;
    const ms = Date.parse(resetAt) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return;
    // reset en fazla ~24 saat ileride (setTimeout üst sınırının çok altında).
    const id = setTimeout(() => bump((n) => n + 1), Math.min(ms + 50, 2_000_000_000));
    return () => clearTimeout(id);
  }, [resetAt]);
  return effectiveRemaining({ remaining, resetAt });
}
