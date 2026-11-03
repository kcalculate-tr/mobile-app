// Rollout kovası — sunucudaki public._ff_fnv1a_bucket ile BİREBİR aynı algoritma.
//
// FNV-1a 32-bit hash, UTF-8 bayt dizisi üzerinde. Sunucu (get_my_features) ve
// istemci aynı girdi için aynı kovayı (0..99) üretmeli; yoksa bir kullanıcı
// sunucuda dalgaya dahil ama istemcide değil (ya da tersi) görünürdü. Bu modül
// SAF: React Native / platform API'si import etmez, tsx --test ile çalışır.
//
// NOT: Bugün canlı çözümlemeyi SUNUCU yapıyor (get_my_features { key: bool }
// döner). Bu fonksiyonlar (a) algoritmanın birebir eşleştiğini kanıtlayan unit
// testler ve (b) __DEV__ tanı ekranında "bu kullanıcı hangi kovada" göstermek
// için var — tek doğruluk kaynağı yine sunucu.

// Postgres convert_to(text, 'UTF8') ile aynı baytları üretir. Anahtarlar ASCII
// olsa da tam UTF-8 (BMP + surrogate çiftleri) doğru işlenir.
function utf8Bytes(input: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let code = input.charCodeAt(i);
    // Surrogate çifti → tek kod noktası
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

/**
 * FNV-1a 32-bit → 0..99 kova. Deterministik ve saf.
 * Math.imul + `>>> 0` ile 32-bit taşmasız çarpım; Postgres'in `% 2^32`siyle
 * aynı bit desenini üretir.
 */
export function fnv1aBucket(input: string): number {
  const bytes = utf8Bytes(input);
  let h = 2166136261 >>> 0; // FNV offset basis
  for (let i = 0; i < bytes.length; i += 1) {
    h = (h ^ bytes[i]) >>> 0;
    h = Math.imul(h, 16777619) >>> 0; // FNV prime
  }
  return h % 100;
}

/**
 * Bir bayrak + kullanıcı için rollout kovası. Girdi biçimi sunucuyla aynı:
 * `key || ':' || user_id`.
 */
export function rolloutBucket(flagKey: string, userId: string): number {
  return fnv1aBucket(`${flagKey}:${userId}`);
}

/**
 * Kullanıcı bu bayrağın rollout dalgasına dahil mi? Kova < rollout_percent.
 * rollout_percent 0 → kimse (0 < 0 asla), 100 → herkes (en çok 99 < 100).
 */
export function inRollout(flagKey: string, userId: string, rolloutPercent: number): boolean {
  if (!Number.isFinite(rolloutPercent) || rolloutPercent <= 0) return false;
  if (rolloutPercent >= 100) return true;
  return rolloutBucket(flagKey, userId) < rolloutPercent;
}
