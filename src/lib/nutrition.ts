export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type Goal = 'lose_weight' | 'maintain' | 'gain_weight';
export type Gender = 'male' | 'female';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, { title: string; description: string }> = {
  sedentary: { title: 'Hareketsiz', description: 'Masa başı iş, çok az egzersiz' },
  light: { title: 'Hafif Aktif', description: 'Hafta 1-3 gün hafif egzersiz' },
  moderate: { title: 'Orta Aktif', description: 'Hafta 3-5 gün egzersiz' },
  active: { title: 'Aktif', description: 'Hafta 6-7 gün egzersiz' },
  very_active: { title: 'Çok Aktif', description: 'Sporcu, fiziksel iş, günde 2x antrenman' },
};

export const ACTIVITY_ORDER: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];

// Eski 3-tier verileri yeni 5-tier sisteme map'le
export function migrateLegacyActivity(value: string | null | undefined): ActivityLevel {
  switch (value) {
    case 'sedentary':
    case 'light':
    case 'moderate':
    case 'active':
    case 'very_active':
      return value;
    case 'low':
      return 'sedentary';
    case 'medium':
      return 'moderate';
    case 'high':
      return 'active';
    default:
      return 'moderate';
  }
}

export interface NutritionProfileInput {
  age: number;
  gender: Gender;
  weightKg: number;
  heightCm: number;
  activity: ActivityLevel;
  goal: Goal;
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}

