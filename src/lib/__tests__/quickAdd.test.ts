import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasGramajChoice, hasRequiredOptionGroup, needsOptionSelection } from '../quickAdd';
import type { OptionGroup } from '../../types';

// 24.09.2026 müşteri bildirimi: gramaj seçimi "varsayılana dönüyor".
// Kök neden hızlı "+" butonunun gramajı hiç sormamasıydı. Bu testler o
// kuralın geri kaymasını engelliyor — kayarsa müşteri yanlış gramajda öğün
// alır ve gramaj farkı (90 TL–175 TL) tahsil edilmez.

const grup = (over: Partial<OptionGroup> = {}): OptionGroup => ({
  id: 'g1', name: 'Sos', description: '', minSelection: 0, maxSelection: 1,
  isRequired: false, sortOrder: 0, items: [], ...over,
});

// ── hasGramajChoice ─────────────────────────────────────────────────────────

test('gramaj seçeneği varsa seçim gerekir', () => {
  assert.equal(hasGramajChoice([{ name: '200g' }, { name: '300g' }]), true);
  // Tek seçenek bile olsa ProductDetail onu zorunlu sayıyor — aynı kural.
  assert.equal(hasGramajChoice([{ name: '200g' }]), true);
});

test('gramaj yoksa / boşsa / adsızsa seçim gerekmez', () => {
  assert.equal(hasGramajChoice([]), false);
  assert.equal(hasGramajChoice(null), false);
  assert.equal(hasGramajChoice(undefined), false);
  // ProductDetailScreen adı boş olan satırı eliyor — burada da elenmeli,
  // yoksa kullanıcı seçecek hiçbir şeyi olmayan bir ekrana yollanır.
  assert.equal(hasGramajChoice([{ name: '' }, { name: '   ' }]), false);
  assert.equal(hasGramajChoice([{}, null]), false);
});

test('gramaj listesi beklenmedik tipteyse çökmez', () => {
  assert.equal(hasGramajChoice('200g'), false);
  assert.equal(hasGramajChoice(42), false);
  assert.equal(hasGramajChoice({ name: '200g' }), false); // dizi değil
});

// ── hasRequiredOptionGroup ──────────────────────────────────────────────────

test('isRequired veya minSelection > 0 zorunludur', () => {
  assert.equal(hasRequiredOptionGroup([grup({ isRequired: true })]), true);
  assert.equal(hasRequiredOptionGroup([grup({ minSelection: 1 })]), true);
  assert.equal(hasRequiredOptionGroup([grup()]), false);
  assert.equal(hasRequiredOptionGroup([]), false);
  assert.equal(hasRequiredOptionGroup(null), false);
});

// ── needsOptionSelection ────────────────────────────────────────────────────

test('ZORUNLU opsiyonu olmayan ama GRAMAJI olan ürün hızlı eklenemez', () => {
  // Asıl hata tam olarak buydu: "Basmati Üzeri Tavuk Fileto ve Brokoli"
  // ürününün zorunlu option_group'u yok, gramajı var; eski kontrol yalnız
  // option_group'a baktığı için ürün gramajsız sepete giriyordu.
  assert.equal(
    needsOptionSelection({ gramajOptions: [{ name: '200g' }, { name: '300g' }], optionGroups: [grup()] }),
    true,
  );
});

test('gramaj tek başına yeterli — opsiyon grupları henüz çekilmemiş olabilir', () => {
  assert.equal(needsOptionSelection({ gramajOptions: [{ name: '200g' }] }), true);
});

test('ne gramaj ne zorunlu grup varsa hızlı ekleme serbest', () => {
  assert.equal(needsOptionSelection({ gramajOptions: [], optionGroups: [grup()] }), false);
  assert.equal(needsOptionSelection({}), false);
});
