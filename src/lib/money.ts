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

/**
 * G18 (İlter 8 Kas) — Final fiyat biçimi, yeni arayüzün TEK kaynağı:
 * `285 TL`, `285,50 TL` (ondalık virgül, binlik nokta ayracı YOK, ₺ YOK).
 * EN arayüzde de aynı. Eski (bayrak kapalı) ekranlar `tl`'yi kullanmaya devam eder.
 */
export const formatPrice = (value: number): string => {
  const n = Math.round((Number(value) || 0) * 100) / 100;
  const abs = Math.abs(n);
  const body = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace('.', ',');
  return `${n < 0 ? '-' : ''}${body} ${PARA_BIRIMI}`;
};

/** `+150 TL` / `-20 TL` / `+12,50 TL` — seçenek farkı, indirim satırı. */
export const formatPriceDelta = (value: number): string => {
  const n = Number(value) || 0;
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${formatPrice(Math.abs(n))}`;
};

/** Hazır metindeki `tl()` çıktılarını (`300.00 TL`) `formatPrice` biçimine çevirir; binlikli `1.250 TL` dokunulmaz. */
export const reformatLegacyTl = (text: string): string =>
  text.replace(/(^|[^\d.])(\d+)\.(\d{1,2}) TL/g, (_m, pre: string, i: string, d: string) => `${pre}${formatPrice(Number(`${i}.${d}`))}`);
