// Mevcut müşteriye tanıtım (G12-S1 · FinIntro / FinIntroOrder). Yeni kabuk
// (yeni_kabuk) ilk açılışında, OTURUMLU kullanıcıya bir kez gösterilen alt
// sayfa. Sipariş geçmişi olan kullanıcıda birincil "Siparişe devam" → eatkcal
// (AI sorusu YOK); yoksa "Göz at". "bir kez" AsyncStorage ile (storage.ts).
//
// Sipariş geçmişi sinyali MEVCUT servisten (`lib/reorder.fetchPastOrders`) —
// yeni sorgu YAZILMAZ (G12-CONTRACT "Bağlar").

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../core/design/components/AppText';
import { Button } from '../../../core/design/components/Button';
import { Sheet } from '../../../core/design/components/Sheet';
import { useTheme } from '../../../core/design/ThemeProvider';
import { Compass, Scan, CircleDashed } from '../../../components/icons';

// Keşfet · Gün halkası · Tara (FEATURES sırası).
const FEATURE_ICONS = [Compass, CircleDashed, Scan];
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { fetchPastOrders } from '../../../lib/reorder';
import { navigationRef } from '../../../navigation/navigationRef';
import { readIntroSeen, writeIntroSeen } from './storage';

type IntroState = 'checking' | 'hidden' | 'plain' | 'order';

export function IntroOverlay() {
  const t = useTheme();
  const i18n = useT();
  const { session, user } = useAuth();
  const [state, setState] = useState<IntroState>('checking');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!session || !user) {
        setState('hidden');
        return;
      }
      if (await readIntroSeen()) {
        setState('hidden');
        return;
      }
      let hasOrders = false;
      try {
        const orders = await fetchPastOrders(user.id, 1);
        hasOrders = orders.length > 0;
      } catch {
        // Sorgu başarısızsa düz tanıtım göster (sipariş CTA'sını zorlama).
      }
      if (!alive) return;
      setState(hasOrders ? 'order' : 'plain');
    })();
    return () => {
      alive = false;
    };
  }, [session, user]);

  const close = (goHome: boolean) => {
    writeIntroSeen();
    setState('hidden');
    if (goHome && navigationRef.isReady()) {
      navigationRef.navigate('Tabs', { screen: 'Home' });
    }
  };

  const visible = state === 'plain' || state === 'order';

  const FEATURES: { title: string; desc: string }[] = [
    { title: i18n.t('intro.kesfet'), desc: i18n.t('intro.kesfet_desc') },
    { title: i18n.t('intro.gun'), desc: i18n.t('intro.gun_desc') },
    { title: i18n.t('intro.tara'), desc: i18n.t('intro.tara_desc') },
  ];

  return (
    <Sheet visible={visible} onClose={() => close(false)} title={i18n.t('intro.title')}>
      <View style={styles.list}>
        {FEATURES.map((f, i) => {
          const Icon = FEATURE_ICONS[i] ?? Compass;
          return (
          <View key={f.title} style={styles.row}>
            {/* G14-S1 — FinIntro: lime nokta yerine özellik ikonu (gri daire). */}
            <View style={[styles.iconWrap, { backgroundColor: t.color.line }]}>
              <Icon size={20} color={t.color.ink} />
            </View>
            <View style={styles.rowText}>
              <AppText textRole="body" style={{ color: t.color.ink, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                {f.title}
              </AppText>
              <AppText textRole="bodySm" style={{ color: t.color.secondary, marginTop: 2 }}>
                {f.desc}
              </AppText>
            </View>
          </View>
          );
        })}
        <AppText textRole="body" style={{ color: t.color.ink, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 4 }}>
          {i18n.t('intro.order')}
        </AppText>
      </View>

      <View style={styles.actions}>
        {state === 'order' ? (
          <>
            <Button tone="ink" label={i18n.t('intro.continueOrder')} onPress={() => close(true)} />
            <Button variant="secondary" label={i18n.t('intro.browseNew')} onPress={() => close(false)} />
          </>
        ) : (
          <>
            <Button tone="ink" label={i18n.t('intro.browse')} onPress={() => close(false)} />
            <Button variant="secondary" label={i18n.t('intro.later')} onPress={() => close(false)} />
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  actions: { marginTop: 20, gap: 6, paddingBottom: 4 },
});
