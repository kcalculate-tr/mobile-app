// eatkcal v2 (G15-S5 md.1) — FinPrCards satır metinleri.
// Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { cardName, cardSubtitle, cardTitle } from '../model/cardsModel';

const t = (k: string) => (k === 'eatkcal.v2.cards.card' ? 'Kart' : k === 'eatkcal.v2.cards.default' ? 'Varsayılan' : k);

test('kart adı: alias önce, sonra banka + marka, sonra "Kart"', () => {
  assert.equal(cardName({ card_alias: ' Enpara ', bank_name: 'X', brand: 'Visa' }, t), 'Enpara');
  assert.equal(cardName({ card_alias: null, bank_name: 'Garanti', brand: 'Bonus' }, t), 'Garanti Bonus');
  assert.equal(cardName({ card_alias: null, bank_name: null, brand: 'Visa' }, t), 'Visa');
  assert.equal(cardName({ card_alias: '', bank_name: null, brand: null }, t), 'Kart');
});

test('başlık maskeli son 4; son 4 yoksa ----', () => {
  assert.equal(cardTitle({ card_alias: null, bank_name: null, brand: null, last4: '4242' }, t), 'Kart •••• 4242');
  assert.equal(cardTitle({ card_alias: null, bank_name: null, brand: null, last4: null }, t), 'Kart •••• ----');
});

test('alt satır yalnız varsayılan kartta', () => {
  assert.equal(cardSubtitle({ is_default: true }, t), 'Varsayılan');
  assert.equal(cardSubtitle({ is_default: false }, t), '');
});
