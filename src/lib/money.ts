/**
 * Para biçimlendirmenin TEK kaynağı.
 *
 * 24.09.2026: uygulama genelinde ₺ işareti tutarın BAŞINA yazılıyordu
 * (`585.00 TL`) ve 27 dosyada 66 ayrı yerde elle kuruluyordu. Türkçe kullanımda
 * doğru biçim tutarın SONUNDA para birimi — `585.00 TL`. Biçim artık burada
 * tanımlı; yeni bir ekran para yazdıracağında buradan geçmeli.
 *
 * NOT: ondalık ayracı bilinçli olarak DEĞİŞTİRİLMEDİ. Çağrı yerleri nokta
 * kullanıyordu; bunu virgüle çevirmek ayrı bir karar (tüm tutarların görünümü
 * değişir) ve bu değişikliğin kapsamında değil.
 */

export const PARA_BIRIMI = 'TL';

/** `585.00 TL` — varsayılan iki ondalık. */
export const tl = (value: number, ondalik = 2): string =>
  `${(Number(value) || 0).toFixed(ondalik)} ${PARA_BIRIMI}`;

/** `1.250 TL` — binlik ayraçlı, ondalıksız (eşik/limit metinleri için). */
export const tlGruplu = (value: number, ondalik = 0): string =>
  `${(Number(value) || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: ondalik,
    maximumFractionDigits: ondalik,
  })} ${PARA_BIRIMI}`;

/** `+120 TL` / `-120 TL` — modifikatör ve indirim rozetleri için. */
export const tlFark = (value: number, ondalik = 0): string => {
  const n = Number(value) || 0;
  const isaret = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${isaret}${Math.abs(n).toFixed(ondalik)} ${PARA_BIRIMI}`;
};
