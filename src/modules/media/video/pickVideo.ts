// Galeriden video seç — G8-S3.md m.1: videoMaxDuration 60, orta kalite/720p,
// ≤ 50 MB (aşarsa anlaşılır hata). videoMaxDuration seçiciye ipucu verir ama
// galeriden önceden kaydedilmiş uzun bir video için OS garanti etmez — bu
// yüzden seçim sonrası süre/boyut burada AYRICA doğrulanır.
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { assertVideoDuration, assertVideoSize } from './rules';
import type { PickedVideo } from './types';

export async function pickVideo(): Promise<PickedVideo | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    videoMaxDuration: 60,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const durationMs = asset.duration ?? 0;
  // asset.fileSize bazı Android ContentProvider'larında gelmeyebilir — gelmezse
  // dosyadan gerçek boyutu oku (50 MB kontrolü asla atlanmasın).
  let fileSizeBytes = asset.fileSize ?? 0;
  if (!fileSizeBytes) {
    const info = await FileSystem.getInfoAsync(asset.uri);
    fileSizeBytes = info.exists ? info.size : 0;
  }

  assertVideoDuration(durationMs);
  assertVideoSize(fileSizeBytes);

  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    durationMs,
    fileSizeBytes,
    mimeType: asset.mimeType ?? null,
  };
}
