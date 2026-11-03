// Öğün paylaşım kartı — react-native-svg ile çizilen, tam çözünürlüklü (1080×1350,
// 4:5 sosyal oran) vektör kart. forwardRef ile <Svg> instance'ı dışarı verilir;
// ebeveyn `ref.toDataURL(...)` ile PNG yakalar (bkz. src/lib/shareCard.ts).
//
// Kartta BULUNAN: marka, "tahmin" etiketi, öğün adı, porsiyon (opsiyonel),
// kalori + protein. BULUNMAYAN (gizlilik, G5-S4 md.1): kişisel hedef, gün toplamı,
// kullanıcı adı/kimliği. Metin tabanlıdır (raster logo yok) — toDataURL yakalaması
// iOS/Android'de güvenilir olsun diye.

import React, { forwardRef } from 'react';
import Svg, {
  Rect,
  Text as SvgText,
  Line,
} from 'react-native-svg';

export type ShareMealData = {
  name: string;
  calories: number;
  protein?: number | null;
  /** Porsiyon metni (ör. "1 tabak", "200 g") — yoksa gösterilmez. */
  portion?: string | null;
  /** "tahmin" etiketi (AI/elle tahmini değer). Varsayılan true. */
  estimate?: boolean;
};

export const CARD_W = 1080;
export const CARD_H = 1350;

const COLORS = {
  bg: '#0A0A0A',
  surface: '#141414',
  border: '#232323',
  accent: '#B9EF14',
  accentText: '#0A0A0A',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.70)',
  textMuted: 'rgba(255,255,255,0.45)',
};

const F = {
  bold: 'PlusJakartaSans_700Bold',
  extra: 'PlusJakartaSans_800ExtraBold',
  semi: 'PlusJakartaSans_600SemiBold',
  reg: 'PlusJakartaSans_400Regular',
};

// SVG otomatik satır kaydırmaz; öğün adını en fazla 2 satıra böl.
function wrapName(name: string, maxPerLine = 18): string[] {
  const clean = (name || 'Öğün').trim();
  if (clean.length <= maxPerLine) return [clean];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length > maxPerLine && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = candidate;
    }
    if (lines.length === 1 && cur.length > maxPerLine) break;
  }
  if (cur) lines.push(cur);
  // En fazla 2 satır; taşarsa 2. satırı kısalt.
  const out = lines.slice(0, 2);
  if (lines.length > 2 || (out[1] && out[1].length > maxPerLine)) {
    out[1] = `${(out[1] ?? '').slice(0, maxPerLine - 1)}…`;
  }
  return out;
}

type Props = { data: ShareMealData };

const MealShareCard = forwardRef<React.ElementRef<typeof Svg>, Props>(({ data }, ref) => {
  const estimate = data.estimate !== false;
  const kcal = Math.max(0, Math.round(Number(data.calories) || 0));
  const protein =
    data.protein != null && isFinite(Number(data.protein))
      ? Math.max(0, Math.round(Number(data.protein)))
      : null;
  const nameLines = wrapName(data.name);
  const portion = (data.portion ?? '').trim();

  // Dikey yerleşim referansları.
  const cx = CARD_W / 2;
  const nameBaseY = portion ? 560 : 600;

  return (
    <Svg ref={ref} width={CARD_W} height={CARD_H} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
      {/* Zemin */}
      <Rect x={0} y={0} width={CARD_W} height={CARD_H} fill={COLORS.bg} />
      {/* İnce çerçeve */}
      <Rect
        x={32}
        y={32}
        width={CARD_W - 64}
        height={CARD_H - 64}
        rx={44}
        fill="none"
        stroke={COLORS.border}
        strokeWidth={2}
      />
      {/* Üst aksan şeridi */}
      <Rect x={96} y={120} width={120} height={10} rx={5} fill={COLORS.accent} />

      {/* Marka */}
      <SvgText x={96} y={210} fontFamily={F.extra} fontSize={56} fill={COLORS.textPrimary}>
        Kcalculate
      </SvgText>
      <SvgText x={96} y={262} fontFamily={F.semi} fontSize={26} fill={COLORS.textMuted} letterSpacing={2}>
        BESLENME TAKİBİ
      </SvgText>

      {/* "tahmin" etiketi */}
      {estimate && (
        <>
          <Rect
            x={CARD_W - 96 - 230}
            y={150}
            width={230}
            height={66}
            rx={33}
            fill="none"
            stroke={COLORS.accent}
            strokeWidth={3}
          />
          <SvgText
            x={CARD_W - 96 - 115}
            y={194}
            fontFamily={F.semi}
            fontSize={30}
            fill={COLORS.accent}
            textAnchor="middle"
            letterSpacing={3}
          >
            TAHMİN
          </SvgText>
        </>
      )}

      {/* Ayraç */}
      <Line x1={96} y1={340} x2={CARD_W - 96} y2={340} stroke={COLORS.border} strokeWidth={2} />

      {/* Öğün adı */}
      {nameLines.map((line, i) => (
        <SvgText
          key={i}
          x={cx}
          y={nameBaseY + i * 92}
          fontFamily={F.bold}
          fontSize={76}
          fill={COLORS.textPrimary}
          textAnchor="middle"
        >
          {line}
        </SvgText>
      ))}

      {/* Porsiyon */}
      {portion ? (
        <SvgText
          x={cx}
          y={nameBaseY + nameLines.length * 92 + 20}
          fontFamily={F.reg}
          fontSize={40}
          fill={COLORS.textSecondary}
          textAnchor="middle"
        >
          {portion}
        </SvgText>
      ) : null}

      {/* İstatistik kartları */}
      {(() => {
        const twoUp = protein != null;
        const boxW = twoUp ? 400 : 560;
        const gap = 48;
        const totalW = twoUp ? boxW * 2 + gap : boxW;
        const startX = cx - totalW / 2;
        const boxY = 820;
        const boxH = 300;
        const render = (x: number, big: string, unit: string, label: string) => (
          <React.Fragment key={label}>
            <Rect x={x} y={boxY} width={boxW} height={boxH} rx={32} fill={COLORS.surface} stroke={COLORS.border} strokeWidth={2} />
            <SvgText x={x + boxW / 2} y={boxY + 150} fontFamily={F.extra} fontSize={110} fill={COLORS.accent} textAnchor="middle">
              {big}
            </SvgText>
            <SvgText x={x + boxW / 2} y={boxY + 205} fontFamily={F.semi} fontSize={38} fill={COLORS.textPrimary} textAnchor="middle">
              {unit}
            </SvgText>
            <SvgText x={x + boxW / 2} y={boxY + 258} fontFamily={F.reg} fontSize={30} fill={COLORS.textMuted} textAnchor="middle" letterSpacing={2}>
              {label}
            </SvgText>
          </React.Fragment>
        );
        return (
          <>
            {render(startX, kcal.toLocaleString('tr-TR'), 'kcal', 'KALORİ')}
            {twoUp && render(startX + boxW + gap, String(protein), 'gram', 'PROTEİN')}
          </>
        );
      })()}

      {/* Alt bilgi */}
      <SvgText x={cx} y={CARD_H - 150} fontFamily={F.semi} fontSize={36} fill={COLORS.textPrimary} textAnchor="middle">
        Kcalculate ile takip et
      </SvgText>
      <SvgText x={cx} y={CARD_H - 100} fontFamily={F.reg} fontSize={30} fill={COLORS.textMuted} textAnchor="middle" letterSpacing={2}>
        eatkcal.com
      </SvgText>
    </Svg>
  );
});

MealShareCard.displayName = 'MealShareCard';

export default MealShareCard;
