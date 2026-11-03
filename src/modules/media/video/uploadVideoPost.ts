// Video + kapak + 3 kare yükleme — G8-S3.md m.1. `post-media` kovasına
// `posts/{uid}/{mediaId}/...` altında (henüz post_id yok — create_post'tan
// ÖNCE çağrılır, dönen url/path'ler p_media'ya geçirilir). Kova politikası ve
// video boyut sınırı G8-S1'de genişletilir (bugün 5 MB/yalnız görsel — bkz.
// supabase/migrations/20261104000400_post_media_storage.sql); bu modül
// sözleşmedeki nihai şekli üretir, kota şu an sunucuda uygulanmıyor olabilir.
//
// fetch(uri).blob() deseni — büyük (≤50 MB) dosyalar için avatarUpload.ts'teki
// base64 çeviriminden (bellekte ~1.33x şişme) kaçınır; aynı desen zaten
// SupportScreen.tsx'teki ek yüklemede kullanılıyor.
import { getSupabaseClient } from '../../../core/supabase';
import { storagePathFor } from './rules';
import { VideoUploadCancelledError } from './types';
import type { PickedVideo, VideoFrames, VideoPostMedia, UploadVideoPostOptions } from './types';

const BUCKET = 'post-media';

async function uploadBlob(path: string, uri: string, contentType: string): Promise<void> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const { error } = await getSupabaseClient().storage.from(BUCKET).upload(path, blob, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
}

function publicUrlFor(path: string): string {
  const { data } = getSupabaseClient().storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function videoExt(mimeType: string | null): string {
  return mimeType === 'video/quicktime' ? 'mov' : 'mp4';
}

export async function uploadVideoPost(
  userId: string,
  picked: PickedVideo,
  frames: VideoFrames,
  options: UploadVideoPostOptions = {},
): Promise<VideoPostMedia> {
  const { onProgress, isCancelled, sort = 0 } = options;
  const mediaId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const checkCancelled = () => {
    if (isCancelled?.()) throw new VideoUploadCancelledError();
  };

  const frameNames = ['start', 'middle', 'end'] as const;
  const framePaths: [string, string, string] = ['', '', ''];

  for (let i = 0; i < frames.length; i += 1) {
    checkCancelled();
    const path = storagePathFor(userId, mediaId, `${frameNames[i]}.jpg`);
    await uploadBlob(path, frames[i].uri, 'image/jpeg');
    framePaths[i] = path;
    onProgress?.({ stage: 'frames', overall: ((i + 1) / frames.length) * 0.4 });
  }

  checkCancelled();
  onProgress?.({ stage: 'video', overall: 0.4 });
  const videoPath = storagePathFor(userId, mediaId, `video.${videoExt(picked.mimeType)}`);
  await uploadBlob(videoPath, picked.uri, picked.mimeType ?? 'video/mp4');
  onProgress?.({ stage: 'done', overall: 1 });

  return {
    kind: 'video',
    url: publicUrlFor(videoPath),
    width: picked.width,
    height: picked.height,
    duration_s: Math.round(picked.durationMs / 1000),
    // Kapak için ayrı bir yükleme yok — başı karesi (frame_paths[0]) kapak
    // olarak yeniden kullanılır (aynı görsel, tek dosya).
    thumb_path: framePaths[0],
    frame_paths: framePaths,
    sort,
  };
}
