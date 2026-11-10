// coach-chat — güvenlik ön filtresi (SAF: import yok; Deno ve Node/tsx ikisinde de çalışır).
// G24-S1 md.2: model çağrılmadan ÖNCE basit anahtar kelime filtresi. Eşleşirse model
// ÇAĞRILMAZ, hak DÜŞMEZ, sabit güvenli yanıt döner (FinCoachSafety: hekime/diyetisyene yönlendir).
//   medical → tıbbi tanı / ilaç / tedavi / tahlil soruları
//   ed      → yeme bozukluğu işaretleri (kusma, laksatif, aç kalma, hızlı kilo verme, telafi
//             egzersizi, taban altı kalori) → sayı/plan YOK, şefkatli yanıt + profesyonel destek
// Ayrıca model yanıtı için son denetim: taban altı günlük kalori hedefi önerisi → güvenli yanıt.

export type SafetyKind = 'medical' | 'ed';
export type Lang = 'tr' | 'en';

/** Günlük kalori tabanı: kadın 1200, erkek/bilinmiyor 1500 (bunun altında hedef ÖNERİLMEZ). */
export function minDailyKcal(gender: string | null | undefined): number {
  const g = String(gender ?? '').toLocaleLowerCase('tr');
  return g === 'female' || g === 'f' || g === 'kadın' || g === 'kadin' || g === 'woman' ? 1200 : 1500;
}

/** Türkçe duyarlı küçük harf + aksan sadeleştirme (ı→i, ş→s …) — eşleşme için. */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/\s+/g, ' ');
}

// Katlanmış (fold) biçimde yazılır. Kelime parçaları bilinçli: "kus" gibi kısa kökler YOK
// (kuskus, kusursuz yanlış alarm verir) — çekimli biçimler tek tek.
export const MEDICAL_TERMS: readonly string[] = [
  // TR
  'ilac', 'insulin', 'metformin', 'antibiyotik', 'doz ', 'dozaj', 'recete',
  'teshis', 'tani koy', 'tanisi', 'hastaligim', 'hastaligi var',
  'kan sekeri', 'kan sekerim', 'seker hastasi', 'diyabet', 'hipoglisemi', 'insulin direnc',
  'tansiyon', 'kolesterol ilac', 'tiroid', 'hashimoto', 'bobrek', 'karaciger', 'gut hastal',
  'hamile', 'gebelik', 'emziriyorum', 'emzirme',
  'kalp krizi', 'gogus agrisi', 'bayildim', 'bayilacak', 'tahlil', 'kan degerler',
  'colyak', 'alerji kriz', 'kemoterapi', 'kanser',
  // EN
  'medication', 'medicine', 'prescription', 'dosage', 'diagnos', 'blood sugar', 'diabet',
  'hypoglyc', 'blood pressure', 'cholesterol med', 'thyroid', 'kidney', 'liver disease',
  'pregnan', 'breastfeed', 'heart attack', 'chest pain', 'faint', 'lab result', 'blood test',
  'celiac', 'chemo', 'cancer',
];

export const ED_TERMS: readonly string[] = [
  // TR
  'kustum', 'kusuyorum', 'kusmak ', 'kusarak', 'kusturu', 'kendimi kustur',
  'laksatif', 'mushil', 'idrar sokturucu',
  'ac kalmak', 'ac kaliyorum', 'ac kalacagim', 'hic yemek yemiyorum', 'hic yemiyorum', 'yemeyi biraktim',
  'gunlerdir yemiyorum', 'oruc tutup kilo', 'tikinircasina', 'tikiniyorum', 'tikindim',
  'telafi icin', 'yaktiktan sonra yiyebil', 'yedigimi yakmak', 'cezalandir',
  'hizli kilo ver', 'cabuk kilo ver', 'kendimden nefret',
  'sisman hissed', 'yemekten korku', 'yemek yedikten sonra sucluluk',
  // EN
  'vomit', 'throw up', 'throwing up', 'purge', 'purging', 'laxative', 'diuretic',
  'starve', 'starving', 'not eating', 'stopped eating', 'binge', 'compensat',
  'burn off what i ate', 'lose weight fast', 'rapid weight loss', 'hate my body', 'punish myself',
];

