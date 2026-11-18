// Paylaşım kartı — 8 tür tek bileşen (G61-S1 md.1; tasarım FinShareCard{Meal,Day,Post,
// Profile,Recipe,Invite,Xray,Story}). `bg` light/dark/photo × `size` story 1080×1920 /
// post 1080×1350 × `qr`. Tamamı react-native-svg: önizleme aynı bileşenin küçültülmüş
// çizimi (viewBox), paylaşım `toDataURL` ile PNG (src/lib/shareCard.ts). PAKET YOK.
//
// Tasarımdan bilinçli farklar (LOG "KARAR"): CSS blur/backdrop-filter ve gölgeler SVG'de
// yok → bulanık lekeler radyal gradyan; fotoğraflı zeminde bulanık foto (profil,
// röntgen) yerine koyu örtülü foto; sabit metin genişliği tahmini (textFit.ts).
// Veri YALNIZ ShareCardInput'tan (cardModel.ts beyaz listesi) gelir.

import React, { forwardRef } from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
  TSpan,
} from 'react-native-svg';
import type { ImageSourcePropType } from 'react-native';
import { BRAND_LOGO_PATHS } from '../../../core/design/components/brandLogoPaths';
import { encodeQr, qrPath } from '../../../lib/qr';
import type { ShareCardInput } from '../../../lib/share/cardModel';
import {
  CARD_TEXT,
  CARD_THEME,
  CARD_W,
  FONT,
  ICON,
  LIME,
  cardHeight,
  cardLayout,
  fmtNum,
  type CardBg,
  type CardLang,
  type CardSize,
  type CardStrings,
  type CardTheme,
} from './cardTheme';
import { baselineAt, fitLine, textWidth, wrapText } from './textFit';

const BOWL = require('../../../../assets/glass/bowl.png');
const DROP = require('../../../../assets/glass/drop.png');
const FOOT = require('../../../../assets/glass/foot.png');

export type ShareCardProps = {
  input: ShareCardInput;
  bg: CardBg;
  size: CardSize;
  qr: boolean;
  lang: CardLang;
  /** Alt köşedeki kısa bağlantı (l.eatkcal.com/m/…). */
  link: string;
  /** QR içeriği (tam bağlantı). Yoksa QR çizilmez. */
  qrValue?: string | null;
  /** Ekranda çizim genişliği (pt). Varsayılan 1080 = yakalama boyutu. */
  width?: number;
  /** Ekran okuyucu etiketi (önizlemede). */
  accessibilityLabel?: string;
};

/** Kartın fotoğraflı zemin için kullanabileceği görsel (yoksa "Fotoğraflı" şablonu gizlenir). */
export function cardPhoto(input: ShareCardInput): string | null {
  switch (input.kind) {
    case 'meal':
    case 'day':
    case 'xray':
    case 'story':
      return input.data.photoUri ?? null;
    case 'post':
    case 'recipe':
      return input.data.imageUri ?? null;
    case 'profile':
      return input.data.avatarUri ?? null;
    case 'invite':
      return null;
  }
}

type Ctx = {
  t: CardTheme;
  s: CardStrings;
  lang: CardLang;
  bg: CardBg;
  post: boolean;
  H: number;
  L: ReturnType<typeof cardLayout>;
  y0: number;
  y1: number;
  P: <A>(story: A, post: A) => A;
};

const X0 = 88;
const CW = 904;

const src = (uri: string | ImageSourcePropType) => (typeof uri === 'string' ? { uri } : uri);

// ─── Küçük yapı taşları ──────────────────────────────────────────────────────
function Txt({
  x, top, size, lh = 1.35, font, fill, anchor, lines, ls,
}: {
  x: number; top: number; size: number; lh?: number; font: string; fill: string; anchor?: 'start' | 'middle' | 'end';
  lines: string[]; ls?: number;
}) {
  return (
    <>
      {lines.map((ln, i) => (
        <SvgText
          key={i}
          x={x}
          y={baselineAt(top + i * size * lh, size, lh)}
          fontFamily={font}
          fontSize={size}
          fill={fill}
          textAnchor={anchor}
          letterSpacing={ls}
        >
          {ln}
        </SvgText>
      ))}
    </>
  );
}

