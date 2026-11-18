// G61-S1 md.3 — l.eatkcal.com/i/<kod> ile gelen davet kodu: cihazda saklanır, sepetteki
// "Davet kodun var mı?" satırı (CartInviteCodeRow) açık + dolu gelir. Kod 30 gün geçerli;
// uygulanınca / reddedilince silinir. Kişisel veri yok (yalnız kod).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeReferralCode, referralCodeLooksValid } from '../../modules/eatkcal/v2/growth/referral';

export const PENDING_INVITE_KEY = '@kcal_pending_invite_v1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function savePendingInvite(code: string, nowMs: number = Date.now()): Promise<string | null> {
  const c = normalizeReferralCode(code);
  if (!referralCodeLooksValid(c)) return null;
  try {
    await AsyncStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ code: c, at: nowMs }));
  } catch {
    /* depolama yoksa kod yalnız bu oturumda gösterilir */
  }
  return c;
}

export async function readPendingInvite(nowMs: number = Date.now()): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_INVITE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { code?: string; at?: number };
    if (!v.code || !referralCodeLooksValid(v.code) || typeof v.at !== 'number' || nowMs - v.at > TTL_MS) {
      await AsyncStorage.removeItem(PENDING_INVITE_KEY);
      return null;
    }
    return v.code;
  } catch {
    return null;
  }
}

export async function clearPendingInvite(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    /* yok say */
  }
}
