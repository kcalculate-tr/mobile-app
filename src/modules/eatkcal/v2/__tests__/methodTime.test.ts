// G17-S1 md.6 — Yöntem ve zaman önceden seçili gelmez; ikisi seçilmeden "Öde" pasif;
// geçersizleşen zaman yeniden istenir. SAF. Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { methodTimeState, type MethodTimeInput } from '../model/methodTime';

const base: MethodTimeInput = {
  pickedMethod: null,
  pickedTime: null,
  deliveryMethod: 'home_delivery', // useEkCheckout varsayılanı (değişmedi)
  deliveryTimeType: 'immediate',
  rulesSettled: true,
  canPickImmediate: true,
  canPickScheduled: true,
  hasScheduledDate: false,
  hasOpenSlot: false,
};

test('açılışta hiçbir şey seçili değil → Öde pasif (mantık varsayılanı home_delivery+immediate olsa bile)', () => {
  const s = methodTimeState(base);
  assert.equal(s.methodReady, false);
  assert.equal(s.ready, false);
});

test('yalnız yöntem seçildi → hâlâ pasif; zaman da seçilince etkin', () => {
  assert.equal(methodTimeState({ ...base, pickedMethod: 'home_delivery' }).ready, false);
  assert.equal(methodTimeState({ ...base, pickedMethod: 'home_delivery', pickedTime: 'immediate' }).ready, true);
});

test('Gel-Al: zaman seçimi gerekmez', () => {
  const s = methodTimeState({ ...base, pickedMethod: 'pickup', deliveryMethod: 'pickup' });
  assert.equal(s.ready, true);
});

test('ileri tarih: gün + açık dilim olmadan pasif', () => {
  const i = { ...base, pickedMethod: 'home_delivery' as const, pickedTime: 'scheduled' as const, deliveryTimeType: 'scheduled' as const };
  assert.equal(methodTimeState(i).ready, false);
  assert.equal(methodTimeState({ ...i, hasScheduledDate: true }).ready, false);
  assert.equal(methodTimeState({ ...i, hasScheduledDate: true, hasOpenSlot: true }).ready, true);
});

test('geçersizleşen zaman: "Hemen" kapandı → seçim düşer (timeStillValid=false), yeniden istenir', () => {
  const s = methodTimeState({ ...base, pickedMethod: 'home_delivery', pickedTime: 'immediate', canPickImmediate: false });
  assert.equal(s.timeStillValid, false);
  assert.equal(s.ready, false);
});

test('mantık zaman türünü kendisi değiştirdi (dükkân kapalı → scheduled) → seçim geçersiz', () => {
  const s = methodTimeState({ ...base, pickedMethod: 'home_delivery', pickedTime: 'immediate', deliveryTimeType: 'scheduled' });
  assert.equal(s.timeStillValid, false);
  assert.equal(s.ready, false);
});

test('kurallar henüz yüklenmediyse (rulesSettled=false) seçim geçerli sayılır', () => {
  const s = methodTimeState({ ...base, pickedMethod: 'home_delivery', pickedTime: 'immediate', rulesSettled: false, canPickImmediate: false });
  assert.equal(s.ready, true);
});
