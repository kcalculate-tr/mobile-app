// modules/kesfet — Keşfet veri katmanı (Dalga 1 editoryal akış + G8 açık
// paylaşım/yorum/etkinlik/bildirim). Yalnız veri + arayüz; ekranlar bayrak
// arkasında. Hiçbir canlı ekran bayrak kapalıyken buna bağlı değildir.
export * from './types';
export {
  realKesfetClient,
  getKesfetClient,
  setKesfetClient,
  resetKesfetClient,
} from './client';
export {
  createMockKesfetClient,
  mockKesfetClient,
  type MockKesfetOptions,
  type MockKesfetClient,
} from './mock';
export { useKesfetStore } from './store';
export { useCommentsStore } from './commentsStore';
export { useNotificationsStore } from './notificationsStore';
export { estimateActivityKcal, MET_TABLE, DEFAULT_WEIGHT_KG } from './activity';
export {
  validateComposer,
  activityDraftCard,
  buildCreateInput,
  MAX_BODY,
  MAX_PHOTOS,
  type ComposerDraft,
  type ComposerError,
  type MealDraft,
  type ActivityDraft,
} from './composer';
