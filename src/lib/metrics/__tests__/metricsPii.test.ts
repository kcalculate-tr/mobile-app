// G19-S3 md.5 — PII beyaz liste testi: kişisel veri hiçbir yoldan props'a giremez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { coerceProp, droppedKeys, looksPersonal, sanitizeProps } from '../sanitize';
import { EVENT_NAMES, eventDef } from '../events';

test('beyaz listede olmayan anahtarlar düşer (ad, e-posta, telefon, adres, konum, not)', () => {
  const props = {
    product_id: '42',
    price: 285,
    email: 'ali@example.com',
    phone: '+90 532 111 22 33',
    address: 'Kıbrıs Şehitleri Cd. No 12',
    full_name: 'Ali Veli',
    lat: 38.43,
    lng: 27.14,
    note: 'kapıya bırak',
    user_id: 'u-1',
  };
  const clean = sanitizeProps('add_to_cart', props);
  assert.deepEqual(clean, { product_id: '42', price: 285 });
  assert.deepEqual(droppedKeys('add_to_cart', props).sort(), ['address', 'email', 'full_name', 'lat', 'lng', 'note', 'phone', 'user_id'].sort());
});

test('beyaz listedeki metin alanına kişisel veri yazılırsa değer düşer', () => {
  assert.deepEqual(sanitizeProps('welcome_skip_click', { source: 'ali@example.com' }), {});
  assert.deepEqual(sanitizeProps('welcome_skip_click', { source: '0532 111 22 33' }), {});
  assert.deepEqual(sanitizeProps('welcome_skip_click', { source: '+90 (532) 111-22-33' }), {});
  assert.deepEqual(sanitizeProps('welcome_skip_click', { source: '12345678901' }), {}); // TCKN biçimi
  assert.deepEqual(sanitizeProps('welcome_skip_click', { source: '4111 1111 1111 1111' }), {}); // kart
  assert.deepEqual(sanitizeProps('welcome_skip_click', { source: 'TR33 0006 1005 1978 6457 8413 26' }), {});
  assert.deepEqual(sanitizeProps('welcome_skip_click', { source: '38.4237, 27.1428' }), {}); // koordinat
  assert.deepEqual(sanitizeProps('welcome_skip_click', { source: 'home' }), { source: 'home' });
});

test('id alanı: uzun salt-rakam (telefon/TCKN) ve boşluklu değer düşer; kısa sipariş no geçer', () => {
  assert.equal(coerceProp('id', 5321112233), null);
  assert.equal(coerceProp('id', '05321112233'), null);
  assert.equal(coerceProp('id', 'ali veli'), null);
  assert.equal(coerceProp('id', 1042), '1042');
  assert.equal(coerceProp('id', '3f2a9c1e-7b1d-4c3e-9a55-0d2f6e1b8c77'), '3f2a9c1e-7b1d-4c3e-9a55-0d2f6e1b8c77');
});

test('url alanı: sorgu dizesi/parça atılır (token, e-posta sızmaz)', () => {
  const clean = sanitizeProps('banner_click', { banner_id: 'b1', deeplink: 'kcal://kampanya/yaz?email=a@b.co&token=xyz#frag' });
  assert.deepEqual(clean, { banner_id: 'b1', deeplink: 'kcal://kampanya/yaz' });
});

test('kod alanı büyük harfe çevrilir, biçim dışı kod düşer', () => {
  assert.deepEqual(sanitizeProps('coupon_apply', { code: ' yaz25 ', ok: true }), { code: 'YAZ25', ok: true });
  assert.deepEqual(sanitizeProps('coupon_apply', { code: 'ali@x.com', ok: false }), { ok: false });
});

test('tür uyuşmazlığı düşer; enum dışı değer düşer; sayı yuvarlanır', () => {
  assert.deepEqual(sanitizeProps('app_open', { cold: 'yes', first: true }), { first: true });
  assert.deepEqual(sanitizeProps('signup', { method: 'facebook' }), {});
  assert.deepEqual(sanitizeProps('signup', { method: 'apple' }), { method: 'apple' });
  assert.deepEqual(sanitizeProps('add_to_cart', { price: 285.505, quantity: Infinity }), { price: 285.51 });
});

test('nesne/dizi değerleri (iç içe veri) hiçbir alanda kabul edilmez', () => {
  for (const n of EVENT_NAMES) {
    const def = eventDef(n)!;
    const props: Record<string, unknown> = {};
    for (const k of Object.keys(def.props)) props[k] = { email: 'a@b.co' };
    assert.deepEqual(sanitizeProps(n, props), {}, n);
  }
});

test('metin alanı 64 karakterle sınırlı', () => {
  const s = sanitizeProps('welcome_skip_click', { source: 'x'.repeat(200) });
  assert.equal(String(s.source).length, 64);
});

test('looksPersonal: olağan ürün/kategori adlarında yanlış alarm yok', () => {
  for (const v of ['Tavuklu Bowl 450 g', 'Somon Salata', 'protein-bar', 'KCAL-1042', 'v1.0.8', '2026-11-09']) {
    assert.equal(looksPersonal(v), false, v);
  }
});

test('bilinmeyen olay adı: props tamamen boş', () => {
  assert.deepEqual(sanitizeProps('bilinmeyen_olay', { a: 1 }), {});
});
