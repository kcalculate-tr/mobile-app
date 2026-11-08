// G18-S1 — ilk 60 saniye saf mantığı: kalıcı bayrak birleştirme, profil kartı,
// oryantasyon adım seçimi, karşılama varyantı, FinMoOpen zaman çizelgesi, ipucu yerleşimi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  EMPTY_ORIENT,
  EMPTY_SYNCED,
  OPEN_T,
  markSeen,
  mergeSynced,
  nextOrientStep,
  orientDone,
  parseSynced,
  showProfileCard,
  skipAll,
  welcomeVariant,
  type OrientStep,
} from '../state';
import { TIP_GAP, TIP_W, holeFor, placeTip, scrimPath } from '../orient/geometry';

const started = { ...EMPTY_ORIENT, started: true };
const set = (...s: OrientStep[]) => new Set<OrientStep>(s);

test('parseSynced: bozuk/boş girdi → boş durum; bilinmeyen kart değeri → open', () => {
  assert.deepEqual(parseSynced(null), EMPTY_SYNCED);
  assert.deepEqual(parseSynced('x'), EMPTY_SYNCED);
  assert.equal(parseSynced({ profileCard: 'weird' }).profileCard, 'open');
  const p = parseSynced({ profileCard: 'done', orient: { started: true, seen: { 1: true, 3: 'yes' } } });
  assert.equal(p.profileCard, 'done');
  assert.equal(p.orient.started, true);
  assert.deepEqual(p.orient.seen, { 1: true, 2: false, 3: false, 4: false });
});

test('mergeSynced: ileri durum kazanır (kapatılan kart bir daha açılmaz; görülen ipucu görülmüş kalır)', () => {
  const a = { profileCard: 'dismissed' as const, orient: markSeen(started, 1) };
  const b = { profileCard: 'open' as const, orient: { ...EMPTY_ORIENT, seen: { 1: false, 2: true, 3: false, 4: false } } };
  const m = mergeSynced(b, a);
  assert.equal(m.profileCard, 'dismissed');
  assert.equal(m.orient.started, true);
  assert.deepEqual(m.orient.seen, { 1: true, 2: true, 3: false, 4: false });
  assert.equal(mergeSynced({ ...EMPTY_SYNCED, profileCard: 'done' }, a).profileCard, 'done');
});

test('profil kartı: yalnız kart açık VE hedef yok (hedef bilinmiyorsa gösterme)', () => {
  assert.equal(showProfileCard('open', false), true);
  assert.equal(showProfileCard('open', true), false);
  assert.equal(showProfileCard('open', undefined), false);
  assert.equal(showProfileCard('dismissed', false), false);
  assert.equal(showProfileCard('done', false), false);
});

test('oryantasyon: başlamadan/atlanınca yok; 1 her zaman önce ve yalnız hedefi ekrandayken', () => {
  assert.equal(nextOrientStep(EMPTY_ORIENT, set(1, 2, 3, 4)), null);
  assert.equal(nextOrientStep(skipAll(started), set(1)), null);
  assert.equal(nextOrientStep(started, set(2, 3, 4)), null, '1 görülmeden 2–4 yok');
  assert.equal(nextOrientStep(started, set(1, 3)), 1);
});

test('oryantasyon: 1 görüldükten sonra ekrandaki görülmemiş en küçük adım (2 Tara sonucu, 3 halka, 4 Keşfet)', () => {
  const o1 = markSeen(started, 1);
  assert.equal(nextOrientStep(o1, set(1)), null);
  assert.equal(nextOrientStep(o1, set(3, 4)), 3);
  assert.equal(nextOrientStep(o1, set(4)), 4);
  const o13 = markSeen(o1, 3);
  assert.equal(nextOrientStep(o13, set(2, 3)), 2);
  const all = [1, 2, 3, 4].reduce((o, s) => markSeen(o, s as OrientStep), started);
  assert.equal(orientDone(all), true);
  assert.equal(orientDone(skipAll(started)), true);
  assert.equal(nextOrientStep(all, set(1, 2, 3, 4)), null);
});

test('karşılama varyantı: varsayılan A; B > C', () => {
  assert.equal(welcomeVariant({ b: false, c: false }), 'a');
  assert.equal(welcomeVariant({ b: true, c: false }), 'b');
  assert.equal(welcomeVariant({ b: false, c: true }), 'c');
  assert.equal(welcomeVariant({ b: true, c: true }), 'b');
});

