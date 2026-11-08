// Test saplaması: @supabase/supabase-js createClient — her çağrıyı kaydeden sahte istemci.
// Durum globalThis.__fakeDb'den okunur (test her senaryoda sıfırlar).
export type Op = { table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> };

export interface FakeDb {
  ops: Op[];
  ordersByAdisyoId: Map<number, number>;
  existingEvents: Map<string, { id: number; processed: boolean }>;
  nextEventId: number;
  rpcError?: string | null;
}

const g = globalThis as unknown as { __fakeDb: FakeDb };

class Query {
  private filters: Array<[string, unknown]> = [];
  private kind = "select";
  private payload: unknown = undefined;
  private wantSingle = false;
  constructor(private table: string) {}

  // insert/update sonrası .select() türü değiştirmez (supabase-js'teki gibi "returning").
  select(_cols?: string) { return this; }
  insert(row: unknown) { this.kind = "insert"; this.payload = row; return this; }
  update(row: unknown) { this.kind = "update"; this.payload = row; return this; }
  eq(col: string, val: unknown) { this.filters.push([col, val]); return this; }
  maybeSingle() { this.wantSingle = true; return this.exec(); }
  single() { this.wantSingle = true; return this.exec(); }
  then<T>(res: (v: unknown) => T, rej?: (e: unknown) => T) { return this.exec().then(res, rej); }

  private exec(): Promise<{ data: unknown; error: unknown }> {
    const db = g.__fakeDb;
    const op: Op = { table: this.table, op: this.kind, filters: [...this.filters] };
    if (this.payload !== undefined) op.payload = JSON.parse(JSON.stringify(this.payload));
    db.ops.push(op);

    if (this.kind === "select" && this.table === "adisyo_webhook_events") {
      const ev = db.existingEvents.get(String(this.filters.find(([c]) => c === "event_id")?.[1]));
      return Promise.resolve({ data: ev ?? null, error: null });
    }
    if (this.kind === "select" && this.table === "orders") {
      const id = db.ordersByAdisyoId.get(Number(this.filters.find(([c]) => c === "adisyo_order_id")?.[1]));
      return Promise.resolve({ data: id ? { id } : null, error: null });
    }
    if (this.kind === "insert" && this.table === "adisyo_webhook_events") {
      const id = db.nextEventId++;
      return Promise.resolve({ data: { id, ...(this.payload as object) }, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }
}

export function createClient(_url: string, _key: string) {
  return {
    from(table: string) { return new Query(table); },
    rpc(name: string, args: unknown) {
      const db = g.__fakeDb;
      db.ops.push({ table: `rpc:${name}`, op: "rpc", payload: JSON.parse(JSON.stringify(args)), filters: [] });
      return Promise.resolve(db.rpcError ? { data: null, error: { message: db.rpcError } } : { data: "inserted", error: null });
    },
  };
}
export type SupabaseClient = ReturnType<typeof createClient>;
