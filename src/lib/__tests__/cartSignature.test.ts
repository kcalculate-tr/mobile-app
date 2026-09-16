import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCartSignatureLines, computeCartSignature } from '../cartSignature';
import type { CartItem } from '../../types';

// Minimal CartItem fabrikası — testte önemli olmayan alanlar sabit.
const makeItem = (overrides: Partial<CartItem> & Pick<CartItem, 'productId' | 'quantity'>): CartItem => ({
  lineKey: `${overrides.productId}-${Math.random()}`,
  name: 'Test Ürün',
  unitPrice: 450,
  selectedOptions: { byGroup: {}, extraPrice: 0, labels: [] },
  ...overrides,
});

const baseCtx = {
  couponCode: null,
  addressId: 'addr-1',
  deliveryMethod: 'delivery',
  deliveryType: 'immediate',
  scheduledDate: null,
  scheduledTime: null,
};

test('aynı fiyatlı farklı ürün değişimi (Tavuk Fileto <-> Tavuk Sote, ikisi de 450 TL) -> farklı imza', () => {
  const before = computeCartSignature(
    buildCartSignatureLines([makeItem({ productId: '6', quantity: 1 })]), // Tavuk Fileto
    baseCtx,
  );
  const after = computeCartSignature(
    buildCartSignatureLines([makeItem({ productId: '7', quantity: 1 })]), // Tavuk Sote, aynı fiyat
    baseCtx,
  );
  assert.notEqual(before, after, 'aynı fiyatlı farklı ürün aynı imzayı üretmemeli');
});

test('sadece randevu saati değişimi -> farklı imza', () => {
  const lines = buildCartSignatureLines([makeItem({ productId: '6', quantity: 1 })]);
  const before = computeCartSignature(lines, { ...baseCtx, deliveryType: 'scheduled', scheduledDate: '2026-09-20', scheduledTime: '13:30' });
  const after = computeCartSignature(lines, { ...baseCtx, deliveryType: 'scheduled', scheduledDate: '2026-09-20', scheduledTime: '14:00' });
  assert.notEqual(before, after, 'farklı randevu saati aynı imzayı üretmemeli');
});

test('aynı sepet, farklı ürün sırası -> aynı imza', () => {
  const a = computeCartSignature(
    buildCartSignatureLines([
      makeItem({ productId: '6', quantity: 1 }),
      makeItem({ productId: '7', quantity: 2 }),
    ]),
    baseCtx,
  );
  const b = computeCartSignature(
    buildCartSignatureLines([
      makeItem({ productId: '7', quantity: 2 }),
      makeItem({ productId: '6', quantity: 1 }),
    ]),
    baseCtx,
  );
  assert.equal(a, b, 'ürün sırası imzayı etkilememeli');
});

test('DB\'den gelen HH:MM:SS ile istemcinin HH:MM aynı saat için eşleşmeli', () => {
  const lines = buildCartSignatureLines([makeItem({ productId: '6', quantity: 1 })]);
  const client = computeCartSignature(lines, { ...baseCtx, scheduledTime: '13:30' });
  const fromDb = computeCartSignature(lines, { ...baseCtx, scheduledTime: '13:30:00' });
  assert.equal(client, fromDb, 'saniye eklenmesi imzayı değiştirmemeli');
});

test('seçili opsiyon değişimi -> farklı imza (aynı ürün, aynı adet)', () => {
  const withOptionA = computeCartSignature(
    buildCartSignatureLines([
      makeItem({
        productId: '6',
        quantity: 1,
        selected_options: [{ template_id: 1, value_id: 10, template_name: '', value_name: '', price_modifier: 0, calorie_modifier: 0, protein_modifier: 0, carbs_modifier: 0, fats_modifier: 0 }],
      }),
    ]),
    baseCtx,
  );
  const withOptionB = computeCartSignature(
    buildCartSignatureLines([
      makeItem({
        productId: '6',
        quantity: 1,
        selected_options: [{ template_id: 1, value_id: 11, template_name: '', value_name: '', price_modifier: 0, calorie_modifier: 0, protein_modifier: 0, carbs_modifier: 0, fats_modifier: 0 }],
      }),
    ]),
    baseCtx,
  );
  assert.notEqual(withOptionA, withOptionB, 'farklı opsiyon seçimi aynı imzayı üretmemeli');
});

test('kupon değişimi -> farklı imza', () => {
  const lines = buildCartSignatureLines([makeItem({ productId: '6', quantity: 1 })]);
  const noCoupon = computeCartSignature(lines, baseCtx);
  const withCoupon = computeCartSignature(lines, { ...baseCtx, couponCode: 'INDIRIM10' });
  assert.notEqual(noCoupon, withCoupon, 'kupon eklenmesi imzayı değiştirmeli');
});

test('adres değişimi -> farklı imza', () => {
  const lines = buildCartSignatureLines([makeItem({ productId: '6', quantity: 1 })]);
  const addr1 = computeCartSignature(lines, { ...baseCtx, addressId: 'addr-1' });
  const addr2 = computeCartSignature(lines, { ...baseCtx, addressId: 'addr-2' });
  assert.notEqual(addr1, addr2, 'farklı adres aynı imzayı üretmemeli');
});
