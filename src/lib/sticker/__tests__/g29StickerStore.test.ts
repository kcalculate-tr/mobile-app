// G29-S1 md.1 — çıkartma kaydı yedek yolları: migration yokken (sütun yok) dosya geri silinir ve
// oturumda bir daha denenmez; okuma toplu ve önbellekli; hiçbir yol fırlatmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetStickerStore,
  forgetSticker,
  isMissingColumnError,
  loadStickerPath,
  peekLocalSticker,
  peekStickerPath,
  rememberLocalSticker,
  stickerColumnState,
  stickerStoragePath,
  uploadSticker,
  type StickerClient,
} from '../stickerStore';
import type { Sticker } from '../subjectLift';

const U = '11111111-1111-1111-1111-111111111111';
const ROW = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const STICKER: Sticker = {
  uri: 'file:///tmp/s.webp',
  width: 512,
  height: 384,
  format: 'webp',
  bytes: 20000,
  sourceWidth: 1600,
  sourceHeight: 1200,
  crop: { x: 0, y: 0, width: 1, height: 1 },
};
const bytes = (n: number) => async () => new ArrayBuffer(n);

type Err = { code?: string; message?: string } | null;
function fakeClient(opts: { uploadErr?: Err; updateErr?: Err; selectErr?: Err; selectRows?: { id: string; sticker_path: string | null }[]; selectThrows?: boolean } = {}) {
  const log = { uploads: [] as { path: string; type: string; upsert: boolean }[], removes: [] as string[][], updates: [] as { values: Record<string, unknown>; id: string }[], selects: [] as string[][] };
  const client: StickerClient = {
    storage: {
      from: (bucket: string) => {
        assert.equal(bucket, 'user-media');
        return {
          upload: async (path, _body, o) => {
            log.uploads.push({ path, type: o.contentType, upsert: o.upsert });
            return { error: opts.uploadErr ?? null };
          },
          remove: async (paths) => {
            log.removes.push(paths);
            return { error: null };
          },
        };
      },
    },
    from: (table: string) => {
      assert.equal(table, 'meal_consumptions');
      return {
        update: (values) => ({
          eq: async (_c, id) => {
            log.updates.push({ values, id });
            return { error: opts.updateErr ?? null };
          },
        }),
        select: (cols) => {
          assert.equal(cols, 'id,sticker_path');
          return {
            in: async (_c, ids) => {
              log.selects.push(ids);
              if (opts.selectThrows) throw new Error('network');
              return { data: opts.selectErr ? null : opts.selectRows ?? [], error: opts.selectErr ?? null };
            },
          };
        },
      };
    },
  };
  return { client, log };
}

test.beforeEach(() => __resetStickerStore());

test('yol: <uid>/stickers/<kayıt id>.webp (kova sahiplik politikası + hesap silme kapsar)', () => {
  assert.equal(stickerStoragePath(U, ROW), `${U}/stickers/${ROW}.webp`);
  assert.equal(stickerStoragePath(U, ROW, 'png'), `${U}/stickers/${ROW}.png`);
  assert.equal(stickerStoragePath(U, '../x/y'), `${U}/stickers/___x_y.webp`);
  assert.throws(() => stickerStoragePath('', ROW));
});

test('sütun yok hatası tanınır (42703 / PGRST204 / mesaj)', () => {
  assert.equal(isMissingColumnError({ code: '42703' }), true);
  assert.equal(isMissingColumnError({ code: 'PGRST204' }), true);
  assert.equal(isMissingColumnError({ message: "Could not find the 'sticker_path' column" }), true);
  assert.equal(isMissingColumnError({ code: '42501', message: 'permission denied' }), false);
  assert.equal(isMissingColumnError(null), false);
});

test('başarılı: WebP yüklenir (upsert), sticker_path yazılır, yol önbelleğe girer', async () => {
  const { client, log } = fakeClient();
  const r = await uploadSticker(client, { userId: U, rowId: ROW, sticker: STICKER, readBytes: bytes(20000) });
  assert.deepEqual(r, { ok: true, path: `${U}/stickers/${ROW}.webp` });
  assert.deepEqual(log.uploads, [{ path: `${U}/stickers/${ROW}.webp`, type: 'image/webp', upsert: true }]);
  assert.deepEqual(log.updates, [{ values: { sticker_path: `${U}/stickers/${ROW}.webp` }, id: ROW }]);
  assert.equal(peekStickerPath(ROW), `${U}/stickers/${ROW}.webp`);
  assert.equal(stickerColumnState(), 'present');
});

