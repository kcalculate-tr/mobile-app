// "Takibe başla" akışı (G12-S1 · FinTb*). Açık temada, tasarım sistemiyle
// (AppText/Button/Chip/Card/Sheet/MacroStrip/ProgressRing). Günlük hedef MEVCUT
// beslenme profili servisiyle (lib/nutrition → calc) hesaplanır; kayıt
// user_nutrition_profiles'a (save.ts) yazılır. Yeni tablo yok.
//
// Akış: Hedef → (Tempo yalnız kilo ver/kas yap) → Seni tanıyalım (açık rıza
// zorunlu) → Hareketin → Sonuç (halka + "Nasıl hesaplanır?" sheet) → İlk adım.
// 18 yaş altı → Underage. editGoal (Profil › Hedefim) modunda Sonuç'tan kaydeder
// ve geri döner (S4 giriş noktasını bağlar).

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../../../core/design/components/AppText';
import { Button } from '../../../core/design/components/Button';
import { Chip } from '../../../core/design/components/Chip';
import { Card } from '../../../core/design/components/Card';
import { Sheet } from '../../../core/design/components/Sheet';
import { MacroStrip } from '../../../core/design/components/MacroStrip';
import { ProgressRing } from '../../../core/design/components/ProgressRing';
import { useTheme } from '../../../core/design/ThemeProvider';
import { useEnter, DURATION, haptic } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import type { RootStackParamList } from '../../../navigation/types';
import type { ActivityLevel } from '../../../lib/nutrition';
import { useTbDraft } from './draft';
import {
  PACE_OPTIONS,
  computeResult,
  goalNeedsPace,
  isUnderage,
  type Pace,
  type TbGender,
  type TbGoal,
} from './calc';
import { saveTakibeProfile } from './save';

