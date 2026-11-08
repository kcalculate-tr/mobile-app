import React from 'react';
import { View } from 'react-native';
import { AppText } from '../../../core/design/components/AppText';
import { useT } from '../../../core/i18n';
import { OnbScaffold } from './OnbScaffold';
import { OnbButton, OnbLead, OnbTitle } from './pieces';
import { useOnb } from './onbTheme';

/**
 * 18 yaş engeli (FinOnbUnderage): geri oku, nötr zemin, kart içinde başlık +
 * açıklama + kalın "Hiçbir bilgin kaydedilmedi." satırı; birincil düğme tema
 * mürekkebi (Light siyah / Dark beyaz), ikincil çip. Hem Onboarding hem Takibe
 * başla yaş adımı bunu kullanır.
 */
export function UnderageView({ onFix, onOk }: { onFix: () => void; onOk: () => void }) {
  const i18n = useT();
  const P = useOnb();
  return (
    <OnbScaffold
      glow={false}
      cardTop={340}
      onBack={onFix}
      footer={
        <View style={{ gap: 8 }}>
          <OnbButton label={i18n.t('onboarding.underage.fix')} onPress={onFix} />
          <OnbButton label={i18n.t('onboarding.underage.ok')} kind="chip" onPress={onOk} />
        </View>
      }
    >
      <OnbTitle style={{ fontSize: 28, lineHeight: 30 }}>{i18n.t('onboarding.underage.title')}</OnbTitle>
      <OnbLead>{i18n.t('onboarding.underage.body')}</OnbLead>
      <AppText
        textRole="bodySm"
        style={{ color: P.ink, fontFamily: 'PlusJakartaSans_700Bold', marginTop: 14 }}
      >
        {i18n.t('onboarding.underage.sub')}
      </AppText>
    </OnbScaffold>
  );
}
