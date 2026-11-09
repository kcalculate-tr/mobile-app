// Tracker'da etkinlik girişi — G8 (yalnız `etkinlik` bayrağı açıkken). Tracker
// bunu tek satırda render eder; bayrak kapalıyken HİÇ render olmaz → Tracker
// bugünküyle birebir aynı. Günün etkinlik toplamı (get_my_day_activity) küçük
// satır + "Etkinlik ekle" → sheet (tür/süre/mesafe + canlı kcal) → log_activity.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText, useTheme, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';

import { getKesfetClient } from '../client';
import { ACTIVITY_TYPES, type ActivityType, type DayActivity } from '../types';
import { activityDraftCard, type ActivityDraft } from '../composer';
import { BottomSheet } from './BottomSheet';
import { Icon } from './icons';
import { activityLimitError } from '../../gun/track/limits';
import { trackEvent } from '../../gun/track/events';

const emptyDraft = (): ActivityDraft => ({ type: 'kosu', minutes: '', distanceKm: '', note: '' });

// G18-S2 TEMAS (Ana sayfa "Bugünkü etkinlikler", FinHomeR3): variant="home" → düğme panodaki
// "+ Etkinlik ekle" (44, köşe 22, line2 çerçeve, 14/600), gün toplamı bölüm başlığında (burada yok);
// onLogged → bölüm satırlarını tazeler. Varsayılan (prop yok) davranış AYNEN.
// G19-S2 md.3: onLogged eklenen kaydın kimliğini verir (Ana sayfa "Geri al" toast'ı).
export interface ActivityLogged {
  id: string;
  type: ActivityType;
  minutes: number;
}

