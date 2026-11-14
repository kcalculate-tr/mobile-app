// Profil fotoğrafı seç + yükle — ProfileScreen.tsx'teki `pickAvatar` ile AYNI
// mekanik (galeri izni → seç → base64 → `avatars` kovasına yükle → public URL).
// Fark: sonucu ham tabloya değil `update_public_profile` RPC'sine yazmak
// çağıranın sorumluluğu (bu dosya yalnız URL döner).
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '../../core/supabase';
import { getProfilClient } from './client';
import type { AvatarSource, PickResult } from './avatarChange';

export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  // G26-S1: sistem seçicisi (iOS PHPicker / Android Photo Picker) izin istemez — galeri izni SORULMAZ.
  const uri = await pickAvatarImage('library');
  if (!uri || uri === 'denied') return null;
  return uploadAvatarUri(userId, uri).catch(() => null);
}

// ─── G53-S1 md.2: "+" rozeti seçenekleri (Fotoğraf çek · Galeriden seç · Fotoğrafı kaldır) ─────────────────
const PICK_OPTS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1] as [number, number],
  quality: 0.5,
};

/** Kare kırpmalı seçim. Kamera izni yoksa 'denied'; vazgeçilirse null. (İzin metinleri Info.plist'te.) */
export async function pickAvatarImage(source: AvatarSource): Promise<PickResult> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return 'denied';
    const r = await ImagePicker.launchCameraAsync(PICK_OPTS);
    return r.canceled || !r.assets[0] ? null : r.assets[0].uri;
  }
  const r = await ImagePicker.launchImageLibraryAsync(PICK_OPTS);
  return r.canceled || !r.assets[0] ? null : r.assets[0].uri;
}

/** Yerel dosya → `avatars` kovası (`{uid}.{ext}`, upsert) → herkese açık URL (önbellek kırıcıyla). Hata atar. */
export async function uploadAvatarUri(userId: string, uri: string): Promise<string> {
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
  const fileName = `${userId}.${ext}`;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from('avatars').upload(fileName, decode(base64), {
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** URL'yi profile yaz — update_public_profile (NULL ad/bio = değiştirme). */
export async function saveAvatarUrl(url: string): Promise<void> {
  await getProfilClient().updatePublicProfile({ displayName: null as unknown as string, bio: null, avatarUrl: url });
}

/**
 * Fotoğrafı kaldır. update_public_profile NULL'ı "değiştirme" sayar → kaldırma eski ProfileScreen'in yaptığı gibi
 * kendi profiles satırına doğrudan yazılır (sahibin güncelleme izni; şema değişikliği yok).
 */
export async function removeAvatarUrl(userId: string): Promise<void> {
  const { error } = await getSupabaseClient().from('profiles').update({ avatar_url: null }).eq('id', userId);
  if (error) throw error;
}
