// G19-S1 (İlter 9 Kas onayı) — tarama fotoğrafını uzun kenar ≤ 1600 px'e küçült.
// Galeri fotoğrafı (ve `pictureSize` seçilemeyen cihazda kamera çekimi) 12–48 MP
// gelebiliyordu → 5 MB üstü reddediliyordu. `expo-image-manipulator` YENİ NATIVE
// modül: native modülü olmayan eski derlemede (OTA ile gelen JS) hiç yüklenmez,
// fotoğraf olduğu gibi kalır (5 MB ön kontrolü yine korur). Hata → orijinal.
import { requireOptionalNativeModule } from 'expo';
import { CAPTURE_MAX_EDGE } from './camera';

export const SHRINK_COMPRESS = 0.7;

export interface ImageSize {
  width: number;
  height: number;
}

/** Saf: küçültme gerekiyorsa tek resize eylemi (oran korunur, büyütme yok). */
export function shrinkAction(
  size: ImageSize | null | undefined,
  maxEdge: number = CAPTURE_MAX_EDGE,
): { resize: { width: number } } | { resize: { height: number } } | null {
  if (!size || !(size.width > 0) || !(size.height > 0)) return null;
  if (Math.max(size.width, size.height) <= maxEdge) return null;
  return size.width >= size.height ? { resize: { width: maxEdge } } : { resize: { height: maxEdge } };
}

type Manipulator = typeof import('expo-image-manipulator');
type Loader = () => Manipulator | null;

const defaultLoader: Loader = () => {
  try {
    if (!requireOptionalNativeModule('ExpoImageManipulator')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-manipulator') as Manipulator;
  } catch {
    return null;
  }
};

let loader: Loader = defaultLoader;

/** Test: modül yükleyicisini değiştir (`null` → varsayılan). */
export function setImageManipulatorLoader(next: Loader | null): void {
  loader = next ?? defaultLoader;
}

/** Küçültülmüş JPEG URI'si; gerek yoksa / modül yoksa / hata → aynı URI. */
export async function shrinkForScan(uri: string, size?: ImageSize | null): Promise<string> {
  const action = shrinkAction(size);
  if (!action) return uri;
  const M = loader();
  if (!M) return uri;
  try {
    const out = await M.manipulateAsync(uri, [action], { compress: SHRINK_COMPRESS, format: M.SaveFormat.JPEG });
    return out?.uri || uri;
  } catch {
    return uri;
  }
}
