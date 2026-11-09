// G19-S3 md.4/md.5 — initFBSDK ATT sırası (aynen korunur) + rıza dalları + track() Meta kapısı
// ve Supabase toplu yazımı. Native modüller taklit; gerçek ağ yok.
/* eslint-disable @typescript-eslint/no-require-imports */

const mockCalls: string[] = [];
let mockAttStatus = 'granted';
const mockInserts: unknown[][] = [];

jest.mock('react-native-fbsdk-next', () => ({
  AppEventsLogger: {
    logEvent: (name: string) => mockCalls.push(`logEvent:${name}`),
    logPurchase: (v: number) => mockCalls.push(`logPurchase:${v}`),
    AppEvents: new Proxy({}, { get: (_t, k) => String(k) }),
  },
  Settings: {
    initializeSDK: () => mockCalls.push('initializeSDK'),
    setAdvertiserTrackingEnabled: (v: boolean) => {
      mockCalls.push(`setAdvertiserTrackingEnabled:${v}`);
      return Promise.resolve(true);
    },
    setAdvertiserIDCollectionEnabled: (v: boolean) => mockCalls.push(`setAdvertiserIDCollectionEnabled:${v}`),
    setAutoLogAppEventsEnabled: (v: boolean) => mockCalls.push(`setAutoLogAppEventsEnabled:${v}`),
  },
}));

jest.mock('expo-tracking-transparency', () => ({
  requestTrackingPermissionsAsync: () => {
    mockCalls.push('requestTracking');
    return Promise.resolve({ status: mockAttStatus });
  },
  getTrackingPermissionsAsync: () => {
    mockCalls.push('getTracking');
    return Promise.resolve({ status: mockAttStatus });
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: () => () => {}, fetch: () => Promise.resolve({ isConnected: true }) },
}));

jest.mock('expo-linking', () => ({
  getInitialURL: () => Promise.resolve(null),
  addEventListener: () => ({ remove: () => {} }),
  createURL: () => 'kcal://',
}));

jest.mock('../../core/supabase', () => {
  const client = {
    from: () => ({
      insert: (rows: unknown) => {
        mockInserts.push(Array.isArray(rows) ? rows : [rows]);
        return Promise.resolve({ error: null, status: 201 });
      },
    }),
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }) },
  };
  return { supabase: client, getSupabaseClient: () => client };
});

type AnalyticsModule = typeof import('../analytics');

function load(os: 'ios' | 'android', storage: Record<string, string> = {}): AnalyticsModule {
  let mod!: AnalyticsModule;
  jest.isolateModules(() => {
    // Platform.OS bu modül kaydında `os` olsun (diğer RN dışa aktarımları gerçek).
    jest.doMock('react-native', () => {
      const actual = jest.requireActual('react-native');
      const P = Object.create(actual.Platform);
      Object.defineProperty(P, 'OS', { value: os });
      return Object.setPrototypeOf({ Platform: P }, actual);
    });
    const asMod = require('@react-native-async-storage/async-storage');
    const AS = asMod.default ?? asMod;
    for (const [k, v] of Object.entries(storage)) void AS.setItem(k, v);
    mod = require('../analytics');
  });
  return mod;
}

async function settle() {
  for (let round = 0; round < 5; round++) {
    for (let i = 0; i < 100; i++) await Promise.resolve();
    jest.advanceTimersByTime(10_000);
  }
}

beforeEach(async () => {
  mockCalls.length = 0;
  mockInserts.length = 0;
  mockAttStatus = 'granted';
});