test('yedek: migration yok (sütun yok) → dosya geri silinir, oturumda bir daha denenmez', async () => {
  const { client, log } = fakeClient({ updateErr: { code: 'PGRST204', message: "Could not find the 'sticker_path' column" } });
  const r = await uploadSticker(client, { userId: U, rowId: ROW, sticker: STICKER, readBytes: bytes(100) });
  assert.deepEqual(r, { ok: false, path: null, reason: 'column_missing' });
  assert.deepEqual(log.removes, [[`${U}/stickers/${ROW}.webp`]]);
  assert.equal(stickerColumnState(), 'missing');
  const r2 = await uploadSticker(client, { userId: U, rowId: 'b', sticker: STICKER, readBytes: bytes(100) });
  assert.equal(r2.reason, 'column_missing');
  assert.equal(log.uploads.length, 1, 'ikinci yükleme yapılmadı');
  // okuma da sorulmaz
  assert.equal(await loadStickerPath(client, ROW), null);
  assert.equal(log.selects.length, 0);
});

test('yedek: başka güncelleme hatası → dosya silinir, sütun durumu değişmez', async () => {
  const { client, log } = fakeClient({ updateErr: { code: '42501', message: 'rls' } });
  const r = await uploadSticker(client, { userId: U, rowId: ROW, sticker: STICKER, readBytes: bytes(100) });
  assert.equal(r.reason, 'update_failed');
  assert.equal(log.removes.length, 1);
  assert.equal(stickerColumnState(), 'unknown');
});

test('yedek: yükleme hatası / okunamayan dosya / çok büyük / kullanıcı-kayıt yok', async () => {
  const a = fakeClient({ uploadErr: { message: 'Bucket not found' } });
  assert.equal((await uploadSticker(a.client, { userId: U, rowId: ROW, sticker: STICKER, readBytes: bytes(10) })).reason, 'upload_failed');
  assert.equal(a.log.updates.length, 0);
  const b = fakeClient();
  assert.equal((await uploadSticker(b.client, { userId: U, rowId: ROW, sticker: STICKER, readBytes: async () => null })).reason, 'read_failed');
  assert.equal((await uploadSticker(b.client, { userId: U, rowId: ROW, sticker: STICKER, readBytes: bytes(2 * 1024 * 1024) })).reason, 'too_large');
  assert.equal((await uploadSticker(b.client, { userId: null, rowId: ROW, sticker: STICKER, readBytes: bytes(10) })).reason, 'no_user');
  assert.equal((await uploadSticker(b.client, { userId: U, rowId: null, sticker: STICKER, readBytes: bytes(10) })).reason, 'no_row');
  assert.equal((await uploadSticker(b.client, { userId: U, rowId: ROW, sticker: STICKER, readBytes: async () => { throw new Error('io'); } })).reason, 'upload_failed');
  assert.equal(b.log.uploads.length, 0);
});

test('PNG yedeği image/png ile yüklenir', async () => {
  const { client, log } = fakeClient();
  await uploadSticker(client, { userId: U, rowId: ROW, sticker: { ...STICKER, format: 'png' }, readBytes: bytes(10) });
  assert.equal(log.uploads[0].type, 'image/png');
  assert.ok(log.uploads[0].path.endsWith('.png'));
});

test('okuma: aynı karede istenen kayıtlar TEK sorguda; sonuç önbellekte', async () => {
  const { client, log } = fakeClient({ selectRows: [{ id: 'r1', sticker_path: `${U}/stickers/r1.webp` }] });
  const [a, b] = await Promise.all([loadStickerPath(client, 'r1'), loadStickerPath(client, 'r2')]);
  assert.equal(a, `${U}/stickers/r1.webp`);
  assert.equal(b, null);
  assert.deepEqual(log.selects, [['r1', 'r2']]);
  assert.equal(await loadStickerPath(client, 'r1'), `${U}/stickers/r1.webp`);
  assert.equal(log.selects.length, 1, 'önbellekten');
});

test('yedek okuma: sütun yok → null ve bir daha sorulmaz; ağ hatası kalıcı değil', async () => {
  const miss = fakeClient({ selectErr: { code: '42703', message: 'column meal_consumptions.sticker_path does not exist' } });
  assert.equal(await loadStickerPath(miss.client, 'r1'), null);
  assert.equal(stickerColumnState(), 'missing');
  assert.equal(await loadStickerPath(miss.client, 'r2'), null);
  assert.equal(miss.log.selects.length, 1);

  __resetStickerStore();
  const net = fakeClient({ selectThrows: true });
  assert.equal(await loadStickerPath(net.client, 'r1'), undefined);
  assert.equal(peekStickerPath('r1'), undefined, 'önbelleğe yazılmadı');
  await loadStickerPath(net.client, 'r1');
  assert.equal(net.log.selects.length, 2, 'yeniden denendi');
});

test('yerel eşleme: log → satır aynı çıkartmayı ağsız gösterir; Geri al unutur', () => {
  rememberLocalSticker(ROW, 'file:///tmp/s.webp');
  assert.equal(peekLocalSticker(ROW), 'file:///tmp/s.webp');
  forgetSticker(ROW);
  assert.equal(peekLocalSticker(ROW), null);
  rememberLocalSticker(null, 'x');
  assert.equal(peekLocalSticker(null), null);
});
