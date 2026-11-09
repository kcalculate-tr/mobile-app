// G19-S2 md.7 — Keşfet / Tara / eatkcal loglarını TEK yerden ölçer: hepsi zaten
// `kcal:logFlight` yayınlıyor (shell/logEvents). Böylece her çağrı noktasına ayrı
// olay eklemeye gerek yok (G19-S3 çağrı noktalarına log_add EKLEMEMELİ — çift sayım).
// Ana sayfadaki elle giriş (logFlight yayınlamaz) TrackerScreen'den ölçülür.
import { onLogFlight, onLogUndo } from '../../shell/logEvents';
import { slotFromHour, type SlotKey } from '../homeData';
import { istanbulHour } from './dayClock';
import { logSourceOf, trackEvent } from './events';

const LABEL_TO_SLOT: Record<string, SlotKey> = {
  kahvaltı: 'breakfast',
  breakfast: 'breakfast',
  öğle: 'lunch',
  lunch: 'lunch',
  akşam: 'dinner',
  dinner: 'dinner',
  'ara öğün': 'snack',
  atıştırma: 'snack',
  snack: 'snack',
};

export function slotFromLabel(label: string | null | undefined, hour = istanbulHour()): SlotKey {
  const k = (label ?? '').trim().toLocaleLowerCase('tr');
  return LABEL_TO_SLOT[k] ?? slotFromHour(hour);
}

let wired = false;
const recent = new Map<string, { source: string; slot: SlotKey }>();

export function wireLogEventsBridge(): void {
  if (wired) return;
  wired = true;
  onLogFlight((p) => {
    const source = logSourceOf(p.source === 'eatkcal' ? 'order' : p.source ?? 'manual');
    const slot = slotFromLabel(p.mealLabel);
    if (p.id) recent.set(p.id, { source, slot });
    trackEvent({ name: 'log_add', props: { source, slot, kcal: Number(p.kcal) || 0, offline: false } });
  });
  onLogUndo((p) => {
    const r = recent.get(p.id);
    recent.delete(p.id);
    trackEvent({
      name: 'log_delete',
      props: { source: (r?.source as never) ?? 'manual', slot: r?.slot ?? slotFromHour(istanbulHour()), undone: false },
    });
  });
}
