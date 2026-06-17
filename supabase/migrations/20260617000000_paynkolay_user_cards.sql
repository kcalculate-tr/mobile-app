-- Paynkolay reconcile migration.
-- ONEMLI: Bu repo'nun migration gecmisi remote ile uyumsuz (15 takipsiz migration).
-- Bu dosya db push ile DEGIL, `supabase db query --linked -f <bu dosya>` ile
-- uygulanir; sonra `supabase migration repair --status applied 20260617000000`.
--
-- Production'da bulunan GERCEK durum (deploy oncesi tespit):
--   * user_cards ZATEN VAR (0 satir) — farkli sema: last4/brand var,
--     paynkolay_customer_key + unique index'ler YOK. -> ALTER (drop/recreate yok).
--   * failed_payments YOK — Tosla payment-verify + paynkolay-callback insert'leri
--     sessizce basarisiz oluyormus (latent bug). -> CREATE (audit'i duzeltir).

-- ── 1) user_cards: guvenli ALTER (tablo bos, drop yok) ──────────────────────
-- Mevcut kolonlar korunur: id, user_id (nullable!), card_token, card_alias,
-- last4 (varchar), brand (varchar), is_default, created_at + RLS + policy'ler.
-- Yalnizca eksikleri ekle.

-- Paynkolay customerKey (=normalize telefon). NULL: flag kapaliyken hic yazilmaz,
-- kart saklama acilinca dolar. NOT NULL YAPILMAZ (mevcut/gelecek satirlar kirilmasin).
alter table public.user_cards
  add column if not exists paynkolay_customer_key text;

-- Ayni kart ayni kullanicida iki kez kaydolmasin.
create unique index if not exists user_cards_user_token_uniq
  on public.user_cards (user_id, card_token);

-- Kullanici basina yalnizca bir varsayilan kart.
create unique index if not exists user_cards_one_default_per_user
  on public.user_cards (user_id)
  where is_default;

-- Listeleme/eslestirme icin.
create index if not exists user_cards_user_id_idx
  on public.user_cards (user_id);

-- NOT: user_id nullable BIRAKILDI (riskli ALTER'dan kacinildi).
-- NOT: RLS zaten aktif; cards_select_own/insert_own/update_own/delete_own policy'leri
--      zaten var — DUPLICATE policy eklenmedi.
-- NOT: masked_pan/card_brand EKLENMEDI — Edge Function mevcut last4/brand'i kullanir.

-- ── 2) failed_payments: CREATE (latent bug fix) ─────────────────────────────
-- Sema, iki callback'in INSERT ettigi alanlardan turetildi:
--   payment-verify (Tosla) + paynkolay-callback ->
--   user_id, error_message, amount, payment_method, order_data (jsonb), created_at.
-- 'reason' ust-kolon DEGIL; order_data jsonb icinde tasinir.
create table if not exists public.failed_payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users (id) on delete set null,
  error_message   text,
  amount          numeric(12, 2) default 0,
  payment_method  text,
  order_data      jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists failed_payments_user_id_idx
  on public.failed_payments (user_id);
create index if not exists failed_payments_created_at_idx
  on public.failed_payments (created_at);

-- RLS: HASSAS audit tablosu. Kullanici erisimi YOK — yalnizca service-role
-- (RLS'i bypass eder) yazar/okur. RLS enable + policy YOK = kullaniciya kapali.
alter table public.failed_payments enable row level security;
