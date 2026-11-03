// Composer SAF mantığı — taslak doğrulama + create_post girdisi üretimi. React
// Native'den bağımsız → `tsx --test` altında doğrudan test edilir (madde 8:
// "composer doğrulama"). Ekran bu kuralları çizer; tahmin burada değil.
import { estimateActivityKcal } from './activity';
import type {
  ActivityCard,
  ActivityType,
  CreatePostInput,
  CreatePostMedia,
  MealCard,
  PostType,
} from './types';

export const MAX_BODY = 2000;
export const MAX_PHOTOS = 4;

export interface MealDraft {
  name: string;
  kcal: string; // ham metin girişi (TextInput)
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  portionLabel: string;
  productId: string | null;
}

export interface ActivityDraft {
  type: ActivityType;
  minutes: string; // ham metin
  distanceKm: string;
  note: string;
}

export interface ComposerDraft {
  type: PostType;
  body: string;
  photoCount: number;
  meal: MealDraft | null;
  activity: ActivityDraft | null;
}

export type ComposerError =
  | 'empty' // serbest: ne metin ne foto
  | 'meal_incomplete' // öğün: ad veya kcal eksik
  | 'activity_incomplete' // etkinlik: süre yok/0
  | 'too_long'
  | 'too_many_photos';

function num(v: string): number {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** İlk ihlal eden kuralı döner; geçerliyse null. */
export function validateComposer(d: ComposerDraft): ComposerError | null {
  if (d.body.length > MAX_BODY) return 'too_long';
  if (d.photoCount > MAX_PHOTOS) return 'too_many_photos';

  if (d.type === 'ogun') {
    if (!d.meal || d.meal.name.trim().length === 0) return 'meal_incomplete';
    const kcal = num(d.meal.kcal);
    if (!Number.isFinite(kcal) || kcal <= 0) return 'meal_incomplete';
    return null;
  }

  if (d.type === 'etkinlik') {
    if (!d.activity) return 'activity_incomplete';
    const minutes = num(d.activity.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return 'activity_incomplete';
    return null;
  }

  // serbest: en az metin ya da bir fotoğraf.
  if (d.body.trim().length === 0 && d.photoCount === 0) return 'empty';
  return null;
}

/** Canlı önizleme için etkinlik kartı (kcal tahmini). Geçersizse null. */
export function activityDraftCard(a: ActivityDraft, weightKg: number | null = null): ActivityCard | null {
  const minutes = num(a.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const distance = num(a.distanceKm);
  return {
    type: a.type,
    minutes,
    distance_km: Number.isFinite(distance) && distance > 0 ? distance : null,
    kcal_est: estimateActivityKcal(a.type, minutes, weightKg),
    note: a.note.trim() ? a.note.trim() : null,
  };
}

function mealDraftCard(m: MealDraft): MealCard {
  const n = (v: string) => {
    const x = num(v);
    return Number.isFinite(x) && x > 0 ? x : 0;
  };
  return {
    name: m.name.trim(),
    kcal: Math.round(n(m.kcal)),
    protein_g: n(m.protein_g),
    carbs_g: n(m.carbs_g),
    fat_g: n(m.fat_g),
    portion_label: m.portionLabel.trim() || '1 porsiyon',
    photo_url: null,
    product_id: m.productId,
  };
}

/** Doğrulanmış taslaktan create_post girdisi. `media` dışarıdan (yüklenmiş). */
export function buildCreateInput(
  d: ComposerDraft,
  media: CreatePostMedia[],
  lang: string,
  idempotencyKey: string,
  weightKg: number | null = null,
): CreatePostInput {
  return {
    type: d.type,
    body: d.body.trim(),
    lang,
    media,
    mealCard: d.type === 'ogun' && d.meal ? mealDraftCard(d.meal) : null,
    activityCard: d.type === 'etkinlik' && d.activity ? activityDraftCard(d.activity, weightKg) : null,
    idempotencyKey,
  };
}
