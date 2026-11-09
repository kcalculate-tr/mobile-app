// G21-S1 md.8 — akış denetiminde devredilen bağlantı hataları (#D1–#D5).
import fs from 'fs';
import path from 'path';

const mockReset = jest.fn();
jest.mock('../navigationRef', () => ({
  navigationRef: { isReady: () => true, reset: (...a: unknown[]) => mockReset(...a) },
}));

import { resetToSignedOut, signedOutRoute } from '../signOutReset';

const SRC = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('G21-S1 md.8 devredilenler', () => {
  test('#D4 çıkış/silme: yığın oturumsuz soğuk açılış ekranına sıfırlanır', () => {
    expect(signedOutRoute(true)).toBe('Onboarding');
    expect(signedOutRoute(false)).toBe('WelcomeGate');
    resetToSignedOut(true);
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Onboarding' }] });
    expect(read('modules/profil/ui/screens/FinPrProfileScreen.tsx')).toMatch(/resetToSignedOut\(yeniOnboardingFlag\)/);
    expect(read('modules/profil/ui/screens/SettingsSecurityScreen.tsx')).toMatch(/resetToSignedOut\(yeniOnboardingFlag\)/);
  });

  test('#D1 Keşfet akışında avatar/ad → açık profil', () => {
    expect(read('modules/kesfet/ui/KesfetScreen.tsx')).toMatch(
      /onOpenAuthor=\{\s*item\.author\.handle\s*\?\s*\(\) => navigation\.navigate\('PublicProfile'/,
    );
  });

  test('#D2 Tara "Elle gir" yeni kabukta Ana sayfa elle giriş sheet’ini açar', () => {
    const s = read('modules/ai/scan/screens/ScanScreen.tsx');
    expect(s).toMatch(/navigate\('Tabs', \{\s*screen: 'Tracker',\s*params: \{ finOpenManual: true \},?\s*\}\)/);
  });

  test('#D3 Takibe "Atla": Hedefim düzenlemesinde geri, yeni kullanıcıda Ana sayfa', () => {
    const s = read('modules/onboarding/takibe/TakibeNavigator.tsx');
    expect(s).not.toMatch(/onSkip=\{\(\) => root\?\.navigate\('Tabs', \{ screen: 'Tracker' \}\)\}/);
    expect((s.match(/onSkip=\{\(\) => tbSkipOut\(root\)\}/g) ?? []).length).toBe(5);
    // saf karar
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tbSkipTarget } = require('../../modules/onboarding/takibe/TakibeNavigator') as {
      tbSkipTarget: (e: boolean, b: boolean) => 'back' | 'home';
    };
    expect(tbSkipTarget(true, true)).toBe('back');
    expect(tbSkipTarget(true, false)).toBe('home');
    expect(tbSkipTarget(false, true)).toBe('home');
  });

  test('#D5 paylaşılan gönderi/profil zemini yeni kabukta temadan', () => {
    const s = read('navigation/AppNavigator.tsx');
    expect((s.match(/contentStyle: \{ backgroundColor: yeniKabukRoutes \? stackBg : '#0A0A0A' \}/g) ?? []).length).toBe(2);
  });
});
