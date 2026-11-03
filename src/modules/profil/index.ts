// modules/profil — profil + iki kayıt şablonu veri katmanı. Yalnız veri ve akış
// mantığı; nihai UI başka oturumda. Mevcut UnifiedLogin/checkout DEĞİŞMEZ.
export * from './types';
export {
  validateHandle,
  normalizeHandle,
  handleReasonI18nKey,
  HANDLE_MIN,
  HANDLE_MAX,
  type HandleReason,
  type HandleCheck,
} from './handle';
export {
  realProfilClient,
  getProfilClient,
  setProfilClient,
  resetProfilClient,
} from './client';
export { createMockProfilClient, mockProfilClient, type MockProfilOptions } from './mock';
export { canViewProfileContent } from './visibility';
export { useHandleClaim, type HandleStatus, type UseHandleClaim } from './useHandleClaim';
export {
  useKcalculateAiRegistration,
  useEatkcalRegistration,
  type KcalculateAiRegistration,
  type EatkcalRegistration,
  type CityGateStatus,
} from './useRegistration';
