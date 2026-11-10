// Profil fotoğrafı seç + yükle — ProfileScreen.tsx'teki `pickAvatar` ile AYNI
// mekanik (galeri izni → seç → base64 → `avatars` kovasına yükle → public URL).
// Fark: sonucu ham tabloya değil `update_public_profile` RPC'sine yazmak
// çağıranın sorumluluğu (bu dosya yalnız URL döner).
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '../../core/supabase';

export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  // G26-S1: sistem seçicisi (iOS PHPicker / Android Photo Picker) izin istemez — galeri izni SORULMAZ.

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.5,
  });
  if (result.canceled || !result.assets[0]) return null;

  const uri = result.assets[0].uri;
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
  const fileName = `${userId}.${ext}`;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from('avatars').upload(fileName, decode(base64), {
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: true,
  });
  if (error) return null;

  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return `${data.publicUrl}?t=${Date.now()}`;
}
