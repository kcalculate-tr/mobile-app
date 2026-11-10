// G24-S1 md.1 — FinScanAIConsent eşitleme: AI kiplerinde kıvılcım ikonu, gövde metni (kodda
// doğru olan G23 metni), "Gizlilik Politikası" bağlantısı (onPrivacy), Kabul / Vazgeç.
// md.3 — koç izni (`ai_coach`): metin TEK YERDEN (consent.sheet.ai_coach_lead), TR + EN.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// eslint-disable-next-line import/first
import { ConsentSheet } from '../ConsentSheet';
// eslint-disable-next-line import/first
import { tr, en } from '../../../../lib/consent/i18n';

test('ai_photo: metin + Gizlilik bağlantısı + Kabul / Vazgeç', () => {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  const onPrivacy = jest.fn();
  const r = render(<ConsentSheet visible mode="ai_photo" onConfirm={onConfirm} onClose={onClose} onPrivacy={onPrivacy} />);
  expect(r.getByTestId('consent-sheet-ai_photo-lead').props.children).toBe(tr.sheet.ai_photo_lead);
  fireEvent.press(r.getByTestId('consent-sheet-ai_photo-privacy'));
  expect(onPrivacy).toHaveBeenCalledTimes(1);
  fireEvent.press(r.getByTestId('consent-sheet-ai_photo-accept'));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  fireEvent.press(r.getByTestId('consent-sheet-ai_photo-cancel'));
  expect(onClose).toHaveBeenCalled();
});

test('onPrivacy verilmezse bağlantı çizilmez', () => {
  const r = render(<ConsentSheet visible mode="ai_photo" onConfirm={jest.fn()} onClose={jest.fn()} />);
  expect(r.queryByTestId('consent-sheet-ai_photo-privacy')).toBeNull();
});

test('ai_coach: İlter onayı bekleyen metin tek yerde (TR + EN)', () => {
  expect(tr.sheet.ai_coach_lead).toBe(
    'Koça yazdıkların ve günlük takip özetin, yanıt üretmek için yapay zekâ hizmet sağlayıcımıza (ABD) gönderilir.',
  );
  expect(en.sheet.ai_coach_lead).toBe(
    'What you write to the coach and a summary of your daily tracking are sent to our AI service provider (USA) to generate replies.',
  );
  const onConfirm = jest.fn();
  const r = render(<ConsentSheet visible mode="ai_coach" onConfirm={onConfirm} onClose={jest.fn()} />);
  expect(r.getByTestId('consent-sheet-ai_coach-lead').props.children).toBe(tr.sheet.ai_coach_lead);
  fireEvent.press(r.getByTestId('consent-sheet-ai_coach-accept'));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
