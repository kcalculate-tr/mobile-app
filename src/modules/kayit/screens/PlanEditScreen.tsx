// G54-S1 md.5 — Kayıt sonrası düzenleme: TEK SAYFA özet ("Planımı düzenle"). Kişisel planım › Düzenle,
// Profil › Hedefim / Kişisel bilgiler buraya gelir (`yeni_kayit` açıkken; gateRouter `PersonalPlanEdit` → `KayitEdit`).
//  · Gruplu satırlar: Hedef · Cinsiyet · Doğum yılı · Boy · Kilo · Hedef kilo · Tempo · Aktivite · Spor · Beslenme tipi
//    · Mutfaklar · Yemediklerin · Öğün sayısı · Pişirme · Zorlandıkların (hedef kilo/tempo kayıttaki aynı koşulla).
//  · Satır → o sorunun KAYIT AKIŞINDAKİ bileşeni alttan sayfada (değer seçili) → "Kaydet" özeti günceller.
//  · Alttaki lime "Değişiklikleri kaydet": kalori/makro kayıttaki AYNI hesapla (computeKayitPlan) yeniden hesaplanır,
//    önce → sonra özeti + onay; kaydedince personal_plan + profil hedefleri (savePlan). Paywall YOK (T1 çağrılmaz).
//  · Kaydedilmemiş değişiklikle çıkış → "Değişiklikler kaydedilmedi" onayı. Sağlık rızası tekrar sorulmaz.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Sheet, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CaretRight } from '../../../components/icons';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import { useMyPlan, useMyPlanStore } from '../../personalPlan/useMyPlan';
import { effectiveTargets, type PpSaved } from '../../personalPlan/types';
import { isoDay } from '../../personalPlan/calc';
import { FONT, KBackdrop, KButton, KText as AppText, NoticeCard, TopBar } from '../ui/parts';
import { useK } from '../ui/theme';
import { EDIT_GROUPS, answersDirty, computeKayitPlan, editDiff, fromPpSaved, toPpSaved, visibleEditRows, type EditRowKey } from '../plan';
import { mealsSplit, type KAnswers, type KQuestion } from '../model';
import { fmtHeight, fmtPace, fmtWeight } from '../format';
import { dislikeLabel } from '../foods';
import { readMuscleSurplus } from '../settings';
import { QuestionEditor } from './QuestionsScreen';

type T = (k: string, p?: Record<string, unknown>) => string;

const ROW_STEP: Record<EditRowKey, KQuestion> = {
  goal: 'goal',
  gender: 'gender',
  birth: 'birth',
  height: 'height',
  weight: 'weight',
  target: 'target',
  pace: 'pace',
  activity: 'activity',
  sport: 'sport',
  diet: 'diet',
  cuisines: 'cuisines',
  dislikes: 'dislikes',
  meals: 'meals',
  cooking: 'cooking',
  struggle: 'struggle',
};

const list = (xs: string[], t: T): string => (xs.length <= 2 ? xs.join(', ') : `${xs.slice(0, 2).join(', ')} ${t('kayit.edit.more', { n: xs.length - 2 })}`);

/** Satır değeri (kayıt metinleriyle). */
export function rowValue(r: EditRowKey, a: KAnswers, t: T, lang: string): string | null {
  switch (r) {
    case 'goal':
      return a.goal ? t(`kayit.q.goal_${a.goal}`) : null;
    case 'gender':
      return a.gender ? t(`kayit.q.gender_${a.gender}`) : null;
    case 'birth':
      return a.birthYear ? String(a.birthYear) : null;
    case 'height': {
      if (!a.heightCm) return null;
      const h = fmtHeight(a.heightCm, a.units);
      return `${h.value} ${h.unit}`;
    }
    case 'weight':
    case 'target': {
      const v = r === 'weight' ? a.weightKg : a.targetWeightKg;
      if (v == null) return null;
      const w = fmtWeight(v, a.units, lang);
      return `${w.value} ${w.unit}`;
    }
    case 'pace':
      return t(a.goal === 'gain' ? 'kayit.q.pace_unit_gain' : 'kayit.q.pace_unit', { v: fmtPace(a.pace, lang) });
    case 'activity':
      return a.activity ? t(`kayit.q.act_${a.activity}`) : null;
    case 'sport':
      if (a.noSport) return t('kayit.q.no_sport');
      if (!a.sportDays.length) return null;
      return [t('kayit.q.days_count', { n: a.sportDays.length }), ...a.sports.map((s) => t(`kayit.q.sport_${s}`))].slice(0, 3).join(', ');
    case 'diet':
      return a.diet ? t(`kayit.q.diet_${a.diet}`) : null;
    case 'cuisines':
      return a.cuisines.length ? list(a.cuisines.map((c) => t(`kayit.q.cuisine_${c}`)), t) : t('kayit.q.cuisines_none');
    case 'dislikes':
      if (a.eatsAll) return t('kayit.q.eats_all');
      return a.dislikes.length ? list(a.dislikes.map((d) => dislikeLabel(d, lang)), t) : null;
    case 'meals':
      return String(a.meals);
    case 'cooking':
      return a.cooking ? t(`kayit.q.cook_${a.cooking}`) : null;
    case 'struggle':
      return a.struggle ? t(`kayit.q.st_${a.struggle}`) : null;
  }
}

