// G18-S4 md.3 — YALNIZ __DEV__ vitrini: FinPush 4 şablonu (dar + genişletilmiş +
// gizli önizleme). Metinler ÜRETİMDEKİ `renderFinPush` + i18n aksiyon etiketleri;
// kart çizimi yalnız karşılaştırma içindir (gerçek bildirimi OS çizer).
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../core/design';
import { useT } from '../core/i18n';
import { FIN_PUSH_ACTIONS, charCount, renderFinPush, type FinPushInput } from '../core/push/finPush';
import { SCROLL_KEYBOARD } from '../core/design/keyboard';

// Örnek değerler en uzun yer tutucu boyunda (pano "Sayım kuralı"); kişi uydurulmaz.
const SAMPLES: { head: string; input: FinPushInput }[] = [
  { head: '1', input: { kind: 'order_status', orderNo: 'KCAL-XXXX', etaMin: 999 } },
  { head: '2', input: { kind: 'streak', days: 999 } },
  { head: '3', input: { kind: 'social', name: '[Ad]', excerpt: '[Yorum özeti]', postId: 'p' } },
  { head: '4', input: { kind: 'reminder', meal: 'lunch' } },
];

export function PushPreviewScene() {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const insets = useSafeAreaInsets();
  const card = { backgroundColor: t.color.surface, borderColor: t.color.line };
  return (
    <ScrollView {...SCROLL_KEYBOARD} style={{ flex: 1, backgroundColor: t.color.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, padding: 16, gap: 18 }}>
      {SAMPLES.map(({ head, input }) => {
        const m = renderFinPush(input, lang === 'en' ? 'en' : 'tr');
        const actions = FIN_PUSH_ACTIONS[input.kind];
        return (
          <View key={head} style={{ gap: 8 }} testID={`fin-push-${input.kind}`}>
            <Text style={[styles.head, { color: t.color.ink }]}>{`${head}. ${input.kind}`}</Text>
            <View style={[styles.card, card]}>
              <Text style={[styles.title, { color: t.color.ink }]} numberOfLines={1}>{m.title}</Text>
              <Text style={[styles.body, { color: t.color.ink }]} numberOfLines={2}>{m.body}</Text>
            </View>
            <View style={[styles.card, card]}>
              <Text style={[styles.title, { color: t.color.ink }]}>{m.title}</Text>
              <Text style={[styles.body, { color: t.color.ink }]}>{m.body}</Text>
            </View>
            {actions.map((a) => (
              <View key={a.id} style={[styles.action, card]}>
                <Text style={[styles.body, { color: t.color.ink }]}>{tr(a.labelKey)}</Text>
              </View>
            ))}
            <View style={[styles.card, card]}>
              <Text style={[styles.title, { color: t.color.ink }]}>kcal.</Text>
              <Text style={[styles.body, { color: t.color.secondary }]}>{tr('push.fin.hidden_preview')}</Text>
            </View>
            <Text style={[styles.meta, { color: t.color.secondary }]}>
              {`${charCount(m.title)}/35 · ${charCount(m.body)}/90 · ${actions.length}/2`}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { fontSize: 17, fontWeight: '700' },
  card: { borderRadius: 18, padding: 12, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  action: { borderRadius: 14, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 15 },
  meta: { fontSize: 13 },
});
