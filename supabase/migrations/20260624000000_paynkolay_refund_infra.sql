-- ============================================================================
-- ADIM 1: Paynkolay iade/sorgulama altyapisi
-- orders  -> Paynkolay referans + islem tarihi (CancelRefundPayment icin zorunlu)
-- refunds -> tablo + audit alanlari (type, referans, ham yanit)
--
-- ⚠️ KAYIT AMACLIDIR. Ilter Supabase SQL Editor'da ELLE calistirir.
--    `supabase db push` ILE UYGULANMAZ (migration history reconcile sorunu var;
--    bu dosya schema_migrations'a yazilmaz, sadece repo gecmisi icin durur).
--
-- Canli sema teyidi (anon/PostgREST introspection, 2026-06-24):
--   orders.id / refund_amount / refunded_at / merchant_oid -> VAR (dokunulmaz)
--   orders.paynkolay_reference_code / paynkolay_trx_date    -> YOK (eklenecek)
--   public.refunds                                          -> YOK (kurulacak)
--
-- Tumu idempotent: IF NOT EXISTS. Tekrar calistirmak GUVENLI.
-- ============================================================================

-- 1) orders: Paynkolay CancelRefundPayment'in istedigi referans + trxDate.
--    Callback basari yolunda (ADIM 2) yazilacak. Refsiz eski order'lar icin
--    paynkolay-query (ADIM 3) fallback ile cozulecek.
alter table public.orders
  add column if not exists paynkolay_reference_code text,
  add column if not exists paynkolay_trx_date       text;

comment on column public.orders.paynkolay_reference_code is
  'Paynkolay REFERENCE_CODE (IKSIRPF...). CancelRefundPayment icin zorunlu.';
comment on column public.orders.paynkolay_trx_date is
  'Paynkolay orijinal islem tarihi (yyyy.mm.dd). CancelRefundPayment trxDate alani.';

-- 2) refunds: TABLO YOK -> olustur. Mevcut boss panel insert'i ile birebir uyumlu
--    (order_id, amount, reason, created_at). Tablo varsa bu blok atlanir.
create table if not exists public.refunds (
  id          bigint generated always as identity primary key,
  order_id    bigint references public.orders(id) on delete set null,
  amount      numeric,
  reason      text,
  created_at  timestamptz default now()
);

-- 3) refunds: audit alanlari (her biri varsa atlanir).
alter table public.refunds
  add column if not exists type                text,        -- 'cancel' | 'refund'
  add column if not exists paynkolay_reference text,
  add column if not exists provider_response   jsonb,       -- Paynkolay ham yanit
  add column if not exists refunded_at         timestamptz,
  add column if not exists status              text;        -- 'success' | 'failed'

comment on column public.refunds.type is
  'cancel (ayni gun, tam) | refund (sonraki gun, tam/kismi)';
comment on column public.refunds.provider_response is
  'Paynkolay CancelRefundPayment ham yaniti (audit/teshis).';

-- 4) RLS: refunds HASSAS (iade kayitlari). Yeni olusturulduysa RLS ac;
--    erisim yalnizca service-role (Edge Function) ve admin_allowlist uzerinden.
--    NOT: Boss panel su an refunds'a anon/authenticated insert deniyordu ve
--    .catch ile sessizce basarisizdi; ADIM 7'de panel Edge Function'a tasinacak.
alter table public.refunds enable row level security;