/** Taslak cevaplar → kaydedilecek plan (kayıttaki aynı hesap; hatırlatma, ölçü, alerjen ve öğün saatleri korunur). */
export function buildEdited(saved: PpSaved, draft: KAnswers, muscleSurplus: number | undefined, now: Date = new Date()) {
  const startIso = saved.startedAt || isoDay(now);
  const plan = computeKayitPlan(draft, { currentYear: now.getFullYear(), startIso, muscleSurplus });
  if (!plan) return null;
  const k = (saved.kayit ?? {}) as { start?: unknown };
  const built = toPpSaved(draft, plan, { startIso, nowIso: now.toISOString(), start: (typeof k.start === 'string' ? k.start : null) as never });
  const split = mealsSplit(draft.meals);
  const next: PpSaved = {
    ...built,
    answers: {
      ...built.answers,
      reminders: saved.answers.reminders,
      measures: saved.answers.measures,
      measuresSkipped: saved.answers.measuresSkipped,
      allergens: saved.answers.allergens,
      steps: saved.answers.steps,
      exerciseMinutes: saved.answers.exerciseMinutes,
      meals: { ...saved.answers.meals, main: split.main, snack: split.snack },
    },
    startWeightKg: saved.startWeightKg || built.startWeightKg,
  };
  return { plan, next };
}

