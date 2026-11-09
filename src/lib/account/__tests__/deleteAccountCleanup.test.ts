// G20-S3 md.7 (B-09) — delete-account: Storage nesneleri + ilişkili kayıtlar.
// supabase/functions/delete-account/cleanup.ts saf modül → sahte admin istemcisiyle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ORDER_ANON_EXTRA,
  REMOVE_CHUNK,
  cleanupUserRecords,
  collectPostMediaPaths,
  postMediaPath,
  removeUserStorage,
  storageTargets,
} from '../../../../supabase/functions/delete-account/cleanup';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const U = 'aaaaaaaa-1111-4222-8333-444455556666';
const OTHER = 'bbbbbbbb-1111-4222-8333-444455556666';

/** Bellek içi Storage: list(prefix) doğrudan çocukları döner (klasör id=null). */
function fakeStorage(buckets: Record<string, string[]>) {
  const removed: Record<string, string[]> = {};
  const lists: string[] = [];
  const storage = {
    from: (bucket: string) => ({
      list: async (prefix: string, opts: { limit: number; offset: number; search?: string }) => {
        lists.push(`${bucket}:${prefix}`);
        const all = (buckets[bucket] ?? []).filter((p) => !(removed[bucket] ?? []).includes(p));
        const base = prefix ? `${prefix}/` : '';
        const kids = new Map<string, boolean>();
        for (const p of all) {
          if (!p.startsWith(base)) continue;
          const rest = p.slice(base.length);
          const [head, ...tail] = rest.split('/');
          if (opts.search && !head.includes(opts.search)) continue;
          kids.set(head, tail.length === 0 || kids.get(head) === true);
        }
        const items = [...kids].map(([name, isFile]) => ({ name, id: isFile ? `id-${name}` : null }));
        return { data: items.slice(opts.offset, opts.offset + opts.limit), error: null };
      },
      remove: async (paths: string[]) => {
        assert.ok(paths.length <= REMOVE_CHUNK);
        (removed[bucket] ??= []).push(...paths);
        return { data: paths, error: null };
      },
    }),
  };
  return { storage, removed, lists };
}

/** Kayıt çağrılarını toplayan sahte tablo istemcisi. */
function fakeTables(data: Record<string, unknown[]> = {}) {
  const calls: string[] = [];
  const from = (table: string) => {
    let op = 'select';
    let patch: unknown = null;
    const q: any = {
      select: () => q,
      delete: () => {
        op = 'delete';
        return q;
      },
      update: (p: unknown) => {
        op = 'update';
        patch = p;
        return q;
      },
      eq: (col: string, v: unknown) => {
        calls.push(`${op} ${table} ${col}=${v}${patch ? ' ' + JSON.stringify(patch) : ''}`);
        return op === 'select' ? Promise.resolve({ data: data[table] ?? [], error: null }) : Promise.resolve({ error: null });
      },
      in: (col: string, v: unknown[]) => {
        calls.push(`${op} ${table} ${col} in ${v.join(',')}`);
        return op === 'select' ? Promise.resolve({ data: data[table] ?? [], error: null }) : Promise.resolve({ error: null });
      },
    };
    return q;
  };
  return { from, calls };
}

test('hedef önekler: avatars kökte <uid>.*, user-media <uid>/, post-media posts/<uid>/, support tickets/<uid>/', () => {
  const t = storageTargets(U);
  assert.deepEqual(
    t.map((x) => `${x.bucket}:${x.prefix}`),
    ['avatars:', `user-media:${U}`, `post-media:posts/${U}`, `post-media:${U}`, `support-attachments:tickets/${U}`],
  );
  assert.equal(t[0].rootMatch!(`${U}.jpg`), true);
  assert.equal(t[0].rootMatch!(`${OTHER}.jpg`), false);
});

test('Storage: yalnız bu kullanıcının nesneleri silinir (iç içe klasörler dahil), başkasına dokunulmaz', async () => {
  const { storage, removed } = fakeStorage({
    avatars: [`${U}.jpg`, `${OTHER}.jpg`],
    'user-media': [`${U}/scans/a.jpg`, `${U}/scans/b.jpg`, `${OTHER}/scans/c.jpg`],
    'post-media': [`posts/${U}/0-1x1.jpg`, `posts/${U}/m1/video.mp4`, `posts/${U}/m1/thumb.jpg`, `posts/${OTHER}/0-1x1.jpg`],
    'support-attachments': [`tickets/${U}/1_a.jpg`, `tickets/${OTHER}/2_b.jpg`],
  });
  const report = await removeUserStorage({ storage }, U, ['legacy/eski.jpg']);
  assert.deepEqual(removed.avatars, [`${U}.jpg`]);
  assert.deepEqual(removed['user-media'].sort(), [`${U}/scans/a.jpg`, `${U}/scans/b.jpg`]);
  assert.deepEqual(removed['post-media'].sort(), [`legacy/eski.jpg`, `posts/${U}/0-1x1.jpg`, `posts/${U}/m1/thumb.jpg`, `posts/${U}/m1/video.mp4`].sort());
  assert.deepEqual(removed['support-attachments'], [`tickets/${U}/1_a.jpg`]);
  assert.deepEqual(report.storage, { avatars: 1, 'user-media': 2, 'post-media': 4, 'support-attachments': 1 });
  assert.deepEqual(report.errors, []);
});