describe('initFBSDK — ATT sırası', () => {
  it('iOS ATT granted: ATT iste → tracking → IDFA → initializeSDK (sıra aynen)', async () => {
    const a = load('ios');
    await a.initFBSDK();
    expect(mockCalls).toEqual([
      'requestTracking',
      'setAdvertiserTrackingEnabled:true',
      'setAdvertiserIDCollectionEnabled:true',
      'initializeSDK',
    ]);
  });

  it('iOS ATT denied: IDFA kapalı, SDK yine ATT SONRASI başlar; reklam olayı Meta’ya gitmez', async () => {
    mockAttStatus = 'denied';
    const a = load('ios');
    await a.initFBSDK();
    expect(mockCalls).toEqual([
      'requestTracking',
      'setAdvertiserTrackingEnabled:false',
      'setAdvertiserIDCollectionEnabled:false',
      'initializeSDK',
    ]);
    mockCalls.length = 0;
    a.track('add_to_cart', { product_id: '7', price: 100, quantity: 2 });
    expect(mockCalls).toEqual([]);
  });

  // G20-S1: uygulama içi reklam ölçümü kapalıyken Apple ATT sorusu HİÇ gösterilmez
  // (yalnız mevcut durum okunur); IDFA/Meta yine kapalı, SDK yine ATT adımından sonra.
  it('iOS uygulama içi reklam rızası denied: ATT SORULMAZ (durum okunur), IDFA kapalı, Meta olayı yok', async () => {
    const a = load('ios', { '@kcal_consent_ads': 'denied' });
    await a.initFBSDK();
    expect(mockCalls).toEqual([
      'getTracking',
      'setAdvertiserTrackingEnabled:false',
      'setAdvertiserIDCollectionEnabled:false',
      'initializeSDK',
    ]);
    mockCalls.length = 0;
    a.track('product_view', { product_id: '7', product_name: 'Bowl', price: 285 });
    expect(mockCalls).toEqual([]);
  });

  it('Android rıza unset: bugünkü gibi yalnız initializeSDK; rıza denied → IDFA + otomatik olay kapalı', async () => {
    const a = load('android');
    await a.initFBSDK();
    expect(mockCalls).toEqual(['initializeSDK']);

    mockCalls.length = 0;
    const b = load('android', { '@kcal_consent_ads': 'denied' });
    await b.initFBSDK();
    expect(mockCalls).toEqual([
      'setAdvertiserIDCollectionEnabled:false',
      'setAutoLogAppEventsEnabled:false',
      'initializeSDK',
    ]);
  });
});

