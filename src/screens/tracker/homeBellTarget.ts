// G21-S1 md.8 (akış denetimi): Ana sayfa zilinin hedefi.
// Önce zil 'Kesfet' akış yığınını açıyordu: (a) bildirim listesi değil akışın
// ikinci kopyası (Keşfet zaten sekme), (b) `kesfet` kapalıyken 'Kesfet' rotası
// üretimde kayıtlı değil → işlenmeyen gezinme. Zil = bildirimler (FinNotifications).
export type HomeBellTarget =
  | { name: 'KesfetNotifications' }
  | { name: 'Tabs'; params: { screen: 'KesfetTab' } }
  | null;

export function homeBellTarget(flags: { sosyalBildirim: boolean; kesfet: boolean }): HomeBellTarget {
  if (flags.sosyalBildirim) return { name: 'KesfetNotifications' };
  if (flags.kesfet) return { name: 'Tabs', params: { screen: 'KesfetTab' } };
  return null;
}
