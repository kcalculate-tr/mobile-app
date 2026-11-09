// G20-S3 md.4 (B-08) — Destek ekleri: `support-attachments` kovası canlıda ÖZEL
// (Claude 9 Kas; okuma: sahibi + admin). Talepte YALNIZ nesne yolu saklanır
// (`support_tickets.attachments` jsonb dizisi); herkese açık URL üretilmez. Gösterim
// anında kısa ömürlü imzalı URL (`createSignedUrl(s)`) alınır.
//
// Saf kısımlar (yol, mesaj, eski URL ayrıştırma) RN import etmez → tsx --test.
// Eski talepler: mesajın sonundaki "--- Ekli Görseller ---" + public URL'ler yola
// çevrilir (kova özel olduğu için o URL'ler artık açılmaz).

export const SUPPORT_BUCKET = 'support-attachments';
/** İmzalı URL ömrü (sn) — açıp bakmaya yeter, paylaşılırsa kısa sürede düşer. */
export const SIGNED_URL_TTL_S = 300;
export const LEGACY_MARKER = '--- Ekli Görseller ---';

/** Dosya adını yol güvenli hâle getir (yalnız harf/rakam . _ -). */
export function safeFileName(name: string): string {
  const base = (name || 'image.jpg').split(/[\\/]/).pop() || 'image.jpg';
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '');
  return (cleaned || 'image.jpg').slice(-80);
}

/** `tickets/<uid>/<zaman>_<ad>` — kova politikası `tickets/<auth.uid()>/` önekini bekler. */
export function supportAttachmentPath(userId: string, fileName: string, now: number = Date.now()): string {
  return `tickets/${userId}/${now}_${safeFileName(fileName)}`;
}

/** Bu kullanıcıya ait geçerli bir ek yolu mu? (`..` yok, doğru önek) */
export function isSupportPath(p: unknown, userId?: string): p is string {
  if (typeof p !== 'string' || p.includes('..') || p.length > 300) return false;
  if (!/^tickets\/[0-9a-fA-F-]{8,}\/[^/]+$/.test(p)) return false;
  return userId ? p.startsWith(`tickets/${userId}/`) : true;
}

/**
 * Talep mesajı: kullanıcının metni + (ek varsa) eski panelin de gördüğü kısa satır.
 * URL YOK; yollar `attachments` kolonunda.
 */
export function ticketMessage(text: string, attachmentCount: number): string {
  return attachmentCount > 0 ? `${text}\n\n--- Ekli Görseller (${attachmentCount}) ---` : text;
}

/** Herkese açık / imzalı Storage URL'sinden kova içi yolu çıkar. */
export function pathFromStorageUrl(url: string): string | null {
  const m = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/support-attachments\/([^?#\s]+)/.exec(url);
  if (!m) return null;
  try {
    const p = decodeURIComponent(m[1]);
    return isSupportPath(p) ? p : null;
  } catch {
    return null;
  }
}

/**
 * Talep → (gösterilecek metin, ek yolları). Yeni talepte yollar `attachments`'ta;
 * eski talepte mesajın sonundaki URL bölümünden çıkarılır ve metinden atılır.
 */
export function ticketView(t: { message?: string | null; attachments?: unknown }): { body: string; paths: string[] } {
  let body = t.message ?? '';
  const paths: string[] = [];
  if (Array.isArray(t.attachments)) {
    for (const p of t.attachments) if (isSupportPath(p) && !paths.includes(p)) paths.push(p);
  }
  // Yeni biçim satırı: "--- Ekli Görseller (N) ---"
  body = body.replace(/\n*--- Ekli Görseller \(\d+\) ---\s*$/, '');
  const i = body.indexOf(LEGACY_MARKER);
  if (i >= 0) {
    const tail = body.slice(i + LEGACY_MARKER.length);
    for (const line of tail.split(/\s+/)) {
      const p = line ? pathFromStorageUrl(line) : null;
      if (p && !paths.includes(p)) paths.push(p);
    }
    body = body.slice(0, i).replace(/\s+$/, '');
  }
  return { body, paths };
}

// ── Ağ (supabase istemcisi dışarıdan; test edilebilir) ────────────────────────
type StorageLike = {
  storage: {
    from: (bucket: string) => {
      upload: (path: string, body: Blob | ArrayBuffer, opts: { contentType?: string; upsert?: boolean }) => Promise<{ error: unknown }>;
      createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  };
};

export type LocalImage = { uri: string; fileName: string; type: string };

/** Görselleri yükle → yalnız başarıyla yüklenen YOLLAR (tek görsel hatası talebi durdurmaz). */
export async function uploadSupportImages(
  client: StorageLike,
  userId: string,
  images: LocalImage[],
  readBlob: (uri: string) => Promise<Blob> = async (uri) => (await fetch(uri)).blob(),
): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      const path = supportAttachmentPath(userId, img.fileName, Date.now() + i);
      const blob = await readBlob(img.uri);
      const { error } = await client.storage.from(SUPPORT_BUCKET).upload(path, blob, { contentType: img.type, upsert: false });
      if (!error) out.push(path);
    } catch {
      /* tek görsel yüklenemedi — talep yine gönderilir */
    }
  }
  return out;
}

/** Kısa ömürlü imzalı URL (yalnız sahibi/admin; RLS). Hata → null. */
export async function signedAttachmentUrl(
  client: StorageLike,
  path: string,
  ttl: number = SIGNED_URL_TTL_S,
): Promise<string | null> {
  try {
    const { data, error } = await client.storage.from(SUPPORT_BUCKET).createSignedUrl(path, ttl);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
