// Paylaşım kartı — cihazda görüntü üretimi + sistem paylaşımı (G5-S4).
//
// Yeni PAKET YOK: react-native-svg'nin <Svg> ref'indeki `toDataURL` ile kart
// bir PNG'ye (base64) çevrilir, expo-file-system/legacy ile önbellek klasörüne
// yazılır ve expo-sharing ile sistem paylaşım sayfası açılır. Aynı zincir
// uygulamada zaten kanıtlı (TrackerScreen PDF export: expo-print + Sharing).
//
// GİZLİLİK (bkz. .claude/night/G5-S4.md md.1): kartta yalnız öğün adı, porsiyon,
// kalori/protein ve "tahmin" etiketi bulunur — kişisel hedef ve gün toplamı YOK.
// Dosya önbellekte tutulur; paylaşım sonrası kullanıcı sistemine bırakılır.

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// react-native-svg <Svg> instance'ının açtığı yüzey. Tam tip paketten gelir;
// burada yalnız ihtiyacımız olan metodu daraltıyoruz (import döngüsü olmasın).
export type SvgCaptureRef = {
  toDataURL: (callback: (base64: string) => void, options?: object) => void;
};

/** Bir <Svg> ref'ini base64 PNG'ye çevirir (data: ön eki OLMADAN). */
export function captureSvgToPngBase64(ref: SvgCaptureRef | null): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ref || typeof ref.toDataURL !== 'function') {
      reject(new Error('Paylaşım kartı henüz hazır değil.'));
      return;
    }
    // toDataURL bazı sürümlerde "data:image/png;base64," ön ekiyle, bazılarında
    // çıplak base64 döndürür — ikisini de normalize ediyoruz.
    let done = false;
    const guard = setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error('Görsel üretimi zaman aşımına uğradı.'));
      }
    }, 8000);
    try {
      ref.toDataURL((data: string) => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        if (!data) {
          reject(new Error('Görsel üretilemedi.'));
          return;
        }
        const comma = data.indexOf(',');
        resolve(data.startsWith('data:') && comma >= 0 ? data.slice(comma + 1) : data);
      });
    } catch (e) {
      if (!done) {
        done = true;
        clearTimeout(guard);
        reject(e instanceof Error ? e : new Error('Görsel üretilemedi.'));
      }
    }
  });
}

function slugify(name: string): string {
  const map: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
  };
  return (name || 'ogun')
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => map[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'ogun';
}

/**
 * Base64 PNG'yi önbelleğe yazar ve sistem paylaşım sayfasını açar.
 * `seed` yalnız dosya adı benzersizliği için kullanılır (öğün id'si gibi) —
 * dosya adında sağlık verisi tutulmaz.
 */
export async function sharePngBase64(base64: string, mealName: string, seed?: string | number): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Bu cihazda paylaşım kullanılamıyor.');
  }
  const dir = FileSystem.cacheDirectory;
  if (!dir) {
    throw new Error('Geçici klasöre erişilemedi.');
  }
  // Benzersiz ad (Date.now kuralı gereği yok): öğün adı + verilen seed.
  const uniq = seed != null ? String(seed).replace(/[^a-zA-Z0-9]/g, '').slice(-10) : 'kart';
  const uri = `${dir}kcal-paylasim-${slugify(mealName)}-${uniq}.png`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: 'Öğün kartını paylaş',
    UTI: 'public.png',
  });
}
