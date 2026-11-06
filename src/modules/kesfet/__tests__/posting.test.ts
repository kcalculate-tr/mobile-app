// G15-S3 — FinPosting durum deposu: aşamalar, ilerleme oranı, temizleme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { postingProgress, usePostingStore } from '../postingStore';

test('ilerleme oranı: paylaşılıyor < inceleniyor; yayında/ret/hata çizgisiz', () => {
  assert.equal(postingProgress('uploading'), 0.4);
  assert.ok((postingProgress('publishing') ?? 0) > (postingProgress('uploading') ?? 0));
  assert.equal(postingProgress('reviewing'), 0.8);
  assert.equal(postingProgress('published'), null);
  assert.equal(postingProgress('rejected'), null);
  assert.equal(postingProgress('error'), null);
  assert.equal(postingProgress('idle'), null);
});

test('set/clear: gönderi kimliği ve tekrar dene korunur, clear sıfırlar', () => {
  const retry = () => {};
  usePostingStore.getState().set('uploading', { postId: null, error: null, retry: null });
  usePostingStore.getState().set('reviewing', { postId: 'p1' });
  assert.equal(usePostingStore.getState().phase, 'reviewing');
  assert.equal(usePostingStore.getState().postId, 'p1');
  usePostingStore.getState().set('error', { error: 'ağ', retry });
  assert.equal(usePostingStore.getState().retry, retry);
  assert.equal(usePostingStore.getState().postId, 'p1');
  usePostingStore.getState().clear();
  assert.deepEqual(
    { phase: usePostingStore.getState().phase, postId: usePostingStore.getState().postId, retry: usePostingStore.getState().retry },
    { phase: 'idle', postId: null, retry: null },
  );
});