export type TbParamList = {
  TbGoal: undefined;
  TbPace: undefined;
  TbAbout: undefined;
  TbActivity: undefined;
  TbResult: undefined;
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

// ── Scaffold: başlık + "Atla" + içerik + alt CTA ────────────────────────────
function TbScaffold({
  onSkip,
  footer,
  scroll = false,
  children,
}: {
  onSkip: () => void;
  footer?: React.ReactNode;
  scroll?: boolean;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const i18n = useT();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return (
    <View style={[styles.root, { backgroundColor: t.color.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <AppText textRole="helper" style={{ color: t.color.secondary }}>
          {i18n.t('tb.header')}
        </AppText>
        <Pressable onPress={onSkip} hitSlop={12} accessibilityRole="button" style={styles.skip}>
          <AppText textRole="bodySm" style={{ color: t.color.secondary }}>
            {i18n.t('tb.skip')}
          </AppText>
        </Pressable>
      </View>
      <Body
        style={styles.body}
        {...(scroll ? { contentContainerStyle: { paddingBottom: 24 }, keyboardShouldPersistTaps: 'handled' as const } : {})}
      >
        {children}
      </Body>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>{footer}</View> : null}
    </View>
  );
}

/** Büyük seçim satırı (hedef/aktivite) — seçiliyse lime çerçeve. */
function SelectRow({
  title,
  desc,
  selected,
  onPress,
}: {
  title: string;
  desc?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={desc ? `${title}. ${desc}` : title}
      style={[
        styles.selectRow,
        {
          backgroundColor: t.color.surface,
          borderColor: selected ? t.color.accent : t.color.line,
          borderWidth: selected ? 2 : t.stroke.regular,
        },
      ]}
    >
      <AppText textRole="section" style={{ color: t.color.ink }}>
        {title}
      </AppText>
      {desc ? (
        <AppText textRole="bodySm" style={{ color: t.color.secondary, marginTop: 2 }}>
          {desc}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function NumberField({
  label,
  value,
  onChange,
  maxLength = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <AppText textRole="helper" style={{ color: t.color.secondary, marginBottom: 6 }}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={t.color.secondary}
        style={[
          styles.input,
          { borderColor: t.color.line, color: t.color.ink, backgroundColor: t.color.surface },
        ]}
      />
    </View>
  );
}

// ── Hedef ─────────────────────────────────────────────────────────────────────
function GoalScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbGoal'>) {
  const i18n = useT();
  const enter = useEnter();
  const root = useRootNav(navigation);
  const { goal, setGoal } = useTbDraft();
  const GOALS: TbGoal[] = ['lose', 'maintain', 'gain', 'regular'];

  const pick = (g: TbGoal) => {
    setGoal(g);
    navigation.navigate(goalNeedsPace(g) ? 'TbPace' : 'TbAbout');
  };

  return (
    <TbScaffold onSkip={() => root?.navigate('Tabs', { screen: 'Tracker' })}>
      <Animated.View style={enter.style}>
        <AppText textRole="screenTitle" style={styles.title}>
          {i18n.t('tb.goal.title')}
        </AppText>
        <AppText textRole="body" style={styles.lead}>
          {i18n.t('tb.goal.sub')}
        </AppText>
        <View style={styles.rows}>
          {GOALS.map((g) => (
            <SelectRow key={g} title={i18n.t(`tb.goal.${g}`)} selected={goal === g} onPress={() => pick(g)} />
          ))}
        </View>
      </Animated.View>
    </TbScaffold>
  );
}

// ── Tempo ───────────────────────────────────────────────────────────────────
function PaceScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbPace'>) {
  const i18n = useT();
  const enter = useEnter();
  const root = useRootNav(navigation);
  const { pace, setPace } = useTbDraft();
  const fmt = (p: Pace) => (i18n.lang === 'tr' ? String(p).replace('.', ',') : String(p));

  return (
    <TbScaffold
      onSkip={() => root?.navigate('Tabs', { screen: 'Tracker' })}
      footer={<Button label={i18n.t('tb.continue')} onPress={() => navigation.navigate('TbAbout')} />}
    >
      <Animated.View style={enter.style}>
        <AppText textRole="screenTitle" style={styles.title}>
          {i18n.t('tb.pace.title')}
        </AppText>
        <AppText textRole="body" style={styles.lead}>
          {i18n.t('tb.pace.sub')}
        </AppText>
        <View style={styles.paceRow}>
          {PACE_OPTIONS.map((p) => (
            <Chip key={p} label={`${fmt(p)} ${i18n.t('tb.pace.unit')}`} selected={pace === p} onPress={() => setPace(p)} />
          ))}
        </View>
      </Animated.View>
    </TbScaffold>
  );
}

// ── Seni tanıyalım ────────────────────────────────────────────────────────────
function AboutScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbAbout'>) {
  const i18n = useT();
  const t = useTheme();
  const enter = useEnter();
  const root = useRootNav(navigation);
  const d = useTbDraft();
  const [birth, setBirth] = useState(d.birthYear ? String(d.birthYear) : '');
  const [height, setHeight] = useState(d.heightCm ? String(d.heightCm) : '');
  const [weight, setWeight] = useState(d.weightKg ? String(d.weightKg) : '');

  const GENDERS: TbGender[] = ['female', 'male', 'unspecified'];
  const birthYear = birth.length === 4 ? Number(birth) : null;
  const complete =
    !!d.gender && birthYear != null && Number(height) > 0 && Number(weight) > 0 && d.consent;

  const next = () => {
    d.setBirthYear(birthYear);
    d.setHeightCm(Number(height) || null);
    d.setWeightKg(Number(weight) || null);
    if (isUnderage(birthYear, nowYear())) {
      navigation.navigate('TbUnderage');
      return;
    }
    navigation.navigate('TbActivity');
  };

  return (
    <TbScaffold
      scroll
      onSkip={() => root?.navigate('Tabs', { screen: 'Tracker' })}
      footer={<Button label={i18n.t('tb.continue')} onPress={next} disabled={!complete} />}
    >
      <Animated.View style={enter.style}>
        <AppText textRole="screenTitle" style={styles.title}>
          {i18n.t('tb.about.title')}
        </AppText>
        <AppText textRole="body" style={styles.lead}>
          {i18n.t('tb.about.sub')}
        </AppText>

        <AppText textRole="helper" style={styles.fieldLabel}>
          {i18n.t('tb.about.gender')}
        </AppText>
        <View style={styles.paceRow}>
          {GENDERS.map((g) => (
            <Chip key={g} label={i18n.t(`tb.about.${g}`)} selected={d.gender === g} onPress={() => d.setGender(g)} />
          ))}
        </View>

        <View style={styles.fieldsRow}>
          <NumberField label={i18n.t('tb.about.birthYear')} value={birth} onChange={setBirth} maxLength={4} placeholder="1998" />
          <NumberField label={i18n.t('tb.about.height')} value={height} onChange={setHeight} placeholder="175" />
          <NumberField label={i18n.t('tb.about.weight')} value={weight} onChange={setWeight} placeholder="70" />
        </View>

        <AppText textRole="helper" style={{ color: t.color.secondary, marginTop: 14 }}>
          {i18n.t('tb.about.privacy')}
        </AppText>

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
              { borderColor: d.consent ? t.color.accent : t.color.line, backgroundColor: d.consent ? t.color.accent : 'transparent' },
            ]}
          >
            {d.consent ? (
              <AppText textRole="helper" style={{ color: t.color.onAccent }}>
                ✓
              </AppText>
            ) : null}
          </View>
          <AppText textRole="bodySm" style={{ color: t.color.ink, flex: 1 }}>
            {i18n.t('tb.about.consent')}
          </AppText>
        </Pressable>
      </Animated.View>
    </TbScaffold>
  );
}

// ── Hareketin ─────────────────────────────────────────────────────────────────
function ActivityScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbActivity'>) {
  const i18n = useT();
  const enter = useEnter();
  const root = useRootNav(navigation);
  const { activity, setActivity } = useTbDraft();
  // Panel 4 seçeneği → servisin 5 seviyesinden 4'ü.
  const OPTIONS: ActivityLevel[] = ['sedentary', 'light', 'active', 'very_active'];

  const pick = (a: ActivityLevel) => {
    setActivity(a);
    navigation.navigate('TbResult');
  };

  return (
    <TbScaffold onSkip={() => root?.navigate('Tabs', { screen: 'Tracker' })}>
      <Animated.View style={enter.style}>
        <AppText textRole="screenTitle" style={styles.title}>
          {i18n.t('tb.activity.title')}
        </AppText>
        <AppText textRole="body" style={styles.lead}>
          {i18n.t('tb.activity.sub')}
        </AppText>
        <View style={styles.rows}>
          {OPTIONS.map((a) => (
            <SelectRow key={a} title={i18n.t(`tb.activity.${a}`)} selected={activity === a} onPress={() => pick(a)} />
          ))}
        </View>
      </Animated.View>
    </TbScaffold>
  );
}

// ── Sonuç ───────────────────────────────────────────────────────────────────
function ResultScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbResult'>) {
  const i18n = useT();
  const t = useTheme();
  const enter = useEnter();
  const root = useRootNav(navigation);
  const { user } = useAuth();
  const draft = useTbDraft();
  const [howOpen, setHowOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const result = useMemo(() => computeResult(draft, nowYear()), [draft]);

  const onContinue = async () => {
    if (draft.editGoal) {
      // Profil › Hedefim düzenleme: kaydet + geri dön (S4 giriş noktasını bağlar).
      if (user) {
        setSaving(true);
        await saveTakibeProfile(user.id, draft, nowYear());
        setSaving(false);
      }
      draft.reset();
      root?.goBack();
      return;
    }
    navigation.navigate('TbFirst');
  };

  const m = result?.macros;
  return (
    <TbScaffold
      onSkip={() => root?.navigate('Tabs', { screen: 'Tracker' })}
      footer={
        <Button
          label={draft.editGoal ? i18n.t('common.save') : i18n.t('tb.continue')}
          onPress={saving ? () => {} : onContinue}
        />
      }
    >
      <Animated.View style={[styles.resultWrap, enter.style]}>
        <AppText textRole="section" style={{ color: t.color.ink, marginBottom: 20 }}>
          {i18n.t('tb.result.title')}
        </AppText>
        <View style={styles.ringWrap}>
          <View style={[styles.ringGlow, { backgroundColor: t.color.accent }]} />
          <ProgressRing progress={1} size={200} strokeWidth={16} color={t.color.accent}>
            <AppText style={styles.bigKcal}>{m ? Math.round(m.calories) : '—'}</AppText>
            <AppText textRole="helper" style={{ color: t.color.secondary }}>
              {i18n.t('tb.result.kcal')}
            </AppText>
          </ProgressRing>
        </View>
        <MacroStrip
          values={{ kcal: m?.calories ?? null, p: m?.protein ?? null, k: m?.carbs ?? null, y: m?.fat ?? null }}
          style={{ marginTop: 24, justifyContent: 'center' }}
        />
        <Button variant="text" label={i18n.t('tb.result.how')} onPress={() => setHowOpen(true)} style={{ marginTop: 16 }} />
      </Animated.View>

      <Sheet visible={howOpen} onClose={() => setHowOpen(false)} title={i18n.t('tb.how.title')}>
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <HowRow label={i18n.t('tb.how.bmr')} value={result ? `${result.bmr} kcal` : '—'} />
          <HowRow label={i18n.t('tb.how.activity')} value={result ? `+${result.tdee - result.bmr} kcal` : '—'} />
          <HowRow
            label={i18n.t('tb.how.goal')}
            value={result && m ? `${m.calories - result.tdee >= 0 ? '+' : ''}${Math.round(m.calories - result.tdee)} kcal` : '—'}
          />
          <AppText textRole="bodySm" style={{ color: t.color.secondary, marginTop: 4 }}>
            {i18n.t('tb.how.note')}
          </AppText>
          <Button label={i18n.t('tb.how.ok')} onPress={() => setHowOpen(false)} />
        </View>
      </Sheet>
    </TbScaffold>
  );
}

function HowRow({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.howRow}>
      <AppText textRole="body" style={{ color: t.color.ink }}>
        {label}
      </AppText>
      <AppText textRole="body" style={{ color: t.color.secondary }}>
        {value}
      </AppText>
    </View>
  );
}

// ── İlk adım ──────────────────────────────────────────────────────────────────
function FirstScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbFirst'>) {
  const i18n = useT();
  const t = useTheme();
  const enter = useEnter();
  const root = useRootNav(navigation);
  const { user } = useAuth();
  const draft = useTbDraft();

  const saveThen = async (go: () => void) => {
    if (user) await saveTakibeProfile(user.id, draft, nowYear());
    draft.reset();
    go();
  };

  return (
    <TbScaffold
      onSkip={() => saveThen(() => root?.navigate('Tabs', { screen: 'Tracker' }))}
      footer={
        <AppText textRole="helper" style={{ color: t.color.secondary, textAlign: 'center' }}>
          {i18n.t('tb.first.footer')}
        </AppText>
      }
    >
      <Animated.View style={enter.style}>
        <AppText textRole="screenTitle" style={styles.title}>
          {i18n.t('tb.first.title')}
        </AppText>
        <View style={[styles.rows, { marginTop: 20 }]}>
          <Card>
            <SelectRowInner
              title={i18n.t('tb.first.scan')}
              desc={i18n.t('tb.first.scan_desc')}
              onPress={() => saveThen(() => root?.navigate('AiScan'))}
            />
          </Card>
          <Card>
            <SelectRowInner
              title={i18n.t('tb.first.manual')}
              onPress={() => saveThen(() => root?.navigate('Tabs', { screen: 'Tracker' }))}
            />
          </Card>
          <Card>
            <SelectRowInner
              title={i18n.t('tb.first.discover')}
              desc={i18n.t('tb.first.discover_desc')}
              onPress={() => saveThen(() => root?.navigate('Tabs', { screen: 'Tracker' }))}
            />
          </Card>
        </View>
      </Animated.View>
    </TbScaffold>
  );
}

