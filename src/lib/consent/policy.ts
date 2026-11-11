// G20-S1 — Politika kabulü ve rıza kararları (saf; RN/ağ yok → tsx --test).
//
// Akış (yalnız yeni arayüz bayrağı açıkken; kapalıyken bugünkü davranış AYNEN):
//   hesap oluşturma bloğu (Koşullar + Gizlilik kabulü · KVKK bilgilendirme ·
//   Meta reklam ölçümü AÇIK, kapatılabilir) → giriş → Meta (G26-S1: iOS ATT yok).
//   Mevcut kullanıcı: bir sonraki açılışta bir kez bilgilendirme sheet'i.
//   Yeni belge sürümü (legal_documents.version artınca): tekrar kabul sheet'i.

import { LEGAL_SLUG } from '../legal/slugs';

/** Kabulü zorunlu belgeler (legal_documents.requires_acceptance ile aynı). İç anahtar. */
export const REQUIRED_DOCS = ['terms', 'privacy'] as const;
export type RequiredDoc = (typeof REQUIRED_DOCS)[number];
/**
 * G20-S3 md.1: iç anahtar → canlı `legal_documents.slug` (kullanim-kosullari,
 * gizlilik-politikasi). Sunucuya giden / sunucudan gelen her ad budur.
 */
export const DOC_SLUG: Record<RequiredDoc, string> = {
  terms: LEGAL_SLUG.terms,
  privacy: LEGAL_SLUG.privacy,
};
/** Canlı ad → iç anahtar (bilinmeyen → null). */
export function docKeyOf(slug: unknown): RequiredDoc | null {
  if (slug === DOC_SLUG.terms) return 'terms';
  if (slug === DOC_SLUG.privacy) return 'privacy';
  return null;
}
/** Yalnız bilgilendirme (aydınlatma metni okunur, kabul edilmez). */
export const INFO_DOC = LEGAL_SLUG.kvkk;

export type DocVersions = Record<RequiredDoc, number>;
export const DEFAULT_VERSIONS: DocVersions = { terms: 1, privacy: 1 };

export const POLICY_KEY = '@kcal_consent_policy';
export const PENDING_KEY = '@kcal_consent_pending';

/** Cihazda: hangi sürümler kabul edildi (veya bilgilendirme görüldü). */
export interface PolicyRecord {
  v: DocVersions;
  at: string;
}

// G20-S3: canlıda kind'a ai_photo, source'a scan eklendi (Claude 9 Kas).
// G27-S1: sağlık verisi açık rızası — kind 'health_data', source 'takibe' (migration 20261111230100).
// G36-S1 md.8: 'personal_plan' — Kişisel plan akışı sağlık rızası (migration 20261112120100).
export type ConsentSource = 'signup_email' | 'signup_social' | 'notice' | 'reconsent' | 'settings' | 'att' | 'scan' | 'takibe' | 'meal_plan' | 'personal_plan';
export type ConsentKind = 'policy' | 'ad_measurement' | 'first_party' | 'att' | 'ai_photo' | 'health_data';

/** user_consents satırı (user_id yazım anında eklenir). */
export interface ConsentRow {
  kind: ConsentKind;
  doc_slug: string | null;
  doc_version: number | null;
  granted: boolean;
  source: ConsentSource;
  platform: string | null;
  app_version: string | null;
  created_at: string;
}

/** my_consent_status() yanıtı. */
export interface ServerStatus {
  docs: { slug: string; version: number; accepted_version: number | null }[];
  ad_measurement: boolean | null;
  first_party: boolean | null;
  /** G20-S3 md.2: yapay zekâ fotoğraf analizi izninin son değeri. */
  ai_photo: boolean | null;
  /**
   * G23-S1: son ai_photo izninin metin sürümü. Canlı my_consent_status bugün DÖNMEZ
   * (null → sürüm bilinmiyor = eski metin sayılır); ileride sunucu eklerse kullanılır.
   */
  ai_photo_version?: number | null;
  /** G27-S1: sağlık verisi açık rızasının son değeri (migration uygulanana dek dönmez → undefined). */
  health_data?: boolean | null;
}

const posInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isInteger(n) && n >= 1 ? n : null;
};

export function parsePolicyRecord(raw: string | null | undefined): PolicyRecord | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { v?: Record<string, unknown>; at?: unknown };
    if (!o || typeof o !== 'object' || !o.v) return null;
    const terms = posInt(o.v.terms);
    const privacy = posInt(o.v.privacy);
    if (terms == null || privacy == null) return null;
    return { v: { terms, privacy }, at: typeof o.at === 'string' ? o.at : '' };
  } catch {
    return null;
  }
}

export function parsePending(raw: string | null | undefined): ConsentRow[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr.filter((r) => r && typeof r.kind === 'string') as ConsentRow[]) : [];
  } catch {
    return [];
  }
}

/** legal_documents satırlarından güncel sürümler (sürüm alanı yoksa / hata → 1). */
export function versionsFrom(rows: { slug?: unknown; version?: unknown }[] | null | undefined): DocVersions {
  const out: DocVersions = { ...DEFAULT_VERSIONS };
  for (const r of rows ?? []) {
    const key = docKeyOf(r.slug);
    if (key) {
      const n = posInt(r.version);
      if (n != null) out[key] = n;
    }
  }
  return out;
}

export function versionsFromStatus(s: ServerStatus | null): DocVersions | null {
  if (!s) return null;
  return versionsFrom(s.docs);
}

/** Sunucu durumu → kullanıcının kabul ettiği sürümler (hiç yoksa null). */
export function acceptedFromStatus(s: ServerStatus | null): DocVersions | null {
  if (!s) return null;
  const acc: Partial<DocVersions> = {};
  for (const d of s.docs) {
    const key = docKeyOf(d.slug);
    if (key && posInt(d.accepted_version) != null) {
      acc[key] = d.accepted_version as number;
    }
  }
  return acc.terms != null && acc.privacy != null ? (acc as DocVersions) : null;
}

export function covers(accepted: DocVersions | null | undefined, current: DocVersions): boolean {
  if (!accepted) return false;
  return REQUIRED_DOCS.every((k) => accepted[k] >= current[k]);
}

export type GateDecision =
  /** Bayrak kapalı: bugünkü davranış (Meta açılışta). */
  | 'legacy'
  /** Henüz hesap yok / bekleniyor: Meta başlatılmaz. */
  | 'wait'
  /** Kabul tamam: Meta başlat. */
  | 'ready'
  /** Mevcut kullanıcı, hiç kayıt yok: bir kez bilgilendirme sheet'i. */
  | 'notice'
  /** Yeni belge sürümü: tekrar kabul sheet'i. */
  | 'reconsent';

/**
 * Açılış kararı. `server` null → sunucu okunamadı (migration henüz yok / çevrimdışı):
 * yalnız cihaz kaydına bakılır (fail-open, kullanıcı kilitlenmez).
 */
export function decideGate(i: {
  flagsOn: boolean;
  signedIn: boolean;
  local: PolicyRecord | null;
  server: ServerStatus | null;
}): GateDecision {
  if (!i.flagsOn) return 'legacy';
  if (!i.signedIn) return i.local ? 'ready' : 'wait';
  const serverCurrent = versionsFromStatus(i.server);
  const current = serverCurrent ?? DEFAULT_VERSIONS;
  const serverAccepted = acceptedFromStatus(i.server);
  // Başka cihazda kabul etmiş olabilir: en yüksek kabul edilen sürüm geçerli.
  const best: DocVersions | null =
    i.local || serverAccepted
      ? {
          terms: Math.max(i.local?.v.terms ?? 0, serverAccepted?.terms ?? 0),
          privacy: Math.max(i.local?.v.privacy ?? 0, serverAccepted?.privacy ?? 0),
        }
      : null;
  if (covers(best, current)) return 'ready';
  if (!i.local && !serverAccepted) return 'notice';
  return 'reconsent';
}

