// G59-S1 — Hikâye medyası yükleme: herkese açık `post-media` kovasında `stories/{uid}/…` (yükleme deseni
// Keşfet'le aynı: fetch(uri).blob() → storage.upload). Fotoğraf uzun kenar ≤ 1920'ye küçültülür (JPEG 0,8;
// mevcut expo-image-manipulator). Video: G58-S1 kuralları (≤ 60 sn / 50 MB; iOS galeri 720p dışa aktarma
// pickVideo'da) + ilk kare kapak (mevcut extractFrames). NOT: index'ten dışa açılmaz (native bağımlılık).
import * as ImageManipulator from 'expo-image-manipulator';
import { getSupabaseClient } from '../../core/supabase';
import { assertVideoDuration, assertVideoSize } from '../media/video/rules';
import { POST_MEDIA_BUCKET } from '../kesfet/mediaPath';

export const STORY_MAX_EDGE = 1920;

export function storyPath(userId: string, id: string, file: string): string {
  return `stories/${userId}/${id}/${file}`;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function uploadUri(path: string, uri: string, contentType: string): Promise<void> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const { error } = await getSupabaseClient().storage.from(POST_MEDIA_BUCKET).upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
}

export interface UploadedStoryMedia {
  mediaUrl: string;
  thumbUrl: string | null;
  width: number;
  height: number;
  durationS: number | null;
}

/** Fotoğraf: küçült (uzun kenar ≤ 1920) → yükle. Dönüş depo yolu (create_story bunu bekler). */
export async function uploadStoryPhoto(userId: string, uri: string, w: number, h: number): Promise<UploadedStoryMedia> {
  const long = Math.max(w, h);
  const resize = long > STORY_MAX_EDGE ? (w >= h ? { width: STORY_MAX_EDGE } : { height: STORY_MAX_EDGE }) : null;
  const out = await ImageManipulator.manipulateAsync(uri, resize ? [{ resize }] : [], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const path = storyPath(userId, newId(), 'photo.jpg');
  await uploadUri(path, out.uri, 'image/jpeg');
  return { mediaUrl: path, thumbUrl: null, width: out.width, height: out.height, durationS: null };
}

/** Video: süre/boyut doğrula → ilk kare kapak + video yükle. */
export async function uploadStoryVideo(
  userId: string,
  v: { uri: string; width: number; height: number; durationMs: number; fileSizeBytes?: number; mimeType?: string | null },
): Promise<UploadedStoryMedia> {
  assertVideoDuration(v.durationMs);
  if (v.fileSizeBytes) assertVideoSize(v.fileSizeBytes);
  const id = newId();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { extractFrames } = require('../media/video/extractFrames') as typeof import('../media/video/extractFrames');
  let thumbUrl: string | null = null;
  try {
    const frames = await extractFrames(v.uri, v.durationMs);
    thumbUrl = storyPath(userId, id, 'thumb.jpg');
    await uploadUri(thumbUrl, frames[0].uri, 'image/jpeg');
  } catch {
    thumbUrl = null; // kapak yoksa görüntüleyici videonun ilk karesini gösterir
  }
  const mov = v.mimeType === 'video/quicktime';
  const path = storyPath(userId, id, mov ? 'video.mov' : 'video.mp4');
  await uploadUri(path, v.uri, mov ? 'video/quicktime' : 'video/mp4');
  return { mediaUrl: path, thumbUrl, width: v.width, height: v.height, durationS: Math.max(1, Math.round(v.durationMs / 1000)) };
}

/** Bugünün öğün fotoğrafı (özel `user-media`) → `stories/{uid}/…` kopyası (hikâye tabanı). */
export async function copyMealPhotoToStory(userId: string, photoPath: string): Promise<UploadedStoryMedia | null> {
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb.storage.from('user-media').download(photoPath);
    if (error || !data) return null;
    const buf = await data.arrayBuffer();
    const path = storyPath(userId, newId(), 'meal.jpg');
    const up = await sb.storage.from(POST_MEDIA_BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: false });
    if (up.error) return null;
    return { mediaUrl: path, thumbUrl: null, width: 1080, height: 1350, durationS: null };
  } catch {
    return null;
  }
}
