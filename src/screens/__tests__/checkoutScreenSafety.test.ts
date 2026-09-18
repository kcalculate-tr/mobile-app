import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Bu dosya CheckoutScreen'i RENDER ETMEZ (proje React render test altyapısı
// kurulu değil — jest/@testing-library/react-native yok). Bunun yerine
// KAYNAK METNİ tarar ve 2026-09-18'de canlıda "Maximum update depth
// exceeded" ile çöken iki spesifik hata sınıfının GERİ GELMEDİĞİNİ doğrular.
// Zayıf ama ucuz bir tripwire — gerçek bir regresyon render testinin yerini
// tutmaz, sadece aynı iki hatanın sessizce tekrarlanmasını engeller.

const source = readFileSync(
  join(__dirname, '../CheckoutScreen.tsx'),
  'utf8',
);

test('KÖK NEDEN (6af7e9e): useCartStore selector\'ı içinde nesne döndüren bir getter ÇAĞRILMAMALI', () => {
  // getTotalMacros() her çağrıda YENİ bir nesne döner (getSubtotal()'un
  // aksine, o primitive sayı döner ve Object.is ile stabildir). Bir Zustand
  // selector'ının İÇİNDE `state.getTotalMacros()` gibi çağrılırsa,
  // useSyncExternalStore her render'da "değişti" sanır -> sonsuz render
  // döngüsü -> "Maximum update depth exceeded" (CheckoutScreen.tsx, dün
  // sipariş akışını tamamen kilitledi). Doğru desen: fonksiyonun kendisini
  // (stabil referans) seç, render gövdesinde AYRICA çağır — bkz. birkaç
  // satır altındaki `getTotalMacros()` çağrısı.
  const dangerousPattern = /useCartStore\(\s*\([^)]*\)\s*=>\s*[^)]*\.getTotalMacros\(\)\s*\)/;
  assert.doesNotMatch(
    source,
    dangerousPattern,
    'getTotalMacros() bir useCartStore selector\'ı İÇİNDE çağrılıyor — sonsuz render döngüsüne yol açar. ' +
      'Fonksiyonu bare seçip (useCartStore(s => s.getTotalMacros)) render gövdesinde ayrıca çağırın.',
  );

  // Toplam Besin Değeri satırı kaldırıldı; getTotalMacros'a artık hiç ihtiyaç yok.
  assert.doesNotMatch(source, /Toplam Besin Değeri/, 'Sepet Özeti\'nden kaldırılan satır geri gelmiş.');
});

test('En-yakın-adres otomatik seçim effect\'i, seçimden ÖNCE guard ref\'ini kilitliyor (sonsuz döngü koruması)', () => {
  const effectMatch = /useEffect\(\(\) => \{\s*if \(autoSelectedNearestRef\.current\) return;[\s\S]*?\}, \[addresses, deviceCoords, deliveryMethod, route\.params\?\.selectedAddressId\]\);/.exec(
    source,
  );
  assert.ok(effectMatch, 'En-yakın-adres otomatik seçim effect\'i bulunamadı — dosya beklenmedik şekilde değişmiş olabilir.');

  const body = effectMatch![0];
  const guardIndex = body.indexOf('autoSelectedNearestRef.current = true');
  const dispatchIndex = body.indexOf("dispatchAddr({ type: 'SET_SELECTED_ADDRESS_ID', payload: nearest.id })");

  assert.ok(guardIndex !== -1, 'Guard (autoSelectedNearestRef.current = true) effect içinde bulunamadı.');
  assert.ok(dispatchIndex !== -1, 'Adres seçim dispatch\'i effect içinde bulunamadı.');
  assert.ok(
    guardIndex < dispatchIndex,
    'Guard, state güncellemesinden ÖNCE set edilmiyor — addresses/deviceCoords her değiştiğinde ' +
      'otomatik seçim tekrar tetiklenip adres state\'ini sonsuz döngüde güncelleyebilir.',
  );
});
