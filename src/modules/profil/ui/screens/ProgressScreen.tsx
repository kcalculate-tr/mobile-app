/**
 * G12-S4 — İlerleme (FinPrProgress paneli, madde 3); G15-S4: Final düzeni.
 *
 * KİLO/BMI YOK. Grafik verisi eski Kcalculate'in kalori grafiğiyle AYNI
 * sorgu (`meal_consumptions`, `dayKey.ts` ile tek günlük referans). Ölçümler
 * `body_measurements` (bel/kalça/göğüs, "yalnız sen görürsün" — burada
 * SALT OKUNUR özet; ekleme/düzenleme mevcut `MeasurementHistory` ekranına
 * yönlendirilir). Rapor indir: `exportNutritionReport.ts`.
 *
 * G15-S4: aralık hapları (seçili lime), gün başına çubuk grafik (hedefe uygun
 * = yeşil · hedef üstü = siyah · hedef altı = gri, kesik hedef çizgisi),
 * Hedef uyumu + Makro tutarlılığı yan yana kartlar, Makro dağılımı çubuğu,
 * Ölçümler satırları, siyah "Beslenme raporunu indir".
 * Tanımlar (uydurma yok, tek kural):
 *  - Hedefe uygun gün: kcal hedefin ±%15'inde. Üstü/altı buna göre.
 *  - Makro tutarlılığı: protein, karbonhidrat ve yağın HER BİRİ günlük hedefinin
 *    ±%20'sinde olan günlerin, kayıt olan günlere oranı (hedefler
 *    `get_nutrition_summary`'den; hedef yoksa kart gösterilmez).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';
import Svg, { Line } from 'react-native-svg';
import { useTheme, FinListSkeleton } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { lastDayKeys, dayKeyFromIso } from '../../../../lib/dayKey';
import { exportNutritionReport } from '../../exportNutritionReport';
import { DownloadSimple, LockSimple, Plus } from '../../../../components/icons';
import {
  FinScreen,
  FinHeader,
  FinCard,
  FinSecondaryButton,
  FinPrimaryButton,
  finExtras,
  body,
  bodyMedium,
  bodySemibold,
  bodyBold,
  heading,
} from '../finUi';

type RangeKey = 'today' | '7' | '14' | '30';
const RANGE_KEYS: RangeKey[] = ['today', '7', '14', '30'];
const RANGE_DAYS: Record<RangeKey, number> = { today: 1, '7': 7, '14': 14, '30': 30 };

type DayTotal = { date: string; kcal: number; protein: number; carbs: number; fat: number };
type Measurement = { date: string; waist_cm: number | null; hip_cm: number | null; chest_cm: number | null };

export type ProgressTargets = { kcal?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null };

const KCAL_TOL = 0.15;
const MACRO_TOL = 0.2;

export default function FinPrProgressScreen({
  onBack,
  goalKcal,
  targets,
  onAddMeasurement,
  vitrinDays,
  vitrinMeasurements,
}: {
  onBack: () => void;
  goalKcal?: number | null;
  /** Makro hedefleri (get_nutrition_summary) — Makro tutarlılığı için. */
  targets?: ProgressTargets;
  onAddMeasurement: () => void;
  /** YALNIZ dev vitrini: Final örneğiyle aynı içerikte gün verisi. */
  vitrinDays?: DayTotal[];
  /** YALNIZ dev vitrini: örnek ölçümler. */
  vitrinMeasurements?: Measurement[];
}) {
  const t = useTheme();
  const x = finExtras(t);
  const { t: tr, lang } = useT();
  const { user } = useAuth();

  const [rangeIndex, setRangeIndex] = useState(1); // 7 gün varsayılan
  const range: RangeKey = RANGE_KEYS[rangeIndex];
  const [loading, setLoading] = useState(!vitrinDays);
  const [days, setDays] = useState<DayTotal[]>(vitrinDays ?? []);
  const [measurements, setMeasurements] = useState<Measurement[]>(vitrinMeasurements ?? []);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (vitrinDays) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = getSupabaseClient();
      const n = RANGE_DAYS[range];
      const keys = lastDayKeys(n);
      const since = `${keys[0]}T00:00:00.000Z`;
      const { data } = await supabase
        .from('meal_consumptions')
        .select('consumed_at, calories, protein, carbs, fat')
        .eq('user_id', user.id)
        .gte('consumed_at', since)
        .order('consumed_at', { ascending: true });

      const map: Record<string, DayTotal> = {};
      for (const k of keys) map[k] = { date: k, kcal: 0, protein: 0, carbs: 0, fat: 0 };
      for (const row of data ?? []) {
        const k = dayKeyFromIso(String(row.consumed_at));
        if (!map[k]) continue;
        map[k].kcal += Number(row.calories ?? 0);
        map[k].protein += Number(row.protein ?? 0);
        map[k].carbs += Number(row.carbs ?? 0);
        map[k].fat += Number(row.fat ?? 0);
      }

      const { data: measureData } = await supabase
        .from('body_measurements')
        .select('date,waist_cm,hip_cm,chest_cm')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(2);

      if (!cancelled) {
        setDays(keys.map((k) => map[k]));
        setMeasurements((measureData as Measurement[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, range, vitrinDays]);

  const activeDays = days.filter((d) => d.kcal > 0);
  const avgKcal =
    activeDays.length > 0 ? Math.round(activeDays.reduce((s, d) => s + d.kcal, 0) / activeDays.length) : 0;
  const goal = goalKcal ?? 0;
  const within = (v: number, target: number, tol: number) => Math.abs(v - target) / target <= tol;
  const goalMatchPct =
    goal > 0 && activeDays.length > 0
      ? Math.round((activeDays.filter((d) => within(d.kcal, goal, KCAL_TOL)).length / activeDays.length) * 100)
      : 0;
  const hasMacroTargets = !!(targets?.protein && targets?.carbs && targets?.fat);
  const macroConsistencyPct =
    hasMacroTargets && activeDays.length > 0
      ? Math.round(
          (activeDays.filter(
            (d) =>
              within(d.protein, targets!.protein as number, MACRO_TOL) &&
              within(d.carbs, targets!.carbs as number, MACRO_TOL) &&
              within(d.fat, targets!.fat as number, MACRO_TOL),
          ).length /
            activeDays.length) *
            100,
        )
      : 0;

  const macroTotals = useMemo(() => {
    const sums = activeDays.reduce(
      (acc, d) => ({ protein: acc.protein + d.protein, carbs: acc.carbs + d.carbs, fat: acc.fat + d.fat }),
      { protein: 0, carbs: 0, fat: 0 },
    );
    const total = sums.protein + sums.carbs + sums.fat;
    if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
    return {
      protein: Math.round((sums.protein / total) * 100),
      carbs: Math.round((sums.carbs / total) * 100),
      fat: Math.round((sums.fat / total) * 100),
    };
  }, [activeDays]);

  const latest = measurements[0];

  const handleExport = async () => {
    if (!user?.id || exporting) return;
    setExporting(true);
    try {
      await exportNutritionReport({
        userName: String(user.user_metadata?.full_name || user.email || '').trim() || 'Kullanıcı',
        userEmail: user.email || '—',
        rangeLabel: tr(`profil.range_${range === 'today' ? 'today' : range}`),
        days,
        measurements,
      });
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : tr('profil.progress'));
    } finally {
      setExporting(false);
    }
  };

  // --- Çubuk grafik ---
  const CHART_H = 120;
  const maxVal = Math.max(goal * 1.25, ...days.map((d) => d.kcal), 1);
  const barColor = (kcal: number) => {
    if (kcal <= 0) return x.track;
    if (goal <= 0) return t.color.accentLine;
    if (within(kcal, goal, KCAL_TOL)) return t.color.accentLine;
    return kcal > goal ? t.color.ink : x.line2;
  };
  const labelFor = (key: string, i: number) => {
    const [yy, mm, dd] = key.split('-').map(Number);
    const d = new Date(yy, mm - 1, dd);
    if (days.length <= 7) return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { weekday: 'short' });
    const step = days.length <= 14 ? 2 : 5;
    return (days.length - 1 - i) % step === 0 ? String(dd) : '';
  };

  const Legend = ({ color, label }: { color: string; label: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontFamily: body, fontSize: 12, color: t.color.secondary }}>{label}</Text>
    </View>
  );

  const MeasureRow = ({ label, value, first }: { label: string; value: number | null | undefined; first?: boolean }) => (
    <View
      style={{
        height: 54,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.color.line,
      }}
    >
      <Text style={{ fontFamily: bodyMedium, fontSize: 15, color: t.color.ink }}>{label}</Text>
      <Text style={{ fontFamily: bodyBold, fontSize: 15, color: t.color.ink }}>{value != null ? `${value} cm` : '—'}</Text>
    </View>
  );

  return (
    <FinScreen scroll contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.progress')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 14 }}>
        {/* Aralık hapları — seçili lime. */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {RANGE_KEYS.map((k, i) => {
            const on = i === rangeIndex;
            return (
              <Pressable
                key={k}
                onPress={() => setRangeIndex(i)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{
                  height: 44,
                  paddingHorizontal: 18,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? t.color.accent : t.color.surface,
                }}
              >
                <Text style={{ fontFamily: bodySemibold, fontSize: 14, color: on ? t.color.onAccent : t.color.ink }}>
                  {tr(`profil.range_${k}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <FinListSkeleton rows={4} style={{ paddingHorizontal: 0 }} />
        ) : activeDays.length === 0 ? (
          <FinCard>
            <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center' }}>
              {tr('profil.no_progress_data')}
            </Text>
          </FinCard>
        ) : (
          <>
            <FinCard style={{ gap: 8, padding: 16 }}>
              <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }}>{tr('profil.calories')}</Text>
              <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
                <Text style={{ fontFamily: heading, fontSize: 28, color: t.color.ink }}>{avgKcal}</Text> {tr('profil.daily_avg')}
              </Text>
              <View style={{ marginTop: 12, height: CHART_H + 22 }}>
                <View style={{ height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' }}>
                  {days.map((d) => (
                    <View
                      key={d.date}
                      style={{
                        width: days.length > 14 ? 5 : days.length > 7 ? 12 : 24,
                        height: Math.max(6, (d.kcal / maxVal) * CHART_H),
                        borderRadius: days.length > 7 ? 3 : 8,
                        backgroundColor: barColor(d.kcal),
                      }}
                    />
                  ))}
                </View>
                {goal > 0 ? (
                  <Svg
                    width="100%"
                    height={2}
                    style={{ position: 'absolute', left: 0, right: 0, top: CHART_H - (goal / maxVal) * CHART_H }}
                  >
                    <Line x1="0" y1="1" x2="100%" y2="1" stroke={x.line2} strokeWidth={1} strokeDasharray="3 3" />
                  </Svg>
                ) : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 6 }}>
                  {days.map((d, i) => (
                    <Text
                      key={d.date}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        fontFamily: body,
                        fontSize: 12,
                        color: t.color.secondary,
                      }}
                      numberOfLines={1}
                    >
                      {labelFor(d.date, i)}
                    </Text>
                  ))}
                </View>
              </View>
              {goal > 0 ? (
                <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
                  <Legend color={t.color.accentLine} label={tr('profil.legend_on')} />
                  <Legend color={t.color.ink} label={tr('profil.legend_over')} />
                  <Legend color={x.line2} label={tr('profil.legend_under')} />
                </View>
              ) : null}
            </FinCard>

            {goal > 0 || hasMacroTargets ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {goal > 0 ? (
                  <FinCard style={{ flex: 1, gap: 4, padding: 16 }}>
                    <Text style={{ fontFamily: bodySemibold, fontSize: 13, color: t.color.ink }}>{tr('profil.goal_match')}</Text>
                    <Text style={{ fontFamily: heading, fontSize: 28, color: t.color.ink }}>%{goalMatchPct}</Text>
                    <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{tr('profil.goal_match_sub')}</Text>
                  </FinCard>
                ) : null}
                {hasMacroTargets ? (
                  <FinCard style={{ flex: 1, gap: 4, padding: 16 }}>
                    <Text style={{ fontFamily: bodySemibold, fontSize: 13, color: t.color.ink }}>{tr('profil.macro_consistency')}</Text>
                    <Text style={{ fontFamily: heading, fontSize: 28, color: t.color.ink }}>%{macroConsistencyPct}</Text>
                    <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{tr('profil.macro_consistency_sub')}</Text>
                  </FinCard>
                ) : null}
              </View>
            ) : null}

            <FinCard style={{ gap: 12, padding: 16 }}>
              <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }}>{tr('profil.macro_dist')}</Text>
              <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: x.track }}>
                <View style={{ flex: macroTotals.protein || 0.001, backgroundColor: t.color.ink }} />
                <View style={{ flex: macroTotals.carbs || 0.001, backgroundColor: t.color.secondary }} />
                <View style={{ flex: macroTotals.fat || 0.001, backgroundColor: x.line2 }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {[
                  { c: t.color.ink, l: tr('profil.macro_protein'), v: macroTotals.protein },
                  { c: t.color.secondary, l: tr('profil.macro_carb'), v: macroTotals.carbs },
                  { c: x.line2, l: tr('profil.macro_fat'), v: macroTotals.fat },
                ].map((m) => (
                  <View key={m.l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.c }} />
                    <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>{m.l}</Text>
                    <Text style={{ fontFamily: bodyBold, fontSize: 13, color: t.color.ink }}>%{m.v}</Text>
                  </View>
                ))}
              </View>
            </FinCard>
          </>
        )}

        <FinCard style={{ gap: 4, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontFamily: heading, fontSize: 20, color: t.color.ink }}>{tr('profil.measurements')}</Text>
            <View
              style={{
                height: 28,
                paddingHorizontal: 10,
                borderRadius: 14,
                backgroundColor: t.color.line,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <LockSimple size={13} color={t.color.ink} />
              <Text style={{ fontFamily: bodySemibold, fontSize: 12, color: t.color.ink }}>{tr('profil.only_you_see')}</Text>
            </View>
          </View>
          <MeasureRow first label={tr('profil.measure_waist')} value={latest?.waist_cm} />
          <MeasureRow label={tr('profil.measure_hip')} value={latest?.hip_cm} />
          <MeasureRow label={tr('profil.measure_chest')} value={latest?.chest_cm} />
          <FinSecondaryButton
            label={tr('profil.add_measurement')}
            onPress={onAddMeasurement}
            height={52}
            icon={<Plus size={16} color={t.color.ink} weight="bold" />}
            style={{ marginTop: 8 }}
          />
        </FinCard>

        <FinPrimaryButton
          label={tr('profil.download_report')}
          onPress={handleExport}
          icon={exporting ? <ActivityIndicator color={t.color.bg} /> : <DownloadSimple size={18} color={t.color.bg} weight="bold" />}
        />
      </View>
    </FinScreen>
  );
}
