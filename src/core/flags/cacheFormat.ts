// 16 Kas — bayrak önbelleği biçimi (saf; RN importu yok → node:test). Bkz. storage.ts.
import type { FlagMap } from './resolve';

/** { __v: uygulama sürümü, map } — sürüm uyuşmazsa ya da eski düz biçimse bayat (null). */
export function parseCachedFlags(raw: string | null, version: string): FlagMap | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (parsed.__v !== version) return null;
    const map = parsed.map;
    return map && typeof map === 'object' && !Array.isArray(map) ? (map as FlagMap) : null;
  } catch {
    return null;
  }
}
