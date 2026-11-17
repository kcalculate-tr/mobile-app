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
 * 17 Kas: Tara fotoğrafını (özel `user-media` kovası) cihaza indirir → composer'da normal
 * fotoğraf gibi eklenir ve gönderiyle herkese açık post-media'ya yüklenir. Hata → null.
 */
export async function downloadScanPhoto(photoPath: string): Promise<LocalPhoto | null> {
  try {
    const { data, error } = await getSupabaseClient().storage.from('user-media').createSignedUrl(photoPath, 600);
    if (error || !data?.signedUrl) return null;
    const ext = (photoPath.split('.').pop() || 'jpg').toLowerCase();
    const target = `${FileSystem.cacheDirectory}scan-share-${Date.now()}.${ext === 'png' ? 'png' : 'jpg'}`;
    const res = await FileSystem.downloadAsync(data.signedUrl, target);
    if (res.status !== 200) return null;
    const { Image } = require('react-native') as typeof import('react-native');
    const size = await new Promise<{ width: number; height: number }>((resolve) =>
      Image.getSize(res.uri, (width, height) => resolve({ width, height }), () => resolve({ width: 1080, height: 1080 })),
    );
    return { uri: res.uri, width: size.width, height: size.height };
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
