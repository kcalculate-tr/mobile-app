// Tabak Röntgeni — AI tarama sonucunun 1080×1920 (9:16) paylaşım kartı
// (G6-S4 md.4, tasarım: T20ShareCard/T20ShareCardGuide). G5-S4'ün MealShareCard'ı
// (1080×1350, 4:5, fotosuz) kaldırılmadı — "feed" seçeneği olarak kalıyor; bu
// YENİ, fotoğraf tabanlı bir kart. forwardRef ile <Svg> dışarı verilir, ebeveyn
// `captureSvgToPngBase64` ile PNG yakalar (bkz. src/lib/shareCard.ts).
//
// GİZLİLİK: kişisel hedef ve gün toplamı YOK. @kullaniciadi yalnız handle'ı
// olan kullanıcılarda gösterilir (G5-CONTRACT profil.handle); yoksa satır
// atlanır — uydurma kullanıcı adı yazılmaz.
//
// Bileşen etiketlerinin foto üzerindeki konumu GERÇEK bir nesne tespiti/bbox
// değil, tasarımdaki sabit yerleşimdir (computeLabelPositions) — süsleme
// amaçlı, besin verisi değil.

import React, { forwardRef } from 'react';
import Svg, {
  Rect,
  Circle,
  Text as SvgText,
  Image as SvgImage,
  Path as SvgPath,
} from 'react-native-svg';
import { CARD_W, CARD_H, PHOTO_H, computeLabelPositions } from './plateXRayLayout';

export type PlateXRayItem = {
  name: string;
  /** Bileşen başına kalori — sunucu vermezse yalnız ad gösterilir. */
  kcal?: number | null;
};

export type PlateXRayData = {
  /** AI taramasının fotoğrafı (yerel/imzalı URL). Yoksa düz zemin. */
  photoUri: string | null;
  /** Bileşen yoksa gösterilen öğün adı. */
  mealName: string;
  totalKcal: number;
  /** Bileşen etiketleri — boşsa kartta yalnız öğün adı + toplam görünür. */
  items: PlateXRayItem[];
  /** @handle — yoksa satır hiç gösterilmez. */
  handle?: string | null;
};

export { CARD_W, CARD_H };

const COLORS = {
  bg: '#F3F4F6',
  ink: '#0A0A0A',
  secondary: '#6B6B70',
  tagBg: 'rgba(255,255,255,0.9)',
  overlay: 'rgba(10,10,10,0.25)',
  lime: '#C6F04F',
};

const F = {
  bold: 'PlusJakartaSans_700Bold',
  semi: 'PlusJakartaSans_600SemiBold',
};

// "Tabak Röntgeni" ikon yolu — T20ShareCard.dc.html'den birebir (kare çerçeve ikonu).
const FRAME_ICON_PATH =
  'M224,40V80a8,8,0,0,1-16,0V48H176a8,8,0,0,1,0-16h40A8,8,0,0,1,224,40ZM80,208H48V176a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H80a8,8,0,0,0,0-16Zm136-40a8,8,0,0,0-8,8v32H176a8,8,0,0,0,0,16h40a8,8,0,0,0,8-8V176A8,8,0,0,0,216,168ZM40,88a8,8,0,0,0,8-8V48H80a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8V80A8,8,0,0,0,40,88ZM80,72h96a8,8,0,0,1,8,8v96a8,8,0,0,1-8,8H80a8,8,0,0,1-8-8V80A8,8,0,0,1,80,72Zm8,96h80V88H88Z';

function Tag({ x, y, label }: { x: number; y: number; label: string }) {
  // Metin genişliğini çalışma zamanında ölçemiyoruz (SVG, native yok); her
  // karakter için yaklaşık bir genişlik payı bırakıp güvenli tarafta kalıyoruz.
  const w = Math.max(160, label.length * 20 + 70);
  const h = 84;
  const r = h / 2;
  return (
    <>
      <Rect x={x} y={y} width={w} height={h} rx={r} fill={COLORS.tagBg} />
      <Circle cx={x + 30} cy={y + h / 2} r={9} fill={COLORS.ink} />
      <SvgText x={x + 52} y={y + h / 2 + 13} fontFamily={F.bold} fontSize={36} fill={COLORS.ink}>
        {label}
      </SvgText>
    </>
  );
}

