// modules/gun — Gün halkası veri katmanı. Yalnız veri; nihai UI başka oturumda.
export * from './types';
export {
  realGunClient,
  getGunClient,
  setGunClient,
  resetGunClient,
} from './client';
export { createMockGunClient, mockGunClient } from './mock';
