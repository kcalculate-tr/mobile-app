// AI tarama kota durumu — bellek içi (kalıcı DEĞİL). İlke (G6-S4 md.3):
// "ekranı açılışında salt okunur değer yoksa çipi gizle" — yani uygulama
// yeniden açıldığında veya bu oturumda hiç tarama/rezervasyon yapılmadıysa
// kalan hak BİLİNMEZ, çip gizlenir. Bir `reserve_ai_scan` sonucu geldiğinde
// (başarılı veya kota dolu) bilinen hâle gelir ve çip görünür.
//
// AsyncStorage'a YAZILMAZ: tahmini bir sayıyı diskte tutup sunucudan
// bağımsızlaşmak, günlük sıfırlamadan sonra yanlış "kalan hak" göstermek
// riski taşır. Bilinmiyorsa gizlemek, yanlış bilgi göstermekten güvenlidir.
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
