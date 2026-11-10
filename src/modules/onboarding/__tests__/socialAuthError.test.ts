// G22-S2 md.5 (FinOnbAccountError) — Apple/Google sonucu sınıflandırıcı: iptal
// SESSİZ, ağ / hesap → satır içi uyarı. Kodlar kütüphanelerin gerçek değerleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authAlertKeys,
  classifySocialAuthError,
  errorCodeOf,
  shouldShowAuthAlert,
} from '../socialAuthError';
import { translate } from '../../../core/i18n/core';

test('başarı (hata yok, iptal yok) → null', () => {
  assert.equal(classifySocialAuthError({ error: null }), null);
  assert.equal(classifySocialAuthError({}), null);
});

test('iptal: AuthContext cancelled bayrağı → cancel (sessiz)', () => {
  const k = classifySocialAuthError({ cancelled: true, error: null });
  assert.equal(k, 'cancel');
  assert.equal(shouldShowAuthAlert(k), false);
});

test('iptal: Apple ERR_REQUEST_CANCELED / ERR_CANCELED → cancel', () => {
  for (const code of ['ERR_REQUEST_CANCELED', 'ERR_CANCELED']) {
    assert.equal(classifySocialAuthError({ error: 'The user canceled', errorCode: code }), 'cancel', code);
  }
});

test('iptal: Google SIGN_IN_CANCELLED (iOS -5, Android 12501) → cancel', () => {
  for (const code of ['SIGN_IN_CANCELLED', '-5', -5, '12501']) {
    assert.equal(classifySocialAuthError({ error: 'cancelled', errorCode: code }), 'cancel', String(code));
  }
});

test('iptal çevrimdışıyken bile sessiz kalır (öncelik iptal)', () => {
  assert.equal(classifySocialAuthError({ cancelled: true, online: false }), 'cancel');
});

test('ağ: Supabase AuthRetryableFetchError / Google NETWORK_ERROR (7) / NSURLError', () => {
  for (const code of ['AuthRetryableFetchError', 'NETWORK_ERROR', '7', '-1009', '-1001']) {
    assert.equal(classifySocialAuthError({ error: 'x', errorCode: code }), 'network', code);
  }
});

test('ağ: mesaj metninden (Network request failed, offline, timed out)', () => {
  for (const msg of ['Network request failed', 'The Internet connection appears to be offline.', 'Request timed out', 'Failed to fetch']) {
    assert.equal(classifySocialAuthError({ error: msg }), 'network', msg);
  }
});

test('ağ: cihaz çevrimdışı → her hata ağ', () => {
  assert.equal(
    classifySocialAuthError({ error: 'Invalid id token', errorCode: 'ERR_REQUEST_FAILED', online: false }),
    'network',
  );
});

test('hesap: Apple ERR_REQUEST_FAILED / ERR_REQUEST_UNKNOWN, Supabase token hatası', () => {
  assert.equal(
    classifySocialAuthError({ error: 'The authorization attempt failed', errorCode: 'ERR_REQUEST_FAILED', online: true }),
    'account',
  );
  assert.equal(classifySocialAuthError({ error: 'unknown', errorCode: 'ERR_REQUEST_UNKNOWN' }), 'account');
  assert.equal(classifySocialAuthError({ error: 'Bad ID token', errorCode: 'bad_jwt' }), 'account');
  assert.equal(classifySocialAuthError({ error: 'Apple ile giriş başarısız oldu (token alınamadı).' }), 'account');
  assert.equal(shouldShowAuthAlert('account'), true);
  assert.equal(shouldShowAuthAlert('network'), true);
  assert.equal(shouldShowAuthAlert(null), false);
});

test('authAlertKeys: ağ ortak, hesap başlığı sağlayıcıya göre', () => {
  assert.deepEqual(authAlertKeys('network', 'apple'), { title: 'auth_error.net_title', body: 'auth_error.net_body' });
  assert.deepEqual(authAlertKeys('network', 'google'), { title: 'auth_error.net_title', body: 'auth_error.net_body' });
  assert.equal(authAlertKeys('account', 'apple').title, 'auth_error.acc_apple_title');
  assert.equal(authAlertKeys('account', 'google').title, 'auth_error.acc_google_title');
  assert.equal(authAlertKeys('account', 'google').body, 'auth_error.acc_body');
});

test('errorCodeOf: code > AuthRetryableFetchError adı > status 0', () => {
  assert.equal(errorCodeOf({ code: 'ERR_REQUEST_CANCELED' }), 'ERR_REQUEST_CANCELED');
  assert.equal(errorCodeOf({ code: -5 }), '-5');
  assert.equal(errorCodeOf({ name: 'AuthRetryableFetchError', status: 0 }), 'AuthRetryableFetchError');
  assert.equal(errorCodeOf({ name: 'AuthApiError', status: 0 }), 'NETWORK_ERROR');
  assert.equal(errorCodeOf({ name: 'AuthApiError', status: 400 }), undefined);
  assert.equal(errorCodeOf(null), undefined);
  assert.equal(errorCodeOf('x'), undefined);
});

test('i18n: uyarı metinleri TR + EN (tasarım S sözlüğü birebir)', () => {
  assert.equal(translate('tr', 'auth_error.net_title'), 'Bağlanamadık');
  assert.equal(translate('en', 'auth_error.net_title'), 'Couldn’t connect');
  assert.equal(translate('tr', 'auth_error.acc_apple_title'), 'Apple ile giriş tamamlanamadı');
  assert.equal(translate('en', 'auth_error.acc_google_title'), 'Couldn’t finish signing in with Google');
  assert.equal(translate('tr', 'auth_error.retry'), 'Tekrar dene');
  assert.equal(translate('en', 'auth_error.retry'), 'Try again');
});
