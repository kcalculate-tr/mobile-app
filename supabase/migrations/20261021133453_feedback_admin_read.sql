-- feedback'te yalnizca "Users select own feedback" (user_id = auth.uid()) vardi;
-- admin icin SELECT politikasi yoktu. Bu yuzden boss panelindeki
-- "Geri Bildirimler" sekmesi 3 kayit varken (0) gosteriyordu.
-- support_tickets'taki tickets_admin_read ile ayni desen.
create policy "feedback_admin_read" on public.feedback
  for select to authenticated
  using (public.is_admin());;
