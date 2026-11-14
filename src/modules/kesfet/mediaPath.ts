// Gönderi medyası kova + yol — SAF (native yok), `tsx --test` altında doğrudan
// test edilir. media.ts (expo-image-picker native bağımlılığı) bunu kullanır.
// G9-3a: gönderi medyası herkese açık `post-media` kovasında `posts/{uid}/...`
// altında olmalı — hem akışta/takipçide görünür, hem de post-media yazma politikası
// (foldername[1]='posts', foldername[2]=uid) ile eşleşir.

export const POST_MEDIA_BUCKET = 'post-media';

/** `posts/{userId}/{index}-{w}x{h}.{ext}` — post-media yazma politikasıyla uyumlu. */
export function buildPostMediaPath(
  userId: string,
  index: number,
  width: number,
  height: number,
  ext: string,
): string {
  return `posts/${userId}/${index}-${width}x${height}.${ext}`;
}

// ─── G53-S1 md.3: paylaşım görsel sınırları (tek kaynak — media.ts, MediaGrid ve görsel kılavuzu bunu okur) ───
/** Fotoğraf seçicide JPEG sıkıştırma kalitesi (expo-image-picker `quality`). */
export const PHOTO_QUALITY = 0.6;
/**
 * `post-media` kovasının dosya başı sınırı (sunucu): 50 MB — supabase/migrations/20261104002000_g8_social.sql
 * §15 `file_size_limit = 52428800`. Fotoğraf için istemcide ayrı bir sınır yok; kova bu tavanı uygular.
 */
export const POST_MEDIA_MAX_BYTES = 50 * 1024 * 1024;
/** Akışta TEK görselin çerçeve yüksekliği (pt): en-boy oranından, bu aralığa sıkıştırılır (contentFit cover). */
export const FEED_SINGLE_MIN_H = 180;
export const FEED_SINGLE_MAX_H = 320;
/** Ölçüsü bilinmeyen görselde çerçeve yüksekliği. */
export const FEED_DEFAULT_H = 220;

/** Akışta tek görsel çerçevesi: genişlik w'de, görsel imgW×imgH → yükseklik (MediaGrid ile aynı formül). */
export function feedSingleFrameHeight(w: number, imgW: number, imgH: number): number {
  if (!(imgW > 0) || !(imgH > 0)) return FEED_DEFAULT_H;
  return Math.round(Math.min(FEED_SINGLE_MAX_H, Math.max(FEED_SINGLE_MIN_H, (w * imgH) / imgW)));
}
