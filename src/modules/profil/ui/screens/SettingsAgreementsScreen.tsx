/**
 * G12-S4 — Sözleşmeler (Final FinPrAgreements panosu).
 *
 * İçerik `src/data/contractsData.ts`'ten (ContractsScreen ile AYNI kaynak)
 * okunur — yeni/ayrı bir sözleşme metni yazılmaz, yalnız Fin kabuğu.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { CONTRACTS } from '../../../../data/contractsData';
import { FinScreen, FinHeader, FinCard, FinChip, body, bodyBold } from '../finUi';

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
  const paragraphs = useMemo(
    () => active.content.split(/\n\n+/).map(p => p.trim()).filter(Boolean),
    [active],
  );

  return (
    <FinScreen contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.agreements_title')} onBack={onBack} />
      <ScrollView
        horizontal
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
      <View style={{ paddingHorizontal: 16 }}>
        <FinCard style={{ gap: 14 }}>
          {paragraphs.map((p, i) => (
            <Text
              key={i}
              style={{
                fontFamily: i === 0 ? bodyBold : body,
                fontSize: 14,
                lineHeight: 20,
                color: t.color.ink,
              }}
            >
              {p}
            </Text>
          ))}
        </FinCard>
      </View>
    </FinScreen>
  );
}
