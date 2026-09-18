// Kart Ekle (1 TL doğrulama) — GERÇEK bağımlılıklar (Supabase + PaynKolay).
// Orkestrasyon/iş kuralları import'suz modüllerde (paynkolay-verification-flow.ts)
// ve Node testlerinde sahte bağımlılıklarla doğrulanır; bu dosya sadece bağlar.
// orders / refunds tablolarına YAZMAZ. Log'a kart/token/secret yazılmaz.

import { SupabaseClient } from '@supabase/supabase-js'
import {
  CardStorageEntry,
  deleteCardFromPaynkolay,
  fetchCardStorageListDiag,
  pick,
  upsertUserCard,
} from './paynkolay-cards.ts'
import { cancelOrRefundTransaction } from './paynkolay-refund.ts'
import {
  CallbackFields,
  CallbackOutcome,
  VerificationDeps,
  VerificationRow,
  planStart,
  processVerificationCallback,
} from './paynkolay-verification-flow.ts'
import { VERIFICATION_AMOUNT, newVerificationRefCode, trDayStartUtcIso } from './paynkolay-verification.ts'

export interface VerificationConfig {
  secretKey: string
  sx: string
  vposUrl: string
  cancelSx: string
}

export function extractCallbackFields(data: Record<string, unknown>): CallbackFields {
  return {
    merchantNo: pick(data, 'MERCHANT_NO', 'merchantNo'),
    referenceCode: pick(data, 'REFERENCE_CODE', 'referenceCode'),
    authCode: pick(data, 'AUTH_CODE', 'authCode'),
    responseCode: pick(data, 'RESPONSE_CODE', 'responseCode'),
    use3D: pick(data, 'USE_3D', 'use3D'),
    rnd: pick(data, 'RND', 'rnd'),
    installment: pick(data, 'INSTALLMENT', 'installment'),
    authorizationAmount: pick(data, 'AUTHORIZATION_AMOUNT', 'authorizationAmount'),
    currencyCode: pick(data, 'CURRENCY_CODE', 'currencyCode'),
    incomingHash: pick(data, 'hashDataV2', 'HASHDATAV2', 'hashData'),
    clientRefCode: pick(data, 'clientRefCode', 'CLIENT_REFERENCE_CODE', 'clientReferenceCode'),
    responseMessage: pick(data, 'RESPONSE_MESSAGE', 'responseMessage', 'RESPONSE_DATA'),
    txnTimestamp: pick(data, 'TIMESTAMP', 'timestamp', 'TRANSACTION_DATE'),
    tranId: pick(data, 'TRAN_ID', 'TranId', 'tranId', 'csTranId', 'CS_TRAN_ID'),
  }
}

const ROW_COLS = 'id, user_id, client_ref_code, amount, status, note, refund_attempts, created_at'

export function buildVerificationDeps(admin: SupabaseClient, cfg: VerificationConfig): VerificationDeps<CardStorageEntry> {
  return {
    now: () => new Date(),
    secretKey: cfg.secretKey,

    async getByRef(ref) {
      const { data } = await admin.from('card_verifications').select(ROW_COLS).eq('client_ref_code', ref).maybeSingle()
      return (data as VerificationRow | null) ?? null
    },

    // Tek seferlik geçiş: yalnız 'initiated' VEYA 'failed' satır alınabilir (koşullu UPDATE, atomik).
    async claimSucceeded(id, patch) {
      const { data, error } = await admin
        .from('card_verifications')
        .update(patch)
        .eq('id', id)
        .in('status', ['initiated', 'failed'])
        .select('id')
      if (error) {
        console.error('[paynkolay-verification] claim hatası:', error.message)
        return false
      }
      return (data?.length ?? 0) > 0
    },

    async markFailed(id, note) {
      const { data, error } = await admin
        .from('card_verifications')
        .update({ status: 'failed', note })
        .eq('id', id)
        .eq('status', 'initiated')
        .select('id')
      if (error) {
        console.error('[paynkolay-verification] markFailed hatası:', error.message)
        return false
      }
      return (data?.length ?? 0) > 0
    },

    async updateRow(id, patch) {
      const { error } = await admin.from('card_verifications').update(patch).eq('id', id)
      if (error) console.error('[paynkolay-verification] güncelleme hatası:', error.message)
    },

    async getCustomerKey(userId) {
      const { data } = await admin.from('profiles').select('payment_customer_key').eq('id', userId).maybeSingle()
      return String(data?.payment_customer_key ?? '')
    },

    async listCards(customerKey) {
      const diag = await fetchCardStorageListDiag(cfg.vposUrl, cfg.sx, cfg.secretKey, customerKey)
      return diag.entries
    },

    async saveCard(userId, customerKey, entry) {
      await upsertUserCard(admin, userId, customerKey, entry)
    },

    async deleteRemoteCard(customerKey, entry) {
      const r = await deleteCardFromPaynkolay({
        vposUrl: cfg.vposUrl, sx: cfg.sx, secretKey: cfg.secretKey,
        customerKey, tranId: entry.tranId, token: entry.token,
      })
      return r.ok
    },

    async refund(req) {
      if (!cfg.cancelSx || !cfg.secretKey || !cfg.vposUrl) throw new Error('iade yapılandırması eksik')
      return await cancelOrRefundTransaction(
        { cancelSx: cfg.cancelSx, secretKey: cfg.secretKey, vposUrl: cfg.vposUrl },
        req,
      )
    },

    async audit(reason, data, userId) {
      try {
        await admin.from('failed_payments').insert([{
          user_id: userId,
          error_message: `Kart doğrulama: ${reason}`,
          amount: 0,
          payment_method: 'kart-dogrulama',
          order_data: { reason, ...data },
          created_at: new Date().toISOString(),
        }])
      } catch (e) {
        console.error('[paynkolay-verification] audit insert hatası:', e)
      }
    },
  }
}

