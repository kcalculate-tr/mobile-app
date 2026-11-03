import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { I18nProvider, useT, type Lang } from '../core/i18n';
import {
  useKesfetStore,
  setKesfetClient,
  resetKesfetClient,
  mockKesfetClient,
  type MealType,
} from '../modules/kesfet';
import {
  getGunClient,
  setGunClient,
  resetGunClient,
  mockGunClient,
  type DayRing,
} from '../modules/gun';
import {
  useHandleClaim,
  getProfilClient,
  setProfilClient,
  resetProfilClient,
  createMockProfilClient,
  type FollowState,
} from '../modules/profil';
import {
  runAiScan,
  getAiScanClient,
  setAiScanClient,
  resetAiScanClient,
  mockAiScanClient,
  type AiScanOutcome,
} from '../modules/ai';

/**
 * Keşfet ve profil (veri) — YALNIZ __DEV__ deneme ekranı.
 *
 * G5-S3'te kurulan veri katmanını (Keşfet akışı, profil/handle, Gün halkası, AI
 * tarama kotası + i18n) sunucu olmadan denemek için. "Mock" modunda bellek içi
 * sağlayıcılar, "Gerçek RPC" modunda canlı Supabase çağrılır. Hiçbir üretim
 * ekranına bağlı değil; AppNavigator'da kaydı __DEV__ ile koşullu.
 */
export default function FeedDataLabScreen() {
  const [mode, setMode] = useState<'mock' | 'real'>('mock');
  const [lang, setLang] = useState<Lang>('tr');

  // Mod değişince tüm modül istemcilerini ayarla (DEV-only global yan etki).
  useEffect(() => {
    if (mode === 'mock') {
      setKesfetClient(mockKesfetClient);
      setGunClient(mockGunClient);
      setProfilClient(createMockProfilClient({ privateUsers: ['user-gizli'] }));
      setAiScanClient(mockAiScanClient);
    } else {
      resetKesfetClient();
      resetGunClient();
      resetProfilClient();
      resetAiScanClient();
    }
  }, [mode]);

  return (
    <I18nProvider forceLang={lang}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Keşfet ve profil (veri)</Text>
        <Text style={styles.sub}>Yalnız geliştirme · veri katmanı denemesi</Text>

        <Section title="Mod">
          <Row>
            <Toggle label="Mock" active={mode === 'mock'} onPress={() => setMode('mock')} />
            <Toggle label="Gerçek RPC" active={mode === 'real'} onPress={() => setMode('real')} />
          </Row>
          <Row>
            <Toggle label="TR" active={lang === 'tr'} onPress={() => setLang('tr')} />
            <Toggle label="EN" active={lang === 'en'} onPress={() => setLang('en')} />
          </Row>
        </Section>

        <I18nDemo />
        <KesfetDemo />
        <ProfilDemo />
        <GunDemo />
        <AiScanDemo />
        <View style={{ height: 40 }} />
      </ScrollView>
    </I18nProvider>
  );
}

// ── i18n ──────────────────────────────────────────────────────────────────────
function I18nDemo() {
  const { t, fmt, lang } = useT();
  return (
    <Section title={`i18n (${lang})`}>
      <Text style={styles.line}>{t('kesfet.title')}</Text>
      <Text style={styles.line}>{t('kesfet.stats.likes', { count: 3 })}</Text>
      <Text style={styles.line}>{t('gun.streak', { count: 7 })}</Text>
      <Text style={styles.line}>kcal: {fmt(1234)} · makro: {fmt(42.5, { precision: 1 })} g</Text>
      <Text style={styles.line}>{t('ai_scan.quota_empty')}</Text>
    </Section>
  );
}

// ── Keşfet ──────────────────────────────────────────────────────────────────
function KesfetDemo() {
  const { t } = useT();
  const store = useKesfetStore();
  const [addKeySeq, setAddKeySeq] = useState(0);
  const [lastConsumption, setLastConsumption] = useState<string | null>(null);

  const add = useCallback(
    async (postId: string, meal: MealType) => {
      const key = `lab-${postId}-${meal}-${addKeySeq}`;
      setAddKeySeq((n) => n + 1);
      const id = await useKesfetStore.getState().addToDay(postId, meal, 1, key);
      setLastConsumption(id);
    },
    [addKeySeq],
  );

  return (
    <Section title="Keşfet">
      <Row>
        <Toggle label={t('kesfet.tab.for_you')} active={store.tab === 'for_you'} onPress={() => store.setTab('for_you')} />
        <Toggle label={t('kesfet.tab.following')} active={store.tab === 'following'} onPress={() => store.setTab('following')} />
      </Row>
      <Row>
        <Btn label="Yükle" onPress={() => store.load()} />
        <Btn label="Daha fazla" onPress={() => store.loadMore()} />
        <Btn label="Yenile" onPress={() => store.refresh()} />
      </Row>
      <Text style={styles.meta}>
        {store.loading ? 'yükleniyor…' : `${store.posts.length} gönderi · hasMore=${String(store.hasMore)}`}
        {store.error ? ` · HATA: ${store.error}` : ''}
      </Text>
      {store.posts.slice(0, 5).map((p) => (
        <View key={p.id} style={styles.card}>
          <Text style={styles.cardTitle}>
            @{p.author.handle} · {p.meal_card ? `${p.meal_card.kcal} kcal` : '—'}
          </Text>
          <Text style={styles.meta}>
            ❤ {p.stats.likes} · 🔖 {p.stats.saves} · ➕ {p.stats.adds} · {p.me.liked ? 'beğenildi' : '—'}
          </Text>
          <Row>
            <Btn label={p.me.liked ? 'Beğeniyi kaldır' : 'Beğen'} onPress={() => store.react(p.id, 'like', !p.me.liked)} />
            <Btn label={p.me.saved ? 'Kayıttan çıkar' : 'Kaydet'} onPress={() => store.react(p.id, 'save', !p.me.saved)} />
            <Btn label={t('kesfet.add_to_day')} onPress={() => add(p.id, 'lunch')} />
          </Row>
        </View>
      ))}
      {lastConsumption ? (
        <Text style={styles.ok}>{t('kesfet.added_toast', { meal: t('meal.lunch') })} · {lastConsumption}</Text>
      ) : null}
    </Section>
  );
}

