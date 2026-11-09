-- G18-S5: 20261108000300_g18_eatkcal_waitlist.sql geri alma.
-- DİKKAT: tablodaki başvuru/öneri satırları silinir — önce dışa aktar.
drop policy if exists eatkcal_waitlist_select_own on public.eatkcal_waitlist_requests;
drop policy if exists eatkcal_waitlist_insert_own on public.eatkcal_waitlist_requests;
drop index if exists public.eatkcal_waitlist_requests_created_idx;
drop index if exists public.eatkcal_waitlist_requests_client_ref_uq;
drop table if exists public.eatkcal_waitlist_requests;
