// "Takibe başla" akışı (G12-S1 · FinTb*, G15-S1 Final eşleşmesi). Light + Dark,
// Onboarding ile aynı iskelet (OnbScaffold: cam nesne, geri oku, sayfa noktaları,
// kart). Günlük hedef MEVCUT beslenme profili servisiyle (lib/nutrition → calc)
// hesaplanır; kayıt user_nutrition_profiles'a (save.ts) yazılır. Yeni tablo yok.
//
// Akış: Hedef → (Tempo yalnız kilo ver/kas yap) → Seni tanıyalım (açık rıza
// zorunlu) → Hareketin → Sonuç (halka + "Nasıl hesaplanır?" sheet) → İlk adım.
// 18 yaş altı → Underage. editGoal (Profil › Hedefim) modunda Sonuç'tan kaydeder
// ve geri döner (S4 giriş noktasını bağlar).

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../core/design/components/FinText';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../../../core/design/components/AppText';
import { ProgressRing } from '../../../core/design/components/ProgressRing';
import { DURATION, haptic } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import type { RootStackParamList } from '../../../navigation/types';
import type { ActivityLevel } from '../../../lib/nutrition';
import { Compass, PencilSimple, Scan } from '../../../components/icons';
import { OnbScaffold, type OnbGlass } from '../components/OnbScaffold';
import { OnbButton, OnbLead, OnbTitle, OptionRow } from '../components/pieces';
import { UnderageView } from '../components/UnderageView';
import { useOnb } from '../components/onbTheme';
import { useTbDraft } from './draft';
import {
  allowedPaces,
  canChooseLose,
  clampPace,
  computeResult,
  goalNeedsPace,
  isUnderage,
  type Pace,
  type TbGender,
  type TbGoal,
} from './calc';
import { saveTakibeProfile } from './save';
import { recordHealthConsent } from '../../../lib/consent/store';
import { HowSheet } from './HowSheet';
import { useOnbFirst } from '../first/store';
import { IconRow, MacroCard, PaceDateRow, PaceSlider, WheelPicker } from './TbParts';
import { track } from '../../../lib/analytics';
import { useFreeAiCap } from '../../../lib/subscription/purchases';
import { Toast } from '../../../core/design/components/Toast';

export type TbParamList = {
  TbGoal: undefined;
  TbPace: undefined;
  TbAbout: undefined;
  TbActivity: undefined;
  /** `vitrinHow`: YALNIZ geliştirme vitrini — "Nasıl hesaplanır?" sheet'i açık başlar. */
  TbResult: { vitrinHow?: boolean } | undefined;
  TbFirst: undefined;
  TbUnderage: undefined;
};

const Stack = createNativeStackNavigator<TbParamList>();

function useRootNav(navigation: NativeStackNavigationProp<TbParamList, keyof TbParamList>) {
  return navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
}

function nowYear(): number {
  return new Date().getFullYear();
}

// Final cam nesne konumları (393 tasarım koordinatı).
const GLASS: Record<'trophy' | 'flame' | 'drop' | 'foot' | 'bowl' | 'flameAbout', OnbGlass> = {
  trophy: { source: require('../../../../assets/glass/trophy.png'), x: 127, y: 112, w: 139, h: 120 },
  flame: { source: require('../../../../assets/glass/flame.png'), x: 236, y: 104, w: 106, h: 130 },
  drop: { source: require('../../../../assets/glass/drop.png'), x: 286, y: 104, w: 68, h: 92 },
  foot: { source: require('../../../../assets/glass/foot.png'), x: 248, y: 102, w: 77, h: 128 },
  bowl: { source: require('../../../../assets/glass/bowl.png'), x: 126, y: 128, w: 140, h: 104 },
  // G21-S1 md.1 (Tur 26f): FinTbAbout damla → alev (damla yuvasının merkezinde, alev oranı).
  flameAbout: { source: require('../../../../assets/glass/flame.png'), x: 282, y: 101, w: 76, h: 93 },
};