/** Callback'in KCALVER dalı. redirectSuccess: WebView'in yakalayacağı son URL (asıl sonuç verify_status ile okunur). */
export async function handleVerificationCallback(
  admin: SupabaseClient,
  data: Record<string, unknown>,
  cfg: VerificationConfig,
): Promise<{ outcome: CallbackOutcome; redirectSuccess: boolean }> {
  const fields = extractCallbackFields(data)
  const outcome = await processVerificationCallback(buildVerificationDeps(admin, cfg), fields)
  // GÜVENLİ LOG: yalnız sonuç türü/durum (kart, token, referans kodu YOK).
  console.log('[paynkolay-verification] callback', {
    outcome: outcome.kind,
    status: outcome.kind === 'succeeded' ? outcome.status : undefined,
    cardSaved: outcome.kind === 'succeeded' ? outcome.cardSaved : undefined,
    note: outcome.kind === 'succeeded' || outcome.kind === 'failed' ? outcome.note : undefined,
  })
  const redirectSuccess =
    outcome.kind === 'succeeded' || (outcome.kind === 'already_processed' && outcome.redirectSuccess)
  return { outcome, redirectSuccess }
}

// ── Başlatma yardımcıları ─────────────────────────────────────────────────────
export async function prepareVerificationStart(admin: SupabaseClient, userId: string, now: Date = new Date()) {
  const { data: open, error: openErr } = await admin
    .from('card_verifications')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('status', 'initiated')
  const { count, error: countErr } = await admin
    .from('card_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', trDayStartUtcIso(now))
  if (openErr || countErr) throw new Error('doğrulama kayıtları okunamadı')

  const plan = planStart(open ?? [], count ?? 0, now)
  if (plan.timeoutIds.length > 0) {
    // Zaman aşımı: 'failed' + note='timeout'. Geç gelen "ödeme alındı" callback'i yine de
    // işlenir (claim 'failed' satırı da alır) — para hareketi iade edilmeden kalmaz.
    await admin
      .from('card_verifications')
      .update({ status: 'failed', note: 'timeout' })
      .in('id', plan.timeoutIds)
      .eq('status', 'initiated')
  }
  return plan
}

export async function insertVerification(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: true; id: string; clientRefCode: string } | { ok: false; conflict: boolean }> {
  const id = crypto.randomUUID()
  const clientRefCode = newVerificationRefCode(id)
  const { error } = await admin.from('card_verifications').insert([{
    id, user_id: userId, client_ref_code: clientRefCode, amount: VERIFICATION_AMOUNT, status: 'initiated',
  }])
  if (error) {
    // 23505: kullanıcı başına tek açık kayıt kuralı (eşzamanlı ikinci başlatma)
    return { ok: false, conflict: (error as { code?: string }).code === '23505' }
  }
  return { ok: true, id, clientRefCode }
}
