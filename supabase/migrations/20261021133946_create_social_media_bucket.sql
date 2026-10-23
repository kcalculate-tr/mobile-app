-- Public-read bucket for Instagram/Metricool images. No storage.objects policies are added:
-- public URLs serve files, and only the service role (social-upload edge function) can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-media', 'social-media', true, 8388608, array['image/jpeg','image/png'])
on conflict (id) do nothing;;
