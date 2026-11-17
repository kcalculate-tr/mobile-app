// G59-S1 — Katman serileştirme (TEK KAYNAK). Hikâye = taban medya + `overlays jsonb`; görüntüleyici
// katmanları cihazda çizer (görüntü yakalama YOK → yeni paket yok). Kurallar sunucudaki
// `story_overlays_valid` ile birebir (supabase/migrations/20261117220100_g59_hikaye.sql):
// dizi, ≤ 40 öğe, izinli türler, x/y 0..1, ölçek 0.2..4, anket 2–4 seçenek (≤ 24 karakter),
// yazı ≤ 200, etiket/konum/bahset ≤ 60, öğün adı ≤ 120. SAF — native yok, `tsx --test` altında koşar.
import type {
  DrawPath,
  OverlayKind,
  StickerSkin,
  StoryAlign,
  StoryBg,
  StoryColorId,
  StoryFont,
  StoryOverlay,
} from './types';

export const OVERLAY_KINDS: readonly OverlayKind[] = [
  'text', 'draw', 'meal', 'ring', 'streak', 'water', 'steps', 'recipe', 'poll', 'location', 'mention', 'hashtag', 'time',
] as const;

/**
 * Kapsam dışı (İlter, 17 Kas): müzik YOK; `question` DM'e kadar, `challenge` meydan okuma özelliği
 * gelene kadar gizli. Sunucu bu türleri reddeder; istemci kütüphanede hiç göstermez.
 */
export const HIDDEN_STICKER_KINDS = ['music', 'question', 'challenge'] as const;

export const MAX_OVERLAYS = 40;
export const MAX_TEXT = 200;
export const MAX_LABEL = 60;
export const MAX_POLL_Q = 80;
export const MAX_POLL_OPT = 24;
export const MAX_OVERLAYS_BYTES = 65536;
export const MIN_SCALE = 0.2;
export const MAX_SCALE = 4;

/** Tasarım FinStoryEditor `cols` (sıra ve ad birebir). */
export const STORY_COLORS: ReadonlyArray<{ id: StoryColorId; hex: string }> = [
  { id: 'white', hex: '#FFFFFF' },
  { id: 'black', hex: '#0A0A0A' },
  { id: 'lime', hex: '#B9EF14' }, // G40 tek marka yeşili (palette.lime; tasarımdaki eski soluk lime yerine)
  { id: 'coral', hex: '#FF7A59' },
  { id: 'sky', hex: '#6EC1FF' },
  { id: 'sun', hex: '#FFD84D' },
  { id: 'lilac', hex: '#B9A2FF' },
  { id: 'mint', hex: '#7FE0C2' },
];
export function colorHex(id: StoryColorId | string | null | undefined): string {
  return STORY_COLORS.find((c) => c.id === id)?.hex ?? '#FFFFFF';
}
/** Yazı kutusu açıkken metin rengi kutuda (tasarım `darkText`): açık renkler koyu metinle. */
export function isLightColor(id: StoryColorId): boolean {
  return ['white', 'lime', 'sun', 'mint', 'sky', 'lilac'].includes(id);
}

export const STORY_FONTS: readonly StoryFont[] = ['modern', 'bold', 'classic', 'type', 'caps'];
export const STORY_ALIGNS: readonly StoryAlign[] = ['center', 'left', 'right'];

