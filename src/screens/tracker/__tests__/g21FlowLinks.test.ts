// G21-S1 md.8 — akış denetiminde düzeltilen bağlantıların birim testleri.
import test from 'node:test';
import assert from 'node:assert/strict';

import { homeBellTarget } from '../homeBellTarget';

test('Ana sayfa zili: sosyal_bildirim açık → bildirim listesi (akış kopyası değil)', () => {
  assert.deepEqual(homeBellTarget({ sosyalBildirim: true, kesfet: true }), { name: 'KesfetNotifications' });
});

test('Ana sayfa zili: bildirim kapalı, Keşfet açık → Keşfet sekmesi (yığına ikinci akış itilmez)', () => {
  assert.deepEqual(homeBellTarget({ sosyalBildirim: false, kesfet: true }), {
    name: 'Tabs',
    params: { screen: 'KesfetTab' },
  });
});

test('Ana sayfa zili: ikisi de kapalı → zil yok (kayıtsız rotaya gezinme yok)', () => {
  assert.equal(homeBellTarget({ sosyalBildirim: false, kesfet: false }), null);
});
