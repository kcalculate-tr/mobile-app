// Galeriden video seç — G8-S3.md m.1: videoMaxDuration 60, orta kalite/720p,
// ≤ 50 MB (aşarsa anlaşılır hata). videoMaxDuration seçiciye ipucu verir ama
// galeriden önceden kaydedilmiş uzun bir video için OS garanti etmez — bu
// yüzden seçim sonrası süre/boyut burada AYRICA doğrulanır.
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { assertVideoDuration, assertVideoMime, assertVideoSize, assertVideoSizeKnown, videoMimeOf } from './rules';
import type { PickedVideo } from './types';

export async function pickVideo(): Promise<PickedVideo | null> {
  // G26-S1: sistem seçicisi (iOS PHPicker / Android Photo Picker) izin istemez — galeri izni SORULMAZ.

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    videoMaxDuration: 60,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    // G58: iOS galeriden seçilen video 720p H.264'e dışa aktarılır (Passthrough = orijinal 4K/1080p).
    // Android'de seçicinin sıkıştırma seçeneği yok → 50 MB sınırı doğrudan uygulanır (LOG).
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
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

  assertVideoMime(asset.mimeType, asset.uri);
  assertVideoDuration(durationMs);
  assertVideoSize(fileSizeBytes);
  // G58: boyut okunamadıysa 50 MB sınırı doğrulanamaz → ret.
  assertVideoSizeKnown(fileSizeBytes);

  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    durationMs,
    fileSizeBytes,
    mimeType: videoMimeOf(asset.mimeType, asset.uri),
  };
}
