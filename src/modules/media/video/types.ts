// Video medya tipleri — G8-CONTRACT.md "post_media" alanlarıyla uyumlu
// (kind/duration_s/thumb_path/frame_paths). Bu kolonlar sunucuda G8-S1'de
// eklenecek; burada yalnız o sözleşmeyi BİREBİR yansıtıyoruz, tahmin yok.

export const MAX_VIDEO_DURATION_S = 60;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

export interface PickedVideo {
  uri: string;
  width: number;
  height: number;
  durationMs: number;
  fileSizeBytes: number;
  mimeType: string | null;
}

export class VideoTooLongError extends Error {
  constructor(public readonly durationMs: number) {
    super(`Video ${Math.round(durationMs / 1000)} sn — en fazla ${MAX_VIDEO_DURATION_S} sn olabilir.`);
    this.name = 'VideoTooLongError';
  }
}

export class VideoTooLargeError extends Error {
  constructor(public readonly fileSizeBytes: number) {
    super(`Video ${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB — en fazla 50 MB olabilir.`);
    this.name = 'VideoTooLargeError';
  }
}

export class VideoUploadCancelledError extends Error {
  constructor() {
    super('Video yüklemesi iptal edildi.');
    this.name = 'VideoUploadCancelledError';
  }
}

// Başı/ortası/sonu sırasıyla — kapak (thumb_path) ilk kareyi yeniden kullanır.
export interface VideoFrame {
  uri: string;
  atMs: number;
  width: number;
  height: number;
}

export type VideoFrames = [VideoFrame, VideoFrame, VideoFrame];

// uploadVideoPost() çıktısı — create_post'un p_media[] girdisine BİREBİR uyar.
export interface VideoPostMedia {
  kind: 'video';
  url: string;
  width: number;
  height: number;
  duration_s: number;
  thumb_path: string;
  frame_paths: [string, string, string];
  sort: number;
}

export type UploadStage = 'frames' | 'video' | 'done';

export interface UploadProgress {
  stage: UploadStage;
  /** 0..1 toplam ilerleme. */
  overall: number;
}

export interface UploadVideoPostOptions {
  onProgress?: (progress: UploadProgress) => void;
  /** Her adımdan önce kontrol edilir; true dönerse VideoUploadCancelledError fırlatılır. */
  isCancelled?: () => boolean;
  sort?: number;
}
