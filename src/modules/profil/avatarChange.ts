// G53-S1 md.2 — Profil fotoğrafı değişimi: SAF akış (RN/native importu YOK → node:test). Uygulama tarafı
// (seçici, yükleme, kayıt) bağımlılık olarak verilir: ../ui/AvatarEditor.tsx → avatarUpload.ts.
//
// Akış: seç (kare kırpma) → ANINDA yerel fotoğraf + dönen gösterge → yükle → kaydet → sunucu URL'si.
// Hata (yükleme ya da kayıt) → ESKİ fotoğraf geri gelir + kısa uyarı. Vazgeçilirse hiçbir şey değişmez.
// Kaldırma: iyimser boşaltma; hata → eski fotoğraf + uyarı.

export type AvatarSource = 'camera' | 'library';

export type AvatarOutcome = 'cancelled' | 'updated' | 'failed' | 'removed' | 'remove_failed' | 'denied';

/** Seçicinin sonucu: yerel uri | null (vazgeçti) | 'denied' (kamera izni yok). */
export type PickResult = string | null | 'denied';

export interface AvatarChangeDeps {
  pick: (source: AvatarSource) => Promise<PickResult>;
  /** Yerel uri → herkese açık URL (avatars kovası). Hata atabilir ya da null dönebilir. */
  upload: (uri: string) => Promise<string | null>;
  /** URL'yi profile yaz (update_public_profile). Hata atabilir. */
  save: (url: string) => Promise<void>;
  /** Ekrandaki avatarı değiştir (iyimser + geri alma). */
  apply: (url: string | null) => void;
  setBusy: (busy: boolean) => void;
}

export async function runAvatarChange(source: AvatarSource, prev: string | null, d: AvatarChangeDeps): Promise<AvatarOutcome> {
  let picked: PickResult;
  try {
    picked = await d.pick(source);
  } catch {
    return 'cancelled';
  }
  if (picked === 'denied') return 'denied';
  if (!picked) return 'cancelled';
  d.apply(picked);
  d.setBusy(true);
  try {
    const url = await d.upload(picked);
    if (!url) throw new Error('upload');
    await d.save(url);
    d.apply(url);
    return 'updated';
  } catch {
    d.apply(prev);
    return 'failed';
  } finally {
    d.setBusy(false);
  }
}

export async function runAvatarRemove(
  prev: string | null,
  d: { remove: () => Promise<void>; apply: (url: string | null) => void; setBusy: (busy: boolean) => void },
): Promise<AvatarOutcome> {
  if (!prev) return 'cancelled';
  d.apply(null);
  d.setBusy(true);
  try {
    await d.remove();
    return 'removed';
  } catch {
    d.apply(prev);
    return 'remove_failed';
  } finally {
    d.setBusy(false);
  }
}

/** Seçenek sayfası satırları: "Fotoğrafı kaldır" yalnız foto varsa. */
export function avatarSheetOptions(hasPhoto: boolean): Array<'take' | 'library' | 'remove'> {
  return hasPhoto ? ['take', 'library', 'remove'] : ['take', 'library'];
}

/**
 * Keşfet üst çubuğu profil kısayolu hedefi: oturum yok → giriş katmanı (AuthSheet = `Login`); handle varsa
 * kendi herkese açık profili (`PublicProfile`); handle henüz yoksa (kullanıcı adı alınmamış) kendi profil
 * önizlemesi (`ProfileSub` › public — aynı FinProfilePublic düzeni).
 */
export type MeShortcutTarget =
  | { name: 'Login' }
  | { name: 'PublicProfile'; params: { handle: string } }
  | { name: 'ProfileSub'; params: { sub: 'public'; handle: null; displayName?: string; avatarUrl: string | null } };

export function meShortcutTarget(me: { signedIn: boolean; handle: string | null; name: string | null; avatarUrl: string | null }): MeShortcutTarget {
  if (!me.signedIn) return { name: 'Login' };
  const h = (me.handle ?? '').trim().replace(/^@/, '');
  if (h) return { name: 'PublicProfile', params: { handle: h } };
  return { name: 'ProfileSub', params: { sub: 'public', handle: null, displayName: me.name ?? undefined, avatarUrl: me.avatarUrl } };
}

/** Baş harf (foto yoksa). */
export function avatarInitial(name: string | null | undefined, lang: string): string | null {
  const n = (name ?? '').trim();
  return n ? n.charAt(0).toLocaleUpperCase(lang === 'en' ? 'en' : 'tr') : null;
}
