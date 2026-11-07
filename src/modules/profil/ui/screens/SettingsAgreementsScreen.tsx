/**
 * G12-S4 — Sözleşmeler (Final FinPrAgreements panosu).
 *
 * İçerik `src/data/contractsData.ts`'ten (ContractsScreen ile AYNI kaynak)
 * okunur — yeni/ayrı bir sözleşme metni yazılmaz, yalnız Fin kabuğu.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { CONTRACTS } from '../../../../data/contractsData';
import { FinScreen, FinHeader, FinCard, FinChip, body, heading } from '../finUi';

export default function AgreementsScreen({
  onBack,
  initialSlug,
}: {
  onBack: () => void;
  initialSlug?: string;
}) {
  const t = useTheme();
  const { t: tr } = useT();

  const initialIndex = useMemo(() => {
    const i = CONTRACTS.findIndex(c => c.slug === initialSlug);
    return i >= 0 ? i : 0;
  }, [initialSlug]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const active = CONTRACTS[activeIndex];
  // FinPrAgreements: kart başlığı (Bricolage) + "Son güncelleme · <tarih>" + gövde.
  // Metin tek kaynaktan (contractsData); baştaki marka/büyük harf başlık ve
  // "Son Güncelleme: …" satırı başlık bloğuna taşınır, gövdeden çıkarılır.
  const { updated, paragraphs } = useMemo(() => {
    const all = active.content.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    let upd: string | null = null;
    const rest = all.filter((p, i) => {
      const m = p.match(/^Son G[üu]ncelleme:\s*(.+)$/i);
      if (m) {
        upd = m[1].trim();
        return false;
      }
      if (i === 0 && p === 'KCAL') return false;
      if (i <= 1 && p.toLocaleUpperCase('tr') === active.title.toLocaleUpperCase('tr')) return false;
      return true;
    });
    return { updated: upd as string | null, paragraphs: rest };
  }, [active]);

  return (
    <FinScreen contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.agreements_title')} onBack={onBack} />
      <ScrollView
        horizontal
        style={{ flexGrow: 0 }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {CONTRACTS.map((c, i) => (
          <FinChip
            key={c.slug}
            label={c.title}
            selected={i === activeIndex}
            onPress={() => setActiveIndex(i)}
          />
        ))}
      </ScrollView>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <FinCard style={{ gap: 12, padding: 16 }}>
          <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }}>{active.title}</Text>
          {updated ? (
            <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
              {tr('profil.agreements_updated')}: {updated}
            </Text>
          ) : null}
          {paragraphs.map((p, i) => (
            <Text
              key={i}
              style={{
                fontFamily: body,
                fontSize: 14,
                lineHeight: 20,
                color: t.color.ink,
              }}
            >
              {p}
            </Text>
          ))}
        </FinCard>
      </ScrollView>
    </FinScreen>
  );
}
