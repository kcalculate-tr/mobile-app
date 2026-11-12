// G25-S1 md.2 / md.6 — EULA hedefi ve "Aboneliği yönet" mağaza adresleri (tek kaynak).
import test from 'node:test';
import assert from 'node:assert/strict';
import { APPLE_EULA_URL, MANAGE_SUB_URL_ANDROID, MANAGE_SUB_URL_IOS, eulaTarget, manageSubUrl } from '../storeLinks';

test('EULA: iOS Apple standart EULA, Android uygulama içi Koşullar', () => {
  assert.equal(APPLE_EULA_URL, 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
  assert.deepEqual(eulaTarget('ios'), { kind: 'url', url: APPLE_EULA_URL });
  assert.deepEqual(eulaTarget('android'), { kind: 'terms' });
});

test('Aboneliği yönet: iOS App Store, Android Play abonelikler derin bağlantısı (paket adıyla)', () => {
  assert.equal(manageSubUrl('ios'), MANAGE_SUB_URL_IOS);
  assert.equal(MANAGE_SUB_URL_IOS, 'https://apps.apple.com/account/subscriptions');
  assert.equal(manageSubUrl('android'), MANAGE_SUB_URL_ANDROID);
  assert.equal(MANAGE_SUB_URL_ANDROID, 'https://play.google.com/store/account/subscriptions?package=com.kcalmobile.app');
});