/** Yazılı hikâye zeminleri ("Oluştur"): degrade + düz. İlki varsayılan. */
export const STORY_BGS: readonly StoryBg[] = [
  { kind: 'gradient', colors: ['#4A4F3A', '#17191C'] },
  { kind: 'gradient', colors: ['#1E3A2A', '#0A0A0A'] },
  { kind: 'gradient', colors: ['#FF7A59', '#B9A2FF'] },
  { kind: 'gradient', colors: ['#6EC1FF', '#7FE0C2'] },
  { kind: 'solid', colors: ['#0A0A0A'] },
  { kind: 'solid', colors: ['#F3F4F6'] },
];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const num = (v: unknown, d: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const skinOf = (v: unknown): StickerSkin => (v === 'dark' || v === 'glass' ? v : 'light');

let idSeq = 0;
/** Katman kimliği (≤ 40 karakter, hikâye içinde tekil). */
export function newOverlayId(kind: OverlayKind, now: number = Date.now()): string {
  idSeq = (idSeq + 1) % 100000;
  return `${kind}-${now.toString(36)}-${idSeq.toString(36)}`.slice(0, 40);
}

/** Yeni katmanın z sırası: en üste. */
export function nextZ(list: readonly StoryOverlay[]): number {
  return list.reduce((m, o) => Math.max(m, o.z), -1) + 1;
}

/** Çizim sırası: z artan; eşitlikte dizi sırası (kararlı). */
export function sortByZ(list: readonly StoryOverlay[]): StoryOverlay[] {
  return list.map((o, i) => ({ o, i })).sort((a, b) => a.o.z - b.o.z || a.i - b.i).map((x) => x.o);
}

/** Seçilen katmanı en üste al (sürüklemeye başlarken). */
export function bringToFront(list: readonly StoryOverlay[], id: string): StoryOverlay[] {
  const z = nextZ(list);
  return list.map((o) => (o.id === id ? ({ ...o, z } as StoryOverlay) : o));
}

function cleanPaths(v: unknown): DrawPath[] {
  if (!Array.isArray(v)) return [];
  const out: DrawPath[] = [];
  for (const p of v.slice(0, 60)) {
    if (!p || typeof p !== 'object') continue;
    const pts = Array.isArray((p as DrawPath).pts) ? (p as DrawPath).pts : [];
    const clean: number[] = [];
    for (let i = 0; i + 1 < pts.length && clean.length < 800; i += 2) {
      // 3 ondalık (≈ 0,4 pt) — jsonb boyutunu sınırlar.
      clean.push(Math.round(clamp(num(pts[i], 0), 0, 1) * 1000) / 1000, Math.round(clamp(num(pts[i + 1], 0), 0, 1) * 1000) / 1000);
    }
    if (clean.length < 2) continue;
    out.push({
      pts: clean,
      color: /^#[0-9A-Fa-f]{6}$/.test(String((p as DrawPath).color)) ? (p as DrawPath).color : '#FFFFFF',
      width: clamp(num((p as DrawPath).width, 10), 2, 48),
      brush: (p as DrawPath).brush === 'marker' ? 'marker' : 'pen',
    });
  }
  return out;
}

/**
 * Tek katmanı temizle: bilinmeyen/gizli tür → null; sayılar sınırlara çekilir; metinler kırpılır.
 * Boş metinli yazı / etiket ve 2'den az seçenekli anket → null (sunucu da reddederdi).
 */
export function cleanOverlay(raw: unknown): StoryOverlay | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind as OverlayKind;
  if (!OVERLAY_KINDS.includes(kind)) return null;
  const id = str(r.id, 40);
  if (!id) return null;
  const d = (r.data && typeof r.data === 'object' ? r.data : {}) as Record<string, unknown>;
  const base = {
    id,
    x: clamp(num(r.x, 0.5), 0, 1),
    y: clamp(num(r.y, 0.5), 0, 1),
    scale: clamp(num(r.scale, 1), MIN_SCALE, MAX_SCALE),
    rotation: clamp(num(r.rotation, 0), -360, 360),
    z: Math.round(num(r.z, 0)),
  };
  switch (kind) {
    case 'text': {
      const text = str(d.text, MAX_TEXT);
      if (!text.trim()) return null;
      const color = STORY_COLORS.some((c) => c.id === d.color) ? (d.color as StoryColorId) : 'white';
      return {
        ...base, kind, data: {
          text,
          font: STORY_FONTS.includes(d.font as StoryFont) ? (d.font as StoryFont) : 'modern',
          color,
          align: STORY_ALIGNS.includes(d.align as StoryAlign) ? (d.align as StoryAlign) : 'center',
          box: d.box === true,
        },
      };
    }
    case 'draw': {
      const paths = cleanPaths(d.paths);
      if (!paths.length) return null;
      return { ...base, kind, x: 0.5, y: 0.5, scale: 1, rotation: 0, data: { paths } };
    }
    case 'meal': {
      const name = str(d.name, 120);
      if (!name.trim()) return null;
      const opt = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v) * 10) / 10));
      return {
        ...base, kind, data: {
          name,
          meal_type: typeof d.meal_type === 'string' ? d.meal_type.slice(0, 20) : null,
          kcal: Math.max(0, Math.round(num(d.kcal, 0))),
          protein_g: opt(d.protein_g),
          carbs_g: opt(d.carbs_g),
          fat_g: opt(d.fat_g),
          image_url: typeof d.image_url === 'string' && /^https?:/i.test(d.image_url) ? d.image_url.slice(0, 500) : null,
          show_macros: d.show_macros !== false,
          skin: skinOf(d.skin),
        },
      };
    }
    case 'ring':
      return { ...base, kind, data: { kcal: Math.max(0, Math.round(num(d.kcal, 0))), goal: Math.max(0, Math.round(num(d.goal, 0))), skin: skinOf(d.skin ?? 'dark') } };
    case 'streak':
      return { ...base, kind, data: { days: Math.max(0, Math.round(num(d.days, 0))), skin: skinOf(d.skin) } };
    case 'water':
      return { ...base, kind, data: { ml: Math.max(0, Math.round(num(d.ml, 0))), skin: skinOf(d.skin ?? 'glass') } };
    case 'steps':
      return { ...base, kind, data: { steps: Math.max(0, Math.round(num(d.steps, 0))), skin: skinOf(d.skin ?? 'glass') } };
    case 'recipe': {
      const name = str(d.name, 120);
      const key = str(d.recipe_key, 60);
      if (!name.trim() || !key) return null;
      return {
        ...base, kind, data: {
          recipe_key: key, name, kcal: Math.max(0, Math.round(num(d.kcal, 0))),
          image_url: typeof d.image_url === 'string' && /^https?:/i.test(d.image_url) ? d.image_url.slice(0, 500) : null,
          skin: skinOf(d.skin),
        },
      };
    }
    case 'poll': {
      const question = str(d.question, MAX_POLL_Q).trim();
      const options = (Array.isArray(d.options) ? d.options : [])
        .map((o) => str(o, MAX_POLL_OPT).trim())
        .filter(Boolean)
        .slice(0, 4);
      if (!question || options.length < 2) return null;
      return { ...base, kind, data: { question, options, skin: skinOf(d.skin) } };
    }
    case 'location':
    case 'mention':
    case 'hashtag': {
      let text = str(d.text, MAX_LABEL).trim();
      if (kind === 'hashtag') text = text.replace(/^#*/, '#').replace(/\s+/g, '');
      if (kind === 'mention') text = text.replace(/^@*/, '@').replace(/\s+/g, '');
      if (!text || text === '#' || text === '@') return null;
      const handle = kind === 'mention' ? text.slice(1).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30) || null : null;
      return { ...base, kind, data: { text: text.slice(0, MAX_LABEL), skin: skinOf(d.skin), ...(kind === 'mention' ? { handle } : {}) } } as StoryOverlay;
    }
    case 'time': {
      const text = /^\d{1,2}[:.]\d{2}$/.test(String(d.text)) ? String(d.text) : '00:00';
      return { ...base, kind, data: { text, skin: skinOf(d.skin) } };
    }
    default:
      return null;
  }
}

