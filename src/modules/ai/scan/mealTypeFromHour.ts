// AI tarama sonucu kaydedilirken öğün tipini sormuyoruz (T20Scan tasarımında
// seçici yok) — günün saatine göre makul bir varsayılan seçilir. Kullanıcı
// Tracker'da dilediği zaman öğün tipini elle düzeltebilir (mevcut akış).
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export function inferMealTypeFromHour(hour: number): MealType {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 22) return 'dinner';
  return 'snack';
}