function SelectRowInner({ title, desc, onPress }: { title: string; desc?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={desc ? `${title}. ${desc}` : title}
      style={styles.cardRow}
    >
      <AppText textRole="section" style={{ color: t.color.ink }}>
        {title}
      </AppText>
      {desc ? (
        <AppText textRole="bodySm" style={{ color: t.color.secondary, marginTop: 2 }}>
          {desc}
        </AppText>
      ) : null}
    </Pressable>
  );
}

// ── 18 yaş engeli ─────────────────────────────────────────────────────────────
function UnderageScreen({ navigation }: NativeStackScreenProps<TbParamList, 'TbUnderage'>) {
  const i18n = useT();
  const t = useTheme();
  const enter = useEnter();
  const root = useRootNav(navigation);
  const draft = useTbDraft();
  return (
    <TbScaffold onSkip={() => root?.navigate('Tabs', { screen: 'Home' })}>
      <Animated.View style={[styles.underageWrap, enter.style]}>
        <AppText textRole="screenTitle" style={[styles.title, { textAlign: 'center' }]}>
          {i18n.t('onboarding.underage.title')}
        </AppText>
        <AppText textRole="body" style={[styles.lead, { textAlign: 'center' }]}>
          {i18n.t('onboarding.underage.sub')}
        </AppText>
        <View style={{ gap: 8, marginTop: 24 }}>
          <Button label={i18n.t('onboarding.underage.fix')} onPress={() => navigation.goBack()} />
          <Button
            variant="text"
            label={i18n.t('onboarding.underage.ok')}
            onPress={() => {
              draft.reset();
              root?.navigate('Tabs', { screen: 'Home' });
            }}
          />
        </View>
      </Animated.View>
    </TbScaffold>
  );
}