export function TrackerActivityEntry({ variant, onLogged }: { variant?: 'home'; onLogged?: (r?: ActivityLogged) => void } = {}) {
  const t = useTheme();
  const { t: tr, fmt } = useT();
  const [day, setDay] = useState<DayActivity | null>(null);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<ActivityDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);
  // G19-S2 md.3: idempotency anahtarı TASLAK başına — ağ hatasında yeniden deneme
  // çift kayıt üretmez (önceden her denemede yeni anahtar üretiliyordu).
  const draftKey = useRef<string | null>(null);

  const refresh = useCallback(() => {
    getKesfetClient()
      .getMyDayActivity()
      .then(setDay)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const preview = activityDraftCard(draft);
  const limitErr = preview ? activityLimitError(preview.minutes, preview.distance_km) : null;
  const canSave = preview != null && !saving && limitErr == null;

  const save = useCallback(async () => {
    if (!preview || saving || activityLimitError(preview.minutes, preview.distance_km)) return;
    setSaving(true);
    haptic('light');
    try {
      if (!draftKey.current) {
        seq.current += 1;
        draftKey.current = `tracker-activity-${seq.current}-${Date.now()}`;
      }
      const res = await getKesfetClient().logActivity({
        type: preview.type,
        minutes: preview.minutes,
        distanceKm: preview.distance_km,
        note: preview.note,
        idempotencyKey: draftKey.current,
      });
      draftKey.current = null;
      setSheet(false);
      setDraft(emptyDraft());
      refresh();
      trackEvent({ name: 'activity_add', props: { type: preview.type, minutes: preview.minutes, undo: false } });
      onLogged?.(res?.activity_log_id ? { id: res.activity_log_id, type: preview.type, minutes: preview.minutes } : undefined);
    } catch {
      // sessiz — kullanıcı tekrar deneyebilir
    } finally {
      setSaving(false);
    }
  }, [preview, saving, refresh, onLogged]);

  const hasTotal = day != null && day.total_minutes > 0;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setSheet(true)}
        accessibilityRole="button"
        accessibilityLabel={tr('kesfet.activity.add')}
        hitSlop={5}
        style={({ pressed }) => [
          variant === 'home' ? styles.addBtnHome : styles.addBtn,
          { borderColor: variant === 'home' ? (t.isDark ? '#48484A' : '#C3C7CC') : t.color.line },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Icon name={variant === 'home' ? 'plus' : 'run'} size={variant === 'home' ? 18 : 16} color={t.color.ink} />
        <AppText variant="caption" style={variant === 'home' ? styles.addLabelHome : styles.addLabel}>{tr('kesfet.activity.add')}</AppText>
      </Pressable>
      {hasTotal && variant !== 'home' ? (
        <AppText variant="caption" tone="secondary" style={styles.total}>
          {tr('kesfet.activity.day_total', {
            kcal: fmt(day!.total_kcal_est),
            min: fmt(day!.total_minutes),
          })}
        </AppText>
      ) : null}

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} accessibilityLabel={tr('kesfet.activity.add')}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <AppText variant="heading" style={styles.sheetTitle}>{tr('kesfet.activity.add')}</AppText>
          <View style={styles.chipWrap} accessibilityRole="radiogroup">
            {ACTIVITY_TYPES.map((at: ActivityType) => {
              const active = draft.type === at;
              return (
                <Pressable
                  key={at}
                  onPress={() => {
                    draftKey.current = null;
                    setDraft((d) => ({ ...d, type: at }));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={tr(`kesfet.activity.type.${at}`)}
                  hitSlop={5}
                  style={[styles.chip, { borderColor: active ? t.color.ink : t.color.line, backgroundColor: active ? t.color.ink : 'transparent' }]}
                >
                  <AppText variant="caption" style={{ color: active ? t.color.surface : t.color.ink, fontWeight: '600' }}>
                    {tr(`kesfet.activity.type.${at}`)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.row}>
            <View style={styles.cell}>
              <AppText variant="caption" tone="secondary" style={styles.label}>{tr('kesfet.compose.minutes')}</AppText>
              <TextInput
                value={draft.minutes}
                onChangeText={(v) => {
                  draftKey.current = null;
                  setDraft((d) => ({ ...d, minutes: v }));
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={t.color.secondary}
                style={[styles.input, { color: t.color.ink, backgroundColor: t.color.surface, borderColor: t.color.line }]}
                accessibilityLabel={tr('kesfet.compose.minutes')}
              />
            </View>
            <View style={styles.cell}>
              <AppText variant="caption" tone="secondary" style={styles.label}>{tr('kesfet.compose.distance')}</AppText>
              <TextInput
                value={draft.distanceKm}
                onChangeText={(v) => {
                  draftKey.current = null;
                  setDraft((d) => ({ ...d, distanceKm: v }));
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={t.color.secondary}
                style={[styles.input, { color: t.color.ink, backgroundColor: t.color.surface, borderColor: t.color.line }]}
                accessibilityLabel={tr('kesfet.compose.distance')}
              />
            </View>
          </View>
          <View style={[styles.kcalLive, { borderColor: t.color.line }]}>
            <Icon name="fire" size={16} color={t.color.accentLine} />
            <AppText variant="body" style={{ fontWeight: '700' }}>
              {limitErr === 'minutes_high'
                ? tr('gun.activity_err_minutes_high')
                : limitErr === 'distance_high'
                  ? tr('gun.activity_err_distance_high')
                  : preview
                    ? tr('kesfet.activity.kcal_est', { kcal: fmt(preview.kcal_est) })
                    : tr('kesfet.compose.kcal_hint')}
            </AppText>
          </View>
          <Pressable
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel={tr('kesfet.activity.add')}
            style={({ pressed }) => [styles.saveBtn, { backgroundColor: canSave ? t.color.ink : t.color.line, opacity: pressed ? 0.9 : 1 }]}
          >
            <AppText variant="body" style={{ color: canSave ? t.color.surface : t.color.secondary, fontWeight: '700' }}>
              {tr('common.save')}
            </AppText>
          </Pressable>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  addBtn: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1 },
  addLabel: { fontWeight: '700' },
  addBtnHome: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1 },
  addLabelHome: { fontSize: 14, lineHeight: 18, fontFamily: 'PlusJakartaSans_600SemiBold' },
  total: { flexShrink: 1 },
  sheetTitle: { marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
  label: { marginBottom: 4, fontWeight: '600' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 15 },
  kcalLive: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  saveBtn: { marginTop: 14, minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
