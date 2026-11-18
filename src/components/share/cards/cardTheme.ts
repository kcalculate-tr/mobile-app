// Paylaşım kartı tema + ölçü + metin tablosu (G61-S1 md.1). Değerler
// docs/g61/design/FinShareCard*.dc.html'den birebir (renk, px ölçüleri, TR/EN).
// Lime = uygulama jetonu #B9EF14 (tasarımla aynı).

import { palette } from '../../../core/design/tokens';

export type CardBg = 'light' | 'dark' | 'photo';
export type CardSize = 'story' | 'post';
export type CardLang = 'tr' | 'en';

export const CARD_W = 1080;
export const cardHeight = (size: CardSize) => (size === 'post' ? 1350 : 1920);

export const LIME = palette.lime;

export type CardTheme = {
  bg: string; text: string; sec: string; panel: string; panelStroke: string | null; chip: string; acc: string;
  logo: string; blobA: string; blobAOp: number; blobB: string; blobBOp: number; track: string; hiBg: string | null;
  hiFg: string; glowOp: number; av: string; avIcon: string;
};

// rgba → (renk, opaklık) çifti: react-native-svg gradyan durakları ayrı opaklık ister.
export const CARD_THEME: Record<CardBg, CardTheme> = {
  light: {
    bg: '#F3F4F6', text: '#0A0A0A', sec: '#45454A', panel: '#FFFFFF', panelStroke: null, chip: '#F3F4F6', acc: '#4A6B00',
    logo: '#0A0A0A', blobA: LIME, blobAOp: 0.42, blobB: LIME, blobBOp: 0.26, track: '#E9EBEE', hiBg: LIME, hiFg: '#0A0A0A',
    glowOp: 0.55, av: '#DCDEE2', avIcon: '#6B6B70',
  },
  dark: {
    bg: '#000000', text: '#F5F5F5', sec: '#A1A1A6', panel: '#1C1C1E', panelStroke: '#2C2C2E', chip: '#2C2C2E', acc: LIME,
    logo: '#FFFFFF', blobA: LIME, blobAOp: 0.36, blobB: LIME, blobBOp: 0.22, track: '#2C2C2E', hiBg: null, hiFg: LIME,
    glowOp: 0.24, av: '#3A3A3C', avIcon: '#A1A1A6',
  },
  photo: {
    bg: '#0A0A0A', text: '#FFFFFF', sec: 'rgba(255,255,255,0.86)', panel: 'rgba(20,20,20,0.55)', panelStroke: 'rgba(255,255,255,0.14)',
    chip: 'rgba(255,255,255,0.16)', acc: LIME, logo: '#FFFFFF', blobA: LIME, blobAOp: 0, blobB: LIME, blobBOp: 0,
    track: 'rgba(255,255,255,0.24)', hiBg: null, hiFg: LIME, glowOp: 0.3, av: 'rgba(255,255,255,0.22)', avIcon: '#FFFFFF',
  },
};

export const FONT = {
  j400: 'PlusJakartaSans_400Regular',
  j500: 'PlusJakartaSans_500Medium',
  j600: 'PlusJakartaSans_600SemiBold',
  j700: 'PlusJakartaSans_700Bold',
  j800: 'PlusJakartaSans_800ExtraBold',
  b700: 'BricolageGrotesque_700Bold',
  b800: 'BricolageGrotesque_800ExtraBold',
} as const;

export function cardLayout(size: CardSize) {
  const post = size === 'post';
  return { top: post ? 96 : 120, bottom: post ? 300 : 320, foot: post ? 72 : 88, gap: post ? 28 : 40 };
}

const tr = {
  mealLabel: 'Öğün',
  calc: 'Kcalculate ile hesaplandı',
  protein: 'Protein', carbs: 'Karb.', fat: 'Yağ',
  today: 'Bugün', ofGoal: 'günlük hedef', meals: 'Öğün', water: 'Su', steps: 'Adım',
  pct: (n: number) => `%${n}`,
  ringA11y: (n: number) => `Günlük hedefin yüzde ${n}’i`,
  explore: 'Keşfet', more: 'Keşfet’te devamını oku',
  followCta: 'Beni Kcalculate’te takip et',
  recipe: 'Tarif', minutes: (n: number) => `${n} dk`, servings: (n: number) => `${n} porsiyon`,
  perServing: (k: number | null, p: number | null) =>
    `Porsiyon: ${[k != null ? `${k} kcal` : null, p != null ? `${p} g protein` : null].filter(Boolean).join(' · ')}`,
  ingTitle: 'Öne çıkan malzemeler',
  invH1: 'Arkadaşını davet et,', invH2: 'ikinize de 1 öğün bizden', codeLabel: 'Davet kodun', how: 'Kod, uygulamaya kayıt olurken girilir.',
  xrayTag: 'Tabak Röntgeni',
  storyAlt: 'Hikâye fotoğrafı',
};

export type CardStrings = typeof tr;

const en: CardStrings = {
  mealLabel: 'Meal',
  calc: 'Calculated with Kcalculate',
  protein: 'Protein', carbs: 'Carbs', fat: 'Fat',
  today: 'Today', ofGoal: 'of daily goal', meals: 'Meals', water: 'Water', steps: 'Steps',
  pct: (n: number) => `${n}%`,
  ringA11y: (n: number) => `${n} percent of daily goal`,
  explore: 'Explore', more: 'Read more on Explore',
  followCta: 'Follow me on Kcalculate',
  recipe: 'Recipe', minutes: (n: number) => `${n} min`, servings: (n: number) => `${n} servings`,
  perServing: (k: number | null, p: number | null) =>
    `${[k != null ? `${k} kcal` : null, p != null ? `${p} g protein` : null].filter(Boolean).join(' · ')} / serving`,
  ingTitle: 'Key ingredients',
  invH1: 'Invite a friend,', invH2: 'you both get 1 meal on us', codeLabel: 'Your invite code', how: 'Enter it when signing up in the app.',
  xrayTag: 'Plate X-ray',
  storyAlt: 'Story photo',
};

export const CARD_TEXT: Record<CardLang, CardStrings> = { tr, en };

/** Sayı biçimi: TR ondalık virgül; binlik ayıracı YOK (repo kuralı "nokta ayracı yok"). */
export function fmtNum(n: number | null | undefined, lang: CardLang, decimals = 0): string {
  if (n == null || !Number.isFinite(n)) return '–';
  const f = Math.pow(10, decimals);
  const v = Math.round(n * f) / f;
  const s = decimals > 0 && v % 1 !== 0 ? v.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '') : String(Math.round(v));
  return lang === 'tr' ? s.replace('.', ',') : s;
}

// Tasarımdaki 24×24 çizgi ikonları (stroke).
export const ICON = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  person: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20c1.2-3 3.6-4.5 6.5-4.5s5.3 1.5 6.5 4.5 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18 15.8c1.6.6 2.8 2 3.5 4.2',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Z M12 7.5V12l3 2',
  qr: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2.5v2.5H14z M17.5 17.5H20V20h-2.5z',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1 M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
} as const;