export default function TakibeBaslaNavigator({
  route,
}: NativeStackScreenProps<RootStackParamList, 'TakibeBasla'>) {
  const reset = useTbDraft((s) => s.reset);
  // Akış açılışında taslağı sıfırla (editGoal bayrağını koru).
  const editGoal = route.params?.editGoal ?? false;
  const didInit = React.useRef(false);
  if (!didInit.current) {
    didInit.current = true;
    reset(editGoal);
  }
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: DURATION.base,
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
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, height: 44 },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  title: { marginBottom: 8 },
  lead: { opacity: 0.7, marginBottom: 8 },
  rows: { gap: 12, marginTop: 16 },
  selectRow: { borderRadius: 20, paddingVertical: 18, paddingHorizontal: 18 },
  paceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  fieldLabel: { marginTop: 20, marginBottom: 8, opacity: 0.7 },
  fieldsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  input: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, height: 52, fontSize: 17, fontFamily: 'PlusJakartaSans_600SemiBold' },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  resultWrap: { alignItems: 'center', paddingTop: 12 },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, opacity: 0.16 },
  bigKcal: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 44, lineHeight: 48, color: '#0A0A0A' },
  howRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardRow: { paddingVertical: 4 },
  underageWrap: { flex: 1, justifyContent: 'center' },
});
