// HomeCelebrations — Ana sayfada CelebrateOverlay + useCelebrations mount
// (G13-S1 m.2). Bayrak KAPALIYKEN TrackerScreen bu bileşeni HİÇ render etmez.
//
// Sinyal GERÇEK veriden:
//  • ilk öğün — bugün ≥1 kayıt VE sunucuda bugünden eski hiç meal_consumptions
//    satırı yok (tek `limit(1)` sorgusu; hata → "eski kayıt var" sayılır,
//    yanlış "ilk öğün" kutlaması olmaz).
//  • 3/7 gün seri — 30 günlük kova (TrackerScreen weeklyConsumption) üzerinden
//    bugün dahil kesintisiz kayıtlı gün sayısı (G19-S2: track/streak, sunucu kuralı).
// Her kutlama kullanıcı başına bir kez (`@kcal_celebrate_shown:<uid>`), ekrana
// geldiği an işaretlenir; 7'lik gösterilince 3'lük de gösterilmiş sayılır.
// Kutlama kapanınca, izin henüz verilmemişse ve daha önce teklif edilmediyse
// bildirim izni sheet'i (FinSheetNotify) açılır — mevcut izin akışı:
// requestPushPermissionOnly → granted ise registerForPushNotifications.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { DURATION, TIMING } from '../../core/design';
import { useT } from '../../core/i18n';
import { getSupabaseClient } from '../../core/supabase';
import { registerForPushNotifications } from '../../core/notifications';
import {
  CelebrateOverlay,
  NotifyPermissionSheet,
  useCelebrations,
  type CelebrateMoment,
} from '../../modules/celebrate';
import { isFirstMeal, type DayBucket } from '../../modules/celebrate/signals';
import { syncStreakReminder } from '../../modules/profil/streakReminder';
import { normalizeMealType } from '../../modules/gun/homeData';
import { addDays } from '../../modules/gun/track/dayClock';
import { celebrationStreak, displayStreak, loggedDays } from '../../modules/gun/track/streak';
import { trackEvent } from '../../modules/gun/track/events';
import { cancelMealReminders, syncMealReminders } from '../../modules/gun/track/mealReminder';

const NOTIFY_OFFERED_KEY = '@kcal_celebrate_notify_offered';
/** G19-S2 md.7: streak_day / ring_complete günde bir kez (kullanıcı + gün). */
const DAY_EVENT_KEY = (uid: string, ev: string) => `@kcal_track_day_event:${ev}:${uid}`;

async function onceForDay(uid: string, ev: string, day: string): Promise<boolean> {
  try {
    const k = DAY_EVENT_KEY(uid, ev);
    if ((await AsyncStorage.getItem(k)) === day) return false;
    await AsyncStorage.setItem(k, day);
    return true;
  } catch {
    return false;
  }
}
/** Kutlama, Logla izi B halka dolumundan SONRA gelsin (üst üste binmesin). */
const SHOW_DELAY = TIMING.logTrail + DURATION.base + TIMING.dailyRing;

export interface HomeCelebrationsProps {
  userId: string | null;
  /** Bugünün kayıtları (en yeni önce) — ilk öğün kartı adı/kcal'ı buradan. */
  today: readonly { name: string; calories: number; consumed_at: string; meal_type?: string | null }[];
  /** Son 30 gün kovası (YYYY-MM-DD + kcal). */
  days: readonly DayBucket[];
  /** Bugünün yerel gün anahtarı. */
  todayKey: string;
  /** Bugünün başı (ISO) — "eski kayıt var mı" sorgusunun sınırı. */
  todayStartISO: string;
  /** false iken (veri yükleniyor) değerlendirme yapılmaz. */
  ready: boolean;
  /** G19-S2: gün halkası tamamlandı mı (hedef varsa kcal ≥ hedef). */
  ringDone?: boolean;
  /** G19-S2: ring_complete olayı için gün toplamı + hedef. */
  kcal?: number;
  target?: number;
  /** G19-S2 md.5: `ogun_hatirlatma` bayrağı — açıkken öğün hatırlatmaları eşitlenir. */
  mealReminders?: boolean;
}

