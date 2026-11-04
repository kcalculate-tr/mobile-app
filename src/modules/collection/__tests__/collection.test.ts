// Tabak koleksiyonu SAF testleri (native yok). Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveCards, type PhotoRecord } from '../deriveCards';

const rec = (over: Partial<PhotoRecord> & { id: string }): PhotoRecord => ({
  name: 'Mercimek',
  meal: 'lunch',
  dateISO: '2026-11-04T12:00:00.000Z',
  photoUri: 'https://x/p.jpg',
  kcal: 300,
  ...over,
});

test('deriveCards: yalnız photoUri olan kayıtlar karta dönüşür', () => {
  const cards = deriveCards(
    [
      rec({ id: 'a', photoUri: 'https://x/a.jpg' }),
      rec({ id: 'b', photoUri: null }),
      rec({ id: 'c', photoUri: 'https://x/c.jpg' }),
    ],
    {},
  );
  assert.equal(cards.length, 2);
  assert.deepEqual(cards.map((c) => c.id), ['a', 'c']);
});

test('deriveCards: katalog no kararlı ve known atamalarını yeniden kullanır', () => {
  const records = [
    rec({ id: 'a', name: 'Mercimek' }),
    rec({ id: 'b', name: 'Pilav' }),
  ];
  const known = { Mercimek: 42 };
  const cards = deriveCards(records, known);
  const mercimek = cards.find((c) => c.name === 'Mercimek')!;
  const pilav = cards.find((c) => c.name === 'Pilav')!;
  // known'daki numara aynen kullanılır.
  assert.equal(mercimek.no, 42);
  // Yeni yemek ilk boş numarayı alır (42 kullanımda, 1 boş).
  assert.equal(pilav.no, 1);

  // Deterministik: aynı girişler aynı çıkışı verir.
  const again = deriveCards(records, known);
  assert.deepEqual(
    again.map((c) => ({ id: c.id, no: c.no })),
    cards.map((c) => ({ id: c.id, no: c.no })),
  );
});

test('deriveCards: aynı yemek adı tek numara alır', () => {
  const cards = deriveCards(
    [
      rec({ id: 'a', name: 'Mercimek' }),
      rec({ id: 'b', name: 'Mercimek' }),
    ],
    {},
  );
  assert.equal(cards[0].no, cards[1].no);
});

test('deriveCards: firstTime yalnız yemek adının ilk örneğinde true', () => {
  const cards = deriveCards(
    [
      rec({ id: 'a', name: 'Mercimek' }),
      rec({ id: 'b', name: 'Pilav' }),
      rec({ id: 'c', name: 'Mercimek' }),
    ],
    {},
  );
  assert.equal(cards.find((c) => c.id === 'a')!.firstTime, true);
  assert.equal(cards.find((c) => c.id === 'b')!.firstTime, true);
  assert.equal(cards.find((c) => c.id === 'c')!.firstTime, false);
});

test('deriveCards: sıralama kayıt geliş sırasını korur', () => {
  const cards = deriveCards(
    [
      rec({ id: 'x', name: 'A' }),
      rec({ id: 'y', name: 'B' }),
      rec({ id: 'z', name: 'C' }),
    ],
    {},
  );
  assert.deepEqual(cards.map((c) => c.id), ['x', 'y', 'z']);
});

test('deriveCards: protein/carbs yoksa null olarak doldurulur', () => {
  const [card] = deriveCards([rec({ id: 'a' })], {});
  assert.equal(card.protein_g, null);
  assert.equal(card.carbs_g, null);
});