// ── Profil ────────────────────────────────────────────────────────────────────
function ProfilDemo() {
  const { t } = useT();
  const handle = useHandleClaim('');
  const [followState, setFollowState] = useState<FollowState | null>(null);

  const follow = useCallback(async (user: string) => {
    const res = await getProfilClient().follow({ user, on: true });
    setFollowState(res.state);
  }, []);

  return (
    <Section title="Profil / handle">
      <Text style={styles.label}>{t('profil.handle_label')}</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        placeholder="@kullanici_adi"
        value={handle.value}
        onChangeText={handle.setValue}
      />
      <Text style={styles.meta}>
        durum: {handle.status}
        {handle.messageKey ? ` · ${t(handle.messageKey)}` : ''}
      </Text>
      <Row>
        <Btn label={`${t('profil.follow')} (açık)`} onPress={() => follow('user-acik')} />
        <Btn label={`${t('profil.follow')} (gizli)`} onPress={() => follow('user-gizli')} />
      </Row>
      {followState ? (
        <Text style={styles.ok}>
          follow → {followState === 'requested' ? t('profil.requested') : followState === 'following' ? t('profil.following') : '—'}
        </Text>
      ) : null}
    </Section>
  );
}

// ── Gün halkası ───────────────────────────────────────────────────────────────
function GunDemo() {
  const { t, fmt } = useT();
  const [rings, setRings] = useState<DayRing[]>([]);
  const [cards, setCards] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await getGunClient().getDayRings();
    setRings(r);
    const c = await getGunClient().getDayCards({ user: r[0]?.user.id ?? 'me' });
    setCards(c.length);
  }, []);

  return (
    <Section title={t('gun.title')}>
      <Btn label="Halkaları yükle" onPress={load} />
      {rings.map((r, i) => (
        <Text key={r.user.id} style={styles.line}>
          {i === 0 ? '→ ' : '   '}
          {r.user.display_name} · %{Math.round(r.progress * 100)} · 🔥{r.streak}
          {r.has_new ? ' · yeni' : ''}
        </Text>
      ))}
      {cards != null ? <Text style={styles.meta}>ilk kişinin kartları: {fmt(cards)}</Text> : null}
    </Section>
  );
}

// ── AI tarama ─────────────────────────────────────────────────────────────────
function AiScanDemo() {
  const { t } = useT();
  const [outcome, setOutcome] = useState<AiScanOutcome | null>(null);
  const [seq, setSeq] = useState(0);

  const scan = useCallback(async () => {
    const res = await runAiScan(getAiScanClient(), {
      idempotencyKey: `lab-scan-${seq}`,
      imageRef: 'file://lab.jpg',
    });
    setSeq((n) => n + 1);
    setOutcome(res);
  }, [seq]);

  return (
    <Section title="AI tarama">
      <Btn label="Tara (kota düşer)" onPress={scan} />
      {outcome ? (
        <View>
          <Text style={styles.meta}>durum: {outcome.status} · kalan: {outcome.remaining}</Text>
          {outcome.status === 'ok' ? (
            <>
              <Text style={styles.ok}>{t('ai_scan.result_estimate')}</Text>
              <Text style={styles.line}>
                {outcome.estimate.name} · {outcome.estimate.kcal} kcal · P{outcome.estimate.protein_g}
              </Text>
            </>
          ) : null}
          {outcome.status === 'quota_exhausted' ? (
            <Text style={styles.warn}>{t('ai_scan.quota_empty')}</Text>
          ) : null}
          {outcome.status === 'failed' ? <Text style={styles.warn}>{t('ai_scan.failed')}</Text> : null}
        </View>
      ) : null}
    </Section>
  );
}

// ── küçük UI yardımcıları (yalnız bu DEV ekranı) ──────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}
function Toggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, active && styles.toggleActive]} accessibilityRole="button">
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
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
  content: { padding: 16, paddingTop: 48, gap: 12 },
  h1: { fontSize: 22, fontWeight: '700', color: '#111' },
  sub: { fontSize: 12, color: '#777', marginTop: -6 },
  section: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#ddd', borderRadius: 12, padding: 12, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#444', textTransform: 'uppercase' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  line: { fontSize: 14, color: '#111' },
  meta: { fontSize: 12, color: '#666' },
  ok: { fontSize: 13, color: '#1a7f37' },
  warn: { fontSize: 13, color: '#b35900' },
  label: { fontSize: 12, color: '#666' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee', borderRadius: 10, padding: 10, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  toggle: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#ccc' },
  toggleActive: { backgroundColor: '#111', borderColor: '#111' },
  toggleText: { fontSize: 13, color: '#111' },
  toggleTextActive: { color: '#fff' },
  btn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f0f0f0' },
  btnText: { fontSize: 13, color: '#111' },
});