/** Sunucudan gelen `overlays` → güvenli liste (bozuk öğeler düşer, en fazla 40). */
export function parseOverlays(raw: unknown): StoryOverlay[] {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  const out: StoryOverlay[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const o = cleanOverlay(item);
    if (!o || seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
    if (out.length >= MAX_OVERLAYS) break;
  }
  return out;
}

/** create_story `p_overlays` — temiz, z sıralı, sunucu sınırı içinde. Sığmıyorsa son çizim yolları kırpılır. */
export function serializeOverlays(list: readonly StoryOverlay[]): StoryOverlay[] {
  let out = sortByZ(parseOverlays(list as unknown[]));
  // Boyut tavanı (64 KB): çok uzun çizimde en eski yollar düşer (ekranda zaten çoğu üstte kalır).
  let guard = 0;
  while (JSON.stringify(out).length > MAX_OVERLAYS_BYTES && guard++ < 200) {
    const di = out.findIndex((o) => o.kind === 'draw');
    if (di < 0) {
      out = out.slice(0, -1);
      continue;
    }
    const d = out[di] as Extract<StoryOverlay, { kind: 'draw' }>;
    const paths = d.data.paths.slice(1);
    out = paths.length ? out.map((o, i) => (i === di ? ({ ...d, data: { paths } } as StoryOverlay) : o)) : out.filter((_, i) => i !== di);
  }
  return out;
}

/** İstemci ön kontrolü (sunucu `story_overlays_valid` ile aynı karar). */
export function overlaysValid(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length > MAX_OVERLAYS) return false;
  if (JSON.stringify(raw).length > MAX_OVERLAYS_BYTES) return false;
  return raw.every((r) => {
    if (!r || typeof r !== 'object') return false;
    const o = r as Record<string, unknown>;
    if (!OVERLAY_KINDS.includes(o.kind as OverlayKind)) return false;
    if (typeof o.id !== 'string' || o.id.length < 1 || o.id.length > 40) return false;
    if (typeof o.x !== 'number' || typeof o.y !== 'number' || o.x < 0 || o.x > 1 || o.y < 0 || o.y > 1) return false;
    if (o.scale != null && (typeof o.scale !== 'number' || o.scale < MIN_SCALE || o.scale > MAX_SCALE)) return false;
    return cleanOverlay(o) != null;
  });
}

