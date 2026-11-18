// Composer medya — galeriden en fazla 4 FOTOĞRAF seç + herkese açık `post-media`
// kovasına (`posts/{uid}/...`) yükle, create_post'un beklediği { path, width,
// height, kind } listesini döner. (G9-3a: gönderi medyası özel user-media yerine
// herkese açık post-media'da olmalı ki akışta/takipçide görünsün; video da oraya.)
// Video YOK (ayrı oturum). avatarUpload.ts ile aynı mekanik (izin → seç → base64
// → upload). Yükleme hatası → o görsel atlanır (sessiz). NOT: index.ts'ten dışa
// açılMAZ — testler asla import etmez (expo-image-picker native bağımlılığı).
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '../../core/supabase';
import { PHOTO_QUALITY, POST_MEDIA_BUCKET, buildPostMediaPath } from './mediaPath';
import type { CreatePostMedia } from './types';

// G53-S1: tek kaynak composer.ts (doğrulama + görsel kılavuzu aynı sayıyı okur).
export { MAX_PHOTOS } from './composer';

export interface LocalPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Galeriden en fazla `remaining` fotoğraf seç (yüklemeden). İzin yoksa []. */
export async function pickPhotos(remaining: number): Promise<LocalPhoto[]> {
  if (remaining <= 0) return [];
  // G26-S1: sistem seçicisi (iOS PHPicker / Android Photo Picker) izin istemez — galeri izni SORULMAZ.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: PHOTO_QUALITY,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, remaining).map((a) => ({
    uri: a.uri,
    width: a.width ?? 1080,
    height: a.height ?? 1080,
  }));
}

/** Seçili fotoğrafları `post-media` kovasına yükle → create_post media listesi. */
export async function uploadPhotos(userId: string, photos: LocalPhoto[]): Promise<CreatePostMedia[]> {
  const supabase = getSupabaseClient();
  const out: CreatePostMedia[] = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    try {
      const ext = (p.uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
      const path = buildPostMediaPath(userId, i, p.width, p.height, ext);
      const base64 = await FileSystem.readAsStringAsync(p.uri, { encoding: FileSystem.EncodingType.Base64 });
      const { error } = await supabase.storage.from(POST_MEDIA_BUCKET).upload(path, decode(base64), {
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        upsert: true,
      });
      if (error) continue;
      out.push({ path, width: p.width, height: p.height, kind: 'image' });
    } catch {
      // bu görseli atla
    }
  }
  return out;
}

/**
 * 17 Kas: Tara çıkartmasını (özel `user-media`) herkese açık `post-media`ya kopyalar ve öğün
 * kartının `photo_url`'i olacak herkese açık URL'yi döner (gönderiye ayrı görsel EKLENMEZ).
 * Yol `posts/{uid}/sticker-…` — post-media yazma politikasıyla uyumlu. Hata → null.
 */
export async function publishMealSticker(userId: string, stickerPath: string): Promise<string | null> {
  try {
    // 18 Kas: React Native'de Blob.arrayBuffer() yok → download() + arrayBuffer() sessizce düşüyordu
    // (çıkartma hiç kopyalanmıyordu). uploadPhotos ile aynı kanıtlı yol: imzalı URL → önbelleğe indir
    // → base64 → ArrayBuffer.
    const sb = getSupabaseClient();
    const signed = await sb.storage.from('user-media').createSignedUrl(stickerPath, 120);
    if (signed.error || !signed.data?.signedUrl) return null;
    const isPng = stickerPath.toLowerCase().endsWith('.png');
    const file = (stickerPath.split('/').pop() || 'sticker.webp').replace(/[^A-Za-z0-9._-]/g, '_');
    const dir = FileSystem.cacheDirectory;
    if (!dir) return null;
    const local = `${dir}kcal-sticker-${file}`;
    const dl = await FileSystem.downloadAsync(signed.data.signedUrl, local);
    if (dl.status !== 200) return null;
    const base64 = await FileSystem.readAsStringAsync(local, { encoding: FileSystem.EncodingType.Base64 });
    const path = `posts/${userId}/sticker-${file}`;
    const up = await sb.storage.from(POST_MEDIA_BUCKET).upload(path, decode(base64), { contentType: isPng ? 'image/png' : 'image/webp', upsert: true });
    if (up.error) return null;
    return sb.storage.from(POST_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl ?? null;
  } catch {
    return null;
  }
}

/** Oturumdaki kullanıcının id'si (yoksa null). */
export async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await getSupabaseClient().auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}
