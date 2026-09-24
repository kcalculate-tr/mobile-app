import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentNavParams, paymentActionVerb, pickInitialCardId, resolveSelectedCardId } from '../checkoutPayment';

test('varsayılan kart ÖNCEDEN seçili gelir', () => {
  assert.equal(pickInitialCardId([{ id: 'a' }, { id: 'b', is_default: true }]), 'b');
});

test('varsayılan yoksa ilk kart; hiç kart yoksa null (yeni kart)', () => {
  assert.equal(pickInitialCardId([{ id: 'a' }, { id: 'b' }]), 'a');
  assert.equal(pickInitialCardId([]), null);
});

test('kart özelliği kapalıysa (allowlist dışı) navigasyon parametresi EKLENMEZ — mevcut akış aynı', () => {
  assert.deepEqual(buildPaymentNavParams({ cardsEnabled: false, selectedCardId: 'a' }), {});
});

test('kayıtlı kart seçiliyse saved_card + cardId, kaydet bayrağı taşınmaz', () => {
  assert.deepEqual(
    buildPaymentNavParams({ cardsEnabled: true, selectedCardId: 'a' }),
    { payMode: 'saved_card', cardId: 'a' },
  );
});

test('yeni kart: customerKey HER ZAMAN gönderilir (saveCard true) — asıl karar PaynKolay sayfasında', () => {
  assert.deepEqual(
    buildPaymentNavParams({ cardsEnabled: true, selectedCardId: null }),
    { payMode: 'new_card', saveCard: true },
  );
});

test('ana buton: kayıtlı kart -> "Siparişi Ver", yeni kart/özellik kapalı -> "Ödemeye Geç"', () => {
  assert.equal(paymentActionVerb({ cardsEnabled: true, selectedCardId: 'a' }), 'Siparişi Ver');
  assert.equal(paymentActionVerb({ cardsEnabled: true, selectedCardId: null }), 'Ödemeye Geç');
  assert.equal(paymentActionVerb({ cardsEnabled: false, selectedCardId: 'a' }), 'Ödemeye Geç');
});

// ── resolveSelectedCardId — 24.09.2026 ──────────────────────────────────────
// Kart listesi artık birden fazla kez yüklenebiliyor ("Tekrar dene", ekrana
// geri dönüş). Bu fonksiyon, yeniden yüklemenin kullanıcının elle yaptığı
// seçimi sessizce ezmemesini garantiler.

test('yeniden yüklemede kullanıcının seçtiği kart KORUNUR (varsayılana dönmez)', () => {
  const kartlar = [{ id: 'a', is_default: true }, { id: 'b' }];
  assert.equal(resolveSelectedCardId('b', kartlar), 'b');
});

test('seçili kart artık listede yoksa varsayılana düşülür', () => {
  const kartlar = [{ id: 'a' }, { id: 'b', is_default: true }];
  assert.equal(resolveSelectedCardId('silinmis-kart', kartlar), 'b');
});

test('ilk yüklemede (önceki seçim yok) varsayılan kart seçilir', () => {
  assert.equal(resolveSelectedCardId(null, [{ id: 'a' }, { id: 'b', is_default: true }]), 'b');
});

test('hiç kayıtlı kart yoksa "yeni kart" (null) kalır', () => {
  assert.equal(resolveSelectedCardId('a', []), null);
  assert.equal(resolveSelectedCardId(null, []), null);
});

test('kayıtlı kart listesi boş dönse bile yeni-kart yolu geçerli parametre üretir', () => {
  // Bu, "liste alınamadı ama özellik açık" durumunun sözleşmesi: bölüm
  // görünmeye devam eder ve ödeme yeni kartla tamamlanabilir.
  assert.deepEqual(
    buildPaymentNavParams({ cardsEnabled: true, selectedCardId: resolveSelectedCardId(null, []) }),
    { payMode: 'new_card', saveCard: true },
  );
  assert.equal(
    paymentActionVerb({ cardsEnabled: true, selectedCardId: resolveSelectedCardId(null, []) }),
    'Ödemeye Geç',
  );
});
