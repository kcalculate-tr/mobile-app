// Paylaşım bağlantıları — tek kaynak (G61-S1 md.3, FinShareNotes "Bağlantı biçimi", İlter onaylı).
//
//   /p/<id> gönderi · /u/<kullanıcı> profil · /r/<tarif> tarif · /i/<kod> davet
//   /m/<id> öğün · /d/<id> gün · /x/<id> röntgen · /s/<id> hikâye
//
// Her paylaşılan bağlantıda `utm_source=<hedef>` (instagram, whatsapp, x, copy, save, other).
// SAF modül: React Native importu yok (Node `tsx --test` altında test edilir).
//
// `/s/` ÇAKIŞMASI (KARAR): `/s/<kod>` G20-S2'den beri saha kodu (attribution.ts,
// source=saha). Hikâye kimlikleri UUID olduğundan `/s/<uuid>` = hikâye, diğer her
// `/s/<kod>` = saha kodu (saha kodları ≤ 32 karakter, UUID biçiminde olamaz).

export type ShareKind = 'meal' | 'day' | 'post' | 'profile' | 'recipe' | 'invite' | 'xray' | 'story';
export type ShareTarget = 'instagram' | 'whatsapp' | 'x' | 'copy' | 'save' | 'other';

export const SHARE_KINDS: readonly ShareKind[] = ['meal', 'day', 'post', 'profile', 'recipe', 'invite', 'xray', 'story'];
export const SHARE_TARGETS: readonly ShareTarget[] = ['instagram', 'whatsapp', 'x', 'copy', 'save', 'other'];

export const SHARE_HOST = 'l.eatkcal.com';

export const KIND_PREFIX: Record<ShareKind, string> = {
  post: 'p',
  profile: 'u',
  recipe: 'r',
  invite: 'i',
  meal: 'm',
  day: 'd',
  xray: 'x',
  story: 's',
};

const PREFIX_KIND: Record<string, ShareKind> = Object.fromEntries(
  (Object.keys(KIND_PREFIX) as ShareKind[]).map((k) => [KIND_PREFIX[k], k]),
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

/** Kimlik bağlantıya güvenli girer: yalnız harf/rakam/_.- (ve @ olmadan kullanıcı adı). */
export function cleanShareId(kind: ShareKind, id: string | number | null | undefined): string | null {
  if (id == null) return null;
  let s = String(id).trim();
  if (kind === 'profile') s = s.replace(/^@+/, '');
  if (kind === 'invite') s = s.toUpperCase();
  if (!s || s.length > 64 || !/^[A-Za-z0-9_.-]+$/.test(s)) return null;
  if (kind === 'story' && !isUuid(s)) return null; // saha koduyla karışmasın
  return s;
}

/** Tam bağlantı. Hedef verilirse `?utm_source=<hedef>` eklenir. Geçersiz kimlik → null. */
export function shareLink(kind: ShareKind, id: string | number | null | undefined, target?: ShareTarget): string | null {
  const clean = cleanShareId(kind, id);
  if (!clean) return null;
  const base = `https://${SHARE_HOST}/${KIND_PREFIX[kind]}/${clean}`;
  return target ? `${base}?utm_source=${target}` : base;
}

/** Kartın alt köşesinde görünen kısa biçim (şema ve utm yok). */
export function displayLink(kind: ShareKind, id: string | number | null | undefined): string {
  const clean = cleanShareId(kind, id);
  return clean ? `${SHARE_HOST}/${KIND_PREFIX[kind]}/${clean}` : SHARE_HOST;
}

export type ParsedShareLink = { kind: ShareKind; id: string };

/** https://l.eatkcal.com/<p>/<id> ya da kcal://<p>/<id> → tür + kimlik. */
export function parseShareLink(url: string | null | undefined): ParsedShareLink | null {
  if (!url || typeof url !== 'string') return null;
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)/i.exec(url.trim());
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  let host = m[2].toLowerCase();
  let path = m[3] ?? '';
  if (scheme !== 'http' && scheme !== 'https') {
    path = `/${host}${path}`;
    host = '';
  } else if (host !== SHARE_HOST) {
    return null;
  }
  const parts = path.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const kind = PREFIX_KIND[parts[0].toLowerCase()];
  if (!kind) return null;
  let raw = parts[1];
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const id = cleanShareId(kind, raw);
  return id ? { kind, id } : null;
}

/** WhatsApp metin bağlantısı (metin + bağlantı tek mesaj). */
export function whatsappUrl(text: string, link: string): string {
  return `whatsapp://send?text=${encodeURIComponent(text ? `${text} ${link}` : link)}`;
}

/** X gönderi niyeti. */
export function xIntentUrl(text: string, link: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
}
