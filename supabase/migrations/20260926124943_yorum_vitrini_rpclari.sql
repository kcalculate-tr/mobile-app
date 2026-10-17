-- ─────────────────────────────────────────────────────────────────────────────
-- YORUM VİTRİNİ — anasayfa şeridi ve ürün sayfası beğeni oranı.
--
-- Neden RPC: ikisi de BAŞKA müşterilerin verisini gösteriyor.
--  · reviews RLS'i "onaylı VEYA kendi yorumun" diyor; onaylı yorum okunabilir
--    ama YAZARIN ADI profiles/orders'ta ve oralara başkasının erişimi yok.
--  · review_item_feedback tamamen sahibine kapalı.
-- Bu yüzden ikisi de SECURITY DEFINER; dışarı yalnız GÖSTERİLEBİLİR alan
-- çıkıyor: maskelenmiş ad ve toplu sayı. user_id hiçbir zaman dönmüyor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Anasayfa şeridi: onaylı, yazılı, 4+ yıldız yorumlar
create or replace function public.en_iyi_yorumlar(p_limit integer default 12)
returns table (
  id       bigint,
  rating   smallint,
  yorum    text,
  ad       text,
  tarih    timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    r.id,
    r.rating,
    r.comment,
    -- Ad maskeleme: "Fırat Beyde" → "Fırat B." Uygulamada başka müşterilerin
    -- tam adını yayımlamak gereksiz; baş harf hem kişisel hem yeterli.
    case
      when coalesce(nullif(trim(p.full_name), ''), nullif(trim(o.customer_name), '')) is null
        then 'kcal. müşterisi'
      else
        split_part(trim(coalesce(nullif(trim(p.full_name),''), o.customer_name)), ' ', 1)
        || case
             when position(' ' in trim(coalesce(nullif(trim(p.full_name),''), o.customer_name))) > 0
               then ' ' || upper(left(split_part(trim(coalesce(nullif(trim(p.full_name),''), o.customer_name)), ' ', 2), 1)) || '.'
             else ''
           end
    end as ad,
    r.created_at
  from reviews r
  left join profiles p on p.id = r.user_id
  left join orders   o on o.id = r.order_id
  where r.is_approved = true
    and nullif(trim(r.comment), '') is not null
    and r.rating >= 4
  order by r.rating desc, r.created_at desc
  limit greatest(coalesce(p_limit, 12), 1);
$$;

-- 2) Ürün beğeni oranı
--
-- p_min_oy ALT SINIR: bunun altındaki ürün hiç DÖNMEZ. Tek oyla "%100'ü
-- beğendi" yazmak müşteriyi yanıltır; sunucu tarafında kesmek, istemcinin
-- yanlışlıkla göstermesini de imkânsız kılıyor. Sayı da dönüyor ki arayüz
-- oranı her zaman "kaç kişiden" ile birlikte gösterebilsin.
create or replace function public.urun_begeni_oranlari(p_min_oy integer default 5)
returns table (
  product_id integer,
  toplam     bigint,
  begenen    bigint,
  oran       integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select f.product_id,
         count(*) as toplam,
         count(*) filter (where f.liked) as begenen,
         round(100.0 * count(*) filter (where f.liked) / nullif(count(*), 0))::int as oran
  from review_item_feedback f
  group by f.product_id
  having count(*) >= greatest(coalesce(p_min_oy, 5), 2);
$$;

revoke all on function public.en_iyi_yorumlar(integer) from public;
revoke all on function public.urun_begeni_oranlari(integer) from public;
grant execute on function public.en_iyi_yorumlar(integer) to anon, authenticated;
grant execute on function public.urun_begeni_oranlari(integer) to anon, authenticated;;
