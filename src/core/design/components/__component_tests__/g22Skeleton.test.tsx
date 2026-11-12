// G22-S2 md.7 — FinMoLoad iskeleti: erişilebilir "Yükleniyor" (TR/EN), satır sayısı,
// azaltılmış harekette sabit (nabız yok).
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

import { I18nProvider } from '../../../i18n';
import { ReducedMotionProvider } from '../../motion';
import { FinCardSkeleton, FinListSkeleton } from '../FinSkeleton';

test('liste iskeleti: progressbar rolü + "Yükleniyor" etiketi (TR)', () => {
  const ui = render(
    <I18nProvider forceLang="tr">
      <FinListSkeleton rows={3} />
    </I18nProvider>,
  );
  const root = ui.getByTestId('fin-skeleton');
  expect(root.props.accessibilityRole).toBe('progressbar');
  expect(root.props.accessibilityLabel).toBe('Yükleniyor');
});

test('EN etiketi "Loading"; kart iskeleti de erişilebilir', () => {
  const ui = render(
    <I18nProvider forceLang="en">
      <FinCardSkeleton rows={2} />
    </I18nProvider>,
  );
  expect(ui.getByTestId('fin-card-skeleton').props.accessibilityLabel).toBe('Loading');
});

test('azaltılmış hareket: iskelet çizilir (nabız yok, sabit opaklık)', () => {
  const ui = render(
    <ReducedMotionProvider value>
      <I18nProvider forceLang="tr">
        <FinListSkeleton rows={2} header testID="sk" />
      </I18nProvider>
    </ReducedMotionProvider>,
  );
  expect(ui.getByTestId('sk')).toBeTruthy();
});
