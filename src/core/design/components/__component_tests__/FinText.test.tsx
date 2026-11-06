// G16-S2 — Final yazı tipi çözücüsü: sistem fontuna düşme yok, fontWeight →
// aynı ailenin ağırlık dosyası, iç içe metin ebeveyn ailesini korur, Android'de
// includeFontPadding:false (iOS'ta dokunulmaz).
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { FinText, resolveFinTextStyle, AppText } from '../../index';

describe('resolveFinTextStyle', () => {
  it('fontFamily yoksa Plus Jakarta Regular (sistem fontu yok)', () => {
    expect(resolveFinTextStyle({ fontSize: 13 }, null, 'ios').fontFamily).toBe('PlusJakartaSans_400Regular');
  });

  it('fontWeight → aynı ailenin ağırlık dosyası, fontWeight düşer', () => {
    const s = resolveFinTextStyle({ fontSize: 15, fontWeight: '700' }, null, 'ios');
    expect(s.fontFamily).toBe('PlusJakartaSans_700Bold');
    expect(s.fontWeight).toBeUndefined();
    const b = resolveFinTextStyle({ fontFamily: 'BricolageGrotesque_400Regular', fontWeight: '600' }, null, 'ios');
    expect(b.fontFamily).toBe('BricolageGrotesque_600SemiBold');
  });

  it('iç içe: ebeveynin ailesinden ağırlık seçilir', () => {
    expect(resolveFinTextStyle({ fontWeight: '700' }, 'BricolageGrotesque_600SemiBold', 'ios').fontFamily).toBe(
      'BricolageGrotesque_700Bold',
    );
  });

  it('Android: includeFontPadding false; iOS: dokunulmaz; açık değer korunur', () => {
    expect(resolveFinTextStyle({ fontSize: 13 }, null, 'android').includeFontPadding).toBe(false);
    expect(resolveFinTextStyle({ fontSize: 13 }, null, 'ios').includeFontPadding).toBeUndefined();
    expect(resolveFinTextStyle({ includeFontPadding: true }, null, 'android').includeFontPadding).toBe(true);
  });
});

describe('FinText', () => {
  it('kalın iç parça AppText başlığının ailesinde kalır', () => {
    const r = render(
      <AppText variant="heading">
        Başlık <FinText testID="kalin" style={{ fontWeight: '700' }}>kalın</FinText>
      </AppText>,
    );
    const node = r.getByTestId('kalin');
    const flat = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
    expect(flat.fontFamily).toBe('BricolageGrotesque_700Bold');
  });

  it('RN Text ile aynı içerik/props', () => {
    const r = render(<FinText accessibilityRole="header">Merhaba</FinText>);
    expect(r.getByText('Merhaba')).toBeTruthy();
    expect(RNText).toBeDefined();
  });
});
