// 18 Kas (İlter): seri / ilk öğün kutlaması paylaşım görseli (9:16, Instagram hikâyesine uygun).
// Ekranda görünmez çizilir, react-native-svg toDataURL ile PNG'ye çevrilir. Kişisel hedef/kilo YOK.
import React, { forwardRef } from 'react';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

const LIME = '#B9EF14';

export const CelebrateShareCard = forwardRef<Svg, { title1: string; mark: string; sub: string; date: string; brand: string; link: string }>(
  function CelebrateShareCard({ title1, mark, sub, date, brand, link }, ref) {
    return (
      <Svg ref={ref} width={360} height={640} viewBox="0 0 1080 1920">
        <Defs>
          <RadialGradient id="g1" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={LIME} stopOpacity="0.45" />
            <Stop offset="1" stopColor={LIME} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="1080" height="1920" fill="#0A0A0A" />
        <Circle cx="260" cy="420" r="560" fill="url(#g1)" />
        <Circle cx="900" cy="1500" r="520" fill="url(#g1)" />
        <Rect x="88" y="140" width={Math.max(220, date.length * 26 + 80)} height="76" rx="38" fill="#2C2C2E" />
        <SvgText x="128" y="191" fill="#F5F5F5" fontSize="34" fontWeight="700">{date}</SvgText>
        <SvgText x="88" y="860" fill="#FFFFFF" fontSize="150" fontWeight="800">{title1}</SvgText>
        <SvgText x="88" y="1030" fill={LIME} fontSize="190" fontWeight="800">{mark}</SvgText>
        <SvgText x="92" y="1130" fill="#A1A1A6" fontSize="48" fontWeight="600">{sub}</SvgText>
        <SvgText x="88" y="1740" fill="#FFFFFF" fontSize="72" fontWeight="800">{brand}</SvgText>
        <SvgText x="90" y="1812" fill="#A1A1A6" fontSize="36" fontWeight="600">{link}</SvgText>
      </Svg>
    );
  },
);
