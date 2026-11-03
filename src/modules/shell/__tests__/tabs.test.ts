// Yeni kabuk sekme mantığı birim testleri (G11-S2 madde 9).
// Saf modül — tsx --test (Node) ile koşar. Çalıştırma: npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveShellTabs,
  shouldShowScan,
  resolveInitialShellTab,
  LEGACY_TABS,
} from '../tabs';

// ── Bayrak KAPALI parite: bugünkü sekme adları/etiketleri/sırası ─────────────
// (Bayrak kapalıyken AppNavigator eski TabNavigator'ı kullanır; bu anlık görüntü
//  gerçek CustomTabBar render'ıyla da karşılaştırılır — bkz. component test.)
test('legacy: sekme ad/etiket/sıra bugünküyle aynı', () => {
  assert.deepEqual(LEGACY_TABS, [
    { route: 'Home', label: 'Anasayfa', hidden: false },
    { route: 'Tracker', label: 'Kcalculate', hidden: false },
    { route: 'Cart', label: '', hidden: true },
    { route: 'Subscriptions', label: 'Macro', hidden: false },
    { route: 'Profile', label: 'Hesabım', hidden: false },
  ]);
});

// ── R3 sekme listesi ─────────────────────────────────────────────────────────
test('R3: kesfet AÇIK → 4 sekme, tasarım sırası', () => {
  const tabs = resolveShellTabs({ kesfet: true });
  assert.equal(tabs.length, 4);
  assert.deepEqual(
    tabs.map((t) => t.route),
    ['Tracker', 'KesfetTab', 'Home', 'Profile'],
  );
  assert.deepEqual(
    tabs.map((t) => t.labelKey),
    ['shell.tab.home', 'shell.tab.explore', 'shell.tab.eat', 'shell.tab.profile'],
  );
});

test('R3: kesfet KAPALI → Keşfet sekmesi YOK (3 sekme)', () => {
  const tabs = resolveShellTabs({ kesfet: false });
  assert.equal(tabs.length, 3);
  assert.deepEqual(
    tabs.map((t) => t.route),
    ['Tracker', 'Home', 'Profile'],
  );
  assert.ok(!tabs.some((t) => t.route === 'KesfetTab'));
});

test('R3: oturum kapısı — eatkcal (Home) serbest, diğerleri oturum ister', () => {
  const tabs = resolveShellTabs({ kesfet: true });
  const byRoute = Object.fromEntries(tabs.map((t) => [t.route, t.requiresAuth]));
  assert.equal(byRoute.Home, false);
  assert.equal(byRoute.Tracker, true);
  assert.equal(byRoute.KesfetTab, true);
  assert.equal(byRoute.Profile, true);
});

// ── Tara görünürlüğü ─────────────────────────────────────────────────────────
test('Tara yalnız ai_tarama açıkken görünür', () => {
  assert.equal(shouldShowScan({ ai_tarama: true }), true);
  assert.equal(shouldShowScan({ ai_tarama: false }), false);
});

// ── Açılış sekmesi kuralı ────────────────────────────────────────────────────
test('açılış sekmesi: oturum yok → Home', () => {
  assert.equal(resolveInitialShellTab({ session: false }), 'Home');
  assert.equal(resolveInitialShellTab({ session: false, hasOrderHistory: false }), 'Home');
});

test('açılış sekmesi: oturum var + sipariş geçmişi var → Home', () => {
  assert.equal(resolveInitialShellTab({ session: true, hasOrderHistory: true }), 'Home');
});

test('açılış sekmesi: oturum var + sipariş geçmişi YOK → Tracker', () => {
  assert.equal(resolveInitialShellTab({ session: true, hasOrderHistory: false }), 'Tracker');
});

test('açılış sekmesi: oturum var + sipariş geçmişi bilinmiyor → Home', () => {
  assert.equal(resolveInitialShellTab({ session: true }), 'Home');
});
