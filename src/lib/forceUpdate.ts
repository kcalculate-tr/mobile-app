import Constants from 'expo-constants';
import { getSupabaseClient } from './supabase';

export type ForceUpdateCheck = {
  required: boolean;
  message: string | null;
};

// Fail-open varsayılan: kontrol başarısız olursa kullanıcı KİLİTLENMEZ.
const FAIL_OPEN: ForceUpdateCheck = { required: false, message: null };

// "1.0.5" → [1,0,5]. Bozuk/eksik/negatif parça → null (güvenli taraf).
const parseVersion = (value: unknown): number[] | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length === 0 || parts.some((n) => !Number.isFinite(n) || n < 0)) {
    return null;
  }
  return parts;
};

// a < b ise true. Eksik haneler 0 sayılır (1.0 == 1.0.0).
const isOlder = (a: number[], b: number[]): boolean => {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
};

// settings.min_supported_version'ı okuyup mevcut app versiyonuyla kıyaslar.
// SADECE: mevcut versiyon okunabildi + min_supported_version dolu + mevcut < min
// ise required=true döner. Aksi her durumda (NULL, bozuk, hata, network) fail-open.
export const checkForceUpdate = async (): Promise<ForceUpdateCheck> => {
  try {
    const current = parseVersion(Constants.expoConfig?.version);
    if (!current) return FAIL_OPEN; // mevcut versiyon okunamadı → kilitleme

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('settings')
      .select('min_supported_version, force_update_message')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) return FAIL_OPEN; // settings okunamadı → kilitleme

    const min = parseVersion(data.min_supported_version);
    if (!min) return FAIL_OPEN; // min_supported_version NULL/bozuk → gösterme

    const message =
      typeof data.force_update_message === 'string' && data.force_update_message.trim()
        ? data.force_update_message.trim()
        : null;

    return { required: isOlder(current, min), message };
  } catch {
    return FAIL_OPEN; // beklenmedik hata → kilitleme
  }
};
