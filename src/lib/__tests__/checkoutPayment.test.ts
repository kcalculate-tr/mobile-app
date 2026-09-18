import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentNavParams, paymentActionVerb, pickInitialCardId } from '../checkoutPayment';

test('varsayılan kart ÖNCEDEN seçili gelir', () => {
  assert.equal(pickInitialCardId([{ id: 'a' }, { id: 'b', is_default: true }]), 'b');
});

test('varsayılan yoksa ilk kart; hiç kart yoksa null (yeni kart)', () => {
  assert.equal(pickInitialCardId([{ id: 'a' }, { id: 'b' }]), 'a');
  assert.equal(pickInitialCardId([]), null);
});

test('kart özelliği kapalıysa (allowlist dışı) navigasyon parametresi EKLENMEZ — mevcut akış aynı', () => {
  assert.deepEqual(buildPaymentNavParams({ cardsEnabled: false, selectedCardId: 'a', saveNewCard: true }), {});
});

test('kayıtlı kart seçiliyse saved_card + cardId, kaydet bayrağı taşınmaz', () => {
  assert.deepEqual(
    buildPaymentNavParams({ cardsEnabled: true, selectedCardId: 'a', saveNewCard: true }),
    { payMode: 'saved_card', cardId: 'a' },
  );
});

test('yeni kart: onay kutusu varsayılan işaretsiz -> saveCard false; işaretliyse true', () => {
  assert.deepEqual(
    buildPaymentNavParams({ cardsEnabled: true, selectedCardId: null, saveNewCard: false }),
    { payMode: 'new_card', saveCard: false },
  );
  assert.deepEqual(
    buildPaymentNavParams({ cardsEnabled: true, selectedCardId: null, saveNewCard: true }),
    { payMode: 'new_card', saveCard: true },
  );
});

test('ana buton: kayıtlı kart -> "Siparişi Ver", yeni kart/özellik kapalı -> "Ödemeye Geç"', () => {
  assert.equal(paymentActionVerb({ cardsEnabled: true, selectedCardId: 'a' }), 'Siparişi Ver');
  assert.equal(paymentActionVerb({ cardsEnabled: true, selectedCardId: null }), 'Ödemeye Geç');
  assert.equal(paymentActionVerb({ cardsEnabled: false, selectedCardId: 'a' }), 'Ödemeye Geç');
});