function StrokeIcon({ d, x, y, size, color, sw = 2 }: { d: string; x: number; y: number; size: number; color: string; sw?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${size / 24})`}>
      <Path d={d} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </G>
  );
}

/** Hap etiket; genişliğini döndürür. */
function chipWidth(label: string, size: number, padL: number, padR: number, weight = 700, icon = 0, gap = 12) {
  return padL + (icon ? icon + gap : 0) + textWidth(label, size, 'jakarta', weight) + padR;
}

function Chip({
  x, y, label, bg, fg, h = 68, size = 28, weight = 700, padL = 28, padR = 28, icon, iconSize = 32, iconSw = 2.2, align = 'start',
}: {
  x: number; y: number; label: string; bg: string; fg: string; h?: number; size?: number; weight?: 700 | 800; padL?: number; padR?: number;
  icon?: string; iconSize?: number; iconSw?: number; align?: 'start' | 'end';
}) {
  const w = chipWidth(label, size, padL, padR, weight, icon ? iconSize : 0);
  const left = align === 'end' ? x - w : x;
  const font = weight === 800 ? FONT.j800 : FONT.j700;
  return (
    <G>
      <Rect x={left} y={y} width={w} height={h} rx={h / 2} fill={bg} />
      {icon ? <StrokeIcon d={icon} x={left + padL} y={y + (h - iconSize) / 2} size={iconSize} color={fg} sw={iconSw} /> : null}
      <SvgText x={left + padL + (icon ? iconSize + 12 : 0)} y={y + h / 2 + size * 0.35} fontFamily={font} fontSize={size} fill={fg}>
        {label}
      </SvgText>
    </G>
  );
}

function Panel({ c, y, h, x = X0, w = CW, r = 48 }: { c: Ctx; y: number; h: number; x?: number; w?: number; r?: number }) {
  return (
    <Rect
      x={x + (c.t.panelStroke ? 1 : 0)}
      y={y + (c.t.panelStroke ? 1 : 0)}
      width={w - (c.t.panelStroke ? 2 : 0)}
      height={h - (c.t.panelStroke ? 2 : 0)}
      rx={r}
      fill={c.t.panel}
      stroke={c.t.panelStroke ?? undefined}
      strokeWidth={c.t.panelStroke ? 2 : 0}
    />
  );
}

function macroCellH(valSize: number) {
  return 18 * 2 + 26 * 1.35 + 2 + valSize * 1.1;
}

function MacroGrid({ c, x, y, w, valSize, vals }: { c: Ctx; x: number; y: number; w: number; valSize: number; vals: (number | null | undefined)[] }) {
  const labels = [c.s.protein, c.s.carbs, c.s.fat];
  const cw = (w - 32) / 3;
  const h = macroCellH(valSize);
  return (
    <G>
      {labels.map((l, i) => {
        const cx = x + i * (cw + 16);
        return (
          <G key={l}>
            <Rect x={cx} y={y} width={cw} height={h} rx={28} fill={c.t.chip} />
            <Txt x={cx + 22} top={y + 18} size={26} font={FONT.j600} fill={c.t.sec} lines={[l]} />
            <Txt
              x={cx + 22}
              top={y + 18 + 26 * 1.35 + 2}
              size={valSize}
              lh={1.1}
              font={FONT.b700}
              fill={c.t.text}
              lines={[`${fmtNum(vals[i], c.lang)} g`]}
            />
          </G>
        );
      })}
    </G>
  );
}

/** Daire içine kırpılmış görsel (yoksa düz daire + kişi ikonu). */
function CircleImage({ id, cx, cy, r, uri, c, iconSize }: { id: string; cx: number; cy: number; r: number; uri?: string | null; c: Ctx; iconSize: number }) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={c.t.av} />
      {uri ? (
        <>
          <Defs>
            <ClipPath id={id}>
              <Circle cx={cx} cy={cy} r={r} />
            </ClipPath>
          </Defs>
          <SvgImage x={cx - r} y={cy - r} width={r * 2} height={r * 2} href={src(uri)} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />
        </>
      ) : (
        <StrokeIcon d={ICON.person} x={cx - iconSize / 2} y={cy - iconSize / 2} size={iconSize} color={c.t.avIcon} sw={1.5} />
      )}
    </G>
  );
}

function RoundImage({ id, x, y, w, h, r, uri }: { id: string; x: number; y: number; w: number; h: number; r: number; uri: string }) {
  return (
    <G>
      <Defs>
        <ClipPath id={id}>
          <Rect x={x} y={y} width={w} height={h} rx={r} />
        </ClipPath>
      </Defs>
      <SvgImage x={x} y={y} width={w} height={h} href={src(uri)} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />
    </G>
  );
}

function Glow({ id, cx, cy, r, op }: { id: string; cx: number; cy: number; r: number; op: number }) {
  if (op <= 0 || r <= 0) return null;
  return (
    <>
      <Defs>
        <RadialGradient id={id} cx={cx} cy={cy} r={r} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={LIME} stopOpacity={op} />
          <Stop offset="0.66" stopColor={LIME} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
    </>
  );
}

// ─── Çerçeve: zemin + alt bilgi ─────────────────────────────────────────────
function Background({ c, photo, extraDim = 0 }: { c: Ctx; photo: string | null; extraDim?: number }) {
  const { H, t } = c;
  if (c.bg === 'photo' && photo) {
    return (
      <G>
        <Rect x={0} y={0} width={CARD_W} height={H} fill={t.bg} />
        <SvgImage x={0} y={0} width={CARD_W} height={H} href={src(photo)} preserveAspectRatio="xMidYMid slice" />
        {extraDim > 0 ? <Rect x={0} y={0} width={CARD_W} height={H} fill="#000000" opacity={extraDim} /> : null}
        <Defs>
          <LinearGradient id="ov" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity={0.3} />
            <Stop offset="0.32" stopColor="#000" stopOpacity={0.05} />
            <Stop offset="0.58" stopColor="#000" stopOpacity={0.25} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.82} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={CARD_W} height={H} fill="url(#ov)" />
      </G>
    );
  }
  return (
    <G>
      <Rect x={0} y={0} width={CARD_W} height={H} fill={t.bg} />
      <Defs>
        <RadialGradient id="blobA" cx={290} cy={350} r={550} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={t.blobA} stopOpacity={t.blobAOp} />
          <Stop offset="0.68" stopColor={t.blobA} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="blobB" cx={900} cy={H - 660} r={500} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={t.blobB} stopOpacity={t.blobBOp} />
          <Stop offset="0.68" stopColor={t.blobB} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={290} cy={350} r={550} fill="url(#blobA)" />
      <Circle cx={900} cy={H - 660} r={500} fill="url(#blobB)" />
    </G>
  );
}

const LOGO = BRAND_LOGO_PATHS.kcalculate;
const [LVX, LVY, LVW, LVH] = LOGO.viewBox.split(' ').map(Number);

function Footer({ c, link, qrValue, qr }: { c: Ctx; link: string; qrValue?: string | null; qr: boolean }) {
  const bottom = c.H - c.L.foot;
  const linkTop = bottom - 30 * 1.35;
  const logoH = 54;
  const logoY = linkTop - 14 - logoH;
  const s = logoH / LVH;
  let qrEl: React.ReactNode = null;
  if (qr && qrValue) {
    try {
      const m = encodeQr(qrValue, { ecc: 'M' });
      const box = 188;
      const bx = X0 + CW - box;
      const by = bottom - box;
      const inner = 156;
      qrEl = (
        <G>
          <Rect x={bx} y={by} width={box} height={box} rx={28} fill="#FFFFFF" />
          <G transform={`translate(${bx + 16} ${by + 16}) scale(${inner / m.size})`}>
            <Path d={qrPath(m)} fill="#0A0A0A" />
          </G>
        </G>
      );
    } catch {
      qrEl = null; // çok uzun veri — QR çizilmez, bağlantı metni kalır
    }
  }
  return (
    <G>
      <G transform={`translate(${X0} ${logoY}) scale(${s}) translate(${-LVX} ${-LVY})`}>
        {LOGO.paths.map((d, i) => (
          <Path key={i} d={d} fill={c.t.logo} />
        ))}
      </G>
      <Txt x={X0} top={linkTop} size={30} font={FONT.j600} fill={c.t.sec} lines={[fitLine(link, 30, qrEl ? CW - 188 - 32 : CW)]} />
      {qrEl}
    </G>
  );
}

// ─── Kart içerikleri ─────────────────────────────────────────────────────────
function MealContent({ c, d }: { c: Ctx; d: Extract<ShareCardInput, { kind: 'meal' }>['data'] }) {
  const { P, t, s } = c;
  const pad = P(48, 40), pgap = P(26, 18), hs = P(72, 58), ks = P(176, 124), ms = P(46, 40), heroMax = P(720, 300);
  const inner = CW - pad * 2;
  const nameLines = wrapText(d.name, hs, inner, 2, 'bricolage', 700);
  const nameH = nameLines.length * hs * 1.05;
  const kcalH = ks * 0.95;
  const mH = macroCellH(ms);
  const panelH = pad * 2 + nameH + pgap + kcalH + pgap + mH + pgap + 64;
  const panelY = c.y1 - panelH;
  const label = d.mealLabel || s.mealLabel;
  const heroTop = c.y0 + 68 + c.L.gap;
  const heroBot = panelY - c.L.gap;
  const regionH = heroBot - heroTop;
  const heroSize = Math.max(0, Math.min(heroMax, regionH, CW));
  const hcx = X0 + CW / 2;
  const hcy = heroTop + regionH / 2;
  const yName = panelY + pad;
  const yKcal = yName + nameH + pgap;
  const yMacro = yKcal + kcalH + pgap;
  const yCalc = yMacro + mH + pgap;
  const kcalStr = fmtNum(d.kcal, c.lang);
  const calcW = chipWidth(s.calc, 26, 18, 26, 800, 30);
  return (
    <G>
      <Chip x={X0} y={c.y0} label={label} bg={t.chip} fg={t.text} />
      {c.bg !== 'photo' && regionH > 40 ? (
        <G>
          <Glow id="mg" cx={hcx} cy={hcy} r={Math.min(CW * 0.43, regionH * 0.62)} op={t.glowOp} />
          {d.photoUri ? (
            <CircleImage id="mp" cx={hcx} cy={hcy} r={heroSize * 0.42} uri={d.photoUri} c={c} iconSize={80} />
          ) : (
            <SvgImage x={hcx - heroSize * 0.4} y={hcy - heroSize * 0.4} width={heroSize * 0.8} height={heroSize * 0.8} href={BOWL} preserveAspectRatio="xMidYMid meet" />
          )}
        </G>
      ) : null}
      <Panel c={c} y={panelY} h={panelH} />
      <Txt x={X0 + pad} top={yName} size={hs} lh={1.05} font={FONT.b700} fill={t.text} lines={nameLines} />
      <SvgText x={X0 + pad} y={yKcal + (ks * 0.95) / 2 + ks * 0.35} fontFamily={FONT.b800} fontSize={ks} fill={t.text}>
        {kcalStr}
        <TSpan fontFamily={FONT.b700} fontSize={ks * 0.4} dx={12}>
          kcal
        </TSpan>
      </SvgText>
      <MacroGrid c={c} x={X0 + pad} y={yMacro} w={inner} valSize={ms} vals={[d.protein, d.carbs, d.fat]} />
      <Rect x={X0 + pad} y={yCalc} width={calcW} height={64} rx={32} fill={LIME} />
      <StrokeIcon d={ICON.check} x={X0 + pad + 18} y={yCalc + 17} size={30} color="#0A0A0A" sw={2.6} />
      <SvgText x={X0 + pad + 18 + 30 + 12} y={yCalc + 32 + 26 * 0.35} fontFamily={FONT.j800} fontSize={26} fill="#0A0A0A">
        {s.calc}
      </SvgText>
    </G>
  );
}

function DayContent({ c, d }: { c: Ctx; d: Extract<ShareCardInput, { kind: 'day' }>['data'] }) {
  const { P, t, s } = c;
  const pad = P(36, 28), ringMax = P(640, 440), pctS = P(168, 120), subS = P(34, 28);
  const cellPadY = P(22, 16), cellPadX = P(24, 20), ico = P(72, 56), val = P(50, 42);
  type Cell = { l: string; v: string; img?: number; letter?: string };
  const cells: Cell[] = [{ l: s.meals, v: fmtNum(d.meals, c.lang), img: BOWL }];
  if (d.protein != null) cells.push({ l: s.protein, v: `${fmtNum(d.protein, c.lang)} g`, letter: 'P' });
  if (d.waterL != null) cells.push({ l: s.water, v: `${fmtNum(d.waterL, c.lang, 1)} L`, img: DROP });
  if (d.steps != null) cells.push({ l: s.steps, v: fmtNum(d.steps, c.lang), img: FOOT });
  const rows = Math.ceil(cells.length / 2);
  const cellH = cellPadY * 2 + Math.max(ico, 26 * 1.35 + val * 1.1);
  const panelH = pad * 2 + rows * cellH + (rows - 1) * 16;
  const panelY = c.y1 - panelH;
  const inner = CW - pad * 2;
  const cellW = (inner - 16) / 2;
  const regionTop = c.y0 + 68 + c.L.gap;
  const regionH = panelY - c.L.gap - regionTop;
  const ring = Math.max(0, Math.min(ringMax, regionH, CW));
  const k = ring / ringMax;
  const rcx = X0 + CW / 2;
  const rcy = regionTop + regionH / 2;
  const R = (ring * 86) / 200;
  const sw = (ring * 18) / 200;
  const pct = Math.max(0, Math.round(d.pct));
  const frac = Math.min(1, pct / 100);
  const circ = 2 * Math.PI * R;
  return (
    <G>
      <Chip x={X0} y={c.y0} label={s.today} bg={t.chip} fg={t.text} />
      {d.dateLabel ? (
        <SvgText x={X0 + CW} y={c.y0 + 34 + 28 * 0.35} fontFamily={FONT.j600} fontSize={28} fill={t.sec} textAnchor="end">
          {d.dateLabel}
        </SvgText>
      ) : null}
      {ring > 60 ? (
        <G>
          <Circle cx={rcx} cy={rcy} r={R} fill="none" stroke={t.track} strokeWidth={sw} />
          {frac > 0 ? (
            <Circle
              cx={rcx}
              cy={rcy}
              r={R}
              fill="none"
              stroke={LIME}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeDasharray={`${circ * frac} ${circ}`}
              transform={`rotate(-90 ${rcx} ${rcy})`}
            />
          ) : null}
          <SvgText x={rcx} y={rcy - 4 * k} fontFamily={FONT.b800} fontSize={pctS * k} fill={t.text} textAnchor="middle">
            {s.pct(pct)}
          </SvgText>
          <SvgText x={rcx} y={rcy + subS * 1.5 * k} fontFamily={FONT.j600} fontSize={subS * k} fill={t.sec} textAnchor="middle">
            {s.ofGoal}
          </SvgText>
        </G>
      ) : null}
      <Panel c={c} y={panelY} h={panelH} />
      {cells.map((cell, i) => {
        const cx = X0 + pad + (i % 2) * (cellW + 16);
        const cy = panelY + pad + Math.floor(i / 2) * (cellH + 16);
        const icy = cy + (cellH - ico) / 2;
        const tx = cx + cellPadX + ico + 18;
        const textH = 26 * 1.35 + val * 1.1;
        const ty = cy + (cellH - textH) / 2;
        return (
          <G key={cell.l}>
            <Rect x={cx} y={cy} width={cellW} height={cellH} rx={28} fill={t.chip} />
            {cell.img != null ? (
              <SvgImage x={cx + cellPadX} y={icy} width={ico} height={ico} href={cell.img} preserveAspectRatio="xMidYMid meet" />
            ) : (
              <G>
                <Circle cx={cx + cellPadX + ico / 2} cy={icy + ico / 2} r={ico / 2} fill={LIME} />
                <SvgText x={cx + cellPadX + ico / 2} y={icy + ico / 2 + 32 * 0.35} fontFamily={FONT.b800} fontSize={32} fill="#0A0A0A" textAnchor="middle">
                  {cell.letter}
                </SvgText>
              </G>
            )}
            <Txt x={tx} top={ty} size={26} font={FONT.j600} fill={t.sec} lines={[cell.l]} />
            <Txt x={tx} top={ty + 26 * 1.35} size={val} lh={1.1} font={FONT.b700} fill={t.text} lines={[fitLine(cell.v, val, cellW - (tx - cx) - 12, 'bricolage', 700)]} />
          </G>
        );
      })}
    </G>
  );
}

function PostContent({ c, d }: { c: Ctx; d: Extract<ShareCardInput, { kind: 'post' }>['data'] }) {
  const { P, t, s } = c;
  const pad = P(48, 40), pgap = P(30, 22), ts = P(44, 38);
  const inner = CW - pad * 2;
  const lines = wrapText(d.text, ts, inner, 3, 'jakarta', 500);
  const textH = lines.length * ts * 1.38;
  const showImg = c.bg !== 'photo' && !!d.imageUri;
  const fixedH = pad * 2 + 96 + pgap + (lines.length ? textH + pgap : 0) + 38;
  const avail = c.y1 - c.y0;
  const imgH = showImg ? Math.max(0, Math.min(P(860, 420), avail - fixedH - pgap)) : 0;
  const panelH = fixedH + (imgH > 0 ? imgH + pgap : 0);
  const panelY = c.bg === 'photo' ? c.y1 - panelH : c.y0;
  const y = panelY + pad;
  const yText = y + 96 + pgap;
  const yImg = yText + (lines.length ? textH + pgap : 0);
  const yMore = yImg + (imgH > 0 ? imgH + pgap : 0);
  const handleLine = `${d.handle ? `@${d.handle} · ` : ''}${s.explore}`;
  return (
    <G>
      <Panel c={c} y={panelY} h={panelH} />
      <CircleImage id="pa" cx={X0 + pad + 48} cy={y + 48} r={48} c={c} iconSize={44} />
      <Txt x={X0 + pad + 96 + 20} top={y + 48 - (36 * 1.35 + 28 * 1.35) / 2} size={36} font={FONT.j700} fill={t.text} lines={[fitLine(d.authorName, 36, inner - 116, 'jakarta', 700)]} />
      <Txt x={X0 + pad + 96 + 20} top={y + 48 - (36 * 1.35 + 28 * 1.35) / 2 + 36 * 1.35} size={28} font={FONT.j500} fill={t.sec} lines={[fitLine(handleLine, 28, inner - 116)]} />
      {lines.length ? <Txt x={X0 + pad} top={yText} size={ts} lh={1.38} font={FONT.j500} fill={t.text} lines={lines} /> : null}
      {imgH > 0 && d.imageUri ? <RoundImage id="pi" x={X0 + pad} y={yImg} w={inner} h={imgH} r={36} uri={d.imageUri} /> : null}
      <SvgText x={X0 + pad} y={yMore + 19 + 28 * 0.35} fontFamily={FONT.j700} fontSize={28} fill={t.acc}>
        {s.more}
      </SvgText>
      <StrokeIcon d={ICON.arrow} x={X0 + pad + textWidth(s.more, 28, 'jakarta', 700) + 12} y={yMore + 4} size={30} color={t.acc} sw={2.2} />
    </G>
  );
}

function ProfileContent({ c, d }: { c: Ctx; d: Extract<ShareCardInput, { kind: 'profile' }>['data'] }) {
  const { P, t, s } = c;
  const gap = P(28, 20), av = P(320, 220), ns = P(104, 84), bs = P(40, 36);
  const name = fitLine(d.name || `@${d.handle}`, ns, CW, 'bricolage', 800);
  const bio = d.bio ? wrapText(d.bio, bs, 780, 2, 'jakarta', 500) : [];
  const ctaW = 52 + 44 + 16 + textWidth(s.followCta, 40, 'jakarta', 800) + 52;
  const total = av + 24 + gap + 20 + ns + 8 + 40 * 1.35 + (bio.length ? gap + bio.length * bs * 1.4 : 0) + gap + 16 + 112;
  const y0 = c.y0 + Math.max(0, (c.y1 - c.y0 - total) / 2);
  const cx = X0 + CW / 2;
  const avCy = y0 + 24 + av / 2;
  const yName = y0 + av + 24 * 2 + gap;
  const yHandle = yName + ns + 8;
  const yBio = yHandle + 40 * 1.35;
  const yCta = yBio + (bio.length ? gap + bio.length * bs * 1.4 : 0) + gap + 16;
  return (
    <G>
      <Circle cx={cx} cy={avCy} r={av / 2 + 24} fill={t.bg} />
      <Circle cx={cx} cy={avCy} r={av / 2 + 12} fill={LIME} />
      <CircleImage id="av" cx={cx} cy={avCy} r={av / 2} uri={d.avatarUri} c={c} iconSize={120} />
      <Txt x={cx} top={yName - 4} size={ns} lh={1} font={FONT.b800} fill={t.text} anchor="middle" lines={[name]} />
      <Txt x={cx} top={yHandle} size={40} font={FONT.j600} fill={t.sec} anchor="middle" lines={[`@${d.handle}`]} />
      {bio.length ? <Txt x={cx} top={yBio + gap} size={bs} lh={1.4} font={FONT.j500} fill={t.text} anchor="middle" lines={bio} /> : null}
      <Rect x={cx - ctaW / 2} y={yCta} width={ctaW} height={112} rx={56} fill={LIME} />
      <StrokeIcon d={ICON.person} x={cx - ctaW / 2 + 52} y={yCta + 34} size={44} color="#0A0A0A" sw={2.2} />
      <SvgText x={cx - ctaW / 2 + 52 + 44 + 16} y={yCta + 56 + 40 * 0.35} fontFamily={FONT.j800} fontSize={40} fill="#0A0A0A">
        {s.followCta}
      </SvgText>
    </G>
  );
}

function RecipeContent({ c, d }: { c: Ctx; d: Extract<ShareCardInput, { kind: 'recipe' }>['data'] }) {
  const { P, t, s } = c;
  const pad = P(44, 36), pgap = P(24, 16), hs = P(80, 60), is = P(36, 32), imgMax = P(700, 300);
  const inner = CW - pad * 2;
  const nameLines = wrapText(d.name, hs, inner, 2, 'bricolage', 700);
  const chips: { label: string; icon?: string; lime?: boolean }[] = [];
  if (d.minutes != null) chips.push({ label: s.minutes(Math.round(d.minutes)), icon: ICON.clock });
  if (d.servings != null) chips.push({ label: s.servings(Math.round(d.servings)), icon: ICON.person });
  if (d.kcalPerServing != null || d.proteinPerServing != null)
    chips.push({
      label: s.perServing(d.kcalPerServing != null ? Math.round(d.kcalPerServing) : null, d.proteinPerServing != null ? Math.round(d.proteinPerServing) : null),
      lime: true,
    });
  // Hap satırlarını yerleştir (flex-wrap, gap 12).
  const placed: { x: number; row: number; w: number; label: string; icon?: string; lime?: boolean }[] = [];
  let cx = 0;
  let row = 0;
  for (const ch of chips) {
    const w = ch.lime ? chipWidth(ch.label, 28, 22, 22, 800) : chipWidth(ch.label, 28, 22, 22, 700, 32, 10);
    if (cx > 0 && cx + w > inner) {
      row++;
      cx = 0;
    }
    placed.push({ x: cx, row, w, ...ch });
    cx += w + 12;
  }
  const chipRows = chips.length ? row + 1 : 0;
  const ings = (d.ingredients ?? []).slice(0, 3);
  const ingH = ings.length ? 26 * 1.35 + ings.length * (is * 1.35 + 10) : 0;
  const panelH =
    pad * 2 + 68 + pgap + nameLines.length * hs * 1.05 + (chipRows ? pgap + chipRows * 64 + (chipRows - 1) * 12 : 0) + (ings.length ? pgap + ingH : 0);
  const showImg = c.bg !== 'photo' && !!d.imageUri;
  const imgH = showImg ? Math.max(0, Math.min(imgMax, c.y1 - c.y0 - panelH - c.L.gap)) : 0;
  const panelY = showImg && imgH > 0 ? c.y0 + imgH + c.L.gap : c.y1 - panelH;
  const yChip = panelY + pad;
  const yName = yChip + 68 + pgap;
  const yChips = yName + nameLines.length * hs * 1.05 + (chipRows ? pgap : 0);
  const y = yChips + (chipRows ? chipRows * 64 + (chipRows - 1) * 12 : 0);
  const glowRegion = !showImg && c.bg !== 'photo' ? panelY - c.L.gap - c.y0 : 0;
  return (
    <G>
      {showImg && imgH > 0 && d.imageUri ? <RoundImage id="ri" x={X0} y={c.y0} w={CW} h={imgH} r={48} uri={d.imageUri} /> : null}
      {glowRegion > 80 ? (
        <G>
          <Glow id="rg" cx={X0 + CW / 2} cy={c.y0 + glowRegion / 2} r={Math.min(CW * 0.43, glowRegion * 0.6)} op={t.glowOp} />
          <SvgImage
            x={X0 + CW / 2 - Math.min(P(460, 260), glowRegion) / 2}
            y={c.y0 + glowRegion / 2 - Math.min(P(460, 260), glowRegion) / 2}
            width={Math.min(P(460, 260), glowRegion)}
            height={Math.min(P(460, 260), glowRegion)}
            href={BOWL}
            preserveAspectRatio="xMidYMid meet"
          />
        </G>
      ) : null}
      <Panel c={c} y={panelY} h={panelH} />
      <Chip x={X0 + pad} y={yChip} label={s.recipe} bg={t.chip} fg={t.text} />
      <Txt x={X0 + pad} top={yName} size={hs} lh={1.05} font={FONT.b700} fill={t.text} lines={nameLines} />
      {placed.map((p) =>
        p.lime ? (
          <Chip key={p.label} x={X0 + pad + p.x} y={yChips + p.row * 76} label={p.label} bg={LIME} fg="#0A0A0A" h={64} weight={800} padL={22} padR={22} />
        ) : (
          <G key={p.label}>
            <Rect x={X0 + pad + p.x} y={yChips + p.row * 76} width={p.w} height={64} rx={32} fill={t.chip} />
            <StrokeIcon d={p.icon ?? ICON.clock} x={X0 + pad + p.x + 22} y={yChips + p.row * 76 + 16} size={32} color={t.text} sw={2} />
            <SvgText x={X0 + pad + p.x + 22 + 32 + 10} y={yChips + p.row * 76 + 32 + 28 * 0.35} fontFamily={FONT.j700} fontSize={28} fill={t.text}>
              {p.label}
            </SvgText>
          </G>
        ),
      )}
      {ings.length ? (
        <G>
          <Txt x={X0 + pad} top={y + pgap} size={26} font={FONT.j700} fill={t.sec} lines={[s.ingTitle]} />
          {ings.map((g, i) => {
            const top = y + pgap + 26 * 1.35 + 10 + i * (is * 1.35 + 10);
            return (
              <G key={g}>
                <Circle cx={X0 + pad + 8} cy={top + (is * 1.35) / 2} r={8} fill={LIME} />
                <Txt x={X0 + pad + 32} top={top} size={is} font={FONT.j600} fill={t.text} lines={[fitLine(g, is, inner - 32)]} />
              </G>
            );
          })}
        </G>
      ) : null}
    </G>
  );
}

function InviteContent({ c, d }: { c: Ctx; d: Extract<ShareCardInput, { kind: 'invite' }>['data'] }) {
  const { P, t, s } = c;
  const pad = P(44, 36), hs = P(96, 72), codeS = P(150, 112), bowl = P(460, 260), glow = P(760, 420);
  const panelH = pad * 2 + 28 * 1.35 + 12 + codeS + 12 + 28 * 1.35;
  const panelY = c.y1 - panelH;
  // Başlık: düz kısım + vurgulu kısım; satırlar birlikte kırılır, vurgulu sözcükler işaretlenir.
  const words = [...s.invH1.split(' ').map((w) => ({ w, hi: false })), ...s.invH2.split(' ').map((w) => ({ w, hi: true }))];
  const lines: { w: string; hi: boolean }[][] = [];
  let cur: { w: string; hi: boolean }[] = [];
  const lw = (ws: { w: string }[]) => textWidth(ws.map((x) => x.w).join(' '), hs, 'bricolage', 800) + 28;
  for (const wd of words) {
    if (cur.length && lw([...cur, wd]) > CW) {
      lines.push(cur);
      cur = [];
    }
    cur.push(wd);
  }
  if (cur.length) lines.push(cur);
  const h1H = lines.length * hs * 1.04;
  const h1Y = panelY - c.L.gap - h1H;
  const regionTop = c.y0;
  const regionH = h1Y - c.L.gap - regionTop;
  const bs = Math.max(0, Math.min(bowl, regionH));
  const gcx = X0 + CW / 2;
  const gcy = regionTop + regionH / 2;
  const hlPad = c.bg === 'light' ? 14 : 0;
  return (
    <G>
      {regionH > 40 ? (
        <G>
          <Glow id="ig" cx={gcx} cy={gcy} r={Math.min(glow / 2, regionH * 0.62)} op={t.glowOp} />
          <SvgImage x={gcx - bs / 2} y={gcy - bs / 2} width={bs} height={bs} href={BOWL} preserveAspectRatio="xMidYMid meet" />
        </G>
      ) : null}
      {lines.map((ln, i) => {
        const top = h1Y + i * hs * 1.04;
        const base = baselineAt(top, hs, 1.04);
        let x = X0;
        const plain = ln.filter((w) => !w.hi).map((w) => w.w).join(' ');
        const hi = ln.filter((w) => w.hi).map((w) => w.w).join(' ');
        const plainW = plain ? textWidth(`${plain} `, hs, 'bricolage', 800) : 0;
        const hiW = hi ? textWidth(hi, hs, 'bricolage', 800) : 0;
        const els: React.ReactNode[] = [];
        if (plain) {
          els.push(
            <SvgText key="p" x={x} y={base} fontFamily={FONT.b800} fontSize={hs} fill={t.text} letterSpacing={-hs * 0.03}>
              {plain}
            </SvgText>,
          );
          x += plainW;
        }
        if (hi) {
          if (t.hiBg) els.push(<Rect key="hb" x={x} y={top + hs * 0.02} width={hiW + hlPad * 2} height={hs * 1.0} rx={18} fill={t.hiBg} />);
          els.push(
            <SvgText key="h" x={x + hlPad} y={base} fontFamily={FONT.b800} fontSize={hs} fill={t.hiFg} letterSpacing={-hs * 0.03}>
              {hi}
            </SvgText>,
          );
        }
        return <G key={i}>{els}</G>;
      })}
      <Panel c={c} y={panelY} h={panelH} />
      <Txt x={X0 + pad} top={panelY + pad} size={28} font={FONT.j700} fill={t.sec} lines={[s.codeLabel]} />
      <Txt x={X0 + pad} top={panelY + pad + 28 * 1.35 + 12} size={codeS} lh={1} font={FONT.b800} fill={t.text} ls={codeS * 0.08} lines={[d.code]} />
      <Txt x={X0 + pad} top={panelY + pad + 28 * 1.35 + 12 + codeS + 12} size={28} font={FONT.j500} fill={t.sec} lines={[s.how]} />
    </G>
  );
}

function XrayContent({ c, d }: { c: Ctx; d: Extract<ShareCardInput, { kind: 'xray' }>['data'] }) {
  const { P, t, s } = c;
  const hs = P(120, 84), ms = P(46, 38);
  const mH = macroCellH(ms);
  const name = fitLine(d.name, hs, CW, 'bricolage', 800);
  const nameTop = c.y0 + 68 + c.L.gap;
  const frameTop = nameTop + hs + c.L.gap;
  const macroY = c.y1 - mH;
  const frameH = Math.max(0, macroY - c.L.gap - frameTop);
  const fx = X0;
  const fw = CW;
  const items = (d.items ?? []).slice(0, 3);
  const POS = [
    [0.08, 0.18],
    [0.3, 0.58],
    [0.1, 0.8],
  ];
  const ix = fx + 28;
  const iy = frameTop + 28;
  const iw = fw - 56;
  const ih = frameH - 56;
  const br = Math.min(iw, ih) * 0.12;
  const scanY = frameTop + frameH * 0.46;
  return (
    <G>
      <Chip x={X0} y={c.y0} label={s.xrayTag} bg={LIME} fg="#0A0A0A" weight={800} padL={20} icon={ICON.qr} />
      <SvgText x={X0 + CW} y={c.y0 + 34 + 56 * 0.35} fontFamily={FONT.b800} fontSize={56} fill={t.text} textAnchor="end">
        {`${fmtNum(d.totalKcal, c.lang)} kcal`}
      </SvgText>
      <Txt x={X0} top={nameTop} size={hs} lh={1} font={FONT.b800} fill={t.text} lines={[name]} />
      {frameH > 80 ? (
        <G>
          <Defs>
            <ClipPath id="xf">
              <Rect x={fx} y={frameTop} width={fw} height={frameH} rx={48} />
            </ClipPath>
            <LinearGradient id="xl" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={LIME} stopOpacity={0} />
              <Stop offset="1" stopColor={LIME} stopOpacity={0.26} />
            </LinearGradient>
            <LinearGradient id="xd" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0A0A0A" stopOpacity={0.1} />
              <Stop offset="1" stopColor="#0A0A0A" stopOpacity={0.35} />
            </LinearGradient>
          </Defs>
          <G clipPath="url(#xf)">
            <Rect x={fx} y={frameTop} width={fw} height={frameH} fill={t.chip} />
            {d.photoUri ? (
              <SvgImage x={fx} y={frameTop} width={fw} height={frameH} href={src(d.photoUri)} preserveAspectRatio="xMidYMid slice" />
            ) : (
              <SvgImage x={fx + fw / 2 - 180} y={frameTop + frameH / 2 - 180} width={360} height={360} href={BOWL} preserveAspectRatio="xMidYMid meet" />
            )}
            <Rect x={fx} y={frameTop} width={fw} height={frameH} fill="url(#xd)" />
            <Rect x={fx} y={frameTop} width={fw} height={frameH * 0.46} fill="url(#xl)" />
            <Rect x={fx} y={scanY - 10} width={fw} height={24} fill={LIME} opacity={0.22} />
            <Rect x={fx} y={scanY} width={fw} height={4} fill={LIME} />
          </G>
          <Rect x={fx + 1.5} y={frameTop + 1.5} width={fw - 3} height={frameH - 3} rx={47} fill="none" stroke={LIME} strokeOpacity={0.55} strokeWidth={3} />
          <G fill="none" stroke={LIME} strokeWidth={6} strokeLinecap="round">
            <Path d={`M${ix} ${iy + br}V${iy}h${br}`} />
            <Path d={`M${ix + iw - br} ${iy}h${br}v${br}`} />
            <Path d={`M${ix + iw} ${iy + ih - br}v${br}h${-br}`} />
            <Path d={`M${ix + br} ${iy + ih}H${ix}v${-br}`} />
          </G>
          {items.map((it, i) => {
            const label = it.kcal != null ? `${it.name} · ${fmtNum(it.kcal, c.lang)} kcal` : it.name;
            const txt = fitLine(label, 26, iw - 80, 'jakarta', 700);
            const w = 16 + 14 + 12 + textWidth(txt, 26, 'jakarta', 700) + 24;
            const px = Math.min(ix + iw * POS[i][0], ix + iw - w);
            const py = Math.min(iy + ih * POS[i][1], iy + ih - 64);
            return (
              <G key={`${it.name}-${i}`}>
                <Rect x={px} y={py} width={w} height={64} rx={32} fill="#0A0A0A" fillOpacity={0.72} stroke={LIME} strokeOpacity={0.6} strokeWidth={2} />
                <Circle cx={px + 16 + 7} cy={py + 32} r={7} fill={LIME} />
                <SvgText x={px + 16 + 14 + 12} y={py + 32 + 26 * 0.35} fontFamily={FONT.j700} fontSize={26} fill="#FFFFFF">
                  {txt}
                </SvgText>
              </G>
            );
          })}
        </G>
      ) : null}
      <MacroGrid c={c} x={X0} y={macroY} w={CW} valSize={ms} vals={[d.protein, d.carbs, d.fat]} />
    </G>
  );
}

function StoryContent({ c, d, link }: { c: Ctx; d: Extract<ShareCardInput, { kind: 'story' }>['data']; link: string }) {
  const { P } = c;
  const photo = c.bg === 'photo';
  const top = photo ? 0 : P(120, 96);
  const bottom = photo ? 0 : P(300, 280);
  const fx = photo ? 0 : X0;
  const fw = photo ? CARD_W : CW;
  const fy = top;
  const fh = c.H - top - bottom;
  const rad = photo ? 0 : 56;
  const txtS = P(64, 52);
  const stW = P(620, 560), stImg = P(150, 120), stName = P(40, 34), stK = P(36, 30);
  const text = d.text ? fitLine(d.text, txtS, fw - 120, 'bricolage', 700) : '';
  const textW = text ? textWidth(text, txtS, 'bricolage', 700) + 52 : 0;
  const textY = fy + fh * P(0.14, 0.12);
  const stX = fx + fw * P(0.12, 0.1);
  const stY = fy + fh * P(0.42, 0.34);
  const nameLines = d.mealName ? wrapText(d.mealName, stName, stW - 44 - stImg - 20, 2, 'jakarta', 800) : [];
  const stH = Math.max(stImg, nameLines.length * stName * 1.15 + 6 + stK * 1.35 + 8) + 44;
  const kcalTxt = d.mealKcal != null ? `${fmtNum(d.mealKcal, c.lang)} kcal` : '';
  const linkW = 22 + 38 + 14 + textWidth(link, 30, 'jakarta', 800) + 30;
  const linkY = photo ? c.H - c.L.foot - 54 - 14 - 41 - 40 - 84 : fy + fh - 40 - 84;
  return (
    <G>
      <Defs>
        <ClipPath id="sf">
          <Rect x={fx} y={fy} width={fw} height={fh} rx={rad} />
        </ClipPath>
        <LinearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0.25} />
          <Stop offset="0.3" stopColor="#000" stopOpacity={0} />
          <Stop offset="0.7" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.35} />
        </LinearGradient>
      </Defs>
      <G clipPath="url(#sf)">
        <Rect x={fx} y={fy} width={fw} height={fh} fill={c.t.chip} />
        {d.photoUri ? <SvgImage x={fx} y={fy} width={fw} height={fh} href={src(d.photoUri)} preserveAspectRatio="xMidYMid slice" /> : null}
        <Rect x={fx} y={fy} width={fw} height={fh} fill="url(#sg)" />
      </G>
      {text ? (
        <G transform={`rotate(-2 ${fx + fw / 2} ${textY + txtS * 0.6})`}>
          <Rect x={fx + fw / 2 - textW / 2} y={textY} width={textW} height={txtS * 1.2 + 20} rx={18} fill="#0A0A0A" />
          <SvgText x={fx + fw / 2} y={textY + 10 + txtS * 0.6 + txtS * 0.35} fontFamily={FONT.b700} fontSize={txtS} fill="#FFFFFF" textAnchor="middle">
            {text}
          </SvgText>
        </G>
      ) : null}
      {d.mealName ? (
        <G transform={`rotate(-4 ${stX + stW / 2} ${stY + stH / 2})`}>
          <Rect x={stX} y={stY} width={stW} height={stH} rx={32} fill="#FFFFFF" />
          {d.mealImageUri ? (
            <RoundImage id="sm" x={stX + 22} y={stY + (stH - stImg) / 2} w={stImg} h={stImg} r={24} uri={d.mealImageUri} />
          ) : (
            <SvgImage x={stX + 22} y={stY + (stH - stImg) / 2} width={stImg} height={stImg} href={BOWL} preserveAspectRatio="xMidYMid meet" />
          )}
          <Txt x={stX + 22 + stImg + 20} top={stY + 22} size={stName} lh={1.15} font={FONT.j800} fill="#0A0A0A" lines={nameLines} />
          {kcalTxt ? (
            <G>
              <Rect
                x={stX + 22 + stImg + 20}
                y={stY + 22 + nameLines.length * stName * 1.15 + 6}
                width={textWidth(kcalTxt, stK, 'bricolage', 700) + 32}
                height={stK * 1.35 + 8}
                rx={20}
                fill={LIME}
              />
              <SvgText
                x={stX + 22 + stImg + 20 + 16}
                y={stY + 22 + nameLines.length * stName * 1.15 + 6 + (stK * 1.35 + 8) / 2 + stK * 0.35}
                fontFamily={FONT.b700}
                fontSize={stK}
                fill="#0A0A0A"
              >
                {kcalTxt}
              </SvgText>
            </G>
          ) : null}
        </G>
      ) : null}
      <G>
        <Rect x={fx + 40} y={linkY} width={linkW} height={84} rx={42} fill="#FFFFFF" />
        <StrokeIcon d={ICON.link} x={fx + 40 + 22} y={linkY + 23} size={38} color="#0A0A0A" sw={2.4} />
        <SvgText x={fx + 40 + 22 + 38 + 14} y={linkY + 42 + 30 * 0.35} fontFamily={FONT.j800} fontSize={30} fill="#0A0A0A">
          {link}
        </SvgText>
      </G>
    </G>
  );
}

// ─── Kök ─────────────────────────────────────────────────────────────────────
const ShareCard = forwardRef<React.ElementRef<typeof Svg>, ShareCardProps>(function ShareCard(
  { input, bg: bgIn, size, qr, lang, link, qrValue, width = CARD_W, accessibilityLabel },
  ref,
) {
  const photoUri = cardPhoto(input);
  const bg: CardBg = bgIn === 'photo' && !photoUri ? 'dark' : bgIn;
  const post = size === 'post';
  const H = cardHeight(size);
  const L = cardLayout(size);
  const c: Ctx = {
    t: CARD_THEME[bg],
    s: CARD_TEXT[lang],
    lang,
    bg,
    post,
    H,
    L,
    y0: L.top,
    y1: H - L.bottom,
    P: (a, b) => (post ? b : a),
  };
  const showQr = qr || input.kind === 'invite';
  const dim = bg === 'photo' && (input.kind === 'profile' || input.kind === 'xray') ? 0.45 : 0;
  let content: React.ReactNode;
  switch (input.kind) {
    case 'meal': content = <MealContent c={c} d={input.data} />; break;
    case 'day': content = <DayContent c={c} d={input.data} />; break;
    case 'post': content = <PostContent c={c} d={input.data} />; break;
    case 'profile': content = <ProfileContent c={c} d={input.data} />; break;
    case 'recipe': content = <RecipeContent c={c} d={input.data} />; break;
    case 'invite': content = <InviteContent c={c} d={input.data} />; break;
    case 'xray': content = <XrayContent c={c} d={input.data} />; break;
    case 'story': content = <StoryContent c={c} d={input.data} link={link} />; break;
  }
  return (
    <Svg
      ref={ref}
      width={width}
      height={(width * H) / CARD_W}
      viewBox={`0 0 ${CARD_W} ${H}`}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    >
      <Background c={c} photo={input.kind === 'story' ? null : photoUri} extraDim={dim} />
      {content}
      <Footer c={c} link={link} qrValue={qrValue} qr={showQr} />
    </Svg>
  );
});

export default ShareCard;
