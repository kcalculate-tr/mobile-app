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

// G12-S3 — Ana sayfa (FinHomeR3) bağları.
export {
  LOG_FLIGHT_EVENT,
  LOG_UNDO_EVENT,
  emitLogFlight,
  emitLogUndo,
  onLogFlight,
  onLogUndo,
  type LogFlightPayload,
  type LogUndoPayload,
} from './logFlight';
export {
  buildSlots,
  normalizeMealType,
  slotFromHour,
  sourceInfo,
  hhmm,
  energyRing,
  macroRing,
  groupThousands,
  type SlotKey,
  type HomeSource,
  type HomeMealItem,
  type HomeSlot,
  type RingSpec,
  type ConsumptionLike,
} from './homeData';
export {
  deliveredAutoLog,
  isFreshDelivery,
  type DeliveredCard,
  type DeliveryOrder,
  type DeliveryOrderItem,
  type DeliveryProduct,
} from './delivery';

// Dışa basit sarmalayıcı — G6-S2'nin AddToDaySheet toast'u ("Günüme paylaş")
// consumption id'sini tek parametre olarak geçirip çağırabilsin diye
// `GunClient.shareMealToDay({ consumption })`'ın ince kabuğu.
export async function shareMealToDay(consumptionId: string): Promise<void> {
  await getGunClient().shareMealToDay({ consumption: consumptionId });
}