describe('track() — Meta yalnız reklam olayları, parametreler eskisiyle aynı', () => {
  it('ATT granted: product_view → ViewedContent; scan/log olayları Meta’ya gitmez', async () => {
    const a = load('ios');
    await a.initFBSDK();
    mockCalls.length = 0;
    a.track('product_view', { product_id: '7', product_name: 'Bowl', price: 285 });
    a.track('add_to_cart', { product_id: '7', price: 100, quantity: 2 });
    a.track('begin_checkout', { price: 300, num_items: 3 });
    a.track('payment_success', { order_id: 1042, price: 300 });
    a.track('scan_success', { n_items: 2, kcal: 500, via: 'camera' });
    a.track('log_add', { source: 'manual', kcal: 300 });
    a.track('share', { target: 'post' });
    expect(mockCalls).toEqual([
      'logEvent:ViewedContent',
      'logEvent:AddedToCart',
      'logEvent:InitiatedCheckout',
      'logPurchase:300',
    ]);
  });

  it('birinci taraf: satırlar toplu insert edilir, kişisel veri düşer, user_id + anon_id + session', async () => {
    const a = load('android');
    a.track('add_to_cart', { product_id: '7', price: 100, quantity: 2, ...({ email: 'a@b.co' } as object) });
    a.track('scan_open');
    await settle();
    const rows = mockInserts.flat() as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.event_name)).toEqual(['add_to_cart', 'scan_open']);
    expect(rows[0].props).toEqual({ product_id: '7', price: 100, quantity: 2 });
    expect(rows[0].user_id).toBe('user-1');
    expect(typeof rows[0].anon_id).toBe('string');
    expect(rows[0].session_id).toBe(rows[1].session_id);
    expect(mockInserts.length).toBe(1); // tek toplu insert
  });

  it('sipariş olaylarına kaynak (channel + first touch) eklenir', async () => {
    const a = load('android', {
      '@kcal_attr_first_touch': JSON.stringify({ source: 'instagram', campaign: 'lansman', at: new Date().toISOString() }),
    });
    a.track('begin_checkout', { price: 300, num_items: 3 });
    await settle();
    const row = mockInserts.flat()[0] as { props: Record<string, unknown> };
    expect(row.props).toMatchObject({ price: 300, num_items: 3, channel: 'app', ft_source: 'instagram', ft_campaign: 'lansman' });
  });

  it('kullanım ölçümü kapalıysa (KVKK itiraz) Supabase’e yazılmaz', async () => {
    const a = load('android', { '@kcal_consent_first_party': '0' });
    a.track('home_view');
    await settle();
    expect(mockInserts.length).toBe(0);
  });

  it('bilinmeyen / sunucu olayı yazılmaz', async () => {
    const a = load('android');
    (a.track as (n: string) => void)('order_delivered');
    (a.track as (n: string) => void)('rastgele_olay');
    await settle();
    expect(mockInserts.length).toBe(0);
  });

  it('identifyUser: yeni hesap → signup (Meta CompletedRegistration), eski hesap → login', async () => {
    const a = load('android');
    await a.identifyUser({ id: 'u-new', created_at: new Date().toISOString(), app_metadata: { provider: 'apple' } });
    await a.identifyUser({ id: 'u-new', created_at: new Date().toISOString(), app_metadata: { provider: 'apple' } }); // ikinci kez yok
    await a.identifyUser({ id: 'u-old', created_at: '2025-01-01T00:00:00Z', app_metadata: { provider: 'google' } });
    await settle();
    const rows = mockInserts.flat() as Array<{ event_name: string; props: Record<string, unknown> }>;
    expect(rows.map((r) => [r.event_name, r.props.method])).toEqual([
      ['signup', 'apple'],
      ['login', 'google'],
    ]);
    expect(mockCalls).toContain('logEvent:CompletedRegistration');
  });

  it('identifyUser: oturum geri yüklemesinde aynı kullanıcı için tekrar login yazılmaz', async () => {
    const a = load('android', { '@kcal_analytics_identified_uid': 'u-old' });
    await a.identifyUser({ id: 'u-old', created_at: '2025-01-01T00:00:00Z', app_metadata: { provider: 'email' } });
    await a.identifyUser({ id: 'u-other', created_at: '2025-01-01T00:00:00Z', app_metadata: { provider: 'email' } });
    await settle();
    const rows = mockInserts.flat() as Array<{ event_name: string; props: Record<string, unknown> }>;
    expect(rows.map((r) => r.event_name)).toEqual(['login']);
  });
});

describe('G20-S1 — initFBSDK onAtt (politika → ATT kaydı)', () => {
  it('ATT soruldu → onAtt({status, asked:true}) SDK ayarlarından ÖNCE; reddedince Meta kapalı', async () => {
    mockAttStatus = 'denied';
    const a = load('ios', { '@kcal_consent_ads': 'granted' });
    const seen: unknown[] = [];
    await a.initFBSDK({ onAtt: (o) => seen.push([o, [...mockCalls]]) });
    expect(seen).toEqual([[{ status: 'denied', asked: true }, ['requestTracking']]]);
    expect(mockCalls).toEqual([
      'requestTracking',
      'setAdvertiserTrackingEnabled:false',
      'setAdvertiserIDCollectionEnabled:false',
      'initializeSDK',
    ]);
  });

  it('requestAttForAds (Ayarlar): iOS’ta ATT sorar, durumu döner; Android unavailable', async () => {
    mockAttStatus = 'granted';
    const a = load('ios');
    await expect(a.requestAttForAds()).resolves.toBe('granted');
    expect(mockCalls).toContain('requestTracking');
    const b = load('android');
    await expect(b.requestAttForAds()).resolves.toBe('unavailable');
  });
});
