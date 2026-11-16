// G55 önizleme — sahte supabase (ağ yok, anahtar yok). Kayıt yükünü window.__saved'e yazar.
const SAMPLE = [{
  id: 'demo-1', name: 'Örnek kampanya', title: 'Yeni Kcalculate geldi 🎉', body: 'Örnek metin',
  title_en: null, body_en: null, target_type: 'all', status: 'sent', target_count: 829, sent_count: 368,
  failed_count: 0, skipped_count: 461, error_message: null, opened_count: 0, created_at: '2026-11-14T20:25:04Z', sent_at: '2026-11-14T20:26:02Z',
}];
function chain(table) {
  let op = 'select'; let payload = null;
  const q = {
    select() { return q; }, order() { return q; }, limit() { return q; }, eq() { return q; }, single() { return q; },
    insert(p) { op = 'insert'; payload = p; return q; },
    update(p) { op = 'update'; payload = p; return q; },
    delete() { op = 'delete'; return q; },
    then(res) {
      if (op === 'insert' || op === 'update') {
        window.__saved = { table, op, payload };
        window.dispatchEvent(new Event('g55-saved'));
        return res({ data: { id: 'demo-new', ...payload }, error: null });
      }
      return res({ data: table === 'notification_campaigns' ? SAMPLE : [], error: null });
    },
  };
  return q;
}
export const supabase = {
  from: chain,
  rpc: (_n, a) => Promise.resolve({ data: { all: 829, macro_members: 41 }[a?.p_target_type] ?? 120, error: null }),
  functions: { invoke: () => Promise.resolve({ data: {}, error: null }) },
  auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
};
