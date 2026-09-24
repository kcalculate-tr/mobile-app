import type { OptionGroup } from '../types';

/**
 * Ürün kartındaki hızlı "+" butonu ile sepete eklemenin güvenli olup
 * olmadığına karar veren TEK kural.
 *
 * 24.09.2026 — müşteri bildirimi: "gramaj tercihini değiştirdiğinde sistem
 * bunu kaydedemeyip varsayılan seçeneğe geri dönüyor ve siparişi o şekilde
 * oluşturuyor."
 *
 * KÖK NEDEN: Et gramajı bir option_group DEĞİL — products.gramaj_options
 * JSON kolonunda duruyor ve ProductDetailScreen onu "sanal şablon"
 * (template_id: 0) olarak işleyip ZORUNLU sayıyor (yıldızlı etiket + eksikse
 * sepete eklemeyi bloke eden kontrol). Buna karşılık hızlı "+" butonları
 * YALNIZCA option_group'lara bakıyordu:
 *
 *     const hasRequired = groups.some(g => g.isRequired)
 *     if (hasRequired) → ProductDetail'e git
 *     addItem(product, {}, 1)          ← gramaj HİÇ sorulmadan sepete
 *
 * Zorunlu option_group'u olmayan ama gramajı olan ürünlerde (ör. "Basmati
 * Üzeri Tavuk Fileto ve Brokoli") bu dal seçim hiç sorulmadan çalışıyordu.
 * Sonuç: sepet kalemi gramajsız → sunucu fiyatı yeniden hesaplarken
 * modifikatör 0 → müşteri varsayılan gramajın ücretini ödüyor ve mutfağa
 * giden siparişte de gramaj bilgisi bulunmuyor.
 *
 * Kural: seçim gerektiren HER ŞEY (zorunlu option_group VEYA gramaj)
 * ürün detayına yönlendirir. Detay ekranı zaten tek doğru seçim yeri.
 */

/** ProductDetailScreen ile AYNI filtre: adı boş olan gramaj satırı yok sayılır. */
export function hasGramajChoice(gramajOptions: unknown): boolean {
  if (!Array.isArray(gramajOptions)) return false;
  return gramajOptions.some((g) => {
    const row = (g ?? {}) as Record<string, unknown>;
    return String(row.name ?? '').trim().length > 0;
  });
}

/** Zorunlu option_group var mı? minSelection > 0 da pratikte zorunludur. */
export function hasRequiredOptionGroup(groups: readonly OptionGroup[] | null | undefined): boolean {
  if (!Array.isArray(groups)) return false;
  return groups.some((g) => Boolean(g?.isRequired) || Number(g?.minSelection) > 0);
}

/**
 * Hızlı ekleme yerine ürün detayına gitmeli mi?
 *
 * `optionGroups` verilmezse (henüz çekilmediyse) yalnız gramaj kontrol edilir —
 * bu sayede gramajlı ürünlerde ağ isteği BEKLENMEDEN doğrudan detaya
 * gidilebiliyor.
 */
export function needsOptionSelection(input: {
  gramajOptions?: unknown;
  optionGroups?: readonly OptionGroup[] | null;
}): boolean {
  return hasGramajChoice(input.gramajOptions) || hasRequiredOptionGroup(input.optionGroups);
}
