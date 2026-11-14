// G48-S1 md.2–4 — eatkcal konum kapısı: SAF kurallar (gateRule).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildDistrictList,
  canSubmit,
  districtMode,
  gateSelectProps,
  gateTarget,
  locationLabel,
  selectionFromGeocode,
  shouldShowGate,
} from '../gateRule';
import { tr, en } from '../i18n';

const ROOT = path.join(__dirname, '../../../../..');
const ZONES = [
  { city: 'İzmir', district: 'Bornova', neighborhood: 'Kazımdirik', is_active: true },
  { city: 'İzmir', district: 'Bornova', neighborhood: 'Erzene', is_active: false },
  { city: 'İzmir', district: 'Torbalı', neighborhood: 'Ayrancılar', is_active: false },
  { city: 'izmir', district: 'Karşıyaka', neighborhood: 'Bostanlı', is_active: true },
  { city: null, district: 'Çiğli', neighborhood: 'Ataşehir', is_active: true },
  { city: 'İzmir', district: 'Aliağa', neighborhood: 'Merkez', is_active: false },
  { city: 'Manisa', district: 'Yunusemre', neighborhood: 'X', is_active: true },
  { city: 'İzmir', district: '', neighborhood: 'Boş', is_active: true },
];
const LIST = buildDistrictList(ZONES);

test('(c) kapı kuralı: oturumlu + adres yok → kapı; adres var → kapı yok; cihaz işareti oturumlu hesabı atlatmaz', () => {
  assert.equal(shouldShowGate({ signedIn: true, addressCount: 0, lastKnownHasAddress: null, anonPassed: true }), true);
  assert.equal(shouldShowGate({ signedIn: true, addressCount: 1, lastKnownHasAddress: null, anonPassed: false }), false);
  // Aynı cihazda sırayla: önce adresli hesap (geçer), sonra adressiz hesap (kapı) — cihaz geneli işaret etkisiz.
  assert.equal(shouldShowGate({ signedIn: true, addressCount: 1, lastKnownHasAddress: true, anonPassed: true }), false);
  assert.equal(shouldShowGate({ signedIn: true, addressCount: 0, lastKnownHasAddress: false, anonPassed: true }), true);
});

test('(c) adres sorgusu başarısız: son bilinen değer; hiç yoksa kapı. Oturumsuz: cihaz işareti', () => {
  assert.equal(shouldShowGate({ signedIn: true, addressCount: null, lastKnownHasAddress: true, anonPassed: false }), false);
  assert.equal(shouldShowGate({ signedIn: true, addressCount: null, lastKnownHasAddress: false, anonPassed: false }), true);
  assert.equal(shouldShowGate({ signedIn: true, addressCount: null, lastKnownHasAddress: null, anonPassed: true }), true);
  assert.equal(shouldShowGate({ signedIn: false, addressCount: null, lastKnownHasAddress: null, anonPassed: false }), true);
  assert.equal(shouldShowGate({ signedIn: false, addressCount: null, lastKnownHasAddress: null, anonPassed: true }), false);
});

test('İzmir ilçeleri: delivery_zones → distinct, alfabetik (TR), aktif satırı olan "hizmet var"; başka il/boş atılır', () => {
  assert.deepEqual(LIST, [
    { name: 'Aliağa', served: false },
    { name: 'Bornova', served: true },
    { name: 'Çiğli', served: true },
    { name: 'Karşıyaka', served: true },
    { name: 'Torbalı', served: false },
  ]);
});

test('(d) İzmir › hizmet ilçesi → adres ekleme; İzmir › hizmet dışı ilçe → Çok yakında', () => {
  assert.equal(gateTarget({ country: 'TR', city: 'İzmir', district: 'Bornova' }, LIST), 'address');
  assert.equal(gateTarget({ country: 'TR', city: 'izmir', district: 'karşıyaka' }, LIST), 'address');
  assert.equal(gateTarget({ country: 'TR', city: 'İzmir', district: 'Torbalı' }, LIST), 'soon');
  assert.equal(gateTarget({ country: 'TR', city: 'İzmir', district: 'Bilinmeyen' }, LIST), 'soon');
});

test('(e) İzmir dışı il ve yabancı şehir → Çok yakında (sipariş akışı yok)', () => {
  assert.equal(gateTarget({ country: 'TR', city: 'İstanbul', district: 'Kadıköy' }, LIST), 'soon');
  assert.equal(gateTarget({ country: 'TR', city: 'Ankara', district: null }, LIST), 'soon');
  assert.equal(gateTarget({ country: 'DE', city: 'Berlin', district: null }, LIST), 'soon');
  assert.equal(gateTarget({ country: 'DE', city: 'İzmir', district: 'Bornova' }, LIST), 'soon', 'yalnız Türkiye İzmiri');
});

test('"Restoranları gör": ülke + şehir şart; Türkiye › İzmir\'de ilçe de zorunlu. İlçe alanı: İzmir liste, diğer serbest', () => {
  assert.equal(canSubmit({ country: 'TR', city: null, district: null }), false);
  assert.equal(canSubmit({ country: 'TR', city: 'İzmir', district: null }), false);
  assert.equal(canSubmit({ country: 'TR', city: 'İzmir', district: 'Bornova' }), true);
  assert.equal(canSubmit({ country: 'TR', city: 'Ankara', district: null }), true);
  assert.equal(canSubmit({ country: 'DE', city: 'Berlin', district: null }), true);
  assert.equal(canSubmit({ country: '', city: 'Berlin', district: null }), false);
  assert.equal(districtMode({ country: 'TR', city: 'İzmir' }), 'list');
  assert.equal(districtMode({ country: 'TR', city: 'Ankara' }), 'text');
  assert.equal(districtMode({ country: 'DE', city: 'Berlin' }), 'text');
});

