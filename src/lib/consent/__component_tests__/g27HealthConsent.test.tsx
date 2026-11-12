// G27-S1 md.3 (G26 SORULAR 3) — sağlık verisi açık rızası user_consents'e AYRI satır.
// Ağ yok (supabase taklit). Migration (20261111230100) uygulanmadan önce satır yan
// kuyrukta bekler ve ortak kuyruktaki politika satırlarını TIKAMAZ.
import AsyncStorage from '@react-native-async-storage/async-storage';
import fs from 'fs';
import path from 'path';

jest.mock('../../analytics', () => ({
  setAdConsent: () => Promise.resolve(),
  setFirstPartyConsent: () => Promise.resolve(),
}));

type Row = { kind: string; source: string; granted: boolean; user_id: string; doc_slug: unknown; doc_version: unknown };
const mockInserts: Row[][] = [];
let mockUid: string | null = 'u1';
let mockRejectKinds: string[] = [];
jest.mock('../../../core/supabase', () => {
  const client = {
    from: () => ({
      insert: (rows: Row[]) => {
        if (rows.some((r) => mockRejectKinds.includes(r.kind))) {
          return Promise.resolve({ error: { message: 'violates check constraint "user_consents_kind_check"' } });
        }
        mockInserts.push(rows);
        return Promise.resolve({ error: null });
      },
    }),
    auth: { getSession: () => Promise.resolve({ data: { session: mockUid ? { user: { id: mockUid } } : null } }) },
  };
  return { supabase: client, getSupabaseClient: () => client };
});

import { HEALTH_CONSENT_KEY, SIDE_PENDING_KEY, flushPending, recordConsentRows, recordHealthConsent } from '../store';
import { PENDING_KEY } from '../policy';

const ROOT = path.resolve(__dirname, '../../../..');

beforeEach(async () => {
  mockInserts.length = 0;
  mockUid = 'u1';
  mockRejectKinds = [];
  await AsyncStorage.clear();
});

test('onay → kind health_data / source takibe AYRI satır (belge alanları boş)', async () => {
  expect(await recordHealthConsent(true, 'takibe')).toBe(true);
  const rows = mockInserts.flat();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ kind: 'health_data', source: 'takibe', granted: true, user_id: 'u1', doc_slug: null, doc_version: null });
  expect(JSON.parse((await AsyncStorage.getItem(HEALTH_CONSENT_KEY)) as string)).toMatchObject({ granted: true, v: 1 });
  expect(await AsyncStorage.getItem(SIDE_PENDING_KEY)).toBeNull();
});

test('aynı sürümde tekrar onay (akışta geri-ileri) yeni satır yazmaz; geri alma yazar', async () => {
  await recordHealthConsent(true);
  expect(await recordHealthConsent(true)).toBe(false);
  expect(mockInserts.flat()).toHaveLength(1);
  expect(await recordHealthConsent(false, 'settings')).toBe(true);
  expect(mockInserts.flat().map((r) => [r.kind, r.granted, r.source])).toEqual([
    ['health_data', true, 'takibe'],
    ['health_data', false, 'settings'],
  ]);
});

test('oturum yoksa satır cihazda bekler, oturum açılınca yazılır', async () => {
  mockUid = null;
  await recordHealthConsent(true);
  expect(mockInserts).toHaveLength(0);
  expect(JSON.parse((await AsyncStorage.getItem(SIDE_PENDING_KEY)) as string)).toHaveLength(1);
  await flushPending('u2');
  expect(mockInserts.flat()[0]).toMatchObject({ kind: 'health_data', user_id: 'u2' });
  expect(await AsyncStorage.getItem(SIDE_PENDING_KEY)).toBeNull();
});

test('migration uygulanmadıysa (CHECK reddi) sağlık satırı bekler, politika satırları yine yazılır', async () => {
  mockRejectKinds = ['health_data'];
  await recordHealthConsent(true);
  await recordConsentRows([
    { kind: 'ad_measurement', doc_slug: null, doc_version: null, granted: false, source: 'settings', platform: 'ios', app_version: '1.1.0', created_at: 'x' },
  ]);
  expect(mockInserts.flat().map((r) => r.kind)).toEqual(['ad_measurement']);
  expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull();
  expect(JSON.parse((await AsyncStorage.getItem(SIDE_PENDING_KEY)) as string)).toHaveLength(1);
  // migration uygulandı → sonraki oturumda yazılır
  mockRejectKinds = [];
  await flushPending('u1');
  expect(mockInserts.flat().map((r) => r.kind)).toEqual(['ad_measurement', 'health_data']);
  expect(await AsyncStorage.getItem(SIDE_PENDING_KEY)).toBeNull();
});

test('migration DOSYASI + rollback: CHECK listeleri ve my_consent_status health_data', () => {
  const up = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261111230100_g27_health_consent.sql'), 'utf8');
  const down = fs.readFileSync(path.join(ROOT, 'supabase/rollbacks/20261111230100_g27_health_consent_rollback.sql'), 'utf8');
  expect(up).toMatch(/'ai_coach', 'health_data'\)\)/);
  expect(up).toMatch(/'coach', 'takibe'\)\)/);
  expect(up).toMatch(/'health_data', \(/);
  expect(down).toMatch(/delete from public\.user_consents where kind = 'health_data' or source = 'takibe'/);
  expect(down).not.toMatch(/'health_data', \(/);
  expect(fs.existsSync(path.join(ROOT, 'supabase/migrations/20261111230100_g27_health_consent_rollback.sql'))).toBe(false);
});

test('Takibe › Seni tanıyalım: onaylı devamda kayıt (18 yaş altı yazılmaz)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/modules/onboarding/takibe/TakibeNavigator.tsx'), 'utf8');
  const next = src.slice(src.indexOf('const next = () => {\n    d.setBirthYear(birth);'));
  const underage = next.indexOf("navigate('TbUnderage')");
  const rec = next.indexOf("recordHealthConsent(true, 'takibe')");
  expect(underage).toBeGreaterThan(0);
  expect(rec).toBeGreaterThan(underage);
  expect(next.indexOf("navigate('TbActivity')")).toBeGreaterThan(rec);
});