export function calculateBMR(profile: NutritionProfileInput): number {
  const { weightKg, heightCm, age, gender } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

export function calculateTDEE(profile: NutritionProfileInput): number {
  const bmr = calculateBMR(profile);
  return bmr * ACTIVITY_MULTIPLIERS[profile.activity];
}

export function calculateTargetCalories(profile: NutritionProfileInput): number {
  const tdee = calculateTDEE(profile);
  let target: number;
  switch (profile.goal) {
    case 'lose_weight':
      target = tdee - 500;
      break;
    case 'gain_weight':
      target = tdee + 300;
      break;
    case 'maintain':
    default:
      target = tdee;
  }
  const min = profile.gender === 'female' ? 1200 : 1500;
  return Math.max(min, Math.round(target));
}

export function calculateMacroTargets(profile: NutritionProfileInput): MacroTargets {
  const calories = calculateTargetCalories(profile);
  const { weightKg, goal, activity } = profile;

  let proteinPerKg: number;
  switch (goal) {
    case 'lose_weight':
    case 'gain_weight':
      proteinPerKg = 1.8;
      break;
    case 'maintain':
    default:
      proteinPerKg = 1.6;
  }
  const protein = Math.round(weightKg * proteinPerKg);
  const proteinKcal = protein * 4;

  let fatRatio: number;
  switch (goal) {
    case 'lose_weight':
      fatRatio = 0.35;
      break;
    case 'gain_weight':
      fatRatio = 0.25;
      break;
    case 'maintain':
    default:
      fatRatio = 0.30;
  }
  const fat = Math.round((calories * fatRatio) / 9);
  const fatKcal = fat * 9;

  const carbs = Math.max(0, Math.round((calories - proteinKcal - fatKcal) / 4));

  const waterMultiplier: Record<ActivityLevel, number> = {
    sedentary: 1.0,
    light: 1.05,
    moderate: 1.10,
    active: 1.15,
    very_active: 1.20,
  };
  const water = Number(((weightKg * 33 * waterMultiplier[activity]) / 1000).toFixed(1));

  return { calories, protein, carbs, fat, water };
}

// ─────────────────────────────────────────────────────────────────────────
// Özel (elle girilen) hedeflerin doğrulanması.
//
// 21.09.2026'ya kadar bu yolda HİÇBİR kontrol yoktu: NutritionProfileScreen
// girilen değerleri olduğu gibi yazıyordu. Canlı veride iki sonucu görüldü —
//  1) makro toplamı kalori hedefiyle tutmuyordu (bir profilde 325 kcal açık,
//     bir başkasında 285 kcal fazla). Halkalar hiçbir zaman uzlaşmıyordu.
//  2) aşırı düşük hedefler kaydedilmişti — BMI'si normal, TDEE'si 2523 olan
//     18 yaşındaki bir kullanıcıda hedef 1250 kcal (%50 açık).
//
// Alt sınır BMR'ye göre DEĞİL, TDEE'ye göre kurulur. Kilo verme hedefinde
// TDEE-500 zaten çoğu kullanıcıda BMR'nin altına düşer (BMR<2500 olan
// herkeste) ve bu normaldir — harcama BMR değil TDEE'dir. BMR tabanı
// koysaydık uygulamanın KENDİ önerisi reddedilirdi: canlı veride kilo
// verme hedefli 237 profilin 81'i bu durumda.
// ─────────────────────────────────────────────────────────────────────────

/** Makro toplamının kalori hedefinden sapabileceği üst sınır (yuvarlama payı). */
export const MACRO_TOLERANCE_KCAL = 50;

/** Cinsiyete göre mutlak alt sınır. */
export const absoluteCalorieFloor = (gender: Gender): number =>
  gender === 'female' ? 1200 : 1500;

/** TDEE'ye göre izin verilen en büyük açık: %35. Daha fazlası aşırı kısıtlama. */
export const MAX_DEFICIT_RATIO = 0.65;

/** Elle girilebilecek en düşük günlük kalori. */
export const minimumCustomCalories = (tdee: number, gender: Gender): number =>
  Math.max(absoluteCalorieFloor(gender), Math.round(tdee * MAX_DEFICIT_RATIO));

/** Makroların karşılığı olan kalori. */
export const macrosToKcal = (protein: number, carbs: number, fat: number): number =>
  protein * 4 + carbs * 4 + fat * 9;

/**
 * Protein ve yağ sabit tutulup karbonhidrat kalori hedefine oturtulur.
 * Karbonhidrat esnek makro olduğu için dengeleme oradan yapılır.
 * Protein + yağ zaten hedefi aşıyorsa null döner (dengelenemez).
 */
export const balanceCarbs = (
  calories: number,
  protein: number,
  fat: number,
): number | null => {
  const kalan = calories - protein * 4 - fat * 9;
  if (kalan < 0) return null;
  return Math.round(kalan / 4);
};

export interface CustomTargetInput {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Kullanıcının toplam günlük harcaması — alt sınır bundan hesaplanır. */
  tdee: number;
  gender: Gender;
}

export type CustomTargetIssue =
  | { kind: 'ok' }
  | { kind: 'invalid'; message: string }
  | { kind: 'too_low'; message: string; minimum: number }
  | { kind: 'macro_mismatch'; message: string; diff: number };

export function validateCustomTargets(input: CustomTargetInput): CustomTargetIssue {
  const { calories, protein, carbs, fat, tdee, gender } = input;

  if ([calories, protein, carbs, fat].some((v) => !Number.isFinite(v) || v < 0)) {
    return { kind: 'invalid', message: 'Hedefler negatif ya da boş olamaz.' };
  }

  const taban = minimumCustomCalories(tdee, gender);
  if (calories < taban) {
    return {
      kind: 'too_low',
      minimum: taban,
      message:
        `Günlük hedef ${taban} kcal'in altına indirilemez. ` +
        `Günlük harcaman ${Math.round(tdee)} kcal; bunun üçte birinden ` +
        `fazlasını kısmak sağlıklı bir hedef değil.`,
    };
  }

  const fark = macrosToKcal(protein, carbs, fat) - calories;
  if (Math.abs(fark) > MACRO_TOLERANCE_KCAL) {
    return {
      kind: 'macro_mismatch',
      diff: fark,
      message:
        fark > 0
          ? `Makroların kalori hedefini ${fark} kcal aşıyor. "Dengele"ye dokunarak düzeltebilirsin.`
          : `Makroların kalori hedefinin ${Math.abs(fark)} kcal altında kalıyor. "Dengele"ye dokunarak düzeltebilirsin.`,
    };
  }

  return { kind: 'ok' };
}