test('konum hapı "[İlçe], [Şehir]"; ölçüm alanları kişisel veri içermez', () => {
  assert.equal(locationLabel({ city: 'İstanbul', district: 'Kadıköy' }), 'Kadıköy, İstanbul');
  assert.equal(locationLabel({ city: 'Berlin', district: null }), 'Berlin');
  const p = gateSelectProps({ country: 'tr', city: 'İzmir', district: 'Bornova', postalCode: '35040' }, true);
  assert.deepEqual(p, { country: 'TR', city: 'İzmir', district: 'Bornova', served: true });
  assert.deepEqual(Object.keys(p).sort(), ['city', 'country', 'district', 'served']);
});

test('konum düğmesi: ters geocode → ülke / il / ilçe / posta kodu (İzmir ilçesi listedeki yazımla)', () => {
  // iOS: il = region, ilçe = subregion
  assert.deepEqual(selectionFromGeocode({ isoCountryCode: 'TR', region: 'İzmir', subregion: 'bornova', city: 'Bornova', postalCode: '35040' }, LIST), {
    country: 'TR', city: 'İzmir', district: 'Bornova', postalCode: '35040',
  });
  // Android: il = region ("İzmir ili"), ilçe = city
  assert.deepEqual(selectionFromGeocode({ isoCountryCode: 'TR', region: 'İzmir', city: 'Karşıyaka', postalCode: null }, LIST), {
    country: 'TR', city: 'İzmir', district: 'Karşıyaka', postalCode: null,
  });
  // İzmir'de listede olmayan ilçe → ilçe boş (kullanıcı seçer)
  assert.equal(selectionFromGeocode({ isoCountryCode: 'TR', region: 'İzmir', subregion: 'Foça' }, LIST)?.district, null);
  // Başka il: ilçe serbest metin
  assert.deepEqual(selectionFromGeocode({ isoCountryCode: 'TR', region: 'İstanbul', subregion: 'Kadıköy', postalCode: '34710' }, LIST), {
    country: 'TR', city: 'İstanbul', district: 'Kadıköy', postalCode: '34710',
  });
  assert.deepEqual(selectionFromGeocode({ isoCountryCode: 'de', city: 'Berlin', district: 'Mitte', postalCode: '10115' }, LIST), {
    country: 'DE', city: 'Berlin', district: 'Mitte', postalCode: '10115',
  });
  assert.equal(selectionFromGeocode(null, LIST), null);
  assert.equal(selectionFromGeocode({ city: 'X' }, LIST), null);
});

test('metinler: pano metinleri birebir, TR = EN anahtarları', () => {
  assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort());
  assert.equal(tr.title, 'Adresini gir.');
  assert.equal(en.title, 'Enter your address.');
  assert.equal(tr.sub, 'Sağlıklı öğünler hemen kapına gelsin.');
  assert.equal(en.sub, 'Healthy meals at your door, right away.');
  assert.equal(`${tr.soon_title_1} ${tr.soon_title_2}`, 'Henüz buralarda değiliz. Ama geliyoruz.');
  assert.equal(tr.soon_body, 'Çok yakında sen de etrafındaki restoranlardan sipariş verebileceksin.');
  assert.equal(tr.add, 'Restoranını ekle');
  assert.equal(tr.suggest, 'Çevrendeki restoranları öner');
  assert.equal(en.suggest, 'Suggest restaurants near you');
  assert.deepEqual([tr.country, tr.city, tr.district, tr.postcode], ['ÜLKE', 'ŞEHİR', 'İLÇE', 'POSTA KODU']);
  assert.deepEqual([en.country, en.city, en.district, en.postcode], ['COUNTRY', 'CITY', 'DISTRICT', 'POSTCODE']);
  assert.equal(tr.see, 'Restoranları gör');
  assert.equal(en.see, 'See restaurants');
});

test('kaynak: EkHomeScreen ve EkCityGate kapısı yalnız EkLocationGate; cihaz işareti yalnız oturumsuz gezinmede yazılır', () => {
  const home = fs.readFileSync(path.join(ROOT, 'src/modules/eatkcal/v2/screens/EkHomeScreen.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(ROOT, 'src/modules/eatkcal/v2/screens/EkCityGateScreen.tsx'), 'utf8');
  for (const src of [home, route]) {
    assert.ok(src.includes('<EkLocationGate'));
    assert.ok(!src.includes('CityGateView'));
    assert.match(src, /if \(!userId\) \{\s*(\/\/[^\n]*\n\s*)?await writeCityGatePassed\(\);/);
  }
  assert.ok(home.includes('useEatGate(userId)'));
  assert.ok(home.includes("navigation.navigate('EkAddressAdd', { gateDistrict: sel.district ?? undefined, afterGate: {} })"));
  assert.ok(!fs.existsSync(path.join(ROOT, 'src/modules/eatkcal/v2/ui/gate/CityGateView.tsx')));
});

test('arka plan varlığı optimize (≤ 400 KB, WebP); girdi dosyaları repoda yok', () => {
  const p = path.join(ROOT, 'assets/eatkcal/gate-bg.webp');
  assert.ok(fs.statSync(p).size <= 400 * 1024);
  assert.equal(fs.readFileSync(p).subarray(8, 12).toString('ascii'), 'WEBP');
  assert.ok(!fs.existsSync(path.join(ROOT, 'docs/tur28/eatkcal-kapi')));
});
