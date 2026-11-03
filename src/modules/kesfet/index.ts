// modules/kesfet — Keşfet veri katmanı (Dalga 1, editoryal akış). Yalnız veri;
// nihai UI başka oturumda çizilir. Hiçbir canlı ekran buna bağlı değil.
export * from './types';
export {
  realKesfetClient,
  getKesfetClient,
  setKesfetClient,
  resetKesfetClient,
} from './client';
export { createMockKesfetClient, mockKesfetClient, type MockKesfetOptions } from './mock';
export { useKesfetStore } from './store';
