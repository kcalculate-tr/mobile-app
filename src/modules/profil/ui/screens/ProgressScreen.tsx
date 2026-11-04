/**
 * G12-S4 — İlerleme (FinPrProgress paneli, madde 3).
 *
 * KİLO/BMI YOK. Grafik verisi eski Kcalculate'in kalori grafiğiyle AYNI
 * sorgu (`meal_consumptions`, `dayKey.ts` ile tek günlük referans — bkz.
 * `src/screens/ProfileScreen.tsx`ın eski `fetchData`'sı). Ölçümler
 * `body_measurements` (bel/kalça/göğüs, "yalnız sen görürsün" — burada
 * SALT OKUNUR özet; ekleme/düzenleme mevcut `MeasurementHistory` ekranına
 * yönlendirilir, yeniden inşa edilmez). Rapor indir: `exportNutritionReport.ts`
 * (bkz. o dosyadaki ENTEGRASYONA notu — TrackerScreen'in private closure'ı
 * dışa verilmediği için eşdeğer, bağımsız bir üretici kullanılır).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { lastDayKeys, dayKeyFromIso } from '../../../../lib/dayKey';
import { exportNutritionReport } from '../../exportNutritionReport';
import { DownloadSimple } from '../../../../components/icons';
import {
  FinScreen,
  FinHeader,
  FinCard,
  FinSectionLabel,
  FinSegmented,
  FinSecondaryButton,
  finExtras,
  body,
  bodyMedium,
  bodySemibold,
  bodyBold,
} from '../finUi';

type RangeKey = 'today' | '7' | '14' | '30';
const RANGE_DAYS: Record<RangeKey, number> = { today: 1, '7': 7, '14': 14, '30': 30 };

type DayTotal = { date: string; kcal: number; protein: number; carbs: number; fat: number };
type Measurement = { date: string; waist_cm: number | null; hip_cm: number | null; chest_cm: number | null };

export default function FinPrProgressScreen({
  onBack,
  goalKcal,
  onAddMeasurement,
}: {
  onBack: () => void;
  goalKcal?: number | null;
  onAddMeasurement: () => void;
}) {
  const t = useTheme();
  const x = finExtras(t);
  const { t: tr } = useT();
  const { user } = useAuth();

  const [rangeIndex, setRangeIndex] = useState(1); // 7 gün varsayılan
  const range: RangeKey = (['today', '7', '14', '30'] as RangeKey[])[rangeIndex];
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DayTotal[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
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
  }, [user?.id, range]);

  const activeDays = days.filter((d) => d.kcal > 0);
  const avgKcal = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + d.kcal, 0) / activeDays.length)
    : 0;
  const goal = goalKcal ?? 0;
  const goalMatchPct = goal > 0 && activeDays.length > 0
    ? Math.round((activeDays.filter((d) => Math.abs(d.kcal - goal) / goal <= 0.15).length / activeDays.length) * 100)
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
  const prev = measurements[1];
  const diff = (a: number | null | undefined, b: number | null | undefined) =>
    a != null && b != null ? Math.round((a - b) * 10) / 10 : null;

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

  return (
    <FinScreen scroll contentStyle={{ paddingTop: 0 }}>
      <FinHeader title={tr('profil.progress')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        <FinSegmented
          options={[tr('profil.range_today'), tr('profil.range_7'), tr('profil.range_14'), tr('profil.range_30')]}
          index={rangeIndex}
          onChange={setRangeIndex}
        />

        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={t.color.accent} size="large" />
          </View>
        ) : activeDays.length === 0 ? (
          <FinCard>
            <Text style={{ fontFamily: body, fontSize: 14, color: t.color.secondary, textAlign: 'center' }}>
              {tr('profil.no_progress_data')}
            </Text>
          </FinCard>
        ) : (
          <>
            <FinCard style={{ gap: 4 }}>
              <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}>
                {tr('profil.calories')}
              </Text>
              <Text style={{ fontFamily: bodyBold, fontSize: 28, color: t.color.ink }}>
                {avgKcal} <Text style={{ fontFamily: bodyMedium, fontSize: 14, color: t.color.secondary }}>{tr('profil.daily_avg')}</Text>
              </Text>
            </FinCard>

            {goal > 0 ? (
              <FinCard style={{ gap: 4 }}>
                <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}>
                  {tr('profil.goal_match')}
                </Text>
                <Text style={{ fontFamily: bodyBold, fontSize: 22, color: t.color.accent }}>{goalMatchPct}%</Text>
                <Text style={{ fontFamily: body, fontSize: 12, color: t.color.secondary }}>
                  {tr('profil.goal_match_sub')}
                </Text>
              </FinCard>
            ) : null}

            <FinCard style={{ gap: 10 }}>
              <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.ink }}>
                {tr('profil.macro_dist')}
              </Text>
              <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: x.track }}>
                <View style={{ flex: macroTotals.protein || 0.001, backgroundColor: t.color.accent }} />
                <View style={{ flex: macroTotals.carbs || 0.001, backgroundColor: t.color.ink }} />
                <View style={{ flex: macroTotals.fat || 0.001, backgroundColor: t.color.secondary }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.secondary }}>
                  {tr('profil.macro_protein')} {macroTotals.protein}%
                </Text>
                <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.secondary }}>
                  {tr('profil.macro_carb')} {macroTotals.carbs}%
                </Text>
                <Text style={{ fontFamily: bodyMedium, fontSize: 12, color: t.color.secondary }}>
                  {tr('profil.macro_fat')} {macroTotals.fat}%
                </Text>
              </View>
            </FinCard>
          </>
        )}

        <FinSectionLabel>{tr('profil.measurements')}</FinSectionLabel>
        <FinCard style={{ gap: 10 }}>
          <Text style={{ fontFamily: body, fontSize: 12, color: t.color.secondary }}>
            {tr('profil.only_you_see')}
          </Text>
          {latest ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <MeasureCol label={tr('profil.measure_waist')} value={latest.waist_cm} delta={diff(latest.waist_cm, prev?.waist_cm)} />
              <MeasureCol label={tr('profil.measure_hip')} value={latest.hip_cm} delta={diff(latest.hip_cm, prev?.hip_cm)} />
              <MeasureCol label={tr('profil.measure_chest')} value={latest.chest_cm} delta={diff(latest.chest_cm, prev?.chest_cm)} />
            </View>
          ) : (
            <Text style={{ fontFamily: body, fontSize: 13, color: t.color.secondary }}>
              {tr('profil.no_progress_data')}
            </Text>
          )}
          <FinSecondaryButton label={tr('profil.add_measurement')} onPress={onAddMeasurement} />
        </FinCard>

        <FinSecondaryButton
          label={tr('profil.download_report')}
          onPress={handleExport}
          icon={exporting ? <ActivityIndicator color={t.color.ink} /> : <DownloadSimple size={18} color={t.color.ink} weight="bold" />}
        />
      </View>
    </FinScreen>
  );
}

function MeasureCol({ label, value, delta }: { label: string; value: number | null; delta: number | null }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
      <Text style={{ fontFamily: bodyBold, fontSize: 18, color: t.color.ink }}>
        {value != null ? `${value} cm` : '—'}
      </Text>
      <Text style={{ fontFamily: bodyMedium, fontSize: 11, color: t.color.secondary }}>{label}</Text>
      {delta != null ? (
        <Text style={{ fontFamily: bodyMedium, fontSize: 11, color: delta < 0 ? t.color.accent : t.color.secondary }}>
          {delta > 0 ? '+' : ''}{delta}
        </Text>
      ) : null}
    </View>
  );
}
