// modules/gun — Gün halkası veri katmanı + UI (ui/ altında, bkz. ./ui).
import { getGunClient } from './client';

export * from './types';
export {
  realGunClient,
  getGunClient,
  setGunClient,
  resetGunClient,
} from './client';
export { createMockGunClient, mockGunClient } from './mock';
export {
  getTodayConsumptions,
  setTodayConsumptionsProvider,
  resetTodayConsumptionsProvider,
  type TodayConsumption,
} from './todayConsumptions';

// Dışa basit sarmalayıcı — G6-S2'nin AddToDaySheet toast'u ("Günüme paylaş")
// consumption id'sini tek parametre olarak geçirip çağırabilsin diye
// `GunClient.shareMealToDay({ consumption })`'ın ince kabuğu.
export async function shareMealToDay(consumptionId: string): Promise<void> {
  await getGunClient().shareMealToDay({ consumption: consumptionId });
}
