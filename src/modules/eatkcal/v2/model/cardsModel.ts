// eatkcal v2 (G15-S5 md.1) — kayıtlı kart satırı metinleri (SAF; birim testli).
// Final (FinPrCards): başlık "Kart •••• 1234", alt satır "Varsayılan · AA/YY".
// Son kullanma tarihi SavedCard verisinde YOK (src/lib/cards.ts) → gösterilmez.
// Kullanıcının PaynKolay'da verdiği ad / banka-marka varsa "Kart" yerine o yazılır
// (bugünkü SavedCardsScreen.cardTitle ile aynı öncelik).
import type { SavedCard } from '../../../../lib/cards';

type T = (key: string, vars?: Record<string, string | number>) => string;

export function cardName(card: Pick<SavedCard, 'card_alias' | 'bank_name' | 'brand'>, t: T): string {
  const alias = card.card_alias?.trim();
  if (alias) return alias;
  const brand = card.brand?.trim();
  const bank = card.bank_name?.trim();
  if (bank && brand) return `${bank} ${brand}`;
  return bank || brand || t('eatkcal.v2.cards.card');
}

export function cardTitle(card: Pick<SavedCard, 'card_alias' | 'bank_name' | 'brand' | 'last4'>, t: T): string {
  return `${cardName(card, t)} •••• ${card.last4 ?? '----'}`;
}

export function cardSubtitle(card: Pick<SavedCard, 'is_default'>, t: T): string {
  return card.is_default ? t('eatkcal.v2.cards.default') : '';
}
