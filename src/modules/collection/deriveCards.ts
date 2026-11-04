// deriveCards — SAF türetme. Mevcut tarama/öğün fotoğraf kayıtlarından (YALNIZ
// photoUri'si olanlar) her kayda bir çıkartma kartı üretir. Yeni sunucu tablosu
// YOK. Katalog numaraları `known` eşlemesinden gelir; yoksa ilk-görülme sırasına
// göre bir sonraki boş numara atanır. Kararlı/deterministik (Date.now/Math.random YOK).
import type { CollectionCard, CollectionMeal } from './types';

export interface PhotoRecord {
  id: string;
  name: string;
  meal: CollectionMeal;
  dateISO: string;
  photoUri: string | null;
  kcal: number;
  protein_g?: number | null;
  carbs_g?: number | null;
}

/**
 * Kayıt akışından kart listesi türetir.
 * @param records  Kayıtlar (gelen sırada; ilk-görülme sırası bu sırayla belirlenir).
 * @param known    Yemek adı → kalıcı katalog numarası eşlemesi (store'dan).
 *
 * Kurallar:
 *  • Yalnız photoUri'si olan kayıtlar karta dönüşür.
 *  • Katalog no: `known[name]` varsa onu kullanır; yoksa kullanılmamış en küçük
 *    pozitif tamsayıyı (1,2,3…) ilk-görülme sırasına göre atar. Böylece aynı
 *    yemek adı tek numara alır ve numaralar kararlıdır.
 *  • firstTime: bu yemek adının akıştaki İLK kart örneğiyse true, sonrakiler false.
 *  • Sıralama: kayıtların geliş sırasını korur (deterministik).
 */
export function deriveCards(
  records: PhotoRecord[],
  known: Record<string, number>,
): CollectionCard[] {
  // Atanmış numaralar — `known` ile başlar, yeni atamalar buna eklenir.
  const assigned: Record<string, number> = { ...known };
  // Kullanımdaki numaralar — çakışmasız yeni numara seçmek için.
  const used = new Set<number>(Object.values(assigned));
  // Bir sonraki aday numara (boş numarayı atlamadan ilerler).
  let next = 1;
  const seen = new Set<string>(); // firstTime için görülen yemek adları

  const cards: CollectionCard[] = [];

  for (const r of records) {
    if (!r.photoUri) continue; // yalnız fotoğraflı kayıtlar

    let no = assigned[r.name];
    if (no === undefined) {
      // Boş olmayan en küçük pozitif numarayı bul.
      while (used.has(next)) next += 1;
      no = next;
      assigned[r.name] = no;
      used.add(no);
    }

    const firstTime = !seen.has(r.name);
    seen.add(r.name);

    cards.push({
      id: r.id,
      no,
      name: r.name,
      meal: r.meal,
      dateISO: r.dateISO,
      photoUri: r.photoUri,
      kcal: r.kcal,
      protein_g: r.protein_g ?? null,
      carbs_g: r.carbs_g ?? null,
      firstTime,
    });
  }

  return cards;
}
