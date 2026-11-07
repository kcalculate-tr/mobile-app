// G17-S2 md.6 — Tara hata teşhisi (istemci). Canlıda analyze-ai-scan 500 dönüyor
// (7 Kas 12:32: yükleme 200 → analiz 500, ~200 ms). Edge yanıt gövdesindeki
// `error` kodu (config / server / ai / timeout / parse / model / forbidden …)
// istemcide kayboluyordu (`functions.invoke` yalnız "non-2xx" mesajı verir).
// Burada kod + HTTP durumu + aşama (upload/analyze) çıkarılır; çağıran LOG'a
// ve Sentry'ye yazar, kullanıcı yine FinErrFailed görür. SAF modül (native yok).

export type ScanFailureStage = 'reserve' | 'upload' | 'analyze';
const STAGE_LABEL: Record<ScanFailureStage, string> = { reserve: 'reserve_ai_scan', upload: 'scan_upload', analyze: 'analyze-ai-scan' };

export interface ScanFailureInfo {
  stage: ScanFailureStage;
  /** Edge gövdesindeki `error` kodu; yoksa 'network' | 'relay' | 'http_<durum>' | 'unknown'. */
  code: string;
  httpStatus: number | null;
  message: string;
}

/** Aşaması ve edge hata kodu bilinen tarama hatası. */
export class ScanStageError extends Error {
  readonly stage: ScanFailureStage;
  readonly code: string;
  readonly httpStatus: number | null;

  constructor(stage: ScanFailureStage, code: string, httpStatus: number | null, message?: string) {
    super(message ?? `${STAGE_LABEL[stage]}: ${code}${httpStatus ? ` (${httpStatus})` : ''}`);
    this.name = 'ScanStageError';
    this.stage = stage;
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Edge JSON gövdesinden `error` kodu (güvenli karakterler, en fazla 40). */
export function edgeErrorCodeFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as { error?: unknown }).error;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim().slice(0, 40).replace(/[^A-Za-z0-9_.-]/g, '_');
}

type ResponseLike = { status?: number; clone?: () => ResponseLike; json?: () => Promise<unknown>; text?: () => Promise<string> };

/**
 * `supabase.functions.invoke` hatasını (FunctionsHttpError / FunctionsFetchError /
 * FunctionsRelayError) ScanStageError('analyze', kod, durum)'a çevirir.
 * FunctionsHttpError.context = edge Response → gövde okunur.
 */
export async function analyzeErrorFromInvoke(error: unknown): Promise<ScanStageError> {
  const e = error as { name?: string; message?: string; context?: ResponseLike } | null;
  const name = e?.name ?? '';
  const ctx = e?.context;
  const status = typeof ctx?.status === 'number' ? ctx.status : null;
  if (name === 'FunctionsFetchError') return new ScanStageError('analyze', 'network', null);
  if (name === 'FunctionsRelayError') return new ScanStageError('analyze', 'relay', status);
  let code: string | null = null;
  if (ctx) {
    try {
      const res = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
      if (typeof res.json === 'function') code = edgeErrorCodeFromBody(await res.json());
      else if (typeof res.text === 'function') code = edgeErrorCodeFromBody(JSON.parse(await res.text()));
    } catch {
      code = null; // gövde JSON değil / zaten okunmuş
    }
  }
  return new ScanStageError('analyze', code ?? (status ? `http_${status}` : 'unknown'), status);
}

/** Yakalanan herhangi bir hatadan teşhis bilgisi (aşama bilinmiyorsa çağıranınki). */
export function scanFailureInfo(e: unknown, fallbackStage: ScanFailureStage): ScanFailureInfo {
  if (e instanceof ScanStageError) {
    return { stage: e.stage, code: e.code, httpStatus: e.httpStatus, message: e.message };
  }
  const message = e instanceof Error ? e.message : String(e ?? 'unknown');
  let code = 'unknown';
  if (fallbackStage === 'upload') {
    const m = /^scan_upload:\s*(no_user|image_too_large)$/.exec(message);
    code = m ? m[1] : /^scan_upload:/.test(message) ? 'storage' : 'upload_failed';
  }
  return { stage: fallbackStage, code, httpStatus: null, message };
}