test('FinMoOpen: toplam 2300 = enter 900 → standard 500 → exit 900; azaltılmış 900 + 200; Atla 200', () => {
  assert.equal(OPEN_T.enterEnd, 900);
  assert.equal(OPEN_T.ringEnd - OPEN_T.enterEnd, 500);
  assert.equal(OPEN_T.total - OPEN_T.ringEnd, 900);
  assert.equal(OPEN_T.total, 2300);
  assert.equal(OPEN_T.reducedHold + OPEN_T.reducedFade, 1100);
  assert.equal(OPEN_T.skipFade, 200);
  assert.equal(OPEN_T.total - OPEN_T.outStart, 300);
});

test('ipucu yerleşimi: FinOrient1 (Tara, sağ alt) — balon sağdan 12, deliğin 12 üstünde, ok daire ortasında', () => {
  const screen = { w: 393, h: 852 };
  // Tara düğmesi 64×64 @ (314,765) → delik daire 74 (6 pt pay) ≈ pano (309,760,74).
  const hole = holeFor('scan', { x: 314, y: 765, w: 62, h: 62 }, screen.w);
  assert.equal(hole.w, 74);
  assert.equal(hole.r, 37);
  const p = placeTip('scan', hole, screen);
  assert.equal(p.above, true);
  assert.equal(p.left, 393 - 12 - TIP_W);
  assert.equal(p.bottom, 852 - (hole.y - TIP_GAP));
  // Ok merkezi = delik merkezi (pano: right 28 → x 346).
  assert.ok(Math.abs(p.left + p.arrowLeft + 7 - (hole.x + hole.w / 2)) < 0.5);
});

test('ipucu yerleşimi: FinOrient3 (halka, sol üst) — balon soldan 16, deliğin 12 altında; FinOrient4 ok "Sana Özel"de', () => {
  const screen = { w: 393, h: 852 };
  const ring = holeFor('ring', { x: 18, y: 113, w: 111, h: 166 }, screen.w);
  assert.equal(ring.r, 24);
  const p3 = placeTip('ring', ring, screen);
  assert.equal(p3.above, false);
  assert.equal(p3.left, 16);
  assert.equal(p3.top, ring.y + ring.h + TIP_GAP);
  const tabs = holeFor('kesfet', { x: 0, y: 109, w: 393, h: 32 }, screen.w);
  assert.equal(tabs.x, 4);
  assert.equal(tabs.x + tabs.w, 389);
  const p4 = placeTip('kesfet', tabs, screen);
  assert.equal(p4.left, 16);
  assert.ok(Math.abs(p4.left + p4.arrowLeft + 7 - (tabs.x + tabs.w * 0.25)) < 0.5);
});

test('örtü yolu: ekran + delik (evenodd), delik köşesi deliğin yarısını aşmaz', () => {
  const d = scrimPath({ w: 100, h: 200 }, { x: 10, y: 20, w: 30, h: 10, r: 99 });
  assert.match(d, /^M0 0H100V200H0Z M/);
  assert.match(d, /A5 5 0 0 1/);
});

test('bayrak kapalı parite: hedef kancası kapalıyken prop eklemez; ipucu/kart/kutlama yalnız yeni_onboarding ile', () => {
  const root = path.resolve(__dirname, '..');
  const hook = fs.readFileSync(path.join(root, 'orient/useOrientTarget.ts'), 'utf8');
  assert.match(hook, /useFeature\('yeni_onboarding'\)/);
  assert.match(hook, /return enabled \? \{ ref, collapsable: false \} : NO_PROPS;/);
  const host = fs.readFileSync(path.join(root, 'orient/OrientHost.tsx'), 'utf8');
  assert.match(host, /const enabled = useFeature\('yeni_onboarding'\)/);
  const slot = fs.readFileSync(path.join(root, 'HomeOnboardingSlot.tsx'), 'utf8');
  assert.match(slot, /if \(!enabled\) return null;/);
});

test('demo kart günlüğe/halkaya YAZMAZ: boş hâl bileşeni hiçbir kayıt fonksiyonu çağırmaz', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../HomeEmptyR1.tsx'), 'utf8');
  assert.doesNotMatch(src, /supabase|meal_consumptions|insert|logMeal|saveConsumption/);
  // Demo kart dokunulamaz (Pressable yok; yalnız iki CTA düğmesi Pressable).
  assert.equal((src.match(/<Pressable/g) ?? []).length, 2);
});
