import test from 'node:test';
import assert from 'node:assert/strict';

import { canViewProfileContent } from '../visibility';

test('canViewProfileContent: kendi profilim her zaman görünür', () => {
  assert.equal(canViewProfileContent({ is_private: true }, 'none', true), true);
});

test('canViewProfileContent: açık hesap herkese görünür', () => {
  assert.equal(canViewProfileContent({ is_private: false }, 'none', false), true);
});

test('canViewProfileContent: gizli hesap + takip etmiyorum → kapalı', () => {
  assert.equal(canViewProfileContent({ is_private: true }, 'none', false), false);
  assert.equal(canViewProfileContent({ is_private: true }, 'requested', false), false);
});

test('canViewProfileContent: gizli hesap + onaylı takipçiyim → açık', () => {
  assert.equal(canViewProfileContent({ is_private: true }, 'following', false), true);
});
