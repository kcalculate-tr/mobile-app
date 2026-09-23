// Jest + React Native Testing Library ortak kurulumu.
//
// node:test ile koşan saf mantık testlerinden (npm run test:unit) AYRI bir
// dünya: burada gerçek bileşenler render ediliyor, o yüzden native modüllerin
// taklidi gerekiyor. Dosya deseni de ayrı: __component_tests__/*.test.tsx

/* global jest, afterEach */

// Supabase istemcisi modül seviyesinde auth oturumu kurmaya çalışıyor
// (AsyncStorage). Bileşen testlerinde ağa çıkmasın.
jest.mock('./src/lib/supabase', () => {
  const zincir = () => {
    const q = {};
    for (const m of ['select','insert','update','upsert','delete','eq','neq','in','is','or','order','limit','range','maybeSingle','single']) {
      q[m] = () => q;
    }
    q.then = (res) => Promise.resolve({ data: [], error: null }).then(res);
    return q;
  };
  const client = {
    from: zincir,
    rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  };
  return { supabase: client, getSupabaseClient: () => client };
});

// Sentry native modülü test ortamında yok.
jest.mock('@sentry/react-native', () => ({
  init: () => {},
  wrap: (c) => c,
  captureException: () => {},
  setUser: () => {},
}));

jest.mock('expo-haptics', () => ({
  impactAsync: () => Promise.resolve(),
  notificationAsync: () => Promise.resolve(),
  selectionAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Animated.timing test bittikten sonra gerçek zamanlayıcıyla dönmeye devam
// edip "update was not wrapped in act(...)" gürültüsü üretiyor. Her testten
// sonra bekleyen zamanlayıcıları temizle — testler zaten son duruma bakıyor.
afterEach(() => {
  jest.clearAllTimers();
});
