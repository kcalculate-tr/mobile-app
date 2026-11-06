// TrackerDayHeader — yeni kabuk (yeni_kabuk) açıkken Ana sayfa (Tracker) üst
// bölümü. Bayrak KAPALIYKEN TrackerScreen bu bileşeni HİÇ render etmez; eski
// davranış bayt bayt korunur (bkz. TrackerScreen).
//
// İçerik (G11-S4 madde 2):
//  • Gün halkası şeridi (gun_halkasi) — GunRingStrip + GunViewer modalı.
//  • Günlük halka dolumu imza anı: ProgressRing (#4A6B00 kontur → lime dolum,
//    TIMING.dailyRing) + merkez sayı RollingNumber (Orta yuvarlanma) + dolunca
//    tek nefes (usePop → scale 1→1.08→1, hero haptik).
//  • Logla izi: LogTrail (logToken değişince) + zaman hapı toast "Öğle’ye loglandı".
//  • Seri anı: yalnız streak>0 → seri çipi. Veri yoksa HİÇ gösterilmez (uydurma yok).
//  • Etkinlik girişi (etkinlik): S3'ün TrackerActivityEntry'si — yerleşim TrackerScreen'de.
//  • Akşam + boş gün sessiz an: "Yarın yeni halka." (isSilentEvening).
//
// Hareket yalnız core/design/motion token/hook'ları + core/design imza bileşenleri.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  AppText,
  ProgressRing,
  Toast,
  LogTrail,
  useTheme,
  usePop,
  haptic,
} from '../../core/design';
import { useT } from '../../core/i18n';
import { useFeature } from '../../core/flags';
import { Bell, TrophyIcon } from '../../components/icons';
import { getGunClient } from '../../modules/gun';
import type { DayRing, DayCard } from '../../modules/gun';
import { GunRingStrip, GunViewer, RollingNumber } from '../../modules/gun/ui';
import { isSilentEvening, type NumLang } from '../../modules/gun/motion';
import { inferMealTypeFromHour } from '../../modules/ai/scan/mealTypeFromHour';
import { FinTopBlock } from './FinTopBlock';

export interface TrackerDayHeaderProps {
  /** Bugün tüketilen kcal (todayMacros.kcal). */
  kcal: number;
  /** Günlük hedef kcal (targets.kcal). */
  target: number;
  /** Logla izi tetikleyici — öğün kaydedilince TrackerScreen artırır. */
  logToken?: number;
  /** Son loglanan öğünün zaman hapı etiketi (ör. "Öğle"). Verilmezse saatten. */
  lastMealLabel?: string | null;
  /** Saat (0–23) — sessiz an koşulu. Dışarıdan verilmezse yerel saat. */
  hour?: number;
  /**
   * G14-S1 (FinHomeR3): makro özetleri. Verilirse üst blok Final düzeninde
   * çizilir — Enerji halkası (yüzde + kalan kcal) + Protein halkası + P·K·Y
   * mini çipleri. Su verisi uygulamada yok → Su halkası gösterilmez.
   */
  macros?: { protein: number; carbs: number; fat: number };
  macroTargets?: { protein: number; carbs: number; fat: number };
  /** G14-S1: gün halkası şeridini burada çizme (TrackerDayStrip öğünlerin altında çizer). */
  hideStrip?: boolean;
  /**
   * G15-S2 (su_takibi): Su halkası verisi. null/undefined → Su halkası yok
   * (bayrak kapalı ya da hedef yok). ml null → yükleniyor (0 gösterilir).
   */
  water?: { ml: number | null; targetMl: number } | null;
  /** Su halkasına dokununca hızlı ekleme (+250 ml). */
  onWaterAdd?: () => void;
  /** Gün boşken "İlk öğününü logla" (FinHomeEmptyR1). */
  onFirstLog?: () => void;
  /** Enerji/Protein halkası ya da makro çipleri → makro ayrıntısı. */
  onOpenMacros?: () => void;
}

