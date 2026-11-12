// G15-S2 — FinPhotoR1 "Planıma ekle" / "Bu öğünü kaydet" + FinCollectCut eşleşme.
//
// Yeni sunucu/paket YOK; mevcut altyapı:
//  • Bu öğünü kaydet → Tabak koleksiyonu yerel deposu (collection/store.ts):
//    yemek adına katalog numarası atanır (yoksa sıradaki numara).
//  • Planıma ekle → expo-notifications ile yerel plan hatırlatması: yarın aynı
//    saatte "Planındaki öğün: <ad> · <kcal> kcal". İzin yoksa false döner —
//    G26-S1: izin İSTEMEZ (tek fonksiyona sorar, yoksa sessizce geçer).
//  • Eşleşme yüzdesi → taranan ad ile eatkcal menüsündeki ürün adları arasında
//    kelime örtüşmesi (Dice) — SAF, birim testli; menü yoksa null (gösterilmez).
import * as Notifications from 'expo-notifications';

import { loadCollection, saveAssignment } from '../../collection';
import { pushGranted } from '../../../core/push/pushPermission';

/** Ada katalog numarası ata (zaten varsa aynısını döner). */
export async function saveMealToCollection(name: string): Promise<number> {
  const state = await loadCollection();
  const key = name.trim();
  const existing = state.assignments[key];
  if (existing) return existing;
  const next = Math.max(0, ...Object.values(state.assignments)) + 1;
  await saveAssignment(key, next);
  return next;
}

/** Yarın aynı saatte yerel plan hatırlatması kurar. İzin verilmezse false. */
export async function schedulePlanReminder(params: {
  title: string;
  body: string;
  now?: Date;
}): Promise<boolean> {
  if (!(await pushGranted().catch(() => false))) return false;
  const at = new Date(params.now ?? new Date());
  at.setDate(at.getDate() + 1);
  await Notifications.scheduleNotificationAsync({
    content: { title: params.title, body: params.body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
  return true;
}

export { bestMatchPercent, nameSimilarity } from './matchName';
