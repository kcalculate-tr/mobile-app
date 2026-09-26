import test from 'node:test';
import assert from 'node:assert/strict';
import { adisyoEtiketleri, fisNotu } from '../../../supabase/functions/_shared/adisyo-labels';

// Aşağıdaki iki kalem CANLI veritabanından alındı (26.09.2026).

/** KCAL-Q112 — gramaj seçilmiş; ESKİ KODDA fişe hiç düşmüyordu. */
const gramajliKalem = {
  selected_options: [
    { value_id: 1, value_name: '200g', template_id: 0, template_name: 'Et Gramajı',
      price_modifier: 90, calorie_modifier: 55, protein_modifier: 12,
      carbs_modifier: 0, fats_modifier: 1 },
  ],
  legacy_selected_options: {
    labels: [],
    byGroup: {},
    extraPrice: 0,
    templateOptions: [
      { value_id: 1, value_name: '200g', template_id: 0, template_name: 'Et Gramajı' },
    ],
  },
};

/** KCAL-D440 — bundle; grup seçimleri zaten gidiyordu, bozulmamalı. */
const bundleKalem = {
  selected_options: [],
  legacy_selected_options: {
    labels: [
      'Yumurta Seçimi: 3 Yumurta',
      'Hindi Füme Seçimi: Hindi Füme 100g',
      'Ekstra Detoks Tercihi: Yeşil Canlandırıcı Detoks (330ml)',
    ],
    byGroup: {},
    extraPrice: 385,
  },
};

/** KCAL-T129 — seçimsiz ürün. */
const sadeKalem = {
  selected_options: [],
  legacy_selected_options: { labels: [], byGroup: {}, extraPrice: 0 },
};

test('GERÇEK HATA: gramaj artık fişe düşüyor (KCAL-Q112)', () => {
  assert.deepEqual(adisyoEtiketleri(gramajliKalem), ['Et Gramajı: 200g']);
  assert.equal(fisNotu(adisyoEtiketleri(gramajliKalem)), '200g');
});

test('eski mantık aynı kalemde BOŞ dönüyordu — regresyon kanıtı', () => {
  const eski =
    (gramajliKalem.selected_options as any)?.labels
    ?? gramajliKalem.legacy_selected_options?.labels
    ?? [];
  assert.deepEqual(eski, [], 'eski kod boş etiket üretiyordu');
});

test('bundle grup seçimleri bozulmadı (KCAL-D440)', () => {
  assert.deepEqual(adisyoEtiketleri(bundleKalem), [
    'Yumurta Seçimi: 3 Yumurta',
    'Hindi Füme Seçimi: Hindi Füme 100g',
    'Ekstra Detoks Tercihi: Yeşil Canlandırıcı Detoks (330ml)',
  ]);
  assert.equal(
    fisNotu(adisyoEtiketleri(bundleKalem)),
    '3 Yumurta | Hindi Füme 100g | Yeşil Canlandırıcı Detoks (330ml)',
  );
});

test('seçimsiz üründe not yazılmaz (KCAL-T129)', () => {
  assert.deepEqual(adisyoEtiketleri(sadeKalem), []);
  assert.equal(fisNotu(adisyoEtiketleri(sadeKalem)), null);
});

test('gramaj + grup birlikteyse gramaj ÖNCE gelir', () => {
  const kalem = {
    selected_options: [{ template_name: 'Et Gramajı', value_name: '180g' }],
    legacy_selected_options: { labels: ['Baz Seçimi: Basmati'] },
  };
  assert.deepEqual(adisyoEtiketleri(kalem), ['Et Gramajı: 180g', 'Baz Seçimi: Basmati']);
  assert.equal(fisNotu(adisyoEtiketleri(kalem)), '180g | Basmati');
});

test('eski nesne şekli ({labels}) hâlâ okunuyor', () => {
  const kalem = { selected_options: { labels: ['Baz Seçimi: Bulgur'] } };
  assert.deepEqual(adisyoEtiketleri(kalem), ['Baz Seçimi: Bulgur']);
});

test('şablon adı yoksa yalnız değer yazılır', () => {
  assert.deepEqual(
    adisyoEtiketleri({ selected_options: [{ value_name: '250g' }] }),
    ['250g'],
  );
});

test('bozuk/eksik veriye dayanıklı', () => {
  assert.deepEqual(adisyoEtiketleri({}), []);
  assert.deepEqual(adisyoEtiketleri({ selected_options: null, legacy_selected_options: null }), []);
  assert.deepEqual(
    adisyoEtiketleri({ selected_options: [{ value_name: '  ' }, { value_name: null }] }),
    [],
  );
  assert.deepEqual(
    adisyoEtiketleri({ legacy_selected_options: { labels: ['', '  ', 'Geçerli'] } }),
    ['Geçerli'],
  );
});
