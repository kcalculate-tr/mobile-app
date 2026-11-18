// Paylaşım kartı veri modeli + GİZLİLİK beyaz listesi (G61-S1 md.1, FinShareNotes).
//
// Her kart türü YALNIZ "Gösterdiği veri" sütunundaki alanları taşır. Kart
// bileşenleri bu modelden başka veri almaz; sunucuya giden anlık görüntü
// (`share_snapshots.payload`) da aynı beyaz listeden geçer (sunucu ayrıca
// kendi listesiyle süzer — migration 20261118100100_g61_share.sql).
//
// "Hiçbir kartta yok": kilo, hedef kilo, BMI, vücut ölçüleri; günlük kalori
// hedefi ve gün toplamı; sağlık tercihleri ve alerjiler; Koç sohbetleri;
// abonelik bilgisi; konum. Gün kartında yalnız yüzde halka var.
// SAF modül (RN importu yok).

import type { ShareKind } from './links';

export type MealCardData = {
  /** Öğün etiketi (Kahvaltı / Öğle yemeği …) — yerelleştirilmiş metin. */
  mealLabel?: string | null;
  name: string;
  kcal: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  /** Öğün fotoğrafı (yalnız fotoğraflı zemin) ya da çıkartma görseli. */
  photoUri?: string | null;
};

export type DayCardData = {
  /** Günlük hedefin yüzdesi (0–999). Hedef/toplam RAKAMI değil. */
  pct: number;
  meals: number;
  protein?: number | null;
  /** Litre. Yoksa hücre gösterilmez. */
  waterL?: number | null;
  /** Adım. Yoksa hücre gösterilmez. */
  steps?: number | null;
  dateLabel?: string | null;
  photoUri?: string | null;
};

export type PostCardData = {
  authorName: string;
  handle?: string | null;
  text: string;
  imageUri?: string | null;
};

export type ProfileCardData = {
  name: string;
  handle: string;
  bio?: string | null;
  avatarUri?: string | null;
};

export type RecipeCardData = {
  name: string;
  minutes?: number | null;
  servings?: number | null;
  kcalPerServing?: number | null;
  proteinPerServing?: number | null;
  /** En fazla 3 öne çıkan malzeme. */
  ingredients?: string[] | null;
  imageUri?: string | null;
};

export type InviteCardData = {
  code: string;
};

export type XrayItem = { name: string; kcal?: number | null };

export type XrayCardData = {
  name: string;
  totalKcal: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  items?: XrayItem[] | null;
  photoUri?: string | null;
};

export type StoryCardData = {
  photoUri?: string | null;
  text?: string | null;
  mealName?: string | null;
  mealKcal?: number | null;
  mealImageUri?: string | null;
};

export type CardDataMap = {
  meal: MealCardData;
  day: DayCardData;
  post: PostCardData;
  profile: ProfileCardData;
  recipe: RecipeCardData;
  invite: InviteCardData;
  xray: XrayCardData;
  story: StoryCardData;
};

export type ShareCardInput = { [K in ShareKind]: { kind: K; data: CardDataMap[K] } }[ShareKind];

/** Kart başına İZİNLİ alanlar (FinShareNotes "Gösterdiği veri"). */
export const ALLOWED_FIELDS: { [K in ShareKind]: readonly (keyof CardDataMap[K])[] } = {
  meal: ['mealLabel', 'name', 'kcal', 'protein', 'carbs', 'fat', 'photoUri'],
  day: ['pct', 'meals', 'protein', 'waterL', 'steps', 'dateLabel', 'photoUri'],
  post: ['authorName', 'handle', 'text', 'imageUri'],
  profile: ['name', 'handle', 'bio', 'avatarUri'],
  recipe: ['name', 'minutes', 'servings', 'kcalPerServing', 'proteinPerServing', 'ingredients', 'imageUri'],
  invite: ['code'],
  xray: ['name', 'totalKcal', 'protein', 'carbs', 'fat', 'items', 'photoUri'],
  story: ['photoUri', 'text', 'mealName', 'mealKcal', 'mealImageUri'],
};

/**
 * Hiçbir kartta / anlık görüntüde bulunamayacak alan adı desenleri (gizlilik testi
 * bunlarla model + sanitize çıktısını tarar).
 */
export const FORBIDDEN_FIELD_PATTERNS: readonly RegExp[] = [
  /weight/i, /kilo/i, /bmi/i, /body/i, /olcu|measure/i,
  /goal/i, /target/i, /hedef/i, /dayTotal|daily_?total|gun_?toplam/i, /remaining/i,
  /allerg/i, /health/i, /saglik/i, /diet/i, /pref/i,
  /coach|koc/i, /chat/i, /subscri|abonelik|plan_?type|tier/i,
  /locat|konum|city|lat\b|lng|lon\b|address/i,
  /like/i, /comment/i, /view/i, /follower/i, /reaction/i, /earned|reward/i, /email|phone/i,
];

export function isForbiddenField(name: string): boolean {
  return FORBIDDEN_FIELD_PATTERNS.some((re) => re.test(name));
}

const num = (v: unknown, max = 1e6): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(max, n);
};
const str = (v: unknown, max = 200): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};
const longStr = (v: unknown, max = 600): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\r/g, '').trim();
  return s ? s.slice(0, max) : null;
};

/**
 * Herhangi bir kaynaktan gelen nesneyi kart modeline indirger: yalnız izinli
 * alanlar, türü doğrulanmış ve uzunluğu sınırlanmış olarak kalır.
 */
