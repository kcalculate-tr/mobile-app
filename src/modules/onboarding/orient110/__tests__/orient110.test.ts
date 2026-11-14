// G54-S1 md.3 — 1.1.0 oryantasyonu saf mantık: kim görür, ne zaman başlar, tanıtım kime, ipucu sırası, işaret biçimi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ORIENT110_TIPS, accountOrientSeen, advance, canStartNow, needsIntro, nextTip, orientDeviceKey, shouldOrient, startPhase, stepName, type Orient110Tip } from '../logic';
import { EMPTY_SYNCED, mergeSynced, parseSynced, stripDeviceOnly } from '../../first/state';

const ALL = new Set<Orient110Tip>(ORIENT110_TIPS);

test('kim görür: yeni_kayit açık + oturum + karar verildi + görülmedi (yeni_onboarding ile ilgisi yok)', () => {
  assert.equal(shouldOrient({ flag: true, session: true, decided: true, seen: false }), true);
  assert.equal(shouldOrient({ flag: true, session: true, decided: true, seen: true }), false);
  assert.equal(shouldOrient({ flag: true, session: false, decided: true, seen: false }), false);
  assert.equal(shouldOrient({ flag: true, session: true, decided: false, seen: false }), false);
  assert.equal(shouldOrient({ flag: false, session: true, decided: true, seen: false }), false);
});

test('ne zaman: Ana sayfa odakta ve başka katman (T1, tebrik, izin, AuthSheet, kutlama) yokken', () => {
  assert.equal(canStartNow({ homeReady: true, overlays: 0, celebrating: false }), true);
  assert.equal(canStartNow({ homeReady: false, overlays: 0, celebrating: false }), false);
  assert.equal(canStartNow({ homeReady: true, overlays: 1, celebrating: false }), false);
  assert.equal(canStartNow({ homeReady: true, overlays: 0, celebrating: true }), false);
});

test('tanıtım yalnız eski müşteriye (bu cihazda onboarding 1–5 görülmedi)', () => {
  assert.equal(needsIntro({ sawOnboardingOnDevice: false }), true);
  assert.equal(needsIntro({ sawOnboardingOnDevice: true }), false);
});

test('eski müşteri: 4 tanıtım sayfası → 4 ipucu (Tara → Ana sayfa → Keşfet → eatkcal) → bitti', () => {
  let p = startPhase(true, ALL);
  const steps: string[] = [];
  while (p.kind !== 'done') {
    steps.push(stepName(p) as string);
    p = advance(p, ALL);
  }
  assert.deepEqual(steps, ['intro_1', 'intro_2', 'intro_3', 'intro_4', 'scan', 'home', 'kesfet', 'eatkcal']);
});

test('yeni kayıt: yalnız ipuçları; hedefi olmayan adım atlanır (Keşfet kapalı)', () => {
  const av = new Set<Orient110Tip>(['scan', 'home', 'eatkcal']);
  let p = startPhase(false, av);
  const steps: string[] = [];
  while (p.kind !== 'done') {
    steps.push(stepName(p) as string);
    p = advance(p, av);
  }
  assert.deepEqual(steps, ['scan', 'home', 'eatkcal']);
  assert.equal(nextTip(null, new Set()), null);
});

test('işaret: hesap (onboarding_state.orient_v110_seen_at) + cihaz anahtarı kullanıcı kimliğiyle', () => {
  assert.equal(accountOrientSeen({ orient_v110_seen_at: '2026-11-14T10:00:00Z' }), true);
  assert.equal(accountOrientSeen({ orient: {} }), false);
  assert.equal(accountOrientSeen(null), false);
  assert.equal(orientDeviceKey('u1'), '@kcal_orient_v110:u1');
  assert.notEqual(orientDeviceKey('u1'), orientDeviceKey('u2'));
});

test('G18 senkron yapısı işareti korur (persist ezmez); cihaz kaydından hesaba taşınmaz', () => {
  const remote = parseSynced({ profileCard: 'done', orient_v110_seen_at: '2026-11-14T10:00:00Z' });
  assert.equal(remote.orient_v110_seen_at, '2026-11-14T10:00:00Z');
  assert.equal(mergeSynced(EMPTY_SYNCED, remote).orient_v110_seen_at, '2026-11-14T10:00:00Z');
  assert.equal(stripDeviceOnly(remote).orient_v110_seen_at, undefined);
  assert.equal(parseSynced({}).orient_v110_seen_at, undefined);
});
