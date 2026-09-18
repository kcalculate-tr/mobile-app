-- "Kart Ekle" (1 TL doğrulama + iade) — doğrulama kayıtları.
-- Sipariş DEĞİL: orders'a ve refunds'a (order_id'li) yazılmaz; iade audit'i bu
-- satırın kendi kolonlarında tutulur. Yazma yalnız service_role (edge function);
-- kullanıcı yalnız KENDİ satırını okur (sonuç polling'i), Boss panel
-- admin_allowlist üzerinden okur.
--
-- user_id: auth.users ON DELETE SET NULL (user_cards'ın CASCADE'inin aksine,
-- failed_payments gibi) — kullanıcı hesabını silse bile iadesi bekleyen
-- ('refund_pending') bir 1 TL kaydı kaybolmasın, retry/Boss görünürlüğü sürsün.
--
-- Durum akışı:
--   initiated -> succeeded (ödeme alındı, kart işlendi) -> refunded | refund_pending
--   initiated -> failed (para çekilmedi, iade yok)
--   refund_pending -> refunded | refund_failed (72 saatlik retry sonrası, elle çözüm)

create table if not exists public.card_verifications (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references auth.users(id) on delete set null,
  -- 'KCALVER' + uuid(dashsız): callback'teki sipariş regex'i (^KCAL(\d+)T) ile ASLA eşleşmez.
  client_ref_code          text not null unique,
  amount                   numeric(10,2) not null default 1.00 check (amount > 0),
  status                   text not null default 'initiated'
                             check (status in ('initiated','succeeded','failed','refund_pending','refunded','refund_failed')),
  paynkolay_reference_code text,
  paynkolay_trx_date       text,        -- yyyy.mm.dd (CancelRefundPayment trxDate)
  tran_id                  text,
  card_saved               boolean not null default false,
  -- 'duplicate_card' | 'card_not_listed' | 'declined' | 'amount_mismatch' | 'timeout' ... (kullanıcı/Boss bağlamı)
  note                     text,
  refund_attempts          integer not null default 0 check (refund_attempts >= 0),
  last_refund_error        text,
  last_refund_at           timestamptz,
  refund_response          jsonb,       -- ham iptal/iade yanıtı (audit/teşhis)
  refunded_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.card_verifications is
  'Kart Ekle: 1 TL doğrulama işlemi + iade takibi. Sipariş değildir; yazma sadece service_role.';

-- Günlük limit sorgusu (kullanıcı başına, TR günü) ve durum taramaları için.
create index if not exists card_verifications_user_created_idx
  on public.card_verifications (user_id, created_at desc);
create index if not exists card_verifications_refund_pending_idx
  on public.card_verifications (created_at) where status = 'refund_pending';
create index if not exists card_verifications_initiated_idx
  on public.card_verifications (created_at) where status = 'initiated';

create or replace function public.card_verifications_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists card_verifications_touch on public.card_verifications;
create trigger card_verifications_touch
  before update on public.card_verifications
  for each row execute function public.card_verifications_touch_updated_at();

-- RLS: INSERT/UPDATE/DELETE politikası YOK (yalnız service_role — RLS'i bypass eder).
alter table public.card_verifications enable row level security;

drop policy if exists card_verifications_select_own on public.card_verifications;
create policy card_verifications_select_own
  on public.card_verifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists card_verifications_select_admin on public.card_verifications;
create policy card_verifications_select_admin
  on public.card_verifications for select
  to authenticated
  using (exists (select 1 from public.admin_allowlist a where a.user_id = auth.uid()));
