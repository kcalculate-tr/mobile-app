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
  SweepDeps,
  SweepSummary,
  VerificationDeps,
  VerificationRow,
  countAttemptsToday,
  planStart,
  processVerificationCallback,
  runVerificationSweep,
} from './paynkolay-verification-flow.ts'
import { lookupSales } from './paynkolay-report.ts'
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
  // Bugünün kayıtları (durum+not) — kendi iptal ettiği kayıtlar limite sayılmaz
  // (countsTowardDailyLimit); sayım saf fonksiyonda, testlenebilir.
  const { data: today, error: countErr } = await admin
    .from('card_verifications')
    .select('status, note')
    .eq('user_id', userId)
    .gte('created_at', trDayStartUtcIso(now))
    .limit(1000)
  if (openErr || countErr) throw new Error('doğrulama kayıtları okunamadı')

  const plan = planStart(open ?? [], countAttemptsToday(today ?? []), now)
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

// ══ SWEEP (aşama 4) ═══════════════════════════════════════════════════════════
const SWEEP_LOCK = 'card-verification-sweep'
const SWEEP_LOCK_TTL_SECONDS = 480 // çökerse 8 dk sonra kendiliğinden açılır (cron 5 dk'da bir)
const SWEEP_COLS =
  'id, user_id, client_ref_code, amount, status, note, refund_attempts, created_at, updated_at, ' +
  'paynkolay_reference_code, paynkolay_trx_date, charged_amount, last_refund_at, report_check_count, report_checked_at'

export interface SweepConfig extends VerificationConfig {
  reportSx: string
}

export function buildSweepDeps(admin: SupabaseClient, cfg: SweepConfig): SweepDeps<CardStorageEntry> {
  const base = buildVerificationDeps(admin, cfg)
  const owner = crypto.randomUUID()
  return {
    ...base,

    async acquireLock() {
      const { data, error } = await admin.rpc('acquire_sweep_lock', {
        p_name: SWEEP_LOCK, p_ttl_seconds: SWEEP_LOCK_TTL_SECONDS, p_owner: owner,
      })
      if (error) {
        console.error('[paynkolay-verification-sweep] kilit hatası:', error.message)
        return false
      }
      return data === true
    },

    async releaseLock() {
      const { error } = await admin.rpc('release_sweep_lock', { p_name: SWEEP_LOCK, p_owner: owner })
      if (error) console.error('[paynkolay-verification-sweep] kilit bırakma hatası:', error.message)
    },

    // Sweep'in ilgilenebileceği satırların ÜST KÜMESİ (cron'daki WHERE EXISTS ile aynı koşullar).
    async listCandidates() {
      const now = Date.now()
      const iso = (msAgo: number) => new Date(now - msAgo).toISOString()
      const MIN = 60 * 1000
      const HOUR = 60 * MIN
      const [initiated, watched, pending, stuck] = await Promise.all([
        admin.from('card_verifications').select(SWEEP_COLS).eq('status', 'initiated').lt('created_at', iso(15 * MIN)).limit(200),
        admin.from('card_verifications').select(SWEEP_COLS).eq('status', 'failed').in('note', ['timeout', 'cancelled'])
          .gt('created_at', iso(24 * HOUR)).lt('report_check_count', 6).limit(200),
        admin.from('card_verifications').select(SWEEP_COLS).eq('status', 'refund_pending').limit(200),
        admin.from('card_verifications').select(SWEEP_COLS).eq('status', 'succeeded').eq('refund_attempts', 0)
          .lt('updated_at', iso(5 * MIN)).limit(200),
      ])
      for (const r of [initiated, watched, pending, stuck]) {
        if (r.error) throw new Error(`aday satırlar okunamadı: ${r.error.message}`)
      }
      return [...(initiated.data ?? []), ...(watched.data ?? []), ...(pending.data ?? []), ...(stuck.data ?? [])] as unknown as VerificationRow[]
    },

    // GRUPLU rapor sorgusu (tek çağrı); güvenilmezse sınırlı, aralıklı tekil sorgu.
    async lookupSales(rows) {
      const { count } = await admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_provider', 'paynkolay')
        .eq('payment_status', 'paid')
        .gte('updated_at', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
      return await lookupSales({
        cfg: { reportSx: cfg.reportSx, secretKey: cfg.secretKey, vposUrl: cfg.vposUrl },
        refs: Array.from(new Set(rows.map((r) => r.client_ref_code))),
        now: new Date(),
        expectNonEmpty: (count ?? 0) > 0,
      })
    },

    async markReportChecked(items) {
      const nowIso = new Date().toISOString()
      for (const it of items) {
        const { error } = await admin
          .from('card_verifications')
          .update({ report_checked_at: nowIso, report_check_count: it.nextCount })
          .eq('id', it.id)
        if (error) console.error('[paynkolay-verification-sweep] rapor sayacı hatası:', error.message)
      }
    },

    async claimRefundAttempt(id, dueBeforeIso) {
      const { data, error } = await admin
        .from('card_verifications')
        .update({ last_refund_at: new Date().toISOString() })
        .eq('id', id)
        .in('status', ['refund_pending', 'succeeded'])
        .or(`last_refund_at.is.null,last_refund_at.lt.${dueBeforeIso}`)
        .select('id')
      if (error) {
        console.error('[paynkolay-verification-sweep] claim hatası:', error.message)
        return false
      }
      return (data?.length ?? 0) > 0
    },
  }
}

/** Sweep turu: kilitle -> tara/mutabık ol -> iade yeniden dene -> kilidi bırak; özet döner + loglanır. */
export async function runSweep(admin: SupabaseClient, cfg: SweepConfig): Promise<SweepSummary> {
  const summary = await runVerificationSweep(buildSweepDeps(admin, cfg))
  // GÜVENLİ LOG: yalnız sayaçlar ve rapor durum dağılımı (kart/token/secret/referans YOK).
  console.log('[paynkolay-verification-sweep] summary', summary)
  return summary
}
