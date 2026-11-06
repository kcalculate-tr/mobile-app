// HomeCelebrations — Ana sayfada CelebrateOverlay + useCelebrations mount
// (G13-S1 m.2). Bayrak KAPALIYKEN TrackerScreen bu bileşeni HİÇ render etmez.
//
// Sinyal GERÇEK veriden:
//  • ilk öğün — bugün ≥1 kayıt VE sunucuda bugünden eski hiç meal_consumptions
//    satırı yok (tek `limit(1)` sorgusu; hata → "eski kayıt var" sayılır,
//    yanlış "ilk öğün" kutlaması olmaz).
//  • 3/7 gün seri — 30 günlük kova (TrackerScreen weeklyConsumption) üzerinden
//    bugün dahil kesintisiz kayıtlı gün sayısı (computeStreak).
// Her kutlama ömür boyu bir kez (`@kcal_celebrate_shown`, useCelebrations).
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
import { computeStreak, isFirstMeal, type DayBucket } from '../../modules/celebrate/signals';
import { syncStreakReminder } from '../../modules/profil/streakReminder';

const NOTIFY_OFFERED_KEY = '@kcal_celebrate_notify_offered';
/** Kutlama, Logla izi B halka dolumundan SONRA gelsin (üst üste binmesin). */
const SHOW_DELAY = TIMING.logTrail + DURATION.base + TIMING.dailyRing;

export interface HomeCelebrationsProps {
  userId: string | null;
  /** Bugünün kayıtları (en yeni önce) — ilk öğün kartı adı/kcal'ı buradan. */
  today: readonly { name: string; calories: number; consumed_at: string }[];
  /** Son 30 gün kovası (YYYY-MM-DD + kcal). */
  days: readonly DayBucket[];
  /** Bugünün yerel gün anahtarı. */
  todayKey: string;
  /** Bugünün başı (ISO) — "eski kayıt var mı" sorgusunun sınırı. */
  todayStartISO: string;
  /** false iken (veri yükleniyor) değerlendirme yapılmaz. */
  ready: boolean;
}

export function HomeCelebrations({
  userId,
  today,
  days,
  todayKey,
  todayStartISO,
  ready,
}: HomeCelebrationsProps) {
  const { t: tt, lang } = useT();
  const { pending, evaluate, dismiss } = useCelebrations();
  const [shown, setShown] = useState<CelebrateMoment | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const hasEarlierRef = useRef<{ user: string; value: boolean } | null>(null);
  const todayCount = today.length;
  const streak = computeStreak(days, todayKey);

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

  // pending → kısa gecikmeyle göster (halka dolumu bitsin).
  useEffect(() => {
    if (!pending || shown) return;
    const id = setTimeout(() => setShown(pending), SHOW_DELAY);
    return () => clearTimeout(id);
  }, [pending, shown]);

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
