// İstemci savunması: WebView'e SADECE render edilebilir bir HTML/form verilir.
// Sunucudan (ya da bir hata sonucu) ham JSON/düz metin gelirse ASLA gösterilmez.

const HTML_HINT = /<\s*(form|html|body|script|iframe|meta)\b/i;

export function toRenderableFormHtml(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t.startsWith('<')) return null; // '{', '[', düz metin -> reddet
  return HTML_HINT.test(t) ? t : null;
}

export const PAYMENT_PAGE_ERROR_MESSAGE =
  'Ödeme sayfası açılamadı. Lütfen tekrar deneyin ya da yeni kart ile ödeyin.';
