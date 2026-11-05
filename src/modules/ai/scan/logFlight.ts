/**
 * G12-S4 — "Logla uçuşu" olayı (Tara yayınlar).
 * Tek kaynak `src/modules/shell/logEvents.ts` (G13-S1 m.4); burası yalnız
 * yeniden dışa verim. Not: `emitLogUndo` artık sözleşmedeki `{ id }` yükünü
 * alır (eski `emitLogUndo(id: string)` imzasının çağıranı yoktu).
 */
export {
  LOG_FLIGHT_EVENT,
  LOG_UNDO_EVENT,
  emitLogFlight,
  emitLogUndo,
  type LogFlightPayload,
  type LogUndoPayload,
} from '../../shell/logEvents';