// "haftada 5 kilo", "1 haftada 4 kg", "lose 10 kg in a month"
const RAPID_LOSS_RE = /\b(gun|hafta|ay)(da|de)\s*(\d+)\s*(kilo|kg)\b|(\d+)\s*(kilo|kg)\s*(\d+)\s*(gun|hafta)|(\d+)\s*(kg|kilo|pounds|lbs)\s*in\s*(a|one|\d+)\s*(day|week)/;
// "günde 800 kalori", "800 kcal a day", "daily 900 calories"
const DAILY_KCAL_RE =
  /(gunde|gunluk|her gun|daily|a day|per day|each day)\D{0,12}(\d{3,4})\s*(kcal|kalori|cal)|(\d{3,4})\s*(kcal|kalori|calories|cal)\D{0,12}(gunde|gunluk|her gun|a day|per day|each day|daily)/g;

/** Metinde taban altı GÜNLÜK kalori geçiyor mu ("günde 900 kalori yesem")? */
export function mentionsDailyKcalBelow(text: string, floor: number): boolean {
  const f = fold(text);
  for (const m of f.matchAll(DAILY_KCAL_RE)) {
    const n = Number(m[2] ?? m[4]);
    if (Number.isFinite(n) && n >= 100 && n < floor) return true;
  }
  return false;
}

/** Kullanıcı mesajı → güvenlik sınıfı (yoksa null). ED önceliklidir (şefkatli yanıt). */
export function classifyMessage(text: string, gender?: string | null): SafetyKind | null {
  const f = ` ${fold(text)} `;
  if (ED_TERMS.some((t) => f.includes(t))) return 'ed';
  if (RAPID_LOSS_RE.test(f)) return 'ed';
  if (mentionsDailyKcalBelow(text, minDailyKcal(gender))) return 'ed';
  if (MEDICAL_TERMS.some((t) => f.includes(t))) return 'medical';
  return null;
}

/** Model yanıtı taban altı günlük hedef öneriyorsa (son denetim) → true. */
export function replyViolatesFloor(text: string, gender?: string | null): boolean {
  return mentionsDailyKcalBelow(text, minDailyKcal(gender));
}

const REPLY = {
  medical: {
    tr: 'Bunu sorduğun için teşekkürler, önemli bir konu. Tıbbi konularda tavsiye veremem; en doğrusu doktoruna ya da diyetisyenine danışman. Ben öğünlerini düzenli kaydetmene ve günlük takibine yardımcı olabilirim.',
    en: 'Thanks for asking, this matters. I can’t give medical advice; the best step is to talk to your doctor or dietitian. I can help you log meals regularly and keep up with daily tracking.',
  },
  ed: {
    tr: 'Bunu benimle paylaştığın için teşekkürler. Yemekle ilişkin zorlayıcı hissettiriyorsa bunu tek başına taşımak zorunda değilsin. Bu konuda sayı ya da plan vermem doğru olmaz; bir doktor, diyetisyen ya da psikologla konuşmak sana iyi gelebilir. İstersen bugün kendine iyi gelecek, düzenli ve doyurucu bir öğün üzerine konuşabiliriz.',
    en: 'Thank you for sharing this with me. If your relationship with food feels hard right now, you don’t have to carry it alone. It wouldn’t be right for me to give numbers or a plan here; talking to a doctor, dietitian or psychologist can really help. If you like, we can talk about a regular, satisfying meal that feels good today.',
  },
} as const;

/** Sabit güvenli yanıt (FinCoachSafety kartı ile). */
export function safetyReply(kind: SafetyKind, lang: Lang): { text: string; cards: { type: 'safety'; variant: SafetyKind }[] } {
  return { text: REPLY[kind][lang], cards: [{ type: 'safety', variant: kind }] };
}
