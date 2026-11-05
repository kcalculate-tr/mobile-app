// logFlight — sekmeler arası "uçuş" olayı (G12 sözleşmesi "Bağlar").
// Tek kaynak `src/modules/shell/logEvents.ts` (G13-S1 m.4); burası yalnız
// geriye uyumlu yeniden dışa verim — gun modülünü kullananlar import yolunu
// değiştirmek zorunda kalmaz.
export {
  LOG_FLIGHT_EVENT,
  LOG_UNDO_EVENT,
  emitLogFlight,
  emitLogUndo,
  onLogFlight,
  onLogUndo,
  type LogFlightPayload,
  type LogUndoPayload,
} from '../shell/logEvents';
