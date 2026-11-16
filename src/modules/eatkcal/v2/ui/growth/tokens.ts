// G56-S1 — eatkcal ana sayfa bölümlerinin renk / ölçü değerleri. Kaynak: docs/g56/design/EkSec.dc.html
// (`t` ve `g` nesneleri) + EkScr.dc.html. Tema rolleriyle aynı olanlar temadan, yalnız tasarımda olan
// ek tonlar (line2, nest, skel, cam, parıltı zemini) burada.
import { useEk } from '../kit';

export interface GrowthTokens {
  dark: boolean;
  bg: string;
  card: string;
  ink: string;
  sec: string;
  line: string;
  line2: string;
  nest: string;
  skel: string;
  lime: string;
  limeInk: string;
  limeLine: string;
  glass: string;
  glassEdge: string;
  glassSh: string;
  /** Kalan kalori bölümünün bulanık renkli zemini + cam yüzeyleri. */
  glow: { base: string; edge: string; a: string; b: string; c: string; glass: string; glassEdge: string; nest: string; skel: string };
}

const LIME = '#B9EF14';

export function useGrowthTokens(): GrowthTokens {
  const { theme, c } = useEk();
  const dark = theme.isDark;
  return dark
    ? {
        dark,
        bg: c.bg,
        card: c.surface,
        ink: c.ink,
        sec: c.secondary,
        line: c.line,
        line2: '#48484A',
        nest: '#2C2C2E',
        skel: '#2C2C2E',
        lime: LIME,
        limeInk: '#0A0A0A',
        limeLine: LIME,
        glass: 'rgba(28,28,30,0.82)',
        glassEdge: 'rgba(255,255,255,0.12)',
        glassSh: 'rgba(0,0,0,0.5)',
        glow: {
          base: '#0D2617',
          edge: 'rgba(185,239,20,0.14)',
          a: 'rgba(185,239,20,0.30)',
          b: 'rgba(31,122,62,0.75)',
          c: 'rgba(254,204,170,0.20)',
          glass: 'rgba(255,255,255,0.08)',
          glassEdge: 'rgba(255,255,255,0.14)',
          nest: 'rgba(255,255,255,0.12)',
          skel: 'rgba(255,255,255,0.10)',
        },
      }
    : {
        dark,
        bg: c.bg,
        card: c.surface,
        ink: c.ink,
        sec: c.secondary,
        line: c.line,
        line2: '#C3C7CC',
        nest: '#E9EBEE',
        skel: '#DCDEE2',
        lime: LIME,
        limeInk: '#0A0A0A',
        limeLine: '#4A6B00',
        glass: 'rgba(255,255,255,0.86)',
        glassEdge: 'rgba(10,10,10,0.08)',
        glassSh: 'rgba(10,10,10,0.16)',
        glow: {
          base: '#FFF4EA',
          edge: 'rgba(10,10,10,0.05)',
          a: 'rgba(185,239,20,0.55)',
          b: 'rgba(254,204,170,0.95)',
          c: 'rgba(254,217,189,0.90)',
          glass: 'rgba(255,255,255,0.62)',
          glassEdge: 'rgba(255,255,255,0.75)',
          nest: 'rgba(255,255,255,0.62)',
          skel: 'rgba(10,10,10,0.07)',
        },
      };
}

/** EkSec ölçüleri (pt). */
export const SEC = {
  gap: 10,
  headMin: 44,
  reorderCardW: 276,
  kcalCardW: 164,
  topCardW: 148,
  bannerW: 300,
  inviteW: 398,
  bannerH: 104,
} as const;
