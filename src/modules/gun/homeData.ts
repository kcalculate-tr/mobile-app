// homeData — Ana sayfa (FinHomeR3) için SAF veri dönüşümleri. RN importu YOK;
// tsx ile birim test edilir. TrackerScreen gerçek `meal_consumptions` satırlarını
// ve hedefleri verir; burada FinHomeR3'teki "Bugün" öğün yuvaları, kaynak
// etiketleri ve durum halkaları üretilir. Panodaki sayı/isim ÖRNEK; burada hep
// gerçek veriden; veri yoksa bölüm gizlenir (uydurma yok).

export type SlotKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** FinHomeR3 kaynak rozeti türleri. */
export type HomeSource = 'scan' | 'kesfet' | 'eatkcal' | 'manual';

export interface ConsumptionLike {
  id: string;
  source: string; // 'manual' | 'pantry' | 'ai_scan' | 'eatkcal' | 'kesfet' | ...
  name: string;
  meal_type: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  consumed_at: string; // ISO
}

export interface HomeMealItem {
  id: string;
  name: string;
  kcal: number;
  /** Kaynak rozeti türü (etiket metnini i18n verir). */
  source: HomeSource;
  /** eatkcal teslimi gibi otomatik loglanan öğün → Düzenle/porsiyon açılır. */
  auto: boolean;
  /** HH:MM (yerelden bağımsız, saat dilimi UTC+3 varsayımı YOK — ISO'dan). */
  time: string;
  /** Son logFlight ile az önce eklendi → vurgu (hl). */
  highlight: boolean;
}

export interface HomeSlot {
  key: SlotKey;
  items: HomeMealItem[];
  kcal: number; // yuva toplamı
  empty: boolean;
}

const SLOT_ORDER: SlotKey[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// DB meal_type iki şemadan gelebilir: TR anahtarlar (manuel kayıt) ya da EN
// anahtarlar (ai_scan inferMealTypeFromHour). İkisini de kanona indir.
const MEAL_TYPE_MAP: Record<string, SlotKey> = {
  kahvalti: 'breakfast',
  ogle: 'lunch',
  aksam: 'dinner',
  atistirma: 'snack',
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
};

export function normalizeMealType(raw: string | null | undefined, consumedAtISO?: string): SlotKey {
  if (raw) {
    const k = MEAL_TYPE_MAP[raw.toLowerCase()];
    if (k) return k;
  }
  // Bilinmeyen/boş → saatten çıkar.
  const h = consumedAtISO ? new Date(consumedAtISO).getHours() : 12;
  return slotFromHour(h);
}

export function slotFromHour(hour: number): SlotKey {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 22) return 'dinner';
  return 'snack';
}

// Kaynak kolonu → FinHomeR3 rozeti + otomatik mi. pantry = dolaptan tüketilen
// eatkcal ürünü (teslim edilmiş sipariş); eatkcal gibi davranır.
export function sourceInfo(source: string): { kind: HomeSource; auto: boolean } {
  switch (source) {
    case 'ai_scan':
    case 'scan':
      return { kind: 'scan', auto: false };
    case 'kesfet':
    case 'feed':
      return { kind: 'kesfet', auto: false };
    case 'eatkcal':
    case 'pantry':
    case 'order':
      return { kind: 'eatkcal', auto: true };
    case 'manual':
    default:
      return { kind: 'manual', auto: false };
  }
}

/** ISO zaman damgasından HH:MM (cihaz yerel saati). */
export function hhmm(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * FinHomeR3 "Bugün" dört yuvası. Boş yuvalar da döner (yuvada "…'e logla ⌄"
 * gösterilir). `highlightId` son logFlight/log ile eklenen öğünü vurgular.
 */
export function buildSlots(
  rows: ConsumptionLike[],
  opts?: { highlightId?: string | null },
): HomeSlot[] {
  const bySlot: Record<SlotKey, HomeMealItem[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const r of rows) {
    const slot = normalizeMealType(r.meal_type, r.consumed_at);
    const info = sourceInfo(r.source);
    bySlot[slot].push({
      id: r.id,
      name: r.name,
      kcal: Math.round(r.calories),
      source: info.kind,
      auto: info.auto,
      time: hhmm(r.consumed_at),
      highlight: !!opts?.highlightId && r.id === opts.highlightId,
    });
  }
  return SLOT_ORDER.map((key) => {
    const items = bySlot[key];
    const kcal = items.reduce((s, it) => s + it.kcal, 0);
    return { key, items, kcal, empty: items.length === 0 };
  });
}

// ─── Durum halkaları (FinHomeR3 ring()) ──────────────────────────────────────

export interface RingSpec {
  key: 'energy' | 'protein' | 'water';
  label: string; // i18n'den gelen etiket (çağıran verir); burada boş bırakılır
  progress: number; // 0..>1
  pct: number; // yüzde (yuvarlanmış)
  /** merkez büyük sayı metni (ör. kalan kcal, "+180"). */
  num: string;
  over: boolean; // hedef üstü mü
  big: boolean; // enerji halkası büyük
  glow: boolean;
}

/** Binlik ayraç (TR "1.840", EN "1,840"). */
export function groupThousands(n: number, lang: 'tr' | 'en'): string {
  const sep = lang === 'en' ? ',' : '.';
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function energyRing(
  consumedKcal: number,
  targetKcal: number,
  lang: 'tr' | 'en',
): RingSpec {
  const p = targetKcal > 0 ? consumedKcal / targetKcal : 0;
  const over = consumedKcal > targetKcal && targetKcal > 0;
  const num = over
    ? '+' + groupThousands(consumedKcal - targetKcal, lang)
    : groupThousands(Math.max(targetKcal - consumedKcal, 0), lang);
  return {
    key: 'energy',
    label: '',
    progress: p,
    pct: Math.round(p * 100),
    num,
    over,
    big: true,
    glow: p > 0,
  };
}

export function macroRing(
  key: 'protein' | 'water',
  got: number,
  goal: number,
): RingSpec {
  const p = goal > 0 ? got / goal : 0;
  return {
    key,
    label: '',
    progress: p,
    pct: Math.round(p * 100),
    num: String(Math.round(got)),
    over: got > goal && goal > 0,
    big: false,
    glow: false,
  };
}