test('Storage: çok sayıda nesne parça parça (≤ 100) silinir', async () => {
  const many = Array.from({ length: 250 }, (_, i) => `${U}/scans/${i}.jpg`);
  const { storage, removed } = fakeStorage({ 'user-media': many });
  const report = await removeUserStorage({ storage }, U);
  assert.equal(removed['user-media'].length, 250);
  assert.equal(report.storage['user-media'], 250);
});

test('gönderi medyası yolları kayıtlardan (public URL / yol / thumb / kareler) toplanır', async () => {
  assert.equal(postMediaPath('https://x.supabase.co/storage/v1/object/public/post-media/posts/u/0-1x1.jpg'), 'posts/u/0-1x1.jpg');
  assert.equal(postMediaPath('posts/u/m/thumb.jpg'), 'posts/u/m/thumb.jpg');
  assert.equal(postMediaPath('https://cdn.example.com/a.jpg'), null);
  assert.equal(postMediaPath('../x'), null);
  const { from, calls } = fakeTables({
    posts: [{ id: 'p1' }, { id: 'p2' }],
    post_media: [
      { url: 'https://x.supabase.co/storage/v1/object/public/post-media/posts/u/0-1x1.jpg', thumb_path: null, frame_paths: null },
      { url: 'posts/u/m/video.mp4', thumb_path: 'posts/u/m/thumb.jpg', frame_paths: ['posts/u/m/f1.jpg'] },
    ],
  });
  const r = await collectPostMediaPaths({ from }, U);
  assert.deepEqual(r.postIds, ['p1', 'p2']);
  assert.deepEqual(r.paths.sort(), ['posts/u/0-1x1.jpg', 'posts/u/m/f1.jpg', 'posts/u/m/thumb.jpg', 'posts/u/m/video.mp4']);
  assert.ok(calls.includes(`select posts author_id=${U}`));
});

test('ilişkili kayıtlar: destek talepleri, gönderiler, takip, jeton, bildirim, olaylar silinir; e-posta/adres metni boşalır', async () => {
  const { from, calls } = fakeTables();
  const r = await cleanupUserRecords({ from }, U, ['p1']);
  for (const c of [
    `delete support_tickets user_id=${U}`,
    'delete post_media post_id in p1',
    `delete posts author_id=${U}`,
    `delete follows follower_id=${U}`,
    `delete follows following_id=${U}`,
    `delete push_tokens user_id=${U}`,
    `delete notification_sends user_id=${U}`,
    `delete analytics_events user_id=${U}`,
    `update feedback user_id=${U} {"user_email":null,"user_id":null}`,
    `update campaign_targets user_id=${U} {"user_email":null,"user_id":null}`,
    `update order_modifications user_id=${U} {"new_address_text":null,"customer_note":null}`,
  ]) {
    assert.ok(calls.includes(c), c);
  }
  assert.deepEqual(r.errors, []);
  // gönderi yoksa post tabloları hiç çağrılmaz
  const t2 = fakeTables();
  await cleanupUserRecords({ from: t2.from }, U, []);
  assert.ok(!t2.calls.some((c) => c.includes(' posts ')));
});

test('bir adım hata verse de diğerleri çalışır (best-effort), hata raporlanır', async () => {
  const { from: base, calls } = fakeTables();
  const from = (t: string) => (t === 'follows' ? { delete: () => ({ eq: () => Promise.reject(new Error('fk')) }) } : base(t));
  const r = await cleanupUserRecords({ from }, U, []);
  assert.equal(r.records.follows_out, 'error');
  assert.ok(r.errors.some((e) => e.startsWith('follows_out')));
  assert.ok(calls.includes(`delete push_tokens user_id=${U}`));
});

test('index.ts: sıra — yollar toplanır → Storage → orders (+konum/ham veri) → kayıtlar → deleteUser; migration FK CASCADE', () => {
  const idx = read('supabase/functions/delete-account/index.ts');
  const iCollect = idx.indexOf('collectPostMediaPaths(admin, userId)');
  const iStorage = idx.indexOf('removeUserStorage(admin, userId, postMediaPaths)');
  const iOrders = idx.indexOf("...ORDER_ANON_EXTRA");
  const iRecords = idx.indexOf('cleanupUserRecords(admin, userId, postIds, report)');
  const iDelete = idx.indexOf('admin.auth.admin.deleteUser(userId)');
  assert.ok(iCollect > 0 && iCollect < iStorage && iStorage < iOrders && iOrders < iRecords && iRecords < iDelete);
  assert.deepEqual(ORDER_ANON_EXTRA, { city: null, district: null, neighbourhood: null, external_payload: null });
  const mig = 'supabase/migrations/20261109220400_g20_s3_account_deletion.sql';
  assert.ok(existsSync(join(ROOT, mig)) && existsSync(join(ROOT, 'supabase/rollbacks/20261109220400_g20_s3_account_deletion_rollback.sql')));
  assert.match(read(mig), /references auth\.users\(id\) on delete cascade/);
});
