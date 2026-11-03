import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ThemeProvider } from '../core/design';
import { I18nProvider } from '../core/i18n';
import {
  mockGunClient,
  setGunClient,
  resetGunClient,
  setTodayConsumptionsProvider,
  resetTodayConsumptionsProvider,
  type DayRing,
} from '../modules/gun';
import { GunRingStrip, GunViewer, GunEmpty } from '../modules/gun/ui';
import { setProfilClient, resetProfilClient, createMockProfilClient } from '../modules/profil';
import { PrivacySheet } from '../modules/profil/ui';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * G6-S3 Gün halkası / profil UI vitrini — YALNIZ __DEV__. Mock veri
 * katmanını kurar (gun + profil) ve bu oturumda yazılan bileşenleri gerçek
 * render ile gösterir. Hiçbir üretim ekranına bağlı değil.
 */
export default function GunProfilUiLabScreen() {
  const navigation = useNavigation<Nav>();
  const [rings, setRings] = useState<DayRing[]>([]);
  const [viewerUser, setViewerUser] = useState<string | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    setGunClient(mockGunClient);
    setProfilClient(createMockProfilClient({ privateUsers: ['user-gizli'] }));
    setTodayConsumptionsProvider(async () => [
      { id: 'c1', name: 'Yulaf ezmesi', meal_type: 'breakfast', kcal: 320, consumed_at: new Date().toISOString() },
      { id: 'c2', name: 'Mercimek çorbası', meal_type: 'lunch', kcal: 210, consumed_at: new Date().toISOString() },
    ]);
    mockGunClient.getDayRings().then(setRings);
    return () => {
      resetGunClient();
      resetProfilClient();
      resetTodayConsumptionsProvider();
    };
  }, []);

  const openViewer = useCallback((userId: string) => setViewerUser(userId), []);

  return (
    <ThemeProvider>
      <I18nProvider>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.h1}>Gün halkası / profil (UI)</Text>

          <Section title="GunRingStrip">
            <GunRingStrip rings={rings} onOpen={openViewer} />
          </Section>

          <Section title="GunEmpty">
            <Btn label={showEmpty ? 'Gizle' : 'Göster'} onPress={() => setShowEmpty((v) => !v)} />
            {showEmpty ? (
              <View style={{ height: 480 }}>
                <GunEmpty onLogMeal={() => {}} onShared={() => setShowEmpty(false)} />
              </View>
            ) : null}
          </Section>

          <Section title="PrivacySheet">
            <Btn label="Aç" onPress={() => setShowPrivacy(true)} />
          </Section>

          <Section title="PublicProfileScreen">
            <Btn label="@kcalculate aç (mock)" onPress={() => navigation.navigate('PublicProfile', { handle: 'kcalculate' })} />
            <Btn label="@dyt.elif aç (mock, gizli değil)" onPress={() => navigation.navigate('PublicProfile', { handle: 'dyt.elif' })} />
          </Section>

          <Section title="Kcal AI kaydı (useFeature('kesfet') arkasında)">
            <Btn label="Kaydı aç" onPress={() => navigation.navigate('KcalAiSignUp')} />
          </Section>
        </ScrollView>

        <GunViewer
          visible={viewerUser !== null}
          rings={rings}
          startUserId={viewerUser ?? 'me'}
          onClose={() => setViewerUser(null)}
        />
        <PrivacySheet
          visible={showPrivacy}
          isPrivate={isPrivate}
          onClose={() => setShowPrivacy(false)}
          onChanged={setIsPrivate}
        />
      </I18nProvider>
    </ThemeProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.btn} accessibilityRole="button">
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 48, gap: 16 },
  h1: { fontSize: 22, fontWeight: '700', color: '#111' },
  section: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd', borderRadius: 12, padding: 12, gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#444', textTransform: 'uppercase' },
  btn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f0f0f0', alignSelf: 'flex-start' },
  btnText: { fontSize: 13, color: '#111' },
});
