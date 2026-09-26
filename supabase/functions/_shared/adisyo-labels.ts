// Adisyo fiş notu etiketleri — SAF mantık, tek doğruluk kaynağı.
//
// 26.09.2026 — GERÇEK HATA: mobil uygulamadan verilen siparişlerde GRAMAJ
// Adisyo fişine hiç düşmüyordu. 21 Mayıs'tan bu yana 135 sipariş etkilendi;
// mutfak o siparişlerde varsayılan gramajı hazırladı.
//
// Sebep: sipariş kaleminde iki ayrı alan var ve şekilleri farklı —
//   selected_options        → ŞABLON seçimleri, DİZİ:
//                             [{ template_name: "Et Gramajı", value_name: "200g" }]
//   legacy_selected_options → { labels: [...], templateOptions: [...] }
//
// Edge fonksiyonu şunu yazıyordu:
//   it.selected_options?.labels ?? it.legacy_selected_options?.labels ?? []
// Dizi üzerinde `.labels` undefined; `legacy.labels` ise gramajlı siparişlerde
// BOŞ DİZİ. Boş dizi nullish OLMADIĞI için `??` zinciri orada duruyor ve sonuç
// boş kalıyordu → OrderDetailNote hiç eklenmiyordu.
//
// Bundle siparişlerde `legacy.labels` dolu olduğu için grup seçimleri
// gidiyordu; bu yüzden hata yalnızca gramajda görünüyordu.

export interface SablonSecimi {
  template_name?: string | null;
  value_name?: string | null;
}

export interface AdisyoKalemi {
  selected_options?: SablonSecimi[] | { labels?: string[] } | null;
  legacy_selected_options?: {
    labels?: string[] | null;
    templateOptions?: SablonSecimi[] | null;
  } | null;
}

/**
 * Fişe yazılacak etiketler. Şablon (gramaj) seçimleri ÖNCE gelir: fiş
 * kırpılsa bile mutfağın en çok ihtiyaç duyduğu bilgi görünsün.
 */
export function adisyoEtiketleri(kalem: AdisyoKalemi): string[] {
  const sablonlar: SablonSecimi[] =
    (Array.isArray(kalem.selected_options) ? kalem.selected_options : undefined)
    ?? kalem.legacy_selected_options?.templateOptions
    ?? [];

  const sablonEtiketleri = sablonlar
    .filter((o) => o && typeof o.value_name === 'string' && o.value_name.trim() !== '')
    .map((o) =>
      o.template_name && o.template_name.trim() !== ''
        ? `${o.template_name}: ${o.value_name}`
        : String(o.value_name),
    );

  const grupEtiketleri =
    (Array.isArray(kalem.selected_options) ? undefined : kalem.selected_options?.labels)
    ?? kalem.legacy_selected_options?.labels
    ?? [];

  return [...sablonEtiketleri, ...grupEtiketleri.filter((l) => typeof l === 'string' && l.trim() !== '')];
}

/**
 * Adisyo fişinde grup önekini soyar ("Baz Seçimi: Basmati" → "Basmati").
 * Fiş dar; önek olmadan da bağlam net.
 */
export function fisNotu(etiketler: string[]): string | null {
  if (etiketler.length === 0) return null;
  const temiz = etiketler.map((l) => {
    const i = l.indexOf(':');
    return i >= 0 ? l.slice(i + 1).trim() : l;
  });
  // Ayraç " | ": "\n" Adisyo word-wrap'iyle çakışıp satırları üst üste
  // bindiriyordu.
  return temiz.join(' | ');
}