const PlateXRayShareCard = forwardRef<React.ElementRef<typeof Svg>, { data: PlateXRayData }>(
  ({ data }, ref) => {
    const totalKcal = Math.max(0, Math.round(Number(data.totalKcal) || 0));
    const items = data.items ?? [];
    const positions = computeLabelPositions(items.length);
    const handle = (data.handle ?? '').trim();

    return (
      <Svg ref={ref} width={CARD_W} height={CARD_H} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
        {/* Zemin */}
        <Rect x={0} y={0} width={CARD_W} height={CARD_H} fill={COLORS.bg} />

        {/* Foto (yoksa düz zemin) */}
        {data.photoUri ? (
          <SvgImage
            x={0}
            y={0}
            width={CARD_W}
            height={PHOTO_H}
            href={data.photoUri}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : null}
        <Rect x={0} y={0} width={CARD_W} height={PHOTO_H} fill={COLORS.overlay} />

        {/* "Tabak Röntgeni" marka etiketi */}
        <SvgPathIcon x={60} y={252} />
        <SvgText x={114} y={297} fontFamily={F.bold} fontSize={39} fill="#FFFFFF">
          Tabak Röntgeni
        </SvgText>

        {/* Bileşen etiketleri (varsa) */}
        {items.map((item, i) => {
          const pos = positions[i];
          if (!pos) return null;
          const label = item.kcal != null ? `${item.name} (${Math.round(item.kcal)} kcal)` : item.name;
          return <Tag key={`${item.name}-${i}`} x={pos.x} y={pos.y} label={label} />;
        })}

        {/* Alt blok */}
        <Rect x={0} y={PHOTO_H} width={CARD_W} height={CARD_H - PHOTO_H} fill={COLORS.bg} />

        {/* Bileşen yoksa yalnız öğün adı + toplam (kişisel hedef/gün toplamı YOK). */}
        {items.length === 0 ? (
          <SvgText x={60} y={1340} fontFamily={F.bold} fontSize={44} fill={COLORS.ink}>
            {data.mealName}
          </SvgText>
        ) : null}

        <SvgText x={60} y={1308} fontFamily={F.semi} fontSize={39} fill={COLORS.secondary}>
          Toplam
        </SvgText>
        <SvgText x={60} y={1362} fontFamily={F.bold} fontSize={120} fill={COLORS.ink}>
          {totalKcal.toLocaleString('tr-TR')}
          <SvgText fontFamily={F.semi} fontSize={54}> kcal</SvgText>
        </SvgText>

        {handle ? (
          <SvgText x={60} y={1512} fontFamily={F.semi} fontSize={42} fill={COLORS.ink}>
            @{handle}
          </SvgText>
        ) : null}

        {/* l.eatkcal.com + kcal kelime markası (metin tabanlı, raster logo yok) */}
        <SvgText x={CARD_W - 60} y={1500} fontFamily={F.semi} fontSize={36} fill={COLORS.secondary} textAnchor="end">
          l.eatkcal.com
        </SvgText>
        <SvgText x={CARD_W - 60 - 150} y={1500} fontFamily={F.bold} fontSize={48} fill={COLORS.ink}>
          kcal
        </SvgText>
        <Rect x={CARD_W - 60 - 42} y={1480} width={15} height={15} rx={9} fill={COLORS.lime} stroke={COLORS.ink} />
      </Svg>
    );
  },
);

PlateXRayShareCard.displayName = 'PlateXRayShareCard';

function SvgPathIcon({ x, y }: { x: number; y: number }) {
  return (
    <SvgPath
      d={FRAME_ICON_PATH}
      fill="#FFFFFF"
      transform={`translate(${x} ${y}) scale(0.2)`}
    />
  );
}

export default PlateXRayShareCard;
