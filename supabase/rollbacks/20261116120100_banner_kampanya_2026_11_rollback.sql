begin;
delete from public.banner_cells where row_id = '5b1e0c2a-7f3d-4e61-9a10-2026110000a1';
delete from public.banner_rows where id = '5b1e0c2a-7f3d-4e61-9a10-2026110000a1';
alter table public.banner_cells drop column if exists image_url_en;
commit;
