// Bayrak altyapısı — dışa açık yüzey.
export { FlagsProvider, FlagsOverrideProvider, useFeature, useFlagsContext } from './FlagsProvider';
export { FLAG_DEFAULTS, FLAG_KEYS, defaultFlags, type FlagKey } from './registry';
export { mergeFlags, flagValue, type FlagMap } from './resolve';
export { fnv1aBucket, rolloutBucket, inRollout } from './rollout';
export { setDevOverride, readDevOverrides, clearDevOverrides } from './devOverrides';
export { readCachedFlags, writeCachedFlags, clearCachedFlags } from './storage';
