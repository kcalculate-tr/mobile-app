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

// ── G58-S1 md.3 (kesfet_video bayrak açma turu) ─────────────────────────────

/** post-media deposunun kabul ettiği video türleri (g8_social: mp4 + quicktime). */
export const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/quicktime'] as const;

/** Uzantıdan/MIME'den tür; bilinmiyorsa null. Android 3gpp/webm depoya yüklenemez → seçimde reddedilir. */
export function videoMimeOf(mimeType: string | null | undefined, uri: string): string | null {
  const m = (mimeType ?? '').toLowerCase().trim();
  if (m) return m;
  const ext = (uri.split('?')[0].split('.').pop() ?? '').toLowerCase();
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  return null;
}

export class VideoUnsupportedError extends Error {
  constructor(public readonly mimeType: string | null) {
    super(`Video türü desteklenmiyor: ${mimeType ?? 'bilinmiyor'}`);
    this.name = 'VideoUnsupportedError';
  }
}

/** MIME bilinmiyorsa (sağlayıcı vermedi, uzantı yok) depo varsayılanı mp4 kabul edilir; bilinen ama desteklenmeyen tür reddedilir. */
export function assertVideoMime(mimeType: string | null | undefined, uri: string): void {
  const m = videoMimeOf(mimeType, uri);
  if (m != null && !(ALLOWED_VIDEO_MIME as readonly string[]).includes(m)) throw new VideoUnsupportedError(m);
}

/** Boyut okunamadıysa (0) 50 MB sınırı doğrulanamaz → reddedilir (eskiden 0 sınırı geçiyordu). */
export function assertVideoSizeKnown(fileSizeBytes: number): void {
  if (!(fileSizeBytes > 0)) throw new VideoUnsupportedError(null);
}

/** Seçim hatası → Composer metin anahtarı (eskiden HER hata "çok uzun" diyordu). */
export function videoPickErrorKey(e: unknown): 'video_too_long' | 'video_too_large' | 'video_unsupported' | 'video_failed' {
  const name = e instanceof Error ? e.name : '';
  if (name === 'VideoTooLongError') return 'video_too_long';
  if (name === 'VideoTooLargeError') return 'video_too_large';
  if (name === 'VideoUnsupportedError') return 'video_unsupported';
  return 'video_failed';
}

/** 60000 → "1:00", 42000 → "0:42" (Composer kutusu; eskiden "0:60" yazıyordu). */
export function formatVideoDuration(durationMs: number): string {
  const s = Math.max(0, Math.round(durationMs / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Akış ızgarası en çok 4 hücre. Gönderide video varsa İLK hücre video olur (4 foto + 1 video
 * gönderisinde video eskiden `slice(0, 4)` ile düşüyordu; sunucu ≤ 4 foto + ≤ 1 video kabul eder).
 */
export function gridMedia<T extends { kind?: string | null }>(media: readonly T[], max = 4): T[] {
  const v = media.find((m) => m.kind === 'video');
  if (!v) return media.slice(0, max);
  return [v, ...media.filter((m) => m !== v)].slice(0, max);
}

/**
 * Akışta oynayabilecek gönderi: görünür olan, YALNIZ ekran öndeyken ve tam ekran oynatıcı kapalıyken.
 */
export function feedPlayablePostId(visibleId: string | null, screenFocused: boolean, fullscreenPostId: string | null): string | null {
  if (!screenFocused || fullscreenPostId != null) return null;
  return visibleId;
}

/**
 * Oynatıcı (native decoder) yalnız görünür hücrede yaratılır; diğerleri kapak görseli. Liste
 * kaydırmada aynı anda en çok 1 akış oynatıcısı (+ tam ekran) — Android ExoPlayer sınırı.
 */
export function shouldMountPlayer(isVisible: boolean): boolean {
  return isVisible === true;
}

/**
 * Composer medya kotası — Final çubuğu "En fazla 4 foto veya 60 sn video": video da 1 hücre sayılır,
 * toplam en çok `max` (akış ızgarası 4 hücre). Video seçiliyken en çok 3 foto; 4 foto varken video yok.
 */
export function composerMediaCaps(photoCount: number, hasVideo: boolean, max = 4): { photoSlots: number; canAddVideo: boolean; used: number } {
  const used = Math.min(max, photoCount + (hasVideo ? 1 : 0));
  return { photoSlots: Math.max(0, max - used), canAddVideo: !hasVideo && photoCount < max, used };
}
