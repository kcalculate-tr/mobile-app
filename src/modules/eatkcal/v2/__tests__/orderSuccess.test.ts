import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVerifiedOrder, successEta, RAIN_DOTS } from '../model/orderSuccess';

const TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

test('kutlama yalnız doğrulanmış siparişte (EkPaymentScreen kuralı)', () => {
  assert.equal(isVerifiedOrder({ payment_status: 'paid', status: 'pending' }), true);
  assert.equal(isVerifiedOrder({ status: 'confirmed', payment_status: 'pending' }), true);
  assert.equal(isVerifiedOrder({ status: 'pending_payment', payment_status: 'pending' }), false);
  assert.equal(isVerifiedOrder({ status: 'payment_failed', payment_status: 'failed' }), false);
  assert.equal(isVerifiedOrder(null), false);
  assert.equal(isVerifiedOrder(undefined), false);
});

test('tahmini süre yalnız gerçek veri varsa', () => {
  // hemen teslim: bölge tahmini
  assert.equal(successEta({ delivery_method: 'delivery', delivery_time_type: 'immediate' }, '30-55 dk', TR), '30-55 dk');
  assert.equal(successEta({ delivery_method: 'delivery', delivery_time_type: 'immediate' }, null, TR), null);
  assert.equal(successEta({ delivery_method: 'delivery', delivery_time_type: 'immediate' }, '  ', TR), null);
  // randevulu: gün + dilim
  assert.equal(
    successEta({ delivery_method: 'delivery', delivery_time_type: 'scheduled', scheduled_date: '2026-11-10', scheduled_slot: '12:00-13:00' }, '30-55 dk', TR),
    '10 Kas, 12:00-13:00',
  );
  assert.equal(
    successEta({ delivery_type: 'scheduled', scheduled_date: '2026-11-10', scheduled_time: '12:00:00' }, null, TR),
    '10 Kas, 12:00',
  );
  // Gel-Al ve veri yok
  assert.equal(successEta({ delivery_method: 'pickup' }, '30-55 dk', TR), null);
  assert.equal(successEta({ delivery_time_type: 'scheduled' }, null, TR), null);
  assert.equal(successEta(null, '30-55 dk', TR), null);
});

test('nokta yağmuru Final ile aynı 14 nokta', () => {
  assert.equal(RAIN_DOTS.length, 14);
  assert.ok(RAIN_DOTS.every((d) => d.d >= 6 && d.d <= 11 && d.fall >= 240 && d.fall <= 500));
});
