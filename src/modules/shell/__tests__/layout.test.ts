// G16-S2 — tab bar indi: alt boşluk = insets.bottom + 4 (insets 0 → 8); içerik
// alt boşluğu barın yeni üst kenarına göre. Saf modül — npm run test:unit
import test from 'node:test';
import assert from 'node:assert/strict';

import { TAB_BAR_R3, TAB_BAR_R3_HEIGHT, tabBarBottomOffset, tabBarContentInset } from '../layout';

test('alt boşluk: home indicator üstünde en fazla 4', () => {
  assert.equal(tabBarBottomOffset(34), 38); // iPhone (Face ID)
  assert.equal(tabBarBottomOffset(21), 25);
  assert.ok(tabBarBottomOffset(34) - 34 <= 4);
});

test('alt boşluk: insets 0 (home tuşlu / Android 3 tuş eski) → 8', () => {
  assert.equal(tabBarBottomOffset(0), 8);
});

test('bar önceki konumdan 20 pt aşağıda (önce insets + 24)', () => {
  assert.equal(34 + 24 - tabBarBottomOffset(34), 20);
});

test('içerik alt boşluğu = bar üst kenarı + nefes payı (son öğe barın altında kalmaz)', () => {
  const top = tabBarBottomOffset(34) + TAB_BAR_R3.PILL_HEIGHT;
  assert.equal(tabBarContentInset(34), top + TAB_BAR_R3.CONTENT_BREATH);
  assert.ok(tabBarContentInset(0) > tabBarBottomOffset(0) + TAB_BAR_R3.PILL_HEIGHT);
  // Geriye uyumlu sabit: insets > 0 için insets + TAB_BAR_R3_HEIGHT ile aynı.
  assert.equal(TAB_BAR_R3_HEIGHT, 76);
  assert.equal(tabBarContentInset(34), 34 + TAB_BAR_R3_HEIGHT);
});

test('Tara ve mini durum hapla aynı satırda (aynı oranda iner)', () => {
  assert.ok(TAB_BAR_R3.SCAN_SIZE === TAB_BAR_R3.PILL_HEIGHT);
  assert.ok(TAB_BAR_R3.MINI_SIZE <= TAB_BAR_R3.PILL_HEIGHT);
});
