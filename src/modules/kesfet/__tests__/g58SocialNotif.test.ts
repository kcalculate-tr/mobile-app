// G58-S1 md.2 — `sosyal_bildirim`: dokunuş hedefi (saf), okundu üst sınırı, 'istek_yok' tanıma,
// bayrak kapısı (zil + rota), sunucu migration'ı (kendi eylem / engel / sonuçlanan istek / yorum
// tekilleştirmesi) ve rollback.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { followRequestGone, markReadUntil, notificationTarget } from '../notifRoute';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const actor = (id: string, handle: string | null) => ({ id, handle: handle as string, display_name: 'X', avatar_url: null, verified: false });

test('hedef: gönderili bildirim → SharedPost; yorum/yanıtta commentId', () => {
  assert.deepEqual(notificationTarget({ kind: 'like', post_id: 'p1', comment_id: null, actor: actor('a', 'h') }), { name: 'SharedPost', params: { postId: 'p1' } });
  assert.deepEqual(notificationTarget({ kind: 'comment', post_id: 'p1', comment_id: 'c1', actor: actor('a', 'h') }), { name: 'SharedPost', params: { postId: 'p1', commentId: 'c1' } });
  assert.deepEqual(notificationTarget({ kind: 'reply', post_id: 'p1', comment_id: 'c2', actor: actor('a', 'h') }), { name: 'SharedPost', params: { postId: 'p1', commentId: 'c2' } });
  assert.deepEqual(notificationTarget({ kind: 'add_to_day', post_id: 'p2', comment_id: 'c9', actor: actor('a', 'h') }), { name: 'SharedPost', params: { postId: 'p2' } });
});

test('hedef: takip / istek / onay → PublicProfile handle || id (handle’sız ve boşluklu handle)', () => {
  assert.deepEqual(notificationTarget({ kind: 'follow', post_id: null, comment_id: null, actor: actor('u-1', 'deniz') }), { name: 'PublicProfile', params: { handle: 'deniz' } });
  assert.deepEqual(notificationTarget({ kind: 'follow_request', post_id: null, comment_id: null, actor: actor('u-2', null) }), { name: 'PublicProfile', params: { handle: 'u-2' } });
  assert.deepEqual(notificationTarget({ kind: 'follow_accept', post_id: null, comment_id: null, actor: actor('u-3', '  ') }), { name: 'PublicProfile', params: { handle: 'u-3' } });
  assert.equal(notificationTarget({ kind: 'follow', post_id: null, comment_id: null, actor: actor('', null) }), null);
});

test('hedef: sistem ve şikâyet sonucu dokunuşla açılmaz', () => {
  assert.equal(notificationTarget({ kind: 'system', post_id: 'p', comment_id: null, actor: actor('a', 'h') }), null);
  assert.equal(notificationTarget({ kind: 'report_result', post_id: 'p', comment_id: null, actor: actor('a', 'h') }), null);
});

test('okundu üst sınırı en yeni satır; boş liste null', () => {
  assert.equal(markReadUntil([]), null);
  assert.equal(markReadUntil([{ created_at: '2026-11-17T10:00:00Z' }, { created_at: '2026-11-17T12:30:00Z' }, { created_at: '2026-11-16T09:00:00Z' }]), '2026-11-17T12:30:00Z');
});

test("'istek_yok' tanınır, ağ hatası tanınmaz", () => {
  assert.equal(followRequestGone(new Error('istek_yok')), true);
  assert.equal(followRequestGone({ message: 'RPC respond_follow_request: istek_yok' }), true);
  assert.equal(followRequestGone(new Error('network')), false);
  assert.equal(followRequestGone(null), false);
});

test('bayrak kapısı: Keşfet zili yalnız sosyal_bildirim açıkken; rota üretimde bayrakla kayıtlı', () => {
  const kesfet = read('src/modules/kesfet/ui/KesfetScreen.tsx');
  assert.match(kesfet, /const sosyalBildirim = useFeature\('sosyal_bildirim'\)/);
  assert.match(kesfet, /showBell=\{sosyalBildirim\}/);
  const nav = read('src/navigation/AppNavigator.tsx');
  assert.match(nav, /\(sosyalBildirimEnabled \|\| __DEV__\) && \(\s*<Stack\.Screen name="KesfetNotifications"/);
  const reg = read('src/core/flags/registry.ts');
  assert.match(reg, /sosyal_bildirim: false/);
});

test('ekran: okundu yalnız başarılı yüklemede ve üst sınırla; dokunuş saf hedeften', () => {
  const s = read('src/modules/kesfet/ui/NotificationsScreen.tsx');
  assert.match(s, /if \(!ok\) return;/);
  assert.match(s, /markAllRead\(markReadUntil\(loaded\)\)/);
  assert.match(s, /notificationTarget\(n\)/);
  assert.match(s, /followRequestGone\(e\)/);
  assert.match(s, /loadMore\(\)/);
});

test('migration: okumada engel + sonuçlanan istek + kaldırılan yorum süzülür; kendi eylem guard’ı korunur', () => {
  const m = read('supabase/migrations/20261117200100_g58_social_notif_filters.sql');
  assert.match(m, /create or replace function public\.list_social_notifications\(/);
  assert.match(m, /create or replace function public\.social_notifications_guard\(\)/);
  // Kendi eylemin için bildirim yok + ekleme anı engel kontrolü AYNEN.
  assert.match(m, /if NEW\.actor_id = NEW\.user_id then\s+return null;/);
  assert.match(m, /if public\.feed_is_blocked\(NEW\.user_id, NEW\.actor_id\) then/);
  // Tekilleştirme yorum kimliğini de içerir.
  assert.match(m, /and n\.comment_id is not distinct from NEW\.comment_id/);
  // Liste VE okunmamış sayacı aynı süzgeç (2'şer kez).
  assert.equal((m.match(/not public\.feed_is_blocked\(v_uid, n\.actor_id\)/g) ?? []).length, 2);
  assert.equal((m.match(/from public\.follow_requests fr/g) ?? []).length, 2);
  assert.equal((m.match(/pc\.status = 'removed'/g) ?? []).length, 2);
  // Tablo/şema değişikliği yok, veri silme yok.
  assert.doesNotMatch(m, /\b(drop table|alter table|delete from)\b/i);
  const rb = read('supabase/rollbacks/20261117200100_g58_social_notif_filters_rollback.sql');
  assert.match(rb, /create or replace function public\.list_social_notifications\(/);
  assert.doesNotMatch(rb, /G58: engel/);
});