/** Saate göre selamlama anahtarı (05–11 sabah, 11–18 gün, diğer akşam). */
function greetingKey(hour: number): string {
  if (hour >= 5 && hour < 11) return 'gun.greeting';
  if (hour >= 11 && hour < 18) return 'gun.greeting_day';
  return 'gun.greeting_evening';
}

/** G14-S1 — FinHomeR3 üst satırı: "Günaydın, <ad>" + zil. */
export function HomeGreeting({ name, onBell, hour }: { name: string; onBell?: () => void; hour?: number }) {
  const t = useTheme();
  const { t: tt } = useT();
  const first = name.trim().split(/\s+/)[0] ?? '';
  return (
    <View style={styles.greetRow}>
      <AppText variant="heading" style={styles.greetText} numberOfLines={1} accessibilityRole="header">
        {first ? `${tt(greetingKey(hour ?? new Date().getHours()))}, ${first}` : tt(greetingKey(hour ?? new Date().getHours()))}
      </AppText>
      {onBell ? (
        <Pressable onPress={onBell} hitSlop={8} accessibilityRole="button" accessibilityLabel={tt('gun.notifications')} style={styles.bell}>
          <Bell size={22} color={t.color.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** G14-S1 — gün halkası şeridi (öğünlerin altında; Final sırası). */
export function TrackerDayStrip() {
  const gunHalkasi = useFeature('gun_halkasi');
  const [rings, setRings] = useState<DayRing[]>([]);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!gunHalkasi) return;
    let alive = true;
    getGunClient()
      .getDayRings()
      .then((r) => alive && setRings(r))
      .catch(() => alive && setRings([]));
    return () => {
      alive = false;
    };
  }, [gunHalkasi]);
  const onAddToDay = useCallback(async (card: DayCard) => {
    await getGunClient().addDayCardToDay({
      card: card.id,
      mealType: card.meal_type ?? inferMealTypeFromHour(new Date().getHours()),
      idempotencyKey: `tracker-${card.id}`,
    });
  }, []);
  if (!gunHalkasi || rings.length === 0) return null;
  return (
    <View style={styles.strip}>
      <GunRingStrip rings={rings} onOpen={(id) => setOpenUserId(id)} />
      {openUserId ? (
        <GunViewer visible rings={rings} startUserId={openUserId} onClose={() => setOpenUserId(null)} onAddToDay={onAddToDay} />
      ) : null}
    </View>
  );
}


export function TrackerDayHeader({
  kcal,
  target,
  logToken = 0,
  lastMealLabel,
  hour,
  macros,
  macroTargets,
  hideStrip = false,
  water,
  onWaterAdd,
  onFirstLog,
  onOpenMacros,
}: TrackerDayHeaderProps) {
  const t = useTheme();
  const { t: tt, lang } = useT();
  const gunHalkasi = useFeature('gun_halkasi');

  const progress = target > 0 ? Math.min(kcal / target, 1) : 0;
  const nowHour = hour ?? new Date().getHours();
  const mealLabel = lastMealLabel ?? tt(`meal.${inferMealTypeFromHour(new Date().getHours())}`);

  // Gün halkası şeridi verisi (gun_halkasi açıkken; RPC yoksa boş → şerit gizli).
  const [rings, setRings] = useState<DayRing[]>([]);
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!gunHalkasi) return;
    let alive = true;
    getGunClient()
      .getDayRings()
      .then((r) => alive && setRings(r))
      .catch(() => alive && setRings([]));
    return () => {
      alive = false;
    };
  }, [gunHalkasi]);

  const streak = rings[0]?.streak ?? 0;

  // Halka dolumu "tek nefes": progress 1'e ulaşınca bir kez pop (hero).
  const { style: popStyle, pop } = usePop();
  const completedRef = useRef(false);
  useEffect(() => {
    if (progress >= 1 && !completedRef.current) {
      completedRef.current = true;
      pop();
    } else if (progress < 1) {
      completedRef.current = false;
    }
  }, [progress, pop]);

  // Logla izi + zaman hapı toast.
  const [showToast, setShowToast] = useState(false);
  const prevLog = useRef(logToken);
  useEffect(() => {
    if (logToken !== prevLog.current) {
      prevLog.current = logToken;
      if (logToken > 0) {
        setShowToast(true);
        haptic('light');
      }
    }
  }, [logToken]);

  const onAddToDay = useCallback(async (card: DayCard) => {
    await getGunClient().addDayCardToDay({
      card: card.id,
      mealType: card.meal_type ?? inferMealTypeFromHour(new Date().getHours()),
      idempotencyKey: `tracker-${card.id}`,
    });
  }, []);

  const silent = isSilentEvening(progress, nowHour);

  return (
    <View style={styles.wrap}>
      <View style={styles.toastLayer} pointerEvents="box-none">
        <Toast
          visible={showToast}
          message={tt('gun.logged_to', { meal: mealLabel })}
          onDismiss={() => setShowToast(false)}
          autoHideMs={2600}
        />
      </View>

      {!hideStrip && gunHalkasi && rings.length > 0 ? (
        <View style={styles.strip}>
          <GunRingStrip rings={rings} onOpen={(id) => setOpenUserId(id)} />
        </View>
      ) : null}

      {macros && macroTargets ? (
        <FinTopBlock
          kcal={kcal}
          target={target}
          macros={macros}
          macroTargets={macroTargets}
          water={water}
          onWaterAdd={onWaterAdd}
          onFirstLog={onFirstLog}
          onOpenMacros={onOpenMacros}
          popStyle={popStyle}
          streak={streak}
        />
      ) : (
      /* Günlük halka dolumu imza anı. */
      <View style={styles.ringBlock}>
        <Animated.View style={[styles.ringCenterWrap, popStyle]}>
          <ProgressRing progress={progress} size={200} strokeWidth={18}>
            <RollingNumber
              value={kcal}
              lang={lang as NumLang}
              fontSize={44}
              color={t.color.ink}
              accessibilityLabel={tt('gun.goal_kcal', { kcal, target })}
            />
            <AppText variant="caption" tone="secondary" style={styles.goalLabel}>
              {tt('gun.goal_kcal', { kcal, target })}
            </AppText>
          </ProgressRing>
        </Animated.View>

        {/* Seri anı — yalnız gerçek seri verisi varsa (streak>0). Yoksa HİÇ yok. */}
        {streak > 0 ? (
          <View
            style={[styles.streakChip, { backgroundColor: t.color.accent }]}
            accessibilityRole="text"
            accessibilityLabel={tt('gun.streak', { count: streak })}
          >
            <TrophyIcon size={14} color={t.color.onAccent} weight="fill" />
            <AppText variant="caption" tone="onAccent" style={styles.streakText}>
              {tt('gun.streak', { count: streak })}
            </AppText>
          </View>
        ) : null}

        {/* Akşam + boş gün: sessiz an. */}
        {silent ? (
          <AppText variant="body" tone="secondary" style={styles.silent}>
            {tt('gun.tomorrow_new_ring')}
          </AppText>
        ) : null}
      </View>
      )}

      {/* Logla izi (öğün loglanınca). Mutlak katman — yerleşimi bozmaz. */}
      {logToken > 0 ? (
        <View pointerEvents="none" style={styles.trailLayer}>
          <LogTrail playToken={logToken} width={300} height={120} label={mealLabel} />
        </View>
      ) : null}

      {openUserId ? (
        <GunViewer
          visible
          rings={rings}
          startUserId={openUserId}
          onClose={() => setOpenUserId(null)}
          onAddToDay={onAddToDay}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 0 },
  strip: { paddingVertical: 10 },
  ringBlock: { alignItems: 'center', paddingVertical: 12, gap: 12 },
  ringCenterWrap: { alignItems: 'center', justifyContent: 'center' },
  goalLabel: { marginTop: 4 },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  streakText: { marginLeft: 0 },
  silent: { textAlign: 'center' },
  trailLayer: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
  toastLayer: { position: 'absolute', top: 0, left: 12, right: 12, zIndex: 10 },
  // G14-S1 — FinHomeR3 üst blok
  greetRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, minHeight: 44 },
  greetText: { flex: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 20, lineHeight: 26 },
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
