// G20-S3 md.4 (B-08) — destek ekleri: yalnız yol, imzalı URL, eski URL'ler yola.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import {
  SIGNED_URL_TTL_S,
  isSupportPath,
  pathFromStorageUrl,
  safeFileName,
  signedAttachmentUrl,
  supportAttachmentPath,
  ticketMessage,
  ticketView,
  uploadSupportImages,
} from '../attachments';

const ROOT = join(__dirname, '..', '..', '..', '..');
const UID = '3f2a9c1e-1111-4222-8333-444455556666';

test('yol: tickets/<uid>/<zaman>_<güvenli ad>; kötü ad temizlenir', () => {
  assert.equal(supportAttachmentPath(UID, 'fiş 1.jpg', 1700), `tickets/${UID}/1700_fi_1.jpg`);
  assert.equal(safeFileName('../../etc/passwd'), 'passwd');
  assert.equal(safeFileName(''), 'image.jpg');
  assert.ok(isSupportPath(supportAttachmentPath(UID, 'a.png', 1), UID));
  assert.equal(isSupportPath(`tickets/${UID}/../x.png`), false);
  assert.equal(isSupportPath(`tickets/${UID}/a.png`, 'baska-kullanici-0000'), false);
  assert.equal(isSupportPath('avatars/a.png'), false);
});

test('mesaj: URL YOK, yalnız ek sayısı satırı', () => {
  assert.equal(ticketMessage('Merhaba', 0), 'Merhaba');
  const m = ticketMessage('Merhaba', 2);
  assert.equal(m, 'Merhaba\n\n--- Ekli Görseller (2) ---');
  assert.doesNotMatch(m, /https?:/);
});

test('eski public URL → yol; görünüm metni URL bölümünden arınır', () => {
  const url = `https://x.supabase.co/storage/v1/object/public/support-attachments/tickets/${UID}/17_a.jpg`;
  assert.equal(pathFromStorageUrl(url), `tickets/${UID}/17_a.jpg`);
  assert.equal(pathFromStorageUrl('https://x/storage/v1/object/public/avatars/u.jpg'), null);
  const legacy = ticketView({ message: `Ürün ezik geldi\n\n--- Ekli Görseller ---\n${url}\n${url.replace('17_a', '18_b')}` });
  assert.equal(legacy.body, 'Ürün ezik geldi');
  assert.deepEqual(legacy.paths, [`tickets/${UID}/17_a.jpg`, `tickets/${UID}/18_b.jpg`]);
  const fresh = ticketView({ message: ticketMessage('Selam', 1), attachments: [`tickets/${UID}/1_a.jpg`, 'kotu/yol', 5] });
  assert.equal(fresh.body, 'Selam');
  assert.deepEqual(fresh.paths, [`tickets/${UID}/1_a.jpg`]);
  assert.deepEqual(ticketView({ message: null }), { body: '', paths: [] });
});

test('yükleme: yalnız başarılı YOLLAR döner (URL üretilmez); imzalı URL kısa ömürlü', async () => {
  const uploads: string[] = [];
  const signs: [string, number][] = [];
  const client = {
    storage: {
      from: (bucket: string) => {
        assert.equal(bucket, 'support-attachments');
        return {
          upload: async (path: string) => {
            uploads.push(path);
            return { error: path.endsWith('bozuk.jpg') ? { message: 'x' } : null };
          },
          createSignedUrl: async (path: string, ttl: number) => {
            signs.push([path, ttl]);
            return { data: { signedUrl: `https://signed/${path}?token=t` }, error: null };
          },
        };
      },
    },
  };
  const paths = await uploadSupportImages(
    client,
    UID,
    [
      { uri: 'file:///a.jpg', fileName: 'a.jpg', type: 'image/jpeg' },
      { uri: 'file:///b.jpg', fileName: 'bozuk.jpg', type: 'image/jpeg' },
    ],
    async () => ({}) as Blob,
  );
  assert.equal(uploads.length, 2);
  assert.equal(paths.length, 1);
  assert.match(paths[0], new RegExp(`^tickets/${UID}/\\d+_a\\.jpg$`));
  assert.equal(await signedAttachmentUrl(client, paths[0]), `https://signed/${paths[0]}?token=t`);
  assert.deepEqual(signs, [[paths[0], SIGNED_URL_TTL_S]]);
  assert.ok(SIGNED_URL_TTL_S <= 600);
});

test('kaynakta destek kovası için getPublicUrl kalmadı', () => {
  const out = execSync(
    "grep -rn \"support-attachments').getPublicUrl\" src --include=*.ts --include=*.tsx | grep -v __tests__ || true",
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(out.trim(), '');
});
