// G25-S1 md.11 — ses gizliliği: iOS requiresOnDeviceRecognition HER ZAMAN true (desteklemeyen
// cihazda kütüphane yok sayar → Apple sunucusu), Android EXTRA_PREFER_OFFLINE HER ZAMAN; Android'de
// cihaz içi tanıyıcı yalnız destekleniyorsa zorlanır. Ses kaydı saklanmaz.
import { speechStartOptions } from '../voice/speech';

test('iOS: requiresOnDeviceRecognition destek bilgisinden bağımsız true; Android intent seçeneği yok', () => {
  for (const onDevice of [true, false]) {
    const o = speechStartOptions('ios', 'tr-TR', onDevice);
    expect(o.requiresOnDeviceRecognition).toBe(true);
    expect('androidIntentOptions' in o).toBe(false);
    expect('recordingOptions' in o).toBe(false);
  }
});

test('Android: EXTRA_PREFER_OFFLINE her zaman; cihaz içi tanıyıcı yalnız destekleniyorsa', () => {
  const yes = speechStartOptions('android', 'en-US', true);
  expect(yes.requiresOnDeviceRecognition).toBe(true);
  expect(yes.androidIntentOptions).toEqual({ EXTRA_PREFER_OFFLINE: true });
  const no = speechStartOptions('android', 'en-US', false);
  expect(no.requiresOnDeviceRecognition).toBe(false);
  expect(no.androidIntentOptions).toEqual({ EXTRA_PREFER_OFFLINE: true });
  expect('recordingOptions' in no).toBe(false);
});