export default function PlanEditScreen() {
  const { t, lang } = useT();
  const P = useK();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { uid, saved, loaded } = useMyPlan();
  const initial = useMemo(() => (saved ? fromPpSaved(saved) : null), [saved]);
  const [draft, setDraft] = useState<KAnswers | null>(initial);
  const [editing, setEditing] = useState<EditRowKey | null>(null);
  const [sheetDraft, setSheetDraft] = useState<KAnswers | null>(null);
  const [confirm, setConfirm] = useState<{ from: number; to: number; changed: boolean; macros: { protein: number; carbs: number; fat: number }; next: PpSaved } | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const surplus = useRef<number | undefined>(undefined);
  const leaving = useRef(false);

  useEffect(() => {
    if (!draft && initial) setDraft(initial);
  }, [initial, draft]);
  useEffect(() => {
    void readMuscleSurplus()
      .then((v) => {
        surplus.current = v;
      })
      .catch(() => undefined);
  }, []);

  const dirty = !!(draft && initial && answersDirty(draft, initial));
  const t2 = t as unknown as T;

  // Kaydedilmemiş değişiklikle çıkış (geri oku, kenardan kaydırma, Android geri) → onay.
  useEffect(() => {
    const off = navigation.addListener?.('beforeRemove', (e: { preventDefault: () => void }) => {
      if (!dirty || leaving.current) return;
      e.preventDefault();
      setUnsaved(true);
    });
    return off;
  }, [navigation, dirty]);

  const back = () => {
    if (dirty) {
      setUnsaved(true);
      return;
    }
    navigation.goBack();
  };

  const open = (r: EditRowKey) => {
    if (!draft) return;
    haptic('selection');
    setSheetDraft(draft);
    setEditing(r);
  };
  const applySheet = () => {
    if (sheetDraft) setDraft(sheetDraft);
    setEditing(null);
  };

  const review = () => {
    if (!saved || !draft) return;
    const r = buildEdited(saved, draft, surplus.current);
    if (!r) return;
    setConfirm({ ...editDiff(effectiveTargets(saved), r.plan), next: r.next });
  };
  const save = async () => {
    if (!uid || !confirm) return;
    setBusy(true);
    setErr(false);
    const res = await useMyPlanStore.getState().save(uid, confirm.next);
    setBusy(false);
    if (!res.ok) {
      haptic('warning');
      setErr(true);
      setConfirm(null);
      return;
    }
    haptic('success');
    setConfirm(null);
    leaving.current = true;
    navigation.goBack();
  };

  const canCalc = !!(saved && draft && computeKayitPlan(draft, { currentYear: new Date().getFullYear(), startIso: saved.startedAt || isoDay(new Date()) }));
  const rows = draft ? visibleEditRows(draft) : [];

  return (
    <View style={{ flex: 1 }} testID="kayit-edit">
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      <KBackdrop shift={8} />
      <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
        <TopBar onBack={back} />
        <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <AppText accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.h1, { color: P.ink }]}>
            {t('kayit.edit.title')}
          </AppText>
          <AppText maxFontSizeMultiplier={1.5} style={[styles.sub, { color: P.sec }]}>
            {t('kayit.edit.sub')}
          </AppText>
          {err ? (
            <View style={{ marginTop: 14 }}>
              <NoticeCard testID="kayit-edit-error" tone="error" title={t('kayit.edit.save_error')} />
            </View>
          ) : null}
          {loaded && !saved ? (
            <View style={{ marginTop: 18 }}>
              <NoticeCard title={t('kayit.edit.incomplete')} />
            </View>
          ) : null}
          {draft
            ? EDIT_GROUPS.map((g) => {
                const rs = g.rows.filter((r) => rows.includes(r));
                if (!rs.length) return null;
                return (
                  <View key={g.key} style={{ marginTop: 22, gap: 8 }} testID={`kayit-edit-group-${g.key}`}>
                    <AppText accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.group, { color: P.sec }]}>
                      {t(`kayit.edit.g_${g.key}`)}
                    </AppText>
                    <View style={[styles.card, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
                      {rs.map((r, i) => {
                        const v = rowValue(r, draft, t2, lang);
                        const label = t(`kayit.edit.r_${r}`);
                        const shown = v ?? t('kayit.edit.empty');
                        return (
                          <Pressable
                            key={r}
                            testID={`kayit-edit-row-${r}`}
                            onPress={() => open(r)}
                            accessibilityRole="button"
                            accessibilityLabel={t('kayit.edit.row_a11y', { label, value: shown })}
                            style={({ pressed }) => [styles.row, i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.ringTrack } : null, pressed ? { opacity: 0.7 } : null]}
                          >
                            <AppText maxFontSizeMultiplier={1.4} style={[styles.rowLabel, { color: P.ink }]}>
                              {label}
                            </AppText>
                            <AppText testID={`kayit-edit-value-${r}`} maxFontSizeMultiplier={1.4} style={[styles.rowValue, { color: v ? P.sec : P.danger }]}>
                              {shown}
                            </AppText>
                            <CaretRight size={16} color={P.sec} />
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            : null}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 8 }}>
          {dirty && !canCalc ? (
            <AppText maxFontSizeMultiplier={1.4} style={[styles.note, { color: P.sec }]}>
              {t('kayit.edit.incomplete')}
            </AppText>
          ) : null}
          <KButton testID="kayit-edit-save" label={t('kayit.edit.save_all')} onPress={review} disabled={!dirty || !canCalc} loading={busy} />
        </View>
      </View>

      {/* Satır düzenleyici: kayıt akışındaki bileşen, alttan sayfa. */}
      <Modal visible={editing != null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(null)}>
        <View style={{ flex: 1 }} testID="kayit-edit-sheet">
          <KBackdrop shift={3} />
          <View style={styles.sheetTop}>
            <Pressable onPress={() => setEditing(null)} accessibilityRole="button" accessibilityLabel={t('kayit.edit.sheet_cancel')} style={styles.sheetBtn} testID="kayit-edit-sheet-cancel">
              <AppText maxFontSizeMultiplier={1.4} style={[styles.sheetBtnText, { color: P.ink }]}>
                {t('kayit.edit.sheet_cancel')}
              </AppText>
            </Pressable>
          </View>
          {editing && sheetDraft ? (
            <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              <QuestionEditor step={ROW_STEP[editing]} answers={sheetDraft} onChange={setSheetDraft} />
            </ScrollView>
          ) : null}
          <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
            <KButton testID="kayit-edit-sheet-save" label={t('kayit.edit.sheet_save')} onPress={applySheet} />
          </View>
        </View>
      </Modal>

      <Sheet visible={confirm != null} onClose={() => setConfirm(null)} testID="kayit-edit-confirm">
        {confirm ? (
          <View style={{ gap: 10, paddingBottom: 4 }}>
            <AppText accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.confirmTitle, { color: P.ink }]}>
              {t('kayit.edit.confirm_title')}
            </AppText>
            <AppText testID="kayit-edit-confirm-kcal" maxFontSizeMultiplier={1.4} style={[styles.confirmKcal, { color: P.ink }]}>
              {confirm.changed ? t('kayit.edit.confirm_kcal', { from: confirm.from, to: confirm.to }) : t('kayit.edit.confirm_same', { to: confirm.to })}
            </AppText>
            <AppText maxFontSizeMultiplier={1.5} style={[styles.sub, { color: P.sec, marginTop: 0 }]}>
              {t('kayit.edit.confirm_macros', { p: confirm.macros.protein, c: confirm.macros.carbs, f: confirm.macros.fat })}
            </AppText>
            <View style={{ marginTop: 10, gap: 4 }}>
              <KButton testID="kayit-edit-confirm-ok" label={t('kayit.edit.confirm_ok')} onPress={() => void save()} loading={busy} />
              <Pressable onPress={() => setConfirm(null)} accessibilityRole="button" accessibilityLabel={t('kayit.edit.confirm_back')} style={styles.textBtn} testID="kayit-edit-confirm-back">
                <AppText maxFontSizeMultiplier={1.4} style={[styles.textBtnText, { color: P.ink }]}>
                  {t('kayit.edit.confirm_back')}
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={unsaved} onClose={() => setUnsaved(false)} testID="kayit-edit-unsaved">
        <View style={{ gap: 10, paddingBottom: 4 }}>
          <AppText accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.confirmTitle, { color: P.ink }]}>
            {t('kayit.edit.unsaved_title')}
          </AppText>
          <AppText maxFontSizeMultiplier={1.5} style={[styles.sub, { color: P.sec, marginTop: 0 }]}>
            {t('kayit.edit.unsaved_body')}
          </AppText>
          <View style={{ marginTop: 10, gap: 4 }}>
            <KButton testID="kayit-edit-unsaved-stay" label={t('kayit.edit.unsaved_stay')} onPress={() => setUnsaved(false)} />
            <Pressable
              onPress={() => {
                setUnsaved(false);
                leaving.current = true;
                navigation.goBack();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('kayit.edit.unsaved_leave')}
              style={styles.textBtn}
              testID="kayit-edit-unsaved-leave"
            >
              <AppText maxFontSizeMultiplier={1.4} style={[styles.textBtnText, { color: P.ink }]}>
                {t('kayit.edit.unsaved_leave')}
              </AppText>
            </Pressable>
          </View>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: FONT.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, marginTop: 4 },
  sub: { fontFamily: FONT.body, fontSize: 15, lineHeight: 21, marginTop: 6 },
  group: { fontFamily: FONT.semi, fontSize: 13, lineHeight: 18, letterSpacing: 0.2, textTransform: 'uppercase' },
  card: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingVertical: 10 },
  rowLabel: { fontFamily: FONT.semi, fontSize: 16, lineHeight: 21, flexShrink: 0, maxWidth: '45%' },
  rowValue: { flex: 1, fontFamily: FONT.body, fontSize: 15, lineHeight: 20, textAlign: 'right' },
  note: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  sheetTop: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 10 },
  sheetBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  sheetBtnText: { fontFamily: FONT.semi, fontSize: 16, lineHeight: 21 },
  confirmTitle: { fontFamily: FONT.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  confirmKcal: { fontFamily: FONT.bold, fontSize: 18, lineHeight: 24 },
  textBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  textBtnText: { fontFamily: FONT.semi, fontSize: 16, lineHeight: 21 },
});
