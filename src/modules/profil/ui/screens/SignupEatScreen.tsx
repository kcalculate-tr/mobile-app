/**
 * G12-S4 — FinSignupEat, panel 1: şehir kapısı ("Şehrini seç", madde 7).
 *
 * Gerçek ilk-sipariş şehir kapısı mantığı `useEatkcalRegistration()`'dan
 * (`src/modules/profil/useRegistration.ts`) — `checkDeliveryCity` RPC'sini
 * çağırır, yeni mantık YAZILMAZ. Panel 2 (teslimat adresi) ve panel 3
 * (telefon) mevcut adres/telefon akışının kendisidir (S4 dışında, KİMSE
 * sahipliği) — bu ekran yalnız şehir onaylanınca `onAllowed()` çağırır,
 * o akışa dokunmaz. Mount noktası: EatHomeScreen (S5 sahipliği) — ENTEGRASYONA.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useEatkcalRegistration } from '../../useRegistration';
import { Check, CaretRight } from '../../../../components/icons';
import {
  FinScreen,
  FinHeader,
  FinSectionLabel,
  FinRowGroup,
  FinChip,
  FinPrimaryButton,
  body,
  bodyMedium,
  bodySemibold,
} from '../finUi';

const CITIES: { name: string; allowed: boolean }[] = [
  { name: 'İzmir', allowed: true },
  { name: 'İstanbul', allowed: false },
  { name: 'Ankara', allowed: false },
  { name: 'Antalya', allowed: false },
];

export default function SignupEatScreen({
  onBack,
  onAllowed,
}: {
  onBack: () => void;
  onAllowed: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const reg = useEatkcalRegistration();
  const [selected, setSelected] = useState<string | null>(null);
  const [notified, setNotified] = useState<Record<string, boolean>>({});

  const handleSelect = async (city: { name: string; allowed: boolean }) => {
    setSelected(city.name);
    if (!city.allowed) return;
    reg.setCity(city.name);
  };

  const handleContinue = async () => {
    // reg.city, handleSelect'te zaten ayarlandı (ayrı bir dokunuş — re-render
    // arada gerçekleşti); burada tekrar setCity çağırıp eski closure'ı
    // checkCity'den önce tetiklemeye çalışmak state güncellemesinin henüz
    // işlenmemiş olmasına yol açabilir.
    if (!selected) return;
    const ok = await reg.checkCity();
    if (ok) onAllowed();
  };

  return (
    <FinScreen scroll contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('eatkcal.city_gate.title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary }}>
          {tr('eatkcal.city_gate.subtitle')}
        </Text>

        <FinRowGroup>
          {CITIES.map((city, i) => (
            <Pressable
              key={city.name}
              onPress={() => handleSelect(city)}
              accessibilityRole="button"
              style={{
                minHeight: 60,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.color.line,
                opacity: city.allowed ? 1 : 0.6,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}>
                  {city.name}
                </Text>
                {city.allowed ? (
                  <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.accentLine }}>
                    {tr('eatkcal.city_gate.active_note')}
                  </Text>
                ) : (
                  <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.secondary }}>
                    {tr('eatkcal.city_gate.soon')}
                  </Text>
                )}
              </View>
              {city.allowed ? (
                selected === city.name ? (
                  <Check size={18} color={t.color.accentLine} weight="bold" />
                ) : (
                  <CaretRight size={16} color={t.color.secondary} />
                )
              ) : (
                <FinChip
                  label={notified[city.name] ? tr('eatkcal.city_gate.notified') : tr('eatkcal.city_gate.notify')}
                  selected={notified[city.name]}
                  onPress={() => setNotified((prev) => ({ ...prev, [city.name]: true }))}
                />
              )}
            </Pressable>
          ))}
        </FinRowGroup>

        {reg.messageKey ? (
          <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.danger, textAlign: 'center' }}>
            {tr(reg.messageKey)}
          </Text>
        ) : reg.status === 'error' ? (
          <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.danger, textAlign: 'center' }}>
            {tr('eatkcal.city_gate.error')}
          </Text>
        ) : null}

        <FinPrimaryButton
          label={tr('eatkcal.city_gate.continue')}
          onPress={handleContinue}
          disabled={!selected || selected !== 'İzmir' || reg.status === 'checking'}
          icon={reg.status === 'checking' ? <ActivityIndicator color={t.color.bg} /> : undefined}
        />
      </View>
    </FinScreen>
  );
}
