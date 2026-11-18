// Herkese açık paylaşım anlık görüntüsü istemcisi (G61-S1 md.3).
// Sunucu: supabase/migrations/20261118100100_g61_share.sql — create_share_snapshot /
// get_share_snapshot / revoke_share_snapshot. Migration canlıda yoksa (uygulanmadı)
// oluşturma null döner → paylaş sayfası bağlantı hedeflerini göstermez (görsel paylaşımı çalışır).
// `core/supabase` tembel yüklenir (Node testleri `setSnapshotRpc` ile sahte verir).

import { snapshotPayload, type SnapshotKind } from './cardModel';

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;

let rpcImpl: Rpc | null = null;

/** Testler için RPC enjekte et (null = gerçek istemci). */
export function setSnapshotRpc(fn: Rpc | null): void {
  rpcImpl = fn;
}

function rpc(): Rpc {
  if (rpcImpl) return rpcImpl;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sb = (require('../../core/supabase') as typeof import('../../core/supabase')).getSupabaseClient();
  return (fn, args) => sb.rpc(fn, args) as unknown as ReturnType<Rpc>;
}

export type SnapshotRecord = {
  id: string;
  kind: SnapshotKind;
  payload: Record<string, unknown>;
  createdAt: string | null;
  /** Sahibin herkese açık adı / kullanıcı adı (varsa). */
  ownerName: string | null;
  ownerHandle: string | null;
};

/** Anlık görüntü oluşturur → kısa kimlik. Başarısızsa null (bağlantısız devam). */
export async function createShareSnapshot(kind: SnapshotKind, data: Record<string, unknown>): Promise<string | null> {
  try {
    const { data: id, error } = await rpc()('create_share_snapshot', { p_kind: kind, p_payload: snapshotPayload(kind, data) });
    if (error || typeof id !== 'string' || !/^[A-Za-z0-9]{6,16}$/.test(id)) return null;
    return id;
  } catch {
    return null;
  }
}

/** Anlık görüntüyü okur (anon da okuyabilir). Yok / iptal / hata → null. */
export async function getShareSnapshot(id: string): Promise<SnapshotRecord | null> {
  if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return null;
  try {
    const { data, error } = await rpc()('get_share_snapshot', { p_id: id });
    if (error || !data) return null;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    if (!row || typeof row.kind !== 'string') return null;
    const kind = row.kind as SnapshotKind;
    if (kind !== 'meal' && kind !== 'day' && kind !== 'xray') return null;
    return {
      id,
      kind,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      createdAt: typeof row.created_at === 'string' ? row.created_at : null,
      ownerName: typeof row.owner_name === 'string' ? row.owner_name : null,
      ownerHandle: typeof row.owner_handle === 'string' ? row.owner_handle : null,
    };
  } catch {
    return null;
  }
}

/** Sahibi anlık görüntüyü iptal eder (bağlantı "Bu içerik artık yok" gösterir). */
export async function revokeShareSnapshot(id: string): Promise<boolean> {
  try {
    const { data, error } = await rpc()('revoke_share_snapshot', { p_id: id });
    return !error && data === true;
  } catch {
    return false;
  }
}

export type SharePreview = { kind: string; gone?: boolean; expired?: boolean } & Record<string, unknown>;

/** l.eatkcal.com önizlemesi (anon da çağırır) — get_share_preview. Hata → gone. */
export async function getSharePreview(kind: string, id: string): Promise<SharePreview> {
  try {
    const { data, error } = await rpc()('get_share_preview', { p_kind: kind, p_id: id });
    if (error || !data || typeof data !== 'object') return { kind, gone: true };
    return data as SharePreview;
  } catch {
    return { kind, gone: true };
  }
}
