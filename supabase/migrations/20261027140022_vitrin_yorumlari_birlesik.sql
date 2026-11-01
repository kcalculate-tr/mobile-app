-- Recovered from live DB history (supabase_migrations.schema_migrations) on 2026-11-02
-- version: 20261027140022  name: vitrin_yorumlari_birlesik
-- Ad maskeleme: "Firat Beyde" -> "Firat B."
-- Baska musterilerin tam adini uygulamada yayimlamiyoruz.
create or replace function public.fn_ad_maskele(p_ad text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case
    when nullif(trim(coalesce(p_ad, '')), '') is null then 'kcal. müşterisi'
    else
      split_part(trim(p_ad), ' ', 1)
      || case
           when position(' ' in trim(p_ad)) > 0
             then ' ' || upper(left(split_part(trim(p_ad), ' ', 2), 1)) || '.'
           else ''
         end
  end;
$$;

-- Anasayfa vitrini: sipariş değerlendirmeleri (reviews) VE uygulama içi
-- geri bildirimler (feedback) birleşik.
--
-- İKİ KAYNAK, TEK KAPI: her iki tarafta da is_approved = true şartı var.
-- Boss panelden onaylanmayan hiçbir metin anasayfaya çıkmaz; şikayetler
-- (1-2 yıldız) onaylansa bile 4 yıldız eşiğini geçemez.
--
-- Geri bildirimde metin eşiği 20 karakter: "Teşekkür ederim" gibi içeriksiz
-- ama 5 yıldızlı satırlar vitrinde yer kaplamasın.
--
-- id text döndürülüyor: reviews.id bigint, feedback.id uuid.
create or replace function public.vitrin_yorumlari(p_limit integer default 12)
returns table(
  id      text,
  rating  smallint,
  yorum   text,
  ad      text,
  tarih   timestamptz,
  kaynak  text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with birlesik as (
    select
      'r_' || r.id::text as id,
      r.rating,
      trim(r.comment) as yorum,
      public.fn_ad_maskele(coalesce(nullif(trim(p.full_name), ''), o.customer_name)) as ad,
      r.created_at as tarih,
      'siparis'::text as kaynak
    from reviews r
    left join profiles p on p.id = r.user_id
    left join orders   o on o.id = r.order_id
    where r.is_approved = true
      and nullif(trim(r.comment), '') is not null
      and r.rating >= 4

    union all

    select
      'f_' || f.id::text as id,
      f.rating::smallint,
      trim(f.message) as yorum,
      public.fn_ad_maskele(nullif(trim(p.full_name), '')) as ad,
      f.created_at as tarih,
      'uygulama'::text as kaynak
    from feedback f
    left join profiles p on p.id = f.user_id
    where f.is_approved = true
      and length(trim(coalesce(f.message, ''))) >= 20
      and coalesce(f.rating, 0) >= 4
  )
  select id, rating, yorum, ad, tarih, kaynak
  from birlesik
  order by rating desc, tarih desc
  limit greatest(coalesce(p_limit, 12), 1);
$$;

revoke all on function public.vitrin_yorumlari(integer) from public;
grant execute on function public.vitrin_yorumlari(integer) to anon, authenticated;
grant execute on function public.fn_ad_maskele(text) to anon, authenticated;
