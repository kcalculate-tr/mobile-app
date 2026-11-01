-- Recovered from live DB history (supabase_migrations.schema_migrations) on 2026-11-02
-- version: 20261027135958  name: feedback_vitrin_onayi
-- Geri bildirimlerin anasayfa vitrinine cikabilmesi icin onay alani.
-- Varsayilan FALSE: hicbir geri bildirim Boss panelden onaylanmadan yayina cikmaz.
-- Sikayetler (1-2 yildiz) bu sekilde kazara vitrine dusemez.
alter table public.feedback
  add column if not exists is_approved boolean not null default false,
  add column if not exists approved_at timestamptz;

create index if not exists feedback_vitrin_idx
  on public.feedback (is_approved, rating desc, created_at desc)
  where is_approved;
