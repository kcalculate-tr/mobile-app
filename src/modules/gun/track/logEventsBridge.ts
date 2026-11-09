// G19-S2 md.7 — Keşfet / Tara / eatkcal loglarını TEK yerden ölçer: hepsi zaten
// `kcal:logFlight` yayınlıyor (shell/logEvents). Böylece her çağrı noktasına ayrı
// olay eklemeye gerek yok (G19-S3 çağrı noktalarına log_add EKLEMEMELİ — çift sayım).
// İstisna (G19-S4): Tara ve Keşfet log_add'ı kendi ekranından gider, köprü atlar.
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

/** log_add'ını kendisi gönderen kaynaklar (çift sayım yok). */
const SELF_REPORTED = new Set(['scan', 'kesfet']);

let wired = false;
const recent = new Map<string, { source: string; slot: SlotKey }>();

export function wireLogEventsBridge(): void {
  if (wired) return;
  wired = true;
  onLogFlight((p) => {
    // G19-S4: Tara (scanTrack.trackScanLog) ve Keşfet (KesfetScreen.logMeal) log_add'ını
    // kendisi gönderir — Tara kuyruğu ve Keşfet'in çerçevesiz yolu uçuş yayınlamadığı için
    // köprü onları eksik sayıyordu. Köprü bu kaynakları SAYMAZ → her kayıt tam 1 log_add.
    if (p.source && SELF_REPORTED.has(p.source)) return;
    const source = logSourceOf(p.source === 'eatkcal' ? 'order' : p.source ?? 'manual');
    const slot = slotFromLabel(p.mealLabel);
    if (p.id) recent.set(p.id, { source, slot });
    trackEvent({ name: 'log_add', props: { source, slot, kcal: Number(p.kcal) || 0, offline: false } });
  });
  onLogUndo((p) => {
    const r = recent.get(p.id);
    // G19-S4: yalnız köprünün saydığı kaydın geri alınması (Keşfet geri alı kendi gönderir).
    if (!r) return;
    recent.delete(p.id);
    trackEvent({
      name: 'log_delete',
      props: { source: r.source as never, slot: r.slot, undone: false },
    });
  });
}
