// Sipariş Özeti'ndeki "Ödeme Yöntemi" kartının saf (React/RN'siz) mantığı —
// birim testlenebilsin diye CheckoutScreen'den ayrı.

export type PayCardLike = { id: string; is_default?: boolean | null };

/** Kayıtlı kart varsa varsayılan (yoksa ilk) kart ÖNCEDEN seçili gelir; yoksa null = "yeni kart". */
export function pickInitialCardId(cards: PayCardLike[]): string | null {
  if (cards.length === 0) return null;
  return (cards.find((c) => c.is_default) ?? cards[0]).id;
}

export type PaymentNavParams = {
  payMode?: 'saved_card' | 'new_card';
  cardId?: string;
  saveCard?: boolean;
};

/**
 * PaymentScreen'e geçirilecek yöntem parametreleri. Kart özelliği kapalıysa
 * (allowlist dışı) HİÇBİR şey eklenmez → mevcut akış birebir aynı kalır.
 */
export function buildPaymentNavParams(input: {
  cardsEnabled: boolean;
  selectedCardId: string | null;
  saveNewCard: boolean;
}): PaymentNavParams {
  if (!input.cardsEnabled) return {};
  if (input.selectedCardId) return { payMode: 'saved_card', cardId: input.selectedCardId };
  return { payMode: 'new_card', saveCard: input.saveNewCard };
}

/** Ana buton: kayıtlı kart seçiliyse "Siparişi Ver" (doğrudan 3D), yoksa "Ödemeye Geç" (PaynKolay sayfası). */
export function paymentActionVerb(input: {
  cardsEnabled: boolean;
  selectedCardId: string | null;
}): 'Siparişi Ver' | 'Ödemeye Geç' {
  return input.cardsEnabled && input.selectedCardId ? 'Siparişi Ver' : 'Ödemeye Geç';
}
