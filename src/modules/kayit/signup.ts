// G42-S1 md.5/md.6/md.8/md.9 — Kayıt tamamlandıktan sonraki iş akışı (oturum açıldıktan sonra çağrılır).
//  · Politika kabulü + Meta onayı (G41 mantığı: acceptPolicies adOn) + 18+ beyanı
//  · Pazarlama onayı (mevcut notification_preferences.marketing_enabled; işaretsizse YAZILMAZ)
//  · A: plan G34 kolonlarına kaydedilir (savePlan), R1 taslağı silinir, plan e-postası denenir
//  · B: kısa profil beklemesi işaretlenir (ilk kalori kaydında açılır)
//  · Başlangıç kartı → ilk açılan sekme (tek seferlik)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../../core/supabase';
import { acceptPolicies } from '../../lib/consent/store';
import { setMarketingOptIn } from '../../lib/notify/marketing';
import { AGE_CONFIRMED_KEY, ONBOARDING_DONE_KEY } from '../onboarding/v2/loginLogic';
import { savePlan } from '../personalPlan/api';
import { computeKayitPlan, toPpSaved } from './plan';
import { readMuscleSurplus } from './settings';
import { dropDraft, kv, useKayit } from './store';
import { rememberStart, setShortPending } from './storage';

export interface SignupFinishInput {
  userId: string;
  method: 'apple' | 'google' | 'email';
  metaOn: boolean;
  marketingOn: boolean;
  lang: 'tr' | 'en';
  /** 18+ beyanı: A yolunda doğum yılından, B yolunda K1b kutusundan. */
  ageOk: boolean;
}

export interface SignupFinishResult {
  path: 'a' | 'b';
  planSaved: boolean;
  emailSent: boolean;
}

/** app_settings `kayit_plan_email_enabled` (oturumlu okunur; okunamazsa açık say — sunucu yine denetler). */
async function planEmailEnabled(): Promise<boolean> {
  try {
    const { data } = await getSupabaseClient().from('app_settings').select('value').eq('key', 'kayit_plan_email_enabled').maybeSingle();
    const v = (data as { value?: unknown } | null)?.value;
    return v !== false;
  } catch {
    return true;
  }
}

/** Plan özeti e-postası (`plan-email` edge function). Deploy yoksa / hata → false (bant gösterilmez). */
export async function sendPlanEmail(lang: 'tr' | 'en'): Promise<boolean> {
  if (!(await planEmailEnabled())) return false;
  try {
    const { data, error } = await getSupabaseClient().functions.invoke('plan-email', { body: { lang } });
    if (error) return false;
    return !!(data as { sent?: boolean } | null)?.sent;
  } catch {
    return false;
  }
}

export async function finishSignup(i: SignupFinishInput): Promise<SignupFinishResult> {
  const s = useKayit.getState();
  await acceptPolicies({ source: i.method === 'email' ? 'signup_email' : 'signup_social', adOn: i.metaOn, ageOk: i.ageOk }).catch(() => {});
  if (i.marketingOn) await setMarketingOptIn(true).catch(() => false);
  try {
    await AsyncStorage.multiSet([
      [ONBOARDING_DONE_KEY, 'true'],
      [AGE_CONFIRMED_KEY, 'true'],
    ]);
  } catch {
    /* yut */
  }
  await rememberStart(kv, s.start);

  if (s.path === 'b') {
    await setShortPending(kv, true);
    return { path: 'b', planSaved: false, emailSent: false };
  }

  const year = new Date().getFullYear();
  const startIso = new Date().toISOString().slice(0, 10);
  const surplus = await readMuscleSurplus();
  const plan = computeKayitPlan(s.answers, { currentYear: year, startIso, muscleSurplus: surplus }) ?? s.plan;
  let planSaved = false;
  if (plan) {
    const saved = toPpSaved(s.answers, plan, { startIso, nowIso: new Date().toISOString(), start: s.start });
    const r = await savePlan(i.userId, saved, year);
    planSaved = r.ok;
  }
  if (planSaved) await dropDraft();
  const emailSent = planSaved ? await sendPlanEmail(i.lang) : false;
  useKayit.getState().setEmailSent(emailSent);
  return { path: 'a', planSaved, emailSent };
}