/** Hesap oluşturma / bilgilendirme / tekrar kabul anında yazılacak satırlar. */
export function policyRows(i: {
  versions: DocVersions;
  adOn: boolean;
  source: ConsentSource;
  platform: string | null;
  appVersion: string | null;
  at: string;
}): ConsentRow[] {
  const base = { platform: i.platform, app_version: i.appVersion, created_at: i.at, source: i.source };
  return [
    ...REQUIRED_DOCS.map<ConsentRow>((slug) => ({
      ...base,
      kind: 'policy',
      doc_slug: DOC_SLUG[slug],
      doc_version: i.versions[slug],
      granted: true,
    })),
    { ...base, kind: 'ad_measurement', doc_slug: null, doc_version: null, granted: i.adOn },
  ];
}

export function toggleRow(i: {
  kind: 'ad_measurement' | 'first_party' | 'att' | 'ai_photo';
  granted: boolean;
  source: ConsentSource;
  platform: string | null;
  appVersion: string | null;
  at: string;
}): ConsentRow {
  return {
    kind: i.kind,
    doc_slug: null,
    doc_version: null,
    granted: i.granted,
    source: i.source,
    platform: i.platform,
    app_version: i.appVersion,
    created_at: i.at,
  };
}

/** Bekleyen satırlar en çok bu kadar tutulur (eski olanlar düşer). */
// ── G20-S3 md.2 — Yapay zekâ fotoğraf analizi izni (Apple 5.1.2(i)) ──────────
// İlk taramadan ÖNCE bir kez sorulur. Cihaz kaydı + user_consents (kind ai_photo,
// source scan | settings). İzin yoksa fotoğraf hiçbir yola (canlı analiz,
// çevrimdışı kuyruk boşaltma) GÖNDERİLMEZ.
export const AI_PHOTO_KEY = '@kcal_ai_photo_consent';

/**
 * G23-S1 (İlter 10 Kas): izin metninin sürümü. v1 = yalnız fotoğraf (G20-S3); v2 = fotoğraf
 * ya da sesli girişin yazıya dökülmüş metni, "Ses kaydedilmez". Eski sürümde verilmiş izin
 * GEÇERSİZ sayılır → bir kez yeniden sorulur (kabul edilince cihaza v2 yazılır).
 * Canlı user_consents CHECK'i ai_photo satırında doc_version'a izin vermediği için sürüm
 * cihaz kaydında tutulur; sunucu satırı aynı biçimde (doc_version null) yazılır.
 */
export const AI_PHOTO_TEXT_VERSION = 2;

export interface AiPhotoRecord {
  granted: boolean;
  at: string;
  /** İzin metni sürümü (eski kayıtlarda yok → 1). */
  v: number;
}

export function parseAiPhoto(raw: string | null | undefined): AiPhotoRecord | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { granted?: unknown; at?: unknown; v?: unknown };
    if (!o || typeof o.granted !== 'boolean') return null;
    return { granted: o.granted, at: typeof o.at === 'string' ? o.at : '', v: posInt(o.v) ?? 1 };
  } catch {
    return null;
  }
}

/**
 * Tara açılışında karar: cihaz kaydı varsa o geçerli (ayardan geri alma dahil);
 * yoksa sunucu (başka cihazda verilmiş izin). Sunucu okunamadı → sor (izin
 * olmadan gönderilmez — burada fail-open YOK).
 * G23-S1: izin yalnız GÜNCEL metin sürümünde verildiyse geçerli. Sunucu sürüm bildirmezse
 * (bugünkü canlı) sunucudaki izin eski metin sayılır → bir kez sorulur.
 */
export function aiPhotoDecision(
  local: AiPhotoRecord | null,
  server: boolean | null | undefined,
  serverVersion?: number | null,
): 'ok' | 'ask' {
  if (local) return local.granted && local.v >= AI_PHOTO_TEXT_VERSION ? 'ok' : 'ask';
  return server === true && (serverVersion ?? 1) >= AI_PHOTO_TEXT_VERSION ? 'ok' : 'ask';
}

export const PENDING_MAX = 50;
export function appendPending(prev: ConsentRow[], add: ConsentRow[]): ConsentRow[] {
  const all = [...prev, ...add];
  return all.length > PENDING_MAX ? all.slice(all.length - PENDING_MAX) : all;
}
