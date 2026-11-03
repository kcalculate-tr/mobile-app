// modules/ai/scan — AI fotoğraf tarama veri katmanı (kota + tahmin akışı).
export * from './types';
export { runAiScan } from './runScan';
export {
  realAiScanClient,
  getAiScanClient,
  setAiScanClient,
  resetAiScanClient,
} from './client';
export { createMockAiScanClient, mockAiScanClient, type MockAiScanOptions } from './mock';
