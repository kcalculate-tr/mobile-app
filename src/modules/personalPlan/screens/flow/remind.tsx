// G34-S1 · Tur 26o — Hatırlatmalar (03 panosu "Hatırlatmalar" + "İzin penceresi"). Bildirim izni
// BURADA, bağlam içinde sorulur (pushPermission tek kapı, kaynak 'personal_plan'); reddedilirse
// akış yine tamamlanır. "Şimdilik geç" izin sormadan geçer.
import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AppText } from '../../../../core/design/components/AppText';
import { useT } from '../../../../core/i18n';
import { Bell } from '../../../../components/icons';
import { requestPushPermission } from '../../../../core/push/pushPermission';
import { shiftTime, mealSlots, type Weekday } from '../../types';
import { usePpFlow } from '../../store';
import { syncPlanReminders } from '../../reminders';
import { Chip, Panel, PpButton, PpCard, Row, Toggle, usePp } from '../../ui/parts';

export function RemindStep({ onDone }: { onDone: (permission: 'granted' | 'denied' | 'skipped') => void }) {
  const i18n = useT();
  const P = usePp();
  const a = usePpFlow((s) => s.answers);
  const set = usePpFlow((s) => s.set);
  const r = a.reminders;
  const [busy, setBusy] = useState(false);
  const slots = mealSlots(a.meals.main, a.meals.snack);
  const mealsOn = slots.some((s) => r.meals[s] !== false);
  const setR = (patch: Partial<typeof r>) => set({ reminders: { ...r, ...patch } });

  const turnOn = async () => {
    if (busy) return;
    setBusy(true);
    let status: 'granted' | 'denied' = 'denied';
    try {
      status = (await requestPushPermission('personal_plan')) === 'granted' ? 'granted' : 'denied';
    } catch {
      status = 'denied';
    }
    setR({ permission: status });
    if (status === 'granted') await syncPlanReminders(a.meals, { ...r, permission: status }, i18n.lang === 'en' ? 'en' : 'tr');
    setBusy(false);
    onDone(status);
  };

  return (
    <PpCard
      title={i18n.t('pp.remind_title')}
      sub={i18n.t('pp.remind_sub')}
      footer={
        <View style={{ gap: 4 }}>
          <PpButton label={i18n.t('pp.remind_cta')} onPress={() => void turnOn()} disabled={busy || (!mealsOn && !r.weighIn)} testID="pp-remind-on" />
          <PpButton
            kind="link"
            label={i18n.t('pp.skip_for_now')}
            onPress={() => {
              setR({ permission: 'skipped' });
              onDone('skipped');
            }}
            testID="pp-remind-skip"
          />
        </View>
      }
    >
      <Panel>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
              {i18n.t('pp.remind_meals')}
            </AppText>
            <AppText textRole="helper" style={{ color: P.sec }}>
              {i18n.t('pp.remind_meals_sub')}
            </AppText>
          </View>
        </View>
        {slots.map((s, i) => (
          <Row key={s} label={i18n.t(`pp.slot_${s}`)} last={i === slots.length - 1}>
            <AppText textRole="bodySm" style={{ color: P.ink, fontVariant: ['tabular-nums'], marginRight: 10 }}>
              {a.meals.times[s] ?? ''}
            </AppText>
            <Toggle value={r.meals[s] !== false} onChange={(v) => setR({ meals: { ...r.meals, [s]: v } })} label={i18n.t('pp.remind_toggle_a11y', { label: i18n.t(`pp.slot_${s}`) })} />
          </Row>
        ))}
      </Panel>
      <Panel style={{ marginTop: 12 }}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
              {i18n.t('pp.remind_weigh')}
            </AppText>
            <AppText textRole="helper" style={{ color: P.sec }}>
              {i18n.t('pp.remind_weigh_sub', { day: i18n.t(`pp.wd_long_${r.weighDay}`) })}
            </AppText>
          </View>
          <Toggle value={r.weighIn} onChange={(v) => setR({ weighIn: v })} label={i18n.t('pp.remind_toggle_a11y', { label: i18n.t('pp.remind_weigh') })} />
        </View>
        {r.weighIn ? (
          <>
            <View style={styles.days}>
              {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => (
                <Chip key={d} flex label={i18n.t(`pp.wd_${d}`)} selected={r.weighDay === d} onPress={() => setR({ weighDay: d })} />
              ))}
            </View>
            <Row label={i18n.t('pp.remind_time')} last>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <PpButton kind="link" label="−" onPress={() => setR({ weighTime: shiftTime(r.weighTime, -30) })} />
                <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {r.weighTime}
                </AppText>
                <PpButton kind="link" label="+" onPress={() => setR({ weighTime: shiftTime(r.weighTime, 30) })} />
              </View>
            </Row>
          </>
        ) : null}
      </Panel>
      <Panel style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
        <View style={[styles.bell, { backgroundColor: P.accent }]}>
          <Bell size={16} color={P.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText textRole="bodySm" style={{ color: P.ink, fontWeight: '700' }}>
            {i18n.t('pp.remind_perm_title')}
          </AppText>
          <AppText textRole="helper" style={{ color: P.sec, marginTop: 2 }}>
            {i18n.t(Platform.OS === 'ios' ? 'pp.remind_perm_body' : 'pp.remind_perm_body_android')}
          </AppText>
        </View>
      </Panel>
    </PpCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  days: { flexDirection: 'row', gap: 4, marginVertical: 10 },
  bell: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
