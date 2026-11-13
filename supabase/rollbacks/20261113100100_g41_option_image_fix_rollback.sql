-- G41-S1 md.4 ROLLBACK — 20261113100100_g41_option_image_fix.sql öncesine döner.
-- 'cleared' satırlara eski image_url birebir geri yazılır; 'filled' satırlar yeniden NULL olur.
-- Sonra yedek tablo silinir.
begin;

do $$
begin
  if to_regclass('public._g41_option_image_backup') is null then
    raise notice 'G41 rollback: yedek tablo yok — yapılacak bir şey yok';
    return;
  end if;
  update public.option_items oi
  set image_url = b.image_url
  from public._g41_option_image_backup b
  where b.option_item_id = oi.id;
  drop table public._g41_option_image_backup;
end $$;

commit;
