// G28-S1 md.7 — yasal web sayfasını uygulama içi tarayıcıda açar (iOS SFSafariViewController /
// Android Custom Tabs; expo-web-browser zaten derlemede — yeni paket yok). Açılamazsa sistem
// tarayıcısı, o da olmazsa `fallback` (uygulama içi belge metni) çağrılır.
import { Linking } from 'react-native';
import { legalWebUrl, type LegalWebDoc } from './urls';

export async function openLegalWeb(doc: LegalWebDoc, lang: string | null | undefined, fallback?: () => void): Promise<boolean> {
  const url = legalWebUrl(doc, lang);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
    await WebBrowser.openBrowserAsync(url);
    return true;
  } catch {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      fallback?.();
      return false;
    }
  }
}
