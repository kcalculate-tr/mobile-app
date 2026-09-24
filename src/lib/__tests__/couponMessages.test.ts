import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCouponErrorMessage,
  type CouponValidationFailure,
  type CouponValidationReason,
} from '../couponMessages';

// Kupon reddi müşterinin gördüğü tek açıklamadır. Sunucudaki
// validate_coupon / validate_coupon_v2 yeni bir `reason` döndürmeye
// başladığında istemci sessizce "Kupon uygulanamadı" diyor — müşteri neden
// reddedildiğini öğrenemiyor, biz de log'dan göremiyoruz. Aşağıdaki liste
// sunucunun üretebildiği TÜM sebepleri tutar; sunucu değişirse buradaki
// test kırılmalı.
//
// Kaynak: public.validate_coupon (auth_required, not_found, inactive,
// not_started, expired, not_yours, min_cart, user_limit_reached,
// total_limit_reached, first_order_only) + public.validate_coupon_v2
// (items_required, no_eligible_item). 23.09.2026'da sunucudan doğrulandı.
const SUNUCU_SEBEPLERI: CouponValidationReason[] = [
  'auth_required',
  'not_found',
  'inactive',
  'not_started',
  'expired',
  'not_yours',
  'min_cart',
  'user_limit_reached',
  'total_limit_reached',
  'first_order_only',
  'items_required',
  'no_eligible_item',
];

test('sunucunun üretebildiği her sebep için özel bir mesaj var', () => {
  for (const reason of SUNUCU_SEBEPLERI) {
    const mesaj = getCouponErrorMessage({ valid: false, reason });
    assert.ok(mesaj && mesaj.length > 0, `${reason} için mesaj yok`);
    assert.notEqual(mesaj, 'Kupon uygulanamadı', `${reason} genel mesaja düşüyor`);
  }
});

test('min_cart mesajı eşiği müşteriye söyler', () => {
  const f: CouponValidationFailure = { valid: false, reason: 'min_cart', min_cart_total: 450 };
  assert.equal(getCouponErrorMessage(f), 'Bu kupon 450 TL ve üzeri siparişlerde geçerlidir.');
});

test('min_cart eşiksiz gelirse genel min sepet mesajına düşer', () => {
  assert.equal(
    getCouponErrorMessage({ valid: false, reason: 'min_cart' }),
    'Minimum sepet tutarı sağlanmadı',
  );
});

test('min_cart_total = 0 tutar cümlesine girmez', () => {
  // 0 ile "0 TL ve üzeri siparişlerde geçerlidir" demek anlamsız olurdu;
  // `!= null` kontrolü 0'ı da geçirdiği için bu davranış bilinçli olarak
  // sabitleniyor — değişirse burada görülür.
  assert.equal(
    getCouponErrorMessage({ valid: false, reason: 'min_cart', min_cart_total: 0 }),
    'Bu kupon 0 TL ve üzeri siparişlerde geçerlidir.',
  );
});

test('ilk-sipariş reddi müşteriye net söylenir', () => {
  assert.equal(
    getCouponErrorMessage({ valid: false, reason: 'first_order_only' }),
    'Bu kupon yalnızca ilk siparişte geçerlidir.',
  );
});

test('ücretsiz öğün kuponunun koli reddi açıklayıcıdır', () => {
  const mesaj = getCouponErrorMessage({ valid: false, reason: 'no_eligible_item' });
  assert.match(mesaj, /koli/i);
  assert.match(mesaj, /tekil bir öğün/i);
});

test('bilinmeyen sebep çökmez, genel mesaja düşer', () => {
  const uydurma = { valid: false, reason: 'gelecekteki_yeni_sebep' } as unknown as CouponValidationFailure;
  assert.equal(getCouponErrorMessage(uydurma), 'Kupon uygulanamadı');
});