/**
 * G21-S1 md.8 (#D3): "Atla" — Profil › Hedefim (editGoal) düzenlemesinde açıldığı yere
 * (Profil) geri döner; yeni kullanıcı akışında bugünkü gibi Ana sayfa.
 */
export function tbSkipTarget(editGoal: boolean, canGoBack: boolean): 'back' | 'home' {
  return editGoal && canGoBack ? 'back' : 'home';
}

function tbSkipOut(root: NativeStackNavigationProp<RootStackParamList> | undefined) {
  if (!root) return;
  if (tbSkipTarget(useTbDraft.getState().editGoal === true, root.canGoBack()) === 'back') root.goBack();
  else root.navigate('Tabs', { screen: 'Tracker' });
}

const TB_STEPS = 6;

/** Takibe başla iskeleti: "Takibe başla" başlığı + 6 nokta + geri + Atla. */
function TbFrame({
  step,
  cardTop,
  glass,
  onBack,
  onSkip,
  footer,
  scroll,
  cardPad,
  children,
}: {
  step: number;
  cardTop: number;
  glass?: OnbGlass;
  onBack: () => void;
  onSkip: () => void;
  footer?: React.ReactNode;
  scroll?: boolean;
  cardPad?: [number, number, number];
  children: React.ReactNode;
}) {
  const i18n = useT();
  return (
    <OnbScaffold
      cardPad={cardPad}
      cardTop={cardTop}
      glass={glass}
      onBack={onBack}
      caption={i18n.t('tb.header')}
      dots={{ count: TB_STEPS, index: step }}
      topRight={{ label: i18n.t('tb.skip'), onPress: onSkip }}
      footer={footer}
      scroll={scroll}
    >
      {children}
    </OnbScaffold>
  );
}

// ── Hedef ─────────────────────────────────────────────────────────────────────
function GoalScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbGoal'>) {
  const i18n = useT();
  const root = useRootNav(navigation);
  const { goal, setGoal, heightCm, weightKg } = useTbDraft();
  const GOALS: TbGoal[] = ['lose', 'maintain', 'gain', 'regular'];
  // G33-S1: BMI < 18,5 biliniyorsa (hedef düzenleme) "Kilo ver" kapalı.
  const loseOk = canChooseLose(heightCm, weightKg);
  // Final: "Kilo ver" önceden seçili.
  const [sel, setSel] = useState<TbGoal>(goal && (goal !== 'lose' || loseOk) ? goal : loseOk ? 'lose' : 'maintain');

  const next = () => {
    setGoal(sel);
    navigation.navigate(goalNeedsPace(sel) ? 'TbPace' : 'TbAbout');
  };

  return (
    <TbFrame
      step={0}
      cardTop={213}
      glass={GLASS.trophy}
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : root?.goBack())}
      onSkip={() => tbSkipOut(root)}
      footer={<OnbButton label={i18n.t('tb.continue')} onPress={next} />}
    >
      <OnbTitle>{i18n.t('tb.goal.title')}</OnbTitle>
      <OnbLead style={{ marginBottom: 16 }}>{i18n.t('tb.goal.sub')}</OnbLead>
      <View style={styles.rows}>
        {GOALS.map((g) => (
          <OptionRow
            key={g}
            title={i18n.t(`tb.goal.${g}`)}
            desc={g === 'lose' && !loseOk ? i18n.t('tb.goal.lose_off') : undefined}
            disabled={g === 'lose' && !loseOk}
            selected={sel === g}
            onPress={() => setSel(g)}
          />
        ))}
      </View>
    </TbFrame>
  );
}

// ── Tempo ───────────────────────────────────────────────────────────────────
/**
 * G25-S1 md.8 (A11): "Hedefe tahmini varış" metni. Akışta hedef kilo sorulmuyor → veri yok → null
 * (satır gizli). Hedef kilo eklenince burada tarih üretilir.
 */
export function paceProjection(): string | null {
  return null;
}

function PaceScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbPace'>) {
  const i18n = useT();
  const root = useRootNav(navigation);
  const { pace, setPace, weightKg } = useTbDraft();
  const fmt = (p: Pace) => (i18n.lang === 'tr' ? String(p).replace('.', ',') : String(p));
  // G33-S1: üst sınır 0,75 kg/hafta; kilo biliniyorsa kilonun %1'ini aşan tempo seçilemez.
  const options = allowedPaces(weightKg);
  const value = clampPace(pace, weightKg);
  const projection = paceProjection();

  return (
    <TbFrame
      step={1}
      cardTop={213}
      glass={GLASS.flame}
      onBack={() => navigation.goBack()}
      onSkip={() => tbSkipOut(root)}
      footer={
        <OnbButton
          label={i18n.t('tb.continue')}
          onPress={() => {
            if (value !== pace) setPace(value);
            navigation.navigate('TbAbout');
          }}
        />
      }
    >
      <OnbTitle>{i18n.t('tb.pace.title')}</OnbTitle>
      <OnbLead style={{ marginBottom: 16 }}>{i18n.t('tb.pace.sub')}</OnbLead>
      <PaceSlider
        options={options}
        value={value}
        onChange={setPace}
        format={fmt}
        unit={i18n.t('tb.pace.unit')}
        minLabel={i18n.t('tb.pace.min')}
        maxLabel={fmt(options[options.length - 1]) + ' kg'}
      />
      {/* G25-S1 md.8 (A11): hedef kilo bu akışta sorulmadığından tarih hesaplanamaz → satır GİZLİ
          (eskiden "—" yer tutucu). Tahmin üretilirse (paceProjection) satır kendiliğinden görünür. */}
      {projection ? <PaceDateRow label={i18n.t('tb.pace.projection')} value={projection} /> : null}
    </TbFrame>
  );
}

// ── Seni tanıyalım ────────────────────────────────────────────────────────────
const YEARS_BACK = 100;

function AboutScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbAbout'>) {
  const i18n = useT();
  const P = useOnb();
  const root = useRootNav(navigation);
  const d = useTbDraft();
  const year = nowYear();
  const years = useMemo(() => Array.from({ length: YEARS_BACK + 1 }, (_, i) => year - YEARS_BACK + i), [year]);
  const heights = useMemo(() => Array.from({ length: 111 }, (_, i) => 110 + i), []); // 110–220 cm
  const weights = useMemo(() => Array.from({ length: 171 }, (_, i) => 30 + i), []); // 30–200 kg
  const [birth, setBirth] = useState(d.birthYear ?? 1995);
  const [height, setHeight] = useState(d.heightCm ?? 170);
  const [weight, setWeight] = useState(d.weightKg ?? 70);

  const GENDERS: TbGender[] = ['female', 'male', 'unspecified'];
  const complete = !!d.gender && d.consent;

  const next = () => {
    d.setBirthYear(birth);
    d.setHeightCm(height);
    d.setWeightKg(weight);
    // G33-S1: tempo kilodan önce soruluyor → kilo gelince %1 sınırına indir; BMI < 18,5'te
    // "Kilo ver" kapalı → hedef "Kilo koru"ya döner.
    const capped = clampPace(d.pace, weight);
    if (capped !== d.pace) d.setPace(capped);
    if (d.goal === 'lose' && !canChooseLose(height, weight)) d.setGoal('maintain');
    if (isUnderage(birth, nowYear())) {
      navigation.navigate('TbUnderage');
      return;
    }
    // G27-S1: açık rıza user_consents'e AYRI satır (kind health_data); en iyi çaba, akışı bekletmez.
    if (d.consent) void recordHealthConsent(true, 'takibe').catch(() => {});
    navigation.navigate('TbActivity');
  };

  // "açık rıza" / "explicit consent" kalın (Final).
  const consent = i18n.t('tb.about.consent');
  const boldWord = i18n.lang === 'tr' ? 'açık rıza' : 'explicit consent';
  const bi = consent.indexOf(boldWord);

  return (
    <TbFrame
      step={2}
      cardTop={168}
      cardPad={[30, 18, 18]}
      glass={GLASS.flameAbout}
      onBack={() => navigation.goBack()}
      onSkip={() => tbSkipOut(root)}
      scroll
      footer={<OnbButton label={i18n.t('tb.continue')} onPress={next} disabled={!complete} />}
    >
      <OnbTitle style={{ fontSize: 26, lineHeight: 30 }}>{i18n.t('tb.about.title')}</OnbTitle>
      <OnbLead style={{ marginBottom: 14 }}>{i18n.t('tb.about.sub')}</OnbLead>

      <AppText textRole="helper" style={{ color: P.sec, marginBottom: 8 }}>
        {i18n.t('tb.about.gender')}
      </AppText>
      <View style={styles.genderRow}>
        {GENDERS.map((g) => {
          const on = d.gender === g;
          return (
            <Pressable
              key={g}
              onPress={() => {
                haptic('selection');
                d.setGender(g);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[
                styles.gender,
                { flex: g === 'unspecified' ? 1.5 : 1 },
                on
                  ? { backgroundColor: P.accent, borderColor: 'transparent' }
                  : { backgroundColor: P.chip, borderColor: P.chipEdge },
              ]}
            >
              <AppText
                textRole="bodySm"
                style={{ color: on ? P.onAccent : P.ink, fontFamily: 'PlusJakartaSans_600SemiBold', textAlign: 'center', fontSize: 14, lineHeight: 17 }}
              >
                {i18n.t(`tb.about.${g}`)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.wheels}>
        <WheelPicker label={i18n.t('tb.about.birthYear')} values={years} value={birth} onChange={setBirth} />
        <WheelPicker label={i18n.t('tb.about.height')} values={heights} value={height} onChange={setHeight} />
        <WheelPicker label={i18n.t('tb.about.weight')} values={weights} value={weight} onChange={setWeight} />
      </View>

      <AppText textRole="helper" style={{ color: P.sec, marginTop: 12 }}>
        {i18n.t('tb.about.privacy')}
      </AppText>
      <View style={[styles.divider, { backgroundColor: P.line }]} />

      <Pressable
        onPress={() => {
          haptic('selection');
          d.setConsent(!d.consent);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: d.consent }}
        style={styles.consentRow}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: d.consent ? P.accent : P.line2, backgroundColor: d.consent ? P.accent : 'transparent' },
          ]}
        >
          {d.consent ? <AppText textRole="helper" style={{ color: P.onAccent }}>✓</AppText> : null}
        </View>
        <Text style={{ flex: 1, color: P.ink, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, lineHeight: 20 }}>
          {bi >= 0 ? (
            <>
              {consent.slice(0, bi)}
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{boldWord}</Text>
              {consent.slice(bi + boldWord.length)}
            </>
          ) : (
            consent
          )}
        </Text>
      </Pressable>
    </TbFrame>
  );
}

// ── Hareketin ─────────────────────────────────────────────────────────────────
function ActivityScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbActivity'>) {
  const i18n = useT();
  const root = useRootNav(navigation);
  const { activity, setActivity } = useTbDraft();
  // Panel 4 seçeneği → servisin 5 seviyesinden 4'ü.
  const OPTIONS: ActivityLevel[] = ['sedentary', 'light', 'active', 'very_active'];
  // Final: "Hafif aktif" önceden seçili.
  const [sel, setSel] = useState<ActivityLevel>(activity ?? 'light');

  const next = () => {
    setActivity(sel);
    navigation.navigate('TbResult');
  };

  return (
    <TbFrame
      step={3}
      cardTop={213}
      glass={GLASS.foot}
      onBack={() => navigation.goBack()}
      onSkip={() => tbSkipOut(root)}
      footer={<OnbButton label={i18n.t('tb.continue')} onPress={next} />}
    >
      <OnbTitle>{i18n.t('tb.activity.title')}</OnbTitle>
      <OnbLead style={{ marginBottom: 16 }}>{i18n.t('tb.activity.sub')}</OnbLead>
      <View style={styles.rows}>
        {OPTIONS.map((a) => (
          <OptionRow key={a} title={i18n.t(`tb.activity.${a}`)} selected={sel === a} onPress={() => setSel(a)} />
        ))}
      </View>
    </TbFrame>
  );
}

