-- Değerlendirme yanıtları: tarih/yazar alanları + müşteri koruması.
-- Mevcut durum: reviews.admin_reply kolonu vardı, boss panel oraya yazıyordu,
-- ama ne zaman yanıtlandığı tutulmuyordu ve müşteriye hiç bildirilmiyordu.
--
-- reviews_update_own politikası müşteriye kendi satırında `true` ile UPDATE
-- veriyor — yani müşteri kendi değerlendirmesindeki admin_reply'ı ya da
-- is_approved'ı değiştirebiliyordu. Aşağıdaki BEFORE tetikleyicisi bunu
-- engelliyor; müşteri yalnız reply_seen_at'i güncelleyebiliyor.

alter table public.reviews
  add column if not exists admin_reply_at timestamptz,
  add column if not exists admin_reply_by uuid,
  add column if not exists reply_seen_at   timestamptz;

create index if not exists idx_reviews_user_created
  on public.reviews (user_id, created_at desc);

create or replace function public.fn_reviews_reply_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
  v_role   text := case when v_claims is null then null else (v_claims::jsonb ->> 'role') end;
  v_yetkili boolean;
begin
  v_yetkili := (v_role is null or v_role = 'service_role' or public.is_admin());

  if v_yetkili then
    -- Yanıt YENİ yazıldı ya da değişti → tarihi damgala, görülme sıfırlanır.
    -- Panelin bu alanları yazmasına güvenmiyoruz; tek doğruluk kaynağı burası.
    if coalesce(new.admin_reply, '') <> coalesce(old.admin_reply, '')
       and coalesce(new.admin_reply, '') <> '' then
      new.admin_reply_at := now();
      new.admin_reply_by := coalesce(auth.uid(), old.admin_reply_by);
      new.reply_seen_at  := null;
    end if;
    return new;
  end if;

  -- Müşteri: yanıt ve moderasyon alanları dokunulamaz.
  new.admin_reply    := old.admin_reply;
  new.admin_reply_at := old.admin_reply_at;
  new.admin_reply_by := old.admin_reply_by;
  new.is_approved    := old.is_approved;
  return new;
end;
$$;

create trigger trg_reviews_reply_guard
before update on public.reviews
for each row execute function public.fn_reviews_reply_guard();;
