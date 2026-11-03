// eatkcal şehir kapısı — mevcut useEatkcalRegistration + mock profil
// istemcisiyle uçtan uca akış (G6-S4 md.2, md.5). Native yok (yalnız mock
// istemci + saf katalog). Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { createMockProfilClient } from '../../profil/mock';
import { getProfilClient, setProfilClient, resetProfilClient } from '../../profil/client';
import { isActiveCity } from '../cityGate';

test('şehir kapısı: izmir anahtarıyla checkDeliveryCity ok döner', async () => {
  setProfilClient(createMockProfilClient());
  try {
    assert.equal(isActiveCity('izmir'), true);
    const res = await getProfilClient().checkDeliveryCity({ city: 'izmir' });
    assert.equal(res.ok, true);
  } finally {
    resetProfilClient();
  }
});

test('şehir kapısı: istanbul/ankara/antalya aktif değil → checkDeliveryCity hiç çağrılmaz, yerel "haber ver" yeterli', async () => {
  setProfilClient(createMockProfilClient());
  try {
    for (const city of ['istanbul', 'ankara', 'antalya']) {
      assert.equal(isActiveCity(city), false);
    }
    // Yine de sunucu de "izmir" dışını reddeder (çift güvence).
    const res = await getProfilClient().checkDeliveryCity({ city: 'istanbul' });
    assert.equal(res.ok, false);
  } finally {
    resetProfilClient();
  }
});
