// G53-S1 md.3 — Paylaşım ekranı "görsel kılavuzu" (i) değerleri. SAF (RN importu YOK → node:test).
// Değerler UYDURULMAZ: hepsi paylaşım kodundaki gerçek sınırlardan okunur.
//   · fotoğraf sayısı      → composer.ts MAX_PHOTOS (doğrulama + seçici `selectionLimit`)
//   · sıkıştırma           → mediaPath.ts PHOTO_QUALITY (media.ts seçici `quality`)
//   · en büyük dosya       → mediaPath.ts POST_MEDIA_MAX_BYTES (post-media kovası, sunucu)
//   · akış çerçevesi       → mediaPath.ts FEED_SINGLE_MIN_H / MAX_H (MediaGrid, contentFit cover)
//   · video süre / boyut   → media/video/types.ts MAX_VIDEO_DURATION_S / MAX_VIDEO_BYTES (pickVideo doğrular)
// Kırpma: Keşfet fotoğraf seçicisinde `allowsEditing` YOK → kodda zorunlu bir oran yok. Bu yüzden öneri olarak
// 1080 × 1350 (4:5 dikey) ve 1080 × 1080 (kare) yazılır; ikisi de akış çerçevesiyle çelişmez (test: g53ShareGuide).
import { MAX_PHOTOS } from './composer';
import { FEED_SINGLE_MAX_H, FEED_SINGLE_MIN_H, PHOTO_QUALITY, POST_MEDIA_MAX_BYTES } from './mediaPath';
import { MAX_VIDEO_BYTES, MAX_VIDEO_DURATION_S } from '../media/video/types';

/** Bir kez kendiliğinden gösterildi işareti (AsyncStorage). */
export const SHARE_GUIDE_SEEN_KEY = 'g53-share-guide-seen';

export const SHARE_GUIDE_RATIOS = [
  { key: 'portrait' as const, w: 1080, h: 1350 },
  { key: 'square' as const, w: 1080, h: 1080 },
];

const MB = 1024 * 1024;

export interface ShareGuideValues {
  maxPhotos: number;
  /** Seçicide kırpma yok (allowsEditing kapalı). */
  cropsOnPick: boolean;
  photoQualityPct: number;
  photoMaxMb: number;
  feedMinH: number;
  feedMaxH: number;
  videoMaxSeconds: number;
  videoMaxMb: number;
}

export function shareGuideValues(): ShareGuideValues {
  return {
    maxPhotos: MAX_PHOTOS,
    cropsOnPick: false,
    photoQualityPct: Math.round(PHOTO_QUALITY * 100),
    photoMaxMb: Math.round(POST_MEDIA_MAX_BYTES / MB),
    feedMinH: FEED_SINGLE_MIN_H,
    feedMaxH: FEED_SINGLE_MAX_H,
    videoMaxSeconds: MAX_VIDEO_DURATION_S,
    videoMaxMb: Math.round(MAX_VIDEO_BYTES / MB),
  };
}

/** Yüzde biçimi: TR "%60", EN "60%". */
export function pctLabel(n: number, lang: string): string {
  return lang === 'en' ? `${n}%` : `%${n}`;
}

/** İlk paylaşım ekranı açılışında kendiliğinden göster? (bir kez). */
export function shouldAutoShowGuide(seen: string | null | undefined): boolean {
  return !seen;
}
