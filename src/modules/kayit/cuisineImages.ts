// G54-S1 md.4b — Mutfak kartı görselleri eşleme tablosu. BU DOSYA ÜRETİLİR: `node scripts/sync-cuisine-images.mjs`
// `docs/tur28/mutfaklar/<anahtar>.jpg` (1080×1350) dosyalarını `assets/kayit/cuisines/` altına kopyalar ve yalnız
// VAR OLAN dosyalar için `require` satırı yazar (eksik dosya Metro'da hata vermez → kart sakin degradeyle çizilir).
// Görsel yoksa: kartın zemini mutfağa özel degrade (CUISINE_GRADIENT, mevcut paletten).
import type { ImageSourcePropType } from 'react-native';
import type { KCuisine } from './model';

export const CUISINE_IMAGES: Partial<Record<KCuisine, ImageSourcePropType>> = {
  // (görsel yok — 14 Kas 2026: docs/tur28/mutfaklar klasörü henüz yok)
};
