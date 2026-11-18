// G61-S1 md.2 — hedef yönlendirme (sahte native bağımlılıklarla).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTarget, visibleTargets, isTargetDisabled, type ShareDeps } from '../targets';

function deps(over: Partial<ShareDeps> = {}) {
  const log: string[] = [];
  const d: ShareDeps = {
    openURL: async (u) => void log.push(`open:${u.split('?')[0]}`),
    copy: async (t) => void log.push(`copy:${t}`),
    shareImage: async (u) => void log.push(`img:${u}`),
    shareText: async (m, u) => void log.push(`text:${m}|${u ?? ''}`),
    getImage: async (z) => `file://${z}.png`,
    ...over,
  };
  return { d, log };
}
const ctx = { kind: 'meal' as const, linkId: 'aB3dE5fG7h', text: 'Menemen', size: 'post' as const };

test('görünen hedefler: bağlantı yoksa kopyala/X yok; Kaydet bu sürümde yok', () => {
  assert.deepEqual(visibleTargets({ hasLink: true, canSaveToLibrary: false }), ['ig_story', 'ig_post', 'whatsapp', 'x', 'copy', 'other']);
  assert.deepEqual(visibleTargets({ hasLink: false, canSaveToLibrary: false }), ['ig_story', 'ig_post', 'whatsapp', 'other']);
  assert.ok(visibleTargets({ hasLink: true, canSaveToLibrary: true }).includes('save'));
  assert.equal(isTargetDisabled('ig_story', false), true);
  assert.equal(isTargetDisabled('copy', false), false);
  assert.equal(isTargetDisabled('other', false), false);
});

test('Instagram Gönderi: bağlantı panoya + 4:5 görsel', async () => {
  const { d, log } = deps();
  const r = await runTarget('ig_post', ctx, d);
  assert.deepEqual(r, { ok: true, outcome: 'instagram' });
  assert.deepEqual(log, ['copy:https://l.eatkcal.com/m/aB3dE5fG7h?utm_source=instagram', 'img:file://post.png']);
});

test('WhatsApp açılamazsa görsel sistem paylaşımı; görsel de yoksa metin', async () => {
  const a = deps({ openURL: async () => { throw new Error('yok'); } });
  assert.equal((await runTarget('whatsapp', ctx, a.d)).ok, true);
  assert.deepEqual(a.log, ['img:file://post.png']);
  const b = deps({ openURL: async () => { throw new Error('yok'); }, getImage: async () => { throw new Error('svg'); } });
  await runTarget('whatsapp', ctx, b.d);
  assert.deepEqual(b.log, ['text:Menemen|https://l.eatkcal.com/m/aB3dE5fG7h?utm_source=whatsapp']);
});

test('X açılamazsa metin paylaşımı; bağlantı yoksa X/kopyala çalışmaz', async () => {
  const a = deps({ openURL: async () => { throw new Error('yok'); } });
  assert.deepEqual(await runTarget('x', ctx, a.d), { ok: true, outcome: 'shared' });
  assert.match(a.log[0], /utm_source=x$/);
  const b = deps();
  assert.deepEqual(await runTarget('copy', { ...ctx, linkId: null }, b.d), { ok: false, error: 'no_link' });
  assert.deepEqual(await runTarget('x', { ...ctx, linkId: null }, b.d), { ok: false, error: 'no_link' });
  assert.deepEqual(b.log, []);
});

test('Diğer: görsel; hata metne düşer; Kaydet kullanılamaz', async () => {
  const a = deps();
  await runTarget('other', ctx, a.d);
  assert.deepEqual(a.log, ['img:file://post.png']);
  assert.deepEqual(await runTarget('save', ctx, a.d), { ok: false, error: 'save_unavailable' });
  const b = deps({ shareImage: async () => { throw new Error('iptal'); } });
  await runTarget('other', ctx, b.d);
  assert.match(b.log[0], /^text:Menemen\|/);
});
