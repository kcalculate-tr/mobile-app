// Bayrak çözümleme — SAF birleştirme mantığı (React Native importu yok, tsx --test).
//
// Canlı yolda sunucu (get_my_features) her bayrağın çözümlenmiş boolean'ını
// döner. İstemci bunu registry varsayılanlarıyla birleştirir: sunucuda
// bulunmayan / boolean olmayan / kayıt defterinde olmayan anahtarlar YEREL
// VARSAYILANDA (false) kalır. __DEV__'de yerel geçersiz kılma (override) en üste
// uygulanır.

import { defaultFlags, FlagKey, FLAG_DEFAULTS } from './registry';

/** Anahtar → boolean. Sunucu haritası, önbellek ve override için ortak tip. */
export type FlagMap = Partial<Record<string, boolean>>;

/**
 * Varsayılanlar + (sunucu/önbellek) + (__DEV__ override) birleşimi.
 *
 * - `remote` null/undefined (RPC hatası, çevrimdışı ve önbellek de yok) →
 *   yalnız varsayılanlar (hepsi false). Asla çökmez.
 * - `remote`'ta YALNIZ kayıt defterinde (FLAG_DEFAULTS) tanınan anahtarlar
 *   dikkate alınır; istemcinin bilmediği sunucu anahtarları yok sayılır
 *   (ileri-uyumlu: sunucu istemciden önde olabilir).
 * - `overrides` yalnız tanınan anahtarları ve yalnız boolean değerleri uygular.
 */
export function mergeFlags(
  remote?: FlagMap | null,
  overrides?: FlagMap | null,
): Record<FlagKey, boolean> {
  const out = defaultFlags();
  const keys = Object.keys(out) as FlagKey[];

  if (remote) {
    for (const k of keys) {
      const v = remote[k];
      if (typeof v === 'boolean') out[k] = v;
    }
  }

  if (overrides) {
    for (const k of keys) {
      const v = overrides[k];
      if (typeof v === 'boolean') out[k] = v;
    }
  }

  return out;
}

/** Tek bir bayrağın değeri; bilinmeyen/eksik → yerel varsayılan (çoğunlukla false). */
export function flagValue(
  key: FlagKey,
  remote?: FlagMap | null,
  overrides?: FlagMap | null,
): boolean {
  const merged = mergeFlags(remote, overrides);
  return merged[key] ?? FLAG_DEFAULTS[key] ?? false;
}
