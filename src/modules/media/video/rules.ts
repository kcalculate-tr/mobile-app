// SAF yardımcılar — native import YOK, `tsx --test` (Node) altında koşar.
// pickVideo/extractFrames bu kuralları çağırır; mantık burada test edilir.
import { MAX_VIDEO_BYTES, MAX_VIDEO_DURATION_S, VideoTooLargeError, VideoTooLongError } from './types';

export function assertVideoDuration(durationMs: number): void {
  if (durationMs > MAX_VIDEO_DURATION_S * 1000) {
    throw new VideoTooLongError(durationMs);
  }
}

export function assertVideoSize(fileSizeBytes: number): void {
  if (fileSizeBytes > MAX_VIDEO_BYTES) {
    throw new VideoTooLargeError(fileSizeBytes);
  }
}

// Başı/ortası/sonu kare zaman damgaları (ms). Uçlarda siyah/boş kare riskine
// karşı küçük bir payla içeri çekilir; çok kısa videolarda (< 600ms) üç nokta
// da videonun içinde kalır ama birbirine yakın olabilir — kabul edilir.
export function frameTimestampsMs(durationMs: number): [number, number, number] {
  const EDGE_PAD_MS = 150;
  const d = Math.max(durationMs, 1);
  const start = Math.min(EDGE_PAD_MS, Math.floor(d / 3));
  const end = Math.max(d - EDGE_PAD_MS, Math.ceil((2 * d) / 3));
  const middle = Math.round(d / 2);
  return [start, middle, Math.min(end, d - 1 >= 0 ? d - 1 : 0)];
}

// create_post'tan ÖNCE yüklenir (henüz post_id yok) — G8-S1 "yol posts/{uid}/…"
// (G8-S1.md m.4). mediaId istemci tarafında üretilen tekil klasör adı; aynı
// gönderinin video + kapak + 3 karesi aynı klasöre düşer.
export function storagePathFor(userId: string, mediaId: string, fileName: string): string {
  return `posts/${userId}/${mediaId}/${fileName}`;
}
