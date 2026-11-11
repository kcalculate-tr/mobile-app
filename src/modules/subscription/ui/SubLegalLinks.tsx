// G25-S1 md.2 (A2, 3.1.2) — Paywall ve Profil › Abonelik altındaki hukuk bağlantıları:
// "Kullanım Koşulları (EULA)" (iOS → Apple standart EULA, Android → uygulama içi Koşullar) ve
// yanında "Gizlilik Politikası". Her bağlantı ≥ 44 pt, rol "link", büyük metinde alt satıra sarar.
import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { LEGAL_SLUG } from '../../../lib/legal/slugs';
import { openLegalWeb } from '../../../lib/legal/openLegal';
import { eulaTarget } from '../../../lib/subscription/storeLinks';

type Nav = { navigate: (n: string, p?: object) => void };

export default function SubLegalLinks({ navigation }: { navigation: unknown }) {
  const { t: tr, lang } = useT();
  const nav = navigation as Nav;
  const inAppTerms = () => nav.navigate('ProfileContracts', { slug: LEGAL_SLUG.terms });
  // G28-S1 md.7: iOS → Apple standart EULA (G25 kararı); Android → legal.eatkcal.com Koşullar.
  // Açılamazsa uygulama içi metin.
  const openEula = () => {
    const target = eulaTarget(Platform.OS);
    if (target.kind === 'url') void Linking.openURL(target.url).catch(inAppTerms);
    else void openLegalWeb('terms', lang, inAppTerms);
  };
  return (
    <View style={styles.row} testID="sub-legal-links">
      <Pressable onPress={openEula} accessibilityRole="link" accessibilityLabel={tr('sub.paywall.eula')} style={styles.link} testID="sub-eula">
        <AppText tone="secondary" style={styles.text}>
          {tr('sub.paywall.eula')}
        </AppText>
      </Pressable>
      <Pressable
        onPress={() => void openLegalWeb('privacy', lang, () => nav.navigate('ProfileContracts', { slug: LEGAL_SLUG.privacy }))}
        accessibilityRole="link"
        accessibilityLabel={tr('sub.paywall.privacy')}
        style={styles.link}
        testID="sub-privacy"
      >
        <AppText tone="secondary" style={styles.text}>
          {tr('sub.paywall.privacy')}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 24 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  text: { fontSize: 13, textDecorationLine: 'underline', textAlign: 'center' },
});
