// 18 Kas (İlter): metin paylaşımında Instagram paylaşım sayfasında çıkmıyor — Instagram yalnız
// görsel paylaşımda listelenir. Genel görsel paylaşımı: base64 PNG → önbellek dosyası → sistem sayfası.
// (shareCard.ts'teki öğün akışına dokunmaz; paket yok.)
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { track } from './analytics';

export async function sharePngImage(
  base64: string,
  fileStem: string,
  opts: { dialogTitle: string; target: 'streak' | 'day' | 'meal' | 'post' | 'app'; surface: string },
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('share_unavailable');
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('cache_unavailable');
  const safe = fileStem.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'kcal';
  const uri = `${dir}kcal-${safe}.png`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: opts.dialogTitle, UTI: 'public.png' });
  track('share', { target: opts.target, surface: opts.surface });
}
