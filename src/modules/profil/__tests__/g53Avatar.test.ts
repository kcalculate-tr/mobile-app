// G53-S1 md.1 + md.2 — Keşfet profil kısayolu hedefi; profil fotoğrafı değişimi (seç → anında göster → yükle
// → kaydet; hata → eski foto), kaldırma, seçenek sayfası satırları.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  avatarInitial,
  avatarSheetOptions,
  meShortcutTarget,
  runAvatarChange,
  runAvatarRemove,
  type AvatarChangeDeps,
} from '../avatarChange';
import { translate } from '../../../core/i18n/core';

const root = path.resolve(__dirname, '../../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

function deps(over: Partial<AvatarChangeDeps> = {}) {
  const log: string[] = [];
  const applied: Array<string | null> = [];
  const busy: boolean[] = [];
  const d: AvatarChangeDeps = {
    pick: async () => 'file:///tmp/yeni.jpg',
    upload: async (uri) => {
      log.push(`upload:${uri}`);
      return 'https://cdn/avatars/u1.jpg?t=1';
    },
    save: async (url) => {
      log.push(`save:${url}`);
    },
    apply: (u) => applied.push(u),
    setBusy: (b) => busy.push(b),
    ...over,
  };
  return { d, log, applied, busy };
}

test('foto seçimi → ANINDA yerel foto + gösterge → yükleme fonksiyonu seçilen dosyayla çağrılır → kayıt → sunucu URL', async () => {
  const { d, log, applied, busy } = deps();
  const r = await runAvatarChange('library', 'https://cdn/eski.jpg', d);
  assert.equal(r, 'updated');
  assert.deepEqual(log, ['upload:file:///tmp/yeni.jpg', 'save:https://cdn/avatars/u1.jpg?t=1']);
  assert.deepEqual(applied, ['file:///tmp/yeni.jpg', 'https://cdn/avatars/u1.jpg?t=1']);
  assert.deepEqual(busy, [true, false]);
});

test('yükleme hatası → eski foto geri gelir, gösterge kapanır', async () => {
  const { d, applied, busy } = deps({ upload: async () => { throw new Error('ağ'); } });
  assert.equal(await runAvatarChange('camera', 'https://cdn/eski.jpg', d), 'failed');
  assert.deepEqual(applied, ['file:///tmp/yeni.jpg', 'https://cdn/eski.jpg']);
  assert.deepEqual(busy, [true, false]);
});

test('yükleme null döndü ya da kayıt hatası → eski foto (foto yoksa boş)', async () => {
  const a = deps({ upload: async () => null });
  assert.equal(await runAvatarChange('library', null, a.d), 'failed');
  assert.deepEqual(a.applied, ['file:///tmp/yeni.jpg', null]);
  const b = deps({ save: async () => { throw new Error('rpc'); } });
  assert.equal(await runAvatarChange('library', 'https://cdn/eski.jpg', b.d), 'failed');
  assert.equal(b.applied.at(-1), 'https://cdn/eski.jpg');
});

test('vazgeçildi / kamera izni yok → hiçbir şey değişmez, yükleme çağrılmaz', async () => {
  const c = deps({ pick: async () => null });
  assert.equal(await runAvatarChange('library', 'x', c.d), 'cancelled');
  assert.deepEqual(c.applied, []);
  assert.deepEqual(c.log, []);
  const n = deps({ pick: async () => 'denied' });
  assert.equal(await runAvatarChange('camera', 'x', n.d), 'denied');
  assert.deepEqual(n.applied, []);
  const e = deps({ pick: async () => { throw new Error('simülatörde kamera yok'); } });
  assert.equal(await runAvatarChange('camera', 'x', e.d), 'cancelled');
});

test('kaldırma: iyimser boşaltma; hata → eski foto; foto yoksa işlem yok', async () => {
  const applied: Array<string | null> = [];
  const ok = await runAvatarRemove('https://cdn/eski.jpg', { remove: async () => {}, apply: (u) => applied.push(u), setBusy: () => {} });
  assert.equal(ok, 'removed');
  assert.deepEqual(applied, [null]);
  const back: Array<string | null> = [];
  const bad = await runAvatarRemove('https://cdn/eski.jpg', { remove: async () => { throw new Error('x'); }, apply: (u) => back.push(u), setBusy: () => {} });
  assert.equal(bad, 'remove_failed');
  assert.deepEqual(back, [null, 'https://cdn/eski.jpg']);
  assert.equal(await runAvatarRemove(null, { remove: async () => {}, apply: () => {}, setBusy: () => {} }), 'cancelled');
});

test('seçenek sayfası: "Fotoğrafı kaldır" yalnız foto varsa', () => {
  assert.deepEqual(avatarSheetOptions(false), ['take', 'library']);
  assert.deepEqual(avatarSheetOptions(true), ['take', 'library', 'remove']);
});

test('Keşfet kısayolu: oturum yok → Login (AuthSheet); handle → kendi PublicProfile; handle yok → kendi önizleme', () => {
  assert.deepEqual(meShortcutTarget({ signedIn: false, handle: 'deniz', name: 'Deniz', avatarUrl: null }), { name: 'Login' });
  assert.deepEqual(meShortcutTarget({ signedIn: true, handle: '@deniz', name: 'Deniz', avatarUrl: 'u' }), { name: 'PublicProfile', params: { handle: 'deniz' } });
  assert.deepEqual(meShortcutTarget({ signedIn: true, handle: '  ', name: 'Deniz', avatarUrl: 'u' }), {
    name: 'ProfileSub',
    params: { sub: 'public', handle: null, displayName: 'Deniz', avatarUrl: 'u' },
  });
  assert.equal(avatarInitial('ılgaz', 'tr'), 'I');
  assert.equal(avatarInitial('', 'tr'), null);
});

test('seçici kare kırpma (allowsEditing + 1:1); kaldırma kendi profiles satırına; kayıt update_public_profile', () => {
  const up = read('src/modules/profil/avatarUpload.ts');
  assert.match(up, /allowsEditing: true,\s*\n\s*aspect: \[1, 1\]/);
  assert.match(up, /launchCameraAsync\(PICK_OPTS\)/);
  assert.match(up, /launchImageLibraryAsync\(PICK_OPTS\)/);
  assert.match(up, /requestCameraPermissionsAsync/);
  assert.match(up, /from\('avatars'\)\.upload\(fileName/);
  assert.match(up, /updatePublicProfile\(\{ displayName: null as unknown as string, bio: null, avatarUrl: url \}\)/);
  assert.match(up, /from\('profiles'\)\.update\(\{ avatar_url: null \}\)\.eq\('id', userId\)/);
});

test('metinler TR + EN', () => {
  assert.equal(translate('tr', 'kesfet_me.a11y'), 'Profilim, paylaşımlarım');
  assert.equal(translate('en', 'kesfet_me.a11y'), 'My profile, my posts');
  for (const k of ['take', 'library', 'remove', 'failed', 'uploading', 'badge_a11y']) {
    const t = translate('tr', `avatar_edit.${k}`);
    const e = translate('en', `avatar_edit.${k}`);
    assert.ok(t && !t.includes('missing') && e && !e.includes('missing') && t !== e, k);
  }
  assert.equal(translate('tr', 'avatar_edit.take'), 'Fotoğraf çek');
  assert.equal(translate('tr', 'avatar_edit.library'), 'Galeriden seç');
  assert.equal(translate('tr', 'avatar_edit.remove'), 'Fotoğrafı kaldır');
});
