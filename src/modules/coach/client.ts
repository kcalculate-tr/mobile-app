// G24-S1 md.3 — kcalAI Koç sunucu istemcisi. Mesaj gönderimi YALNIZ `coach-chat` edge fonksiyonu
// (coach_messages'a istemci yazamaz). Okuma/geri bildirim/silme RLS ile doğrudan.
// `core/supabase` tembel require (Node testleri için).
import type { CoachErrorCode, CoachMessage, CoachRef, CoachStatus } from './types';
import { statusFrom } from './model';

type SupabaseModule = typeof import('../../core/supabase');
function sb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../core/supabase') as SupabaseModule).getSupabaseClient();
}

export class CoachError extends Error {
  constructor(public code: CoachErrorCode, public status: CoachStatus | null = null) {
    super(code);
  }
}

type ResponseLike = { status?: number; clone?: () => ResponseLike; json?: () => Promise<unknown> };

/** functions.invoke hatası → kod. 404 = fonksiyon yok (deploy edilmemiş) → 'unavailable'. */
export async function coachErrorFromInvoke(error: unknown): Promise<CoachError> {
  const e = error as { name?: string; context?: ResponseLike } | null;
  if (e?.name === 'FunctionsFetchError') return new CoachError('network');
  if (e?.name === 'FunctionsRelayError') return new CoachError('server');
  const ctx = e?.context;
  const status = typeof ctx?.status === 'number' ? ctx.status : null;
  let body: Record<string, unknown> | null = null;
  try {
    const res = ctx && typeof ctx.clone === 'function' ? ctx.clone() : ctx;
    if (res && typeof res.json === 'function') body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  const code = typeof body?.error === 'string' ? body.error : null;
  if (status === 404 && code == null) return new CoachError('unavailable');
  if (status === 402 || code === 'quota') return new CoachError('quota', statusFrom(body?.status));
  if (status === 429 || code === 'rate_limit') return new CoachError('rate_limit');
  return new CoachError('server');
}

export function normalizeMessage(raw: unknown): CoachMessage | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (typeof o.body !== 'string' || (o.role !== 'user' && o.role !== 'assistant')) return null;
  return {
    id: typeof o.id === 'string' ? o.id : `local-${Math.random().toString(36).slice(2)}`,
    role: o.role,
    body: o.body,
    cards: Array.isArray(o.cards) ? (o.cards as CoachMessage['cards']) : null,
    feedback: o.feedback === 1 || o.feedback === -1 ? o.feedback : null,
    created_at: typeof o.created_at === 'string' ? o.created_at : new Date().toISOString(),
  };
}

export interface SendResult {
  userMessage: CoachMessage | null;
  reply: CoachMessage;
  status: CoachStatus | null;
  safety: 'medical' | 'ed' | null;
}

export async function sendCoachMessage(message: string, lang: 'tr' | 'en', ref?: CoachRef | null): Promise<SendResult> {
  // G36 md.13: kişisel plan bağlamı yalnız Koç AI izni açıksa (sunucu son rıza satırını da denetler).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { hasCoachConsent } = require('./access') as typeof import('./access'); // access → client döngüsü yok
  const aiConsent = await hasCoachConsent().catch(() => false);
  const { data, error } = await sb().functions.invoke('coach-chat', {
    body: { message, lang, ai_consent: aiConsent, ...(ref ? { ref } : {}) },
  });
  if (error) throw await coachErrorFromInvoke(error);
  const d = (data ?? {}) as Record<string, unknown>;
  const reply = normalizeMessage(d.reply);
  if (!reply) throw new CoachError('server');
  return {
    userMessage: normalizeMessage(d.user_message),
    reply,
    status: statusFrom(d.status),
    safety: d.safety === 'medical' || d.safety === 'ed' ? d.safety : null,
  };
}

export async function fetchCoachMessages(limit = 120): Promise<CoachMessage[]> {
  const { data, error } = await sb()
    .from('coach_messages')
    .select('id, role, body, cards, feedback, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new CoachError('server');
  return ((data ?? []) as unknown[])
    .map(normalizeMessage)
    .filter((m): m is CoachMessage => m != null)
    .reverse();
}

export async function fetchCoachStatus(): Promise<CoachStatus | null> {
  try {
    const { data, error } = await sb().rpc('my_coach_status');
    return error ? null : statusFrom(data);
  } catch {
    return null;
  }
}

export async function setCoachFeedback(id: string, value: -1 | 1 | null): Promise<boolean> {
  const { error } = await sb().from('coach_messages').update({ feedback: value }).eq('id', id);
  return !error;
}

export async function deleteCoachHistory(): Promise<boolean> {
  const { error } = await sb().rpc('delete_coach_history');
  return !error;
}

/**
 * Fonksiyon deploy edilmiş mi? GET → fonksiyon 405 döner (var); ağ geçidi 404 (yok).
 * Ağ hatası → 'unknown' (giriş gösterilir; gönderimde hata hâli).
 */
export async function probeCoachFunction(): Promise<'ok' | 'missing' | 'unknown'> {
  try {
    const { error } = await sb().functions.invoke('coach-chat', { method: 'GET' });
    if (!error) return 'ok';
    const e = error as { name?: string; context?: ResponseLike };
    if (e.name === 'FunctionsFetchError' || e.name === 'FunctionsRelayError') return 'unknown';
    const status = typeof e.context?.status === 'number' ? e.context.status : null;
    if (status === 404) return 'missing';
    return 'ok';
  } catch {
    return 'unknown';
  }
}
