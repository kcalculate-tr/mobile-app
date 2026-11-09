// G19-S2 md.2 — Çevrimdışı kayıt kuyruğu (meal_consumptions yazımları). SAF
// çekirdek: depolama ve yürütücü dışarıdan verilir → tsx ile birim testli. RN
// bağı (AsyncStorage + Supabase + NetInfo) `logQueueNative.ts`'te.
//
// Kurallar:
//  · Ekleme İSTEMCİDE üretilen `id` (uuid) ile yapılır → yeniden deneme
//    idempotent: aynı satır ikinci kez gelirse 23505 (birincil anahtar) = başarı.
//  · Sıra korunur (FIFO); bir işlem "yeniden dene" derse kuyruk orada durur.
//  · Sıkıştırma: bekleyen ekleme + silme → ikisi de düşer; ekleme + güncelleme →
//    eklemeye katılır; güncelleme + güncelleme → birleşir; güncelleme + silme →
//    yalnız silme kalır.
//  · Kalıcı hata (RLS/CHECK — 42501/23514/22xxx) → işlem düşer, çağırana bildirilir
//    (ekran satırı geri alır); ağ/5xx → kalır, sonra denenir.
//  · Kuyruk en fazla MAX_OPS işlem; taşarsa EN ESKİ değil EN YENİ reddedilir
//    (eski kayıtlar sırayla gitsin; kullanıcıya "kaydedilemedi").

export type QueueRow = Record<string, unknown> & { id: string };

export type QueueOp =
  | { kind: 'insert'; id: string; row: QueueRow; at: number }
  | { kind: 'update'; id: string; patch: Record<string, unknown>; at: number }
  | { kind: 'delete'; id: string; at: number };

export type ExecResult = 'ok' | 'retry' | 'drop';

export const MAX_OPS = 200;

/** Yeni işlemi kuyruğa sıkıştırarak ekler. Taşma → null (reddedildi). */
export function enqueue(queue: readonly QueueOp[], op: QueueOp): QueueOp[] | null {
  const q = queue.slice();
  const idx = (kind: QueueOp['kind']) => q.findIndex((o) => o.id === op.id && o.kind === kind);
  if (op.kind === 'delete') {
    const ins = idx('insert');
    // Sunucuya hiç gitmemiş satırın silinmesi: ikisi de düşer.
    const rest = q.filter((o) => !(o.id === op.id && (o.kind === 'update' || o.kind === 'insert')));
    if (ins >= 0) return rest;
    if (rest.some((o) => o.id === op.id && o.kind === 'delete')) return rest;
    if (rest.length >= MAX_OPS) return null;
    rest.push(op);
    return rest;
  }
  if (op.kind === 'update') {
    const ins = idx('insert');
    if (ins >= 0) {
      const cur = q[ins] as Extract<QueueOp, { kind: 'insert' }>;
      q[ins] = { ...cur, row: { ...cur.row, ...op.patch, id: cur.id } };
      return q;
    }
    const up = idx('update');
    if (up >= 0) {
      const cur = q[up] as Extract<QueueOp, { kind: 'update' }>;
      q[up] = { ...cur, patch: { ...cur.patch, ...op.patch } };
      return q;
    }
    if (q.length >= MAX_OPS) return null;
    q.push(op);
    return q;
  }
  // insert: aynı id'li bekleyen silme varsa (geri al) silme düşer; satır sunucuda
  // zaten duruyorsa ekleme 23505 ile "başarı" sayılır.
  const del = idx('delete');
  if (del >= 0) {
    q.splice(del, 1);
    return q;
  }
  if (idx('insert') >= 0) return q; // çift ekleme: ilki yeter
  if (q.length >= MAX_OPS) return null;
  q.push(op);
  return q;
}

export interface FlushOutcome {
  queue: QueueOp[];
  done: QueueOp[];
  dropped: QueueOp[];
  stopped: boolean;
}

/** Kuyruğu sırayla yürütür; 'retry'de durur. */
export async function flush(
  queue: readonly QueueOp[],
  exec: (op: QueueOp) => Promise<ExecResult>,
): Promise<FlushOutcome> {
  const done: QueueOp[] = [];
  const dropped: QueueOp[] = [];
  let i = 0;
  for (; i < queue.length; i += 1) {
    let r: ExecResult;
    try {
      r = await exec(queue[i]);
    } catch {
      r = 'retry';
    }
    if (r === 'retry') break;
    if (r === 'ok') done.push(queue[i]);
    else dropped.push(queue[i]);
  }
  return { queue: queue.slice(i), done, dropped, stopped: i < queue.length };
}

/** Supabase/PostgREST hatasını sınıflar. */
export function classifyError(kind: QueueOp['kind'], err: { code?: string; status?: number; message?: string } | null): ExecResult {
  if (!err) return 'ok';
  const code = String(err.code ?? '');
  if (kind === 'insert' && code === '23505') return 'ok'; // zaten yazılmış (idempotent)
  if (code === '42501' || code === '23514' || code === '23502' || code === '22P02' || code.startsWith('22') || code === 'PGRST204') return 'drop';
  const status = Number(err.status ?? 0);
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return 'drop';
  return 'retry';
}

/** Ekranın bekleyen işlemleri görünür tutması için: kuyruğu satır listesine uygula. */
export function applyPending<T extends { id: string }>(rows: readonly T[], queue: readonly QueueOp[]): T[] {
  let out = rows.slice();
  for (const op of queue) {
    if (op.kind === 'insert') {
      if (!out.some((r) => r.id === op.id)) out = [op.row as unknown as T, ...out];
    } else if (op.kind === 'update') {
      out = out.map((r) => (r.id === op.id ? ({ ...r, ...op.patch } as T) : r));
    } else {
      out = out.filter((r) => r.id !== op.id);
    }
  }
  return out;
}

/** Yeniden deneme bekleme süresi (ms): 2 s, 4 s, 8 s … en fazla 60 s. */
export function backoffMs(attempt: number): number {
  return Math.min(60_000, 2000 * 2 ** Math.max(0, attempt));
}

/** RFC4122 v4 — `rand` 16 bayt döndürür (native: expo-crypto; test: sabit). */
export function uuidFromBytes(b: Uint8Array): string {
  const x = Array.from(b.slice(0, 16));
  x[6] = (x[6] & 0x0f) | 0x40;
  x[8] = (x[8] & 0x3f) | 0x80;
  const h = x.map((n) => n.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
