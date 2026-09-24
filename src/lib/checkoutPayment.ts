// Sipariş Özeti'ndeki "Ödeme Yöntemi" kartının saf (React/RN'siz) mantığı —
// birim testlenebilsin diye CheckoutScreen'den ayrı.

export type PayCardLike = { id: string; is_default?: boolean | null };

/** Kayıtlı kart varsa varsayılan (yoksa ilk) kart ÖNCEDEN seçili gelir; yoksa null = "yeni kart". */
export function pickInitialCardId(cards: PayCardLike[]): string | null {
  if (cards.length === 0) return null;
  return (cards.find((c) => c.is_default) ?? cards[0]).id;
}

/**
 * Kart listesi YENİDEN yüklendiğinde seçimi çözer.
 *
 * 24.09.2026: liste artık birden fazla kez yüklenebiliyor ("Tekrar dene",
 * ekrana geri dönüş). Her yüklemede pickInitialCardId'ye dönmek kullanıcının
 * elle yaptığı seçimi sessizce varsayılana geri alırdı. Kural: önceki seçim
 * hâlâ listedeyse KORUNUR; değilse (kart silinmiş, başka hesap) ilk yükleme
 * mantığına düşülür.
 *
 * `previous === null` "yeni kart" demek ve bu da bilinçli bir seçim olabilir —
 * ama ilk yüklemede de null olduğu için ayırt edilemiyor; bu yüzden null'da
 * ilk yükleme mantığı uygulanır.
 */
export function resolveSelectedCardId(
  previous: string | null,
  cards: PayCardLike[],
): string | null {
  if (previous && cards.some((c) => c.id === previous)) return previous;
  return pickInitialCardId(cards);
}

export type PaymentNavParams = {
  payMode?: 'saved_card' | 'new_card';
  cardId?: string;
  saveCard?: boolean;
};

/**
 * PaymentScreen'e geçirilecek yöntem parametreleri. Kart özelliği kapalıysa
 * (allowlist dışı) HİÇBİR şey eklenmez → mevcut akış birebir aynı kalır.
 *
 * `saveCard` artık HER ZAMAN true: bu bayrak yalnızca PaynKolay'a customerKey
 * gönderilip gönderilmeyeceğini belirliyor. Kartın gerçekten saklanması için
 * kullanıcının PaynKolay sayfasında "Öde ve Kartı Kayıt Et" butonuna basması
 * gerekiyor (backend, ödeme sonrası PaynKolay'daki kart listesini TranId ile
 * sorgulayıp aynalıyor — bkz. _shared/paynkolay-cards.ts::saveCardFromTranId).
 *
 * ESKİ DAVRANIŞ (hata): app'teki onay kutusu işaretsizken customerKey boş
 * gidiyordu; kullanıcı PaynKolay'da "Öde ve Kartı Kayıt Et"e bassa bile kart
 * SESSİZCE kaydedilmiyordu. İki ayrı onay noktası birbiriyle çelişiyordu.
 */
export function buildPaymentNavParams(input: {
  cardsEnabled: boolean;
  selectedCardId: string | null;
}): PaymentNavParams {
  if (!input.cardsEnabled) return {};
  if (input.selectedCardId) return { payMode: 'saved_card', cardId: input.selectedCardId };
  return { payMode: 'new_card', saveCard: true };
}

/** Ana buton: kayıtlı kart seçiliyse "Siparişi Ver" (doğrudan 3D), yoksa "Ödemeye Geç" (PaynKolay sayfası). */
export function paymentActionVerb(input: {
  cardsEnabled: boolean;
  selectedCardId: string | null;
}): 'Siparişi Ver' | 'Ödemeye Geç' {
  return input.cardsEnabled && input.selectedCardId ? 'Siparişi Ver' : 'Ödemeye Geç';
}
