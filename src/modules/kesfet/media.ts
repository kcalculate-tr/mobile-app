// Composer medya — galeriden en fazla 4 FOTOĞRAF seç + `user-media` kovasına
// yükle, create_post'un beklediği { path, width, height, kind } listesini döner.
// Video YOK (ayrı oturum). avatarUpload.ts ile aynı mekanik (izin → seç → base64
// → upload). Yükleme hatası → o görsel atlanır (sessiz). NOT: index.ts'ten dışa
// açılMAZ — testler asla import etmez (expo-image-picker native bağımlılığı).
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '../../core/supabase';
import type { CreatePostMedia } from './types';

export const MAX_PHOTOS = 4;

export interface LocalPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Galeriden en fazla `remaining` fotoğraf seç (yüklemeden). İzin yoksa []. */
export async function pickPhotos(remaining: number): Promise<LocalPhoto[]> {
  if (remaining <= 0) return [];
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: 0.6,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, remaining).map((a) => ({
    uri: a.uri,
    width: a.width ?? 1080,
    height: a.height ?? 1080,
  }));
}

/** Seçili fotoğrafları `user-media` kovasına yükle → create_post media listesi. */
export async function uploadPhotos(userId: string, photos: LocalPhoto[]): Promise<CreatePostMedia[]> {
  const supabase = getSupabaseClient();
  const out: CreatePostMedia[] = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    try {
      const ext = (p.uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
      const path = `${userId}/posts/${i}-${p.width}x${p.height}.${ext}`;
      const base64 = await FileSystem.readAsStringAsync(p.uri, { encoding: FileSystem.EncodingType.Base64 });
      const { error } = await supabase.storage.from('user-media').upload(path, decode(base64), {
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

/** Oturumdaki kullanıcının id'si (yoksa null). */
export async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await getSupabaseClient().auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}
