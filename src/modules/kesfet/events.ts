// Uygulama içi uçuş olayları (G12 sözleşmesi "Bağlar"). Keşfet bir öğünü
// loglayınca `kcal:logFlight`, "Geri al"da `kcal:logUndo` yayar.
// Tek kaynak `src/modules/shell/logEvents.ts` (G13-S1 m.4); burası yalnız
// yeniden dışa verim (olay adı/tip tekrarı yok).
export {
  LOG_FLIGHT_EVENT,
  LOG_UNDO_EVENT,
  emitLogFlight,
  emitLogUndo,
  type LogFlightPayload,
  type LogUndoPayload,
} from '../shell/logEvents';