/** Denetlenecek metin var mı? (sunucu `story_has_text`): yazı / konum / bahset / etiket / anket. */
export function hasModeratedText(list: readonly StoryOverlay[]): boolean {
  return list.some((o) => o.kind === 'text' || o.kind === 'location' || o.kind === 'mention' || o.kind === 'hashtag' || o.kind === 'poll');
}

/** Normalleştirilmiş noktalar → SVG yolu (tuval w×h). Tek nokta → küçük çizgi (nokta görünür). */
export function pathD(pts: readonly number[], w: number, h: number): string {
  if (pts.length < 2) return '';
  const p = (i: number) => `${Math.round(pts[i] * w * 10) / 10} ${Math.round(pts[i + 1] * h * 10) / 10}`;
  if (pts.length === 2) return `M${p(0)} L${Math.round(pts[0] * w * 10) / 10 + 0.1} ${Math.round(pts[1] * h * 10) / 10}`;
  let d = `M${p(0)}`;
  for (let i = 2; i < pts.length; i += 2) d += ` L${p(i)}`;
  return d;
}

/**
 * Silgi: dokunulan noktaya (oran) `radius` (oran) mesafedeki yolları tümden kaldırır (KARAR: yol bazlı
 * silgi — piksel silgi görüntü yakalama ister).
 */
export function erasePaths(paths: readonly DrawPath[], x: number, y: number, radius: number): DrawPath[] {
  const r2 = radius * radius;
  return paths.filter((p) => {
    for (let i = 0; i + 1 < p.pts.length; i += 2) {
      const dx = p.pts[i] - x;
      const dy = p.pts[i + 1] - y;
      if (dx * dx + dy * dy <= r2) return false;
    }
    return true;
  });
}

/** Sürükleme sonunda katman çöp alanında mı? (tuval altı orta, oran). */
export function inTrashZone(x: number, y: number): boolean {
  return y >= 0.86 && Math.abs(x - 0.5) <= 0.12;
}

/** İki parmak: başlangıç → şimdiki ölçek/açı (katmanın ilk değerine göre). */
export function pinchTransform(
  start: { scale: number; rotation: number; dist: number; angle: number },
  now: { dist: number; angle: number },
): { scale: number; rotation: number } {
  const ratio = start.dist > 0 ? now.dist / start.dist : 1;
  let rot = start.rotation + (now.angle - start.angle);
  while (rot > 180) rot -= 360;
  while (rot < -180) rot += 360;
  return { scale: clamp(start.scale * ratio, MIN_SCALE, MAX_SCALE), rotation: Math.round(rot * 10) / 10 };
}

/** Merkez/kılavuz yapışması (tasarım "placed" kesikli lime çizgileri): ±0,015 içinde ortaya kilitlenir. */
export function snapCenter(v: number): { v: number; snapped: boolean } {
  return Math.abs(v - 0.5) <= 0.015 ? { v: 0.5, snapped: true } : { v, snapped: false };
}
