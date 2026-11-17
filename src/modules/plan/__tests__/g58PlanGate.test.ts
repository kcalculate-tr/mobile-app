// G58-S1 md.1 — Öğün planı bayrak açma turu: ekran hâli (misafir / hata / boş / içerik), alışveriş
// listesi kapısı (abonelik bilinmiyorken bekle, Ücretsiz/misafir kilitli), metinler TR + EN.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { planAccess, planEntryVisible, planScreenState, shopGate } from '../access';
import { tr as planTr, en as planEn } from '../i18n';

test('planScreenState: misafir her durumda giriş kartı', () => {
  assert.equal(planScreenState({ signedIn: false, status: undefined, count: 0 }), 'guest');
  assert.equal(planScreenState({ signedIn: false, status: 'ready', count: 3 }), 'guest');
});

test('planScreenState: hata + önbellek yok → hata; önbellek varsa içerik', () => {
  assert.equal(planScreenState({ signedIn: true, status: 'error', count: 0 }), 'error');
  assert.equal(planScreenState({ signedIn: true, status: 'error', count: 2 }), 'content');
});

test('planScreenState: yüklenirken boş plan kartı yok; hazır + 0 satır → boş', () => {
  assert.equal(planScreenState({ signedIn: true, status: 'loading', count: 0 }), 'content');
  assert.equal(planScreenState({ signedIn: true, status: 'ready', count: 0 }), 'empty');
  assert.equal(planScreenState({ signedIn: true, status: undefined, count: 0 }), 'empty');
  assert.equal(planScreenState({ signedIn: true, status: 'ready', count: 5 }), 'content');
});

test('shopGate: Fresh ve Balance açık; Ücretsiz kilitli; abonelik bilinmiyorken oturumluda bekle', () => {
  assert.equal(shopGate({ tier: 'fresh', status: 'verified', signedIn: true }), 'open');
  assert.equal(shopGate({ tier: 'balance', status: 'rc_only', signedIn: true }), 'open');
  assert.equal(shopGate({ tier: 'free', status: 'verified', signedIn: true }), 'locked');
  // resolveTier(null, null) → free/unknown: Fresh kullanıcıyı paywall'a atmamak için bekle.
  assert.equal(shopGate({ tier: 'free', status: 'unknown', signedIn: true }), 'wait');
  // Misafirde abonelik durumu hiç gelmez → kilitli (giriş kartı), sonsuz bekleme yok.
  assert.equal(shopGate({ tier: 'free', status: 'unknown', signedIn: false }), 'locked');
});

test('erişim kuralı kademeyle tutarlı (Ücretsiz önizleme · Fresh şablon · Balance koç)', () => {
  assert.equal(planAccess('free').shopping, false);
  assert.equal(planAccess('free').canApply, false);
  assert.equal(planAccess('fresh').shopping, true);
  assert.equal(planAccess('fresh').regenCostsCoach, false);
  assert.equal(planAccess('balance').mode, 'coach');
  assert.equal(planEntryVisible(false), false);
  assert.equal(planEntryVisible(true), true);
});

test('G58 metinleri TR + EN eksiksiz', () => {
  const keys = ['error_title', 'retry', 'guest_title', 'guest_body', 'guest_cta', 'shop_locked_title', 'shop_locked_body', 'shop_locked_cta'] as const;
  for (const k of keys) {
    assert.ok(typeof planTr[k] === 'string' && planTr[k].length > 0, `tr ${k}`);
    assert.ok(typeof planEn[k] === 'string' && planEn[k].length > 0, `en ${k}`);
    assert.notEqual(planTr[k], planEn[k], `çevrilmemiş ${k}`);
  }
});

test('ekranlar G58 hâllerini kullanır (kilitli kartta liste çizilmez, misafir giriş, hata Tekrar dene)', () => {
  const root = path.resolve(__dirname, '..');
  const meal = fs.readFileSync(path.join(root, 'screens/MealPlanScreen.tsx'), 'utf8');
  const shop = fs.readFileSync(path.join(root, 'screens/ShoppingListScreen.tsx'), 'utf8');
  assert.match(meal, /planScreenState\(/);
  assert.match(meal, /plan-retry/);
  assert.match(meal, /plan-guest-login/);
  assert.match(shop, /shopGate\(/);
  assert.match(shop, /shop-locked/);
  assert.match(shop, /shop-retry/);
  // Eski davranış: her render'da `if (!allowed) navigate(SubPaywall)` ve altta liste — artık yok.
  assert.doesNotMatch(shop, /if \(!allowed\) nav\.navigate\('SubPaywall'/);
  // El ile eklenen kalem plansızken de listeyi açar.
  assert.match(shop, /entry\?\.manual\.length/);
});
