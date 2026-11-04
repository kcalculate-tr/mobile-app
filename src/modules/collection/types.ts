// Tabak koleksiyonu tipleri — tarama/öğün fotoğraflarından türetilen çıkartma
// kartları. Sunucu tablosu YOK; kartlar mevcut kayıtlardan türetilir (deriveCards).
export type CollectionMeal = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'eatkcal';

export interface CollectionCard {
  id: string; // kararlı kimlik (ör. consumption id)
  no: number; // katalogda gösterilen "No. 043"
  name: string;
  meal: CollectionMeal;
  dateISO: string;
  photoUri: string | null;
  kcal: number;
  protein_g?: number | null;
  carbs_g?: number | null;
  firstTime: boolean; // "İlk kez" — bu yemek adı ilk kez görülüyorsa
}

// Koleksiyon hedefi — "N / 120 tabak".
export const COLLECTION_TARGET = 120;
