-- review_reports — kullanıcıya dönük "yorumu bildir/şikayet et" akışı (Apple 1.2 UGC).
-- Anasayfa "Müşteri Yorumları" şeridinde (TopReviewsStrip) gösterilen ONAYLI
-- yorumlar için in-app şikayet. Kaynak iki tablo olabilir:
--   · 'siparis'  → reviews.id
--   · 'uygulama' → feedback.id
-- (vitrin_yorumlari RPC'si iki kaynağı birleştirip tek "id + kaynak" döndürüyor.)
--
-- Moderasyon tarafı (Boss paneli) bu tabloyu service-role ile okur; normal
-- kullanıcı yalnızca KENDİ şikayetini EKLER, hiçbir satırı okuyamaz/silemez.
-- NOT: staging'de test EDİLMEDİ (gece kuralları — dosya olarak yazıldı, uygulanmadı).

create table if not exists public.review_reports (
  id               bigserial    primary key,
  -- Şikayet eden (oturum zorunlu — RLS auth.uid() ile eşleştirir).
  reporter_user_id uuid         not null references auth.users(id) on delete cascade,
  -- Şikayet edilen içeriğin kaynağı + o kaynaktaki kimliği. FK YOK: iki ayrı
  -- tabloya (reviews/feedback) işaret edebildiği ve içerik ileride
  -- anonimleştirilse bile şikayet kaydı korunması gerektiği için metin tutulur.
  content_kaynak   text         not null check (content_kaynak in ('siparis', 'uygulama')),
  content_id       text         not null,
  -- Sabit sebep kodu (UI'daki seçenekler) + serbest not (opsiyonel).
  reason           text         not null check (reason in ('spam', 'offensive', 'irrelevant', 'fake', 'other')),
  note             text,
  -- Moderasyon durumu; Boss paneli günceller.
  status           text         not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at       timestamptz  not null default now(),
  -- Aynı kullanıcı aynı içeriği bir kez bildirir (spam/çift kayıt engeli).
  unique (reporter_user_id, content_kaynak, content_id)
);

create index if not exists review_reports_content_idx
  on public.review_reports (content_kaynak, content_id);
create index if not exists review_reports_status_idx
  on public.review_reports (status, created_at desc);

alter table public.review_reports enable row level security;

-- Kullanıcı yalnızca KENDİ adına şikayet ekler.
drop policy if exists review_reports_insert_own on public.review_reports;
create policy review_reports_insert_own
  on public.review_reports for insert
  with check (auth.uid() = reporter_user_id);

-- Normal kullanıcıya select/update/delete YOK (policy tanımlanmadı → RLS reddeder).
-- Moderasyon service-role anahtarıyla (RLS bypass) Boss panelinden okur/günceller.