export function HomeCelebrations({
  userId,
  today,
  days,
  todayKey,
  todayStartISO,
  ready,
  ringDone = false,
  kcal = 0,
  target = 0,
  mealReminders = false,
}: HomeCelebrationsProps) {
  const { t: tt, lang } = useT();
  const { pending, evaluate, dismiss, markSeen } = useCelebrations(userId);
  const [shown, setShown] = useState<CelebrateMoment | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const hasEarlierRef = useRef<{ user: string; value: boolean } | null>(null);
  const todayCount = today.length;
  // G19-S2 md.4: seri kuralı sunucuyla aynı (track/streak). Kova 30 gün; bugünün
  // kayıtları kovaya henüz yansımamış olabilir (yeni log) → bugün ayrıca eklenir.
  const logged = loggedDays(days);
  if (todayCount > 0) logged.add(todayKey);
  const streak = celebrationStreak(logged, todayKey);
  const shownStreak = displayStreak(logged, todayKey);
  // Son 7 günde kayıt var mı (öğün hatırlatması yalnız takip eden kullanıcıya).
  let recentlyActive = false;
  for (let i = 0; i < 7 && !recentlyActive; i += 1) recentlyActive = logged.has(addDays(todayKey, -i));
  const slotsKey = today
    .map((r) => normalizeMealType(r.meal_type ?? null, r.consumed_at))
    .sort()
    .join(',');

  // Değerlendir: bugün kayıt varsa, gerçek sinyalle.
  useEffect(() => {
    if (!ready || !userId || todayCount === 0) return;
    let alive = true;
    (async () => {
      let hasEarlier = true;
      if (hasEarlierRef.current?.user === userId) {
        hasEarlier = hasEarlierRef.current.value;
      } else {
        try {
          const { data, error } = await getSupabaseClient()
            .from('meal_consumptions')
            .select('id')
            .eq('user_id', userId)
            .lt('consumed_at', todayStartISO)
            .limit(1);
          if (!error && Array.isArray(data)) {
            hasEarlier = data.length > 0;
            // "Eski kayıt var" kalıcı doğrudur; "yok" ise gün dönünce değişebilir.
            if (hasEarlier) hasEarlierRef.current = { user: userId, value: true };
          }
        } catch {
          hasEarlier = true;
        }
      }
      if (!alive) return;
      await evaluate({ isFirstMeal: isFirstMeal(todayCount, hasEarlier), streak });
    })();
    return () => {
      alive = false;
    };
  }, [ready, userId, todayCount, streak, todayStartISO, evaluate]);

  // G15-S4 — Seri hatırlatması: izin verildiyse her gün 19:30; bugün öğün
  // loglandıysa bugünün bildirimi iptal, ertesi güne kurulu kalır. İzin yoksa
  // syncStreakReminder hiçbir şey kurmaz.
  useEffect(() => {
    if (!ready || !userId) return;
    void syncStreakReminder({
      loggedToday: todayCount > 0,
      title: tt('profil.streak_reminder_title'),
      body: tt('profil.streak_reminder_body'),
    });
  }, [ready, userId, todayCount, tt]);

  // G19-S2 md.5: öğün hatırlatmaları (fin_reminder) — yuva loglanınca o günün
  // bildirimi kalkar; bayrak kapalıyken kurulu olanlar da iptal edilir.
  useEffect(() => {
    if (!ready || !userId) return;
    if (!mealReminders) {
      void cancelMealReminders();
      return;
    }
    void syncMealReminders({
      userId,
      lang: lang === 'en' ? 'en' : 'tr',
      loggedToday: new Set(slotsKey ? slotsKey.split(',') : []),
      recentlyActive,
    });
  }, [ready, userId, mealReminders, slotsKey, recentlyActive, lang, todayKey]);

  // G19-S2 md.7: streak_day — bugünün ilk kaydı seriyi uzattığında, günde bir kez.
  useEffect(() => {
    if (!ready || !userId || todayCount === 0) return;
    void onceForDay(userId, 'streak_day', todayKey).then((first) => {
      if (first) trackEvent({ name: 'streak_day', props: { streak: shownStreak } });
    });
  }, [ready, userId, todayCount, todayKey, shownStreak]);

  // G19-S2 md.7: ring_complete — hedef tamamlandığında, günde bir kez.
  useEffect(() => {
    if (!ready || !userId || !ringDone) return;
    void onceForDay(userId, 'ring_complete', todayKey).then((first) => {
      if (first) trackEvent({ name: 'ring_complete', props: { kcal, target } });
    });
  }, [ready, userId, ringDone, todayKey, kcal, target]);

  // pending → kısa gecikmeyle göster (halka dolumu bitsin).
  useEffect(() => {
    if (!pending || shown) return;
    const id = setTimeout(() => {
      setShown(pending);
      // G19-S2 md.4: ekrana geldiği AN kalıcı işaret — açıkken uygulama kapansa da tekrar çıkmaz.
      void markSeen(pending);
    }, SHOW_DELAY);
    return () => clearTimeout(id);
  }, [pending, shown, markSeen]);

  const offerNotify = useCallback(async () => {
    try {
      if ((await AsyncStorage.getItem(NOTIFY_OFFERED_KEY)) === '1') return;
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status === 'granted' || perm.canAskAgain === false) return;
      await AsyncStorage.setItem(NOTIFY_OFFERED_KEY, '1');
      setNotifyOpen(true);
    } catch {
      /* izin okunamadı — teklif etme */
    }
  }, []);

  const onDone = useCallback(() => {
    const m = shown;
    setShown(null);
    if (!m) return;
    void dismiss(m).then(offerNotify);
  }, [shown, dismiss, offerNotify]);

  const first = today.length > 0 ? today[today.length - 1] : null; // en eski = ilk öğün
  const cardSub =
    shown === 'first' && first
      ? tt('celebrate.card_sub_first', { name: first.name, kcal: Math.round(first.calories) })
      : shown
        ? tt(`celebrate.card_sub_${shown}`)
        : '';
  const cardTitle = shown ? tt(`celebrate.card_${shown}`) : '';
  const dateLabel = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    month: 'short',
  });

  const onShare = useCallback(() => {
    if (!shown) return;
    const msg = `${tt(`celebrate.${shown}_title1`)} ${tt(`celebrate.${shown}_mark`)} · ${cardSub} · Kcalculate`;
    void Share.share({ message: msg }).catch(() => {});
  }, [shown, cardSub, tt]);

  return (
    <>
      {shown ? (
        <CelebrateOverlay
          visible
          moment={shown}
          dateLabel={dateLabel}
          cardTitle={cardTitle}
          cardSub={cardSub}
          onShare={onShare}
          onDone={onDone}
        />
      ) : null}
      <NotifyPermissionSheet
        visible={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        onResult={(status) => {
          if (status === 'granted') {
            void registerForPushNotifications();
            void syncStreakReminder({ loggedToday: todayCount > 0, title: tt('profil.streak_reminder_title'), body: tt('profil.streak_reminder_body') });
          }
        }}
      />
    </>
  );
}