export function sanitizeCard<K extends ShareKind>(kind: K, raw: Record<string, unknown>): CardDataMap[K] {
  const r = raw ?? {};
  const out: Record<string, unknown> = {};
  switch (kind) {
    case 'meal':
      out.mealLabel = str(r.mealLabel, 40);
      out.name = str(r.name, 80) ?? '';
      out.kcal = Math.round(num(r.kcal, 20000) ?? 0);
      out.protein = num(r.protein, 2000);
      out.carbs = num(r.carbs, 2000);
      out.fat = num(r.fat, 2000);
      out.photoUri = str(r.photoUri, 2000);
      break;
    case 'day':
      out.pct = Math.round(num(r.pct, 999) ?? 0);
      out.meals = Math.round(num(r.meals, 50) ?? 0);
      out.protein = num(r.protein, 2000);
      out.waterL = num(r.waterL, 20);
      out.steps = num(r.steps, 200000);
      out.dateLabel = str(r.dateLabel, 40);
      out.photoUri = str(r.photoUri, 2000);
      break;
    case 'post':
      out.authorName = str(r.authorName, 60) ?? '';
      out.handle = str(r.handle, 40);
      out.text = firstLines(longStr(r.text) ?? '', 3);
      out.imageUri = str(r.imageUri, 2000);
      break;
    case 'profile':
      out.name = str(r.name, 60) ?? '';
      out.handle = (str(r.handle, 40) ?? '').replace(/^@+/, '');
      out.bio = firstLines(longStr(r.bio, 200) ?? '', 2) || null;
      out.avatarUri = str(r.avatarUri, 2000);
      break;
    case 'recipe':
      out.name = str(r.name, 80) ?? '';
      out.minutes = num(r.minutes, 1440);
      out.servings = num(r.servings, 100);
      out.kcalPerServing = num(r.kcalPerServing, 20000);
      out.proteinPerServing = num(r.proteinPerServing, 2000);
      out.ingredients = Array.isArray(r.ingredients)
        ? (r.ingredients as unknown[]).map((g) => str(g, 40)).filter((g): g is string => !!g).slice(0, 3)
        : null;
      out.imageUri = str(r.imageUri, 2000);
      break;
    case 'invite':
      out.code = (str(r.code, 16) ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      break;
    case 'xray':
      out.name = str(r.name, 80) ?? '';
      out.totalKcal = Math.round(num(r.totalKcal, 20000) ?? 0);
      out.protein = num(r.protein, 2000);
      out.carbs = num(r.carbs, 2000);
      out.fat = num(r.fat, 2000);
      out.items = Array.isArray(r.items)
        ? (r.items as unknown[])
            .map((it) => {
              const o = (it ?? {}) as Record<string, unknown>;
              const name = str(o.name, 40);
              return name ? { name, kcal: num(o.kcal, 20000) } : null;
            })
            .filter((x): x is { name: string; kcal: number | null } => !!x)
            .slice(0, 3)
        : null;
      out.photoUri = str(r.photoUri, 2000);
      break;
    case 'story':
      out.photoUri = str(r.photoUri, 2000);
      out.text = str(r.text, 80);
      out.mealName = str(r.mealName, 60);
      out.mealKcal = num(r.mealKcal, 20000);
      out.mealImageUri = str(r.mealImageUri, 2000);
      break;
  }
  return out as CardDataMap[K];
}

/** Metnin ilk n satırı (gönderi metni: "ilk 3 satır"). */
export function firstLines(text: string, n: number): string {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, n).join('\n');
}

/** Sunucu anlık görüntüsü alabilen türler (gönderi/profil/tarif mevcut kayıtlardan okunur). */
export const SNAPSHOT_KINDS = ['meal', 'day', 'xray'] as const;
export type SnapshotKind = (typeof SNAPSHOT_KINDS)[number];

export function isSnapshotKind(k: ShareKind): k is SnapshotKind {
  return (SNAPSHOT_KINDS as readonly string[]).includes(k);
}

/**
 * Sunucuya giden anlık görüntü yükü: beyaz liste + YEREL dosya yolları çıkarılır
 * (file://, ph://, content:// başkasına anlamsız ve cihaz yolu sızdırır).
 */
export function snapshotPayload(kind: SnapshotKind, data: Record<string, unknown>): Record<string, unknown> {
  const clean = sanitizeCard(kind, data) as Record<string, unknown>;
  for (const k of Object.keys(clean)) {
    const v = clean[k];
    if (v == null) delete clean[k];
    else if (typeof v === 'string' && /uri$/i.test(k) && !/^https:\/\//i.test(v)) delete clean[k];
  }
  delete clean.photoUri; // anlık görüntüde fotoğraf yok (yalnız metin + sayı; web önizlemesi tür görseli kullanır)
  return clean;
}

/** Kartın bağlantı kimliği yoksa da gösterebileceği kısa bir hata-dayanıklı başlık. */
export function cardTitle(input: ShareCardInput): string {
  switch (input.kind) {
    case 'meal':
    case 'recipe':
    case 'xray':
      return input.data.name;
    case 'post':
      return input.data.authorName;
    case 'profile':
      return input.data.name || `@${input.data.handle}`;
    case 'invite':
      return input.data.code;
    case 'day':
      return `${input.data.pct}%`;
    case 'story':
      return input.data.text ?? input.data.mealName ?? '';
  }
}
