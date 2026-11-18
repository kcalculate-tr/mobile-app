// G61-S1 md.3 — paylaşım bağlantıları React Navigation yolu (getStateFromPath ile gerçek eşleme).
import test from 'node:test';
import assert from 'node:assert/strict';
import { getStateFromPath } from '@react-navigation/core';
import { SHARE_LINK_PATH, SHARE_STORY_PATH, shareKindFromParam } from '../shareLinks';

const UUID = '3f2a9c1e-7b44-4d2a-9a51-0c8e2d1f6b77';
const config = {
  screens: {
    SharedPost: 'p/:postId',
    PublicProfile: 'u/:handle',
    Kesfet: 'kesfet',
    SubPaywall: 'teklif/:offer',
    ShareLink: { path: SHARE_LINK_PATH, alias: [SHARE_STORY_PATH] },
  },
};

function route(path: string) {
  const st = getStateFromPath(path, config as never);
  const r = st?.routes?.[0];
  return r ? { name: r.name, params: r.params as Record<string, string> } : null;
}

test('m/d/x/r/i → ShareLink { kind, id }', () => {
  for (const p of ['m', 'd', 'x', 'r', 'i']) {
    const r = route(`${p}/abc123XYZ0`);
    assert.equal(r?.name, 'ShareLink', p);
    assert.equal(r?.params.kind, p);
    assert.equal(r?.params.id, 'abc123XYZ0');
  }
  assert.equal(route('m/abc123XYZ0?utm_source=whatsapp')?.name, 'ShareLink');
});

test('/s/<UUID> hikâye; /s/<saha kodu> eşleşmez (bugünkü davranış)', () => {
  const r = route(`s/${UUID}`);
  assert.equal(r?.name, 'ShareLink');
  assert.equal(r?.params.kind, 's');
  assert.equal(r?.params.id, UUID);
  assert.equal(route('s/IZM01'), null);
  assert.equal(route('k/BOX12'), null);
});

test('mevcut rotalar değişmedi', () => {
  assert.equal(route(`p/${UUID}`)?.name, 'SharedPost');
  assert.equal(route('u/ilter')?.name, 'PublicProfile');
  assert.equal(route('teklif/izmir')?.name, 'SubPaywall');
  assert.equal(route('kesfet')?.name, 'Kesfet');
  assert.equal(route('privacy'), null);
});

test('shareKindFromParam', () => {
  assert.equal(shareKindFromParam('m'), 'meal');
  assert.equal(shareKindFromParam('s'), 'story');
  assert.equal(shareKindFromParam('recipe'), 'recipe');
  assert.equal(shareKindFromParam('k'), null);
});