// ── Sonuç ───────────────────────────────────────────────────────────────────
function ResultScreen({ navigation, route }: NativeStackScreenProps<TbParamList, 'TbResult'>) {
  const i18n = useT();
  const P = useOnb();
  const root = useRootNav(navigation);
  const { user } = useAuth();
  const draft = useTbDraft();
  // `vitrinHow` yalnız geliştirmede (vitrin) — üretimde __DEV__ false.
  const [howOpen, setHowOpen] = useState(__DEV__ && route.params?.vitrinHow === true);
  const [saving, setSaving] = useState(false);
  // G25-S1 md.9 (A12): kayıt `ok:false` → hata toast'ı + Tekrar dene; kutlama/geçiş YALNIZ başarıda
  // (eskiden hata yutuluyor, "Profil hazır" yine çıkıyordu). Taslak korunur.
  const [saveFailed, setSaveFailed] = useState(false);
  const result = useMemo(() => computeResult(draft, nowYear()), [draft]);

  const save = async (): Promise<boolean> => {
    if (!user) return true;
    setSaving(true);
    setSaveFailed(false);
    const r = await saveTakibeProfile(user.id, draft, nowYear());
    setSaving(false);
    if (!r.ok) {
      setSaveFailed(true);
      return false;
    }
    return true;
  };

  const onContinue = async () => {
    if (draft.editGoal) {
      // Profil › Hedefim düzenleme: kaydet + geri dön (S4 giriş noktasını bağlar).
      if (!(await save())) return;
      draft.reset();
      root?.goBack();
      return;
    }
    // G18-S1 md.5 (Tur 26 #5): profil kartından gelen akış Sonuç'ta biter →
    // profil kaydı → Ana sayfa'da "Profil hazır" (FinCelebrateProfile) → oryantasyon.
    // TbFirst ("İlk öğününü logla") kayıtlı kalır; görevi Ana sayfa "İlk öğününü
    // ekle" kartı + Orient1 (Tara) üstlenir (LOG › SORULAR 1).
    if (!(await save())) return;
    const kcal = result?.macros?.calories ?? null;
    draft.reset();
    useOnbFirst.getState().setCard('done');
    useOnbFirst.getState().queueCelebrate(kcal != null ? Math.round(kcal) : null);
    root?.navigate('Tabs', { screen: 'Tracker' });
  };

  const m = result?.macros;
  const g = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)} g`);
  return (
    <TbFrame
      step={4}
      cardTop={112}
      cardPad={[24, 20, 20]}
      onBack={() => navigation.goBack()}
      onSkip={() => tbSkipOut(root)}
      footer={
        <>
          {saveFailed ? (
            <View style={styles.toastWrap}>
              <Toast
                visible
                tone="error"
                testID="tb-save-error"
                message={i18n.t('tb.save_failed')}
                onRetry={saving ? undefined : () => void onContinue()}
                onDismiss={() => setSaveFailed(false)}
              />
            </View>
          ) : null}
          <OnbButton
            label={draft.editGoal ? i18n.t('common.save') : i18n.t('tb.continue')}
            onPress={saving ? () => {} : onContinue}
          />
        </>
      }
    >
      <View style={styles.resultWrap}>
        <AppText textRole="bodySm" style={{ color: P.sec, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 22 }}>
          {i18n.t('tb.result.title')}
        </AppText>
        <ProgressRing progress={1} size={200} strokeWidth={16} color={P.accent}>
          <AppText style={[styles.bigKcal, { color: P.ink }]}>{m ? Math.round(m.calories) : '—'}</AppText>
          <AppText textRole="bodySm" style={{ color: P.sec, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
            {i18n.t('tb.result.kcal')}
          </AppText>
        </ProgressRing>
        <View style={styles.macros}>
          <MacroCard label={i18n.t('tb.result.protein')} value={g(m?.protein)} />
          <MacroCard label={i18n.t('tb.result.carbs')} value={g(m?.carbs)} />
          <MacroCard label={i18n.t('tb.result.fat')} value={g(m?.fat)} />
        </View>
        <Pressable
          onPress={() => setHowOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('tb.result.how')}
          hitSlop={12}
          style={{ marginTop: 28, minHeight: 44, justifyContent: 'center' }}
        >
          <AppText
            textRole="bodySm"
            style={{ color: P.ink, fontFamily: 'PlusJakartaSans_700Bold', textDecorationLine: 'underline' }}
          >
            {i18n.t('tb.result.how')}
          </AppText>
        </Pressable>
      </View>

      <HowSheet
        visible={howOpen}
        onClose={() => setHowOpen(false)}
        title={i18n.t('tb.how.title')}
        closeLabel={i18n.t('common.close')}
        footer={<OnbButton label={i18n.t('tb.how.ok')} onPress={() => setHowOpen(false)} />}
      >
        {/* FinTbHow: üç satırın hepsi alt çizgili; not 13 · üst 12 · alt 16. */}
        <View>
          <HowRow title={i18n.t('tb.how.bmr')} desc={i18n.t('tb.how.bmr_desc')} />
          <HowRow title={i18n.t('tb.how.activity')} desc={i18n.t('tb.how.activity_desc')} />
          <HowRow title={i18n.t('tb.how.goal')} desc={i18n.t('tb.how.goal_desc')} />
          <AppText style={{ color: P.sec, marginTop: 12, marginBottom: 16, fontSize: 13, lineHeight: 18 }}>
            {i18n.t('tb.how.note')}
          </AppText>
        </View>
      </HowSheet>
    </TbFrame>
  );
}

function HowRow({ title, desc, value, last }: { title: string; desc: string; value?: string; last?: boolean }) {
  const P = useOnb();
  return (
    <View style={[styles.howRow, !last ? { borderBottomWidth: 1, borderBottomColor: P.line } : null]}>
      <View style={styles.howHead}>
        <AppText textRole="body" style={{ color: P.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, lineHeight: 20, flex: 1 }}>
          {title}
        </AppText>
        {value ? (
          <AppText textRole="bodySm" style={{ color: P.sec, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
            {value}
          </AppText>
        ) : null}
      </View>
      <AppText textRole="bodySm" style={{ color: P.sec, marginTop: 2, fontSize: 14, lineHeight: 20 }}>
        {desc}
      </AppText>
    </View>
  );
}

// ── İlk adım ──────────────────────────────────────────────────────────────────
function FirstScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbFirst'>) {
  const i18n = useT();
  const P = useOnb();
  const root = useRootNav(navigation);
  const { user } = useAuth();
  const draft = useTbDraft();
  const freeCap = useFreeAiCap(); // G25-S1 md.1: "günde N ücretsiz" sunucu tavanından (yedek 2)
  // G25-S1 md.9 (A12): kayıt başarısızsa geçiş yok; hata toast'ı + Tekrar dene (aynı hedefe).
  const [failedGo, setFailedGo] = useState<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);

  const saveThen = async (go: () => void) => {
    if (busy) return;
    if (user) {
      setBusy(true);
      setFailedGo(null);
      const r = await saveTakibeProfile(user.id, draft, nowYear());
      setBusy(false);
      if (!r.ok) {
        setFailedGo(() => go);
        return;
      }
    }
    draft.reset();
    go();
  };

  return (
    <TbFrame
      step={5}
      cardTop={213}
      glass={GLASS.bowl}
      onBack={() => navigation.goBack()}
      onSkip={() => saveThen(() => root?.navigate('Tabs', { screen: 'Tracker' }))}
      footer={
        <>
          {failedGo ? (
            <View style={styles.toastWrap}>
              <Toast
                visible
                tone="error"
                testID="tb-save-error"
                message={i18n.t('tb.save_failed')}
                onRetry={busy ? undefined : () => void saveThen(failedGo)}
                onDismiss={() => setFailedGo(null)}
              />
            </View>
          ) : null}
          <AppText textRole="helper" style={{ color: P.sec, textAlign: 'center' }}>
            {i18n.t('tb.first.footer')}
          </AppText>
        </>
      }
    >
      <OnbTitle style={{ marginBottom: 16 }}>{i18n.t('tb.first.title')}</OnbTitle>
      <View style={styles.rows}>
        <IconRow
          title={i18n.t('tb.first.scan')}
          desc={i18n.t('tb.first.scan_desc', { count: freeCap })}
          icon={(c) => <Scan size={22} color={c} />}
          onPress={() => saveThen(() => root?.navigate('AiScan'))}
        />
        <IconRow
          title={i18n.t('tb.first.manual')}
          icon={(c) => <PencilSimple size={22} color={c} />}
          onPress={() => saveThen(() => root?.navigate('Tabs', { screen: 'Tracker' }))}
        />
        <IconRow
          title={i18n.t('tb.first.discover')}
          desc={i18n.t('tb.first.discover_desc')}
          icon={(c) => <Compass size={22} color={c} />}
          onPress={() => saveThen(() => root?.navigate('Tabs', { screen: 'Tracker' }))}
        />
      </View>
    </TbFrame>
  );
}

// ── 18 yaş engeli ─────────────────────────────────────────────────────────────
function UnderageScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbUnderage'>) {
  const root = useRootNav(navigation);
  const draft = useTbDraft();
  return (
    <UnderageView
      onFix={() => navigation.goBack()}
      onOk={() => {
        draft.reset();
        root?.navigate('Tabs', { screen: 'Home' });
      }}
    />
  );
}

/** Yalnız bileşen testleri (G25-S1 md.8/md.9): ekranları navigatörsüz çizmek için. */
export const __tbScreensForTest = { PaceScreen, ResultScreen, FirstScreen };

const TB_ROUTE_ORDER: string[] =['TbGoal', 'TbPace', 'TbAbout', 'TbActivity', 'TbResult', 'TbFirst', 'TbUnderage'];

export default function TakibeBaslaNavigator({
  route,
}: NativeStackScreenProps<RootStackParamList, 'TakibeBasla'>) {
  const reset = useTbDraft((s) => s.reset);
  const P = useOnb();
  // Akış açılışında taslağı sıfırla (editGoal bayrağını koru).
  const editGoal = route.params?.editGoal ?? false;
  const didInit = React.useRef(false);
  if (!didInit.current) {
    didInit.current = true;
    reset(editGoal);
  }
  return (
    <Stack.Navigator
      // G19-S3: onb_step — her adım odaklandığında (geri dönüş dahil) bir kez.
      screenListeners={({ route }) => ({
        focus: () => track('onb_step', { flow: 'takibe', step: route.name, index: TB_ROUTE_ORDER.indexOf(route.name) }),
      })}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: DURATION.base,
        contentStyle: { backgroundColor: P.bg },
      }}
    >
      <Stack.Screen name="TbGoal" component={GoalScreen} />
      <Stack.Screen name="TbPace" component={PaceScreen} />
      <Stack.Screen name="TbAbout" component={AboutScreen} />
      <Stack.Screen name="TbActivity" component={ActivityScreen} />
      <Stack.Screen name="TbResult" component={ResultScreen} />
      <Stack.Screen name="TbFirst" component={FirstScreen} />
      <Stack.Screen name="TbUnderage" component={UnderageScreen} options={{ animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  toastWrap: { marginBottom: 10 },
  rows: { gap: 10 },
  genderRow: { flexDirection: 'row', gap: 8 },
  gender: { minHeight: 52, borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  wheels: { flexDirection: 'row', gap: 10, marginTop: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 12 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, minHeight: 44 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  resultWrap: { alignItems: 'center' },
  bigKcal: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 44, lineHeight: 48 },
  macros: { flexDirection: 'row', gap: 10, marginTop: 24 },
  howRow: { paddingVertical: 12 },
  howHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
