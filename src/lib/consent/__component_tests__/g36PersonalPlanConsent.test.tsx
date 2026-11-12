// G36-S1 md.8 (İlter 12 Kas, G34 SORULAR 2) — Kişisel plan sağlık rızası AYRI kaynak 'personal_plan'.
// Geçerli sağlık rızası (Takibe başla ya da önceki plan) varsa Giriş'te "Onaylandı", YENİ satır yok.
// Migration (20261112130100) canlıda değilken 'personal_plan' satırı reddedilirse yan kuyruktaki
// diğer satırlar (takibe, meal_plan) yine yazılır.
import AsyncStorage from '@react-native-async-storage/async-storage';
import fs from 'fs';
import path from 'path';

jest.mock('../../analytics', () => ({
  setAdConsent: () => Promise.resolve(),
  setFirstPartyConsent: () => Promise.resolve(),
}));

type Row = { kind: string; source: string; granted: boolean; user_id: string };
const mockInserts: Row[][] = [];
let mockRejectSources: string[] = [];
jest.mock('../../../core/supabase', () => {
  const client = {
    from: () => ({
      insert: (rows: Row[]) => {
        if (rows.some((r) => mockRejectSources.includes(r.source))) {
          return Promise.resolve({ error: { message: 'violates check constraint "user_consents_source_check"' } });
        }
        mockInserts.push(rows);
        return Promise.resolve({ error: null });
      },
    }),
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }) },
  };
  return { supabase: client, getSupabaseClient: () => client };
});

import { HEALTH_CONSENT_KEY, SIDE_PENDING_KEY, recordAllergenConsent, recordHealthConsent } from '../store';
import { grantHealthConsent, healthConsentGiven } from '../../../modules/personalPlan/api';

const ROOT = path.resolve(__dirname, '../../../..');

beforeEach(async () => {
  mockInserts.length = 0;
  mockRejectSources = [];
  await AsyncStorage.clear();
});

test('kişisel plan onayı → kind health_data / source personal_plan AYRI satır', async () => {
  expect(await healthConsentGiven()).toBe(false);
  await grantHealthConsent();
  const rows = mockInserts.flat();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ kind: 'health_data', source: 'personal_plan', granted: true, user_id: 'u1' });
  expect(await healthConsentGiven()).toBe(true);
});

test('Takibe sağlık rızası geçerliyse "Onaylandı": healthConsentGiven true, yeni satır yazılmaz', async () => {
  await recordHealthConsent(true, 'takibe');
  mockInserts.length = 0;
  expect(await healthConsentGiven()).toBe(true);
  await grantHealthConsent(); // akış bunu çağırmaz; çağrılsa bile aynı sürümde tekrar yazmaz
  expect(mockInserts.flat()).toHaveLength(0);
});

test('eski metin sürümü / geri alınmış rıza geçerli sayılmaz', async () => {
  await AsyncStorage.setItem(HEALTH_CONSENT_KEY, JSON.stringify({ granted: true, v: 0 }));
  expect(await healthConsentGiven()).toBe(false);
  await AsyncStorage.setItem(HEALTH_CONSENT_KEY, JSON.stringify({ granted: false, v: 1 }));
  expect(await healthConsentGiven()).toBe(false);
});

test('migration canlıda değil: personal_plan satırı bekler, yan kuyruktaki diğer satırlar yazılır', async () => {
  mockRejectSources = ['personal_plan'];
  await grantHealthConsent();
  expect(mockInserts.flat()).toHaveLength(0);
  await recordAllergenConsent(true); // yan kuyruk: [personal_plan, meal_plan]
  expect(mockInserts.flat().map((r) => r.source)).toEqual(['meal_plan']);
  const left = JSON.parse((await AsyncStorage.getItem(SIDE_PENDING_KEY)) as string) as Row[];
  expect(left.map((r) => r.source)).toEqual(['personal_plan']);
  mockRejectSources = [];
  await recordAllergenConsent(false); // migration uygulandı → bekleyen de yazılır
  expect(mockInserts.flat().map((r) => r.source)).toEqual(['meal_plan', 'personal_plan', 'meal_plan']);
  expect(await AsyncStorage.getItem(SIDE_PENDING_KEY)).toBeNull();
});

test('migration DOSYASI + rollback: source CHECK personal_plan ekler / G33 listesine döner (NOT VALID)', () => {
  const up = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261112130100_g36_personal_plan_consent.sql'), 'utf8');
  const down = fs.readFileSync(path.join(ROOT, 'supabase/rollbacks/20261112130100_g36_personal_plan_consent_rollback.sql'), 'utf8');
  expect(up).toMatch(/'takibe', 'meal_plan', 'personal_plan'\)\)/);
  expect(up).toMatch(/YALNIZ DOSYA/);
  expect(down).toMatch(/'takibe', 'meal_plan'\)\) not valid/);
  expect(down).not.toMatch(/delete from/);
});

test('akış: rıza geçerliyse Giriş "Onaylandı" (consentDone) ve grantHealthConsent çağrılmaz', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/modules/personalPlan/screens/PersonalPlanFlowScreen.tsx'), 'utf8');
  expect(src).toMatch(/setConsentDone\(consent\)/);
  expect(src).toMatch(/s\.answers\.consentHealth && !consentDone\) \{\s*void grantHealthConsent\(\)/);
});
