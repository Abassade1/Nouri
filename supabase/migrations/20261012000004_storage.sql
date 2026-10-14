-- =============================================================================
-- 0004  Storage buckets and policies
--
-- Path conventions (first folder decides who may touch a file):
--   avatars       {user_id}/avatar.jpg                public read
--   credentials   {carer_id}/{file}                   carer + admin only
--   pet-photos    {owner_id}/{pet_id}/{file}          owner; carers with a live booking; admin
--   visit-photos  {booking_id}/{file}                 carer of booking writes; owner/carer/admin read
-- All private buckets are served through short-lived signed URLs.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',      'avatars',      true,  2097152,  array['image/jpeg', 'image/png', 'image/webp']),
  ('credentials',  'credentials',  false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('pet-photos',   'pet-photos',   false, 5242880,  array['image/jpeg', 'image/png', 'image/webp']),
  ('visit-photos', 'visit-photos', false, 5242880,  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- uuid cast that returns null instead of raising on bad paths.
create function public.try_uuid(p text) returns uuid
language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- avatars --------------------------------------------------------------------
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');
create policy avatars_own_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_own_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- credentials ----------------------------------------------------------------
create policy credentials_read on storage.objects for select to authenticated
  using (bucket_id = 'credentials'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy credentials_write on storage.objects for insert to authenticated
  with check (bucket_id = 'credentials' and (storage.foldername(name))[1] = auth.uid()::text
              and public.auth_role() = 'carer');
create policy credentials_delete on storage.objects for delete to authenticated
  using (bucket_id = 'credentials' and (storage.foldername(name))[1] = auth.uid()::text);

-- pet photos -----------------------------------------------------------------
create policy pet_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'pet-photos'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or public.is_admin()
              or public.carer_can_view_pet(public.try_uuid((storage.foldername(name))[2]), false)));
create policy pet_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy pet_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy pet_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- visit photos (reports and concern flags) -----------------------------------
create policy visit_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'visit-photos'
         and public.can_see_booking(public.try_uuid((storage.foldername(name))[1])));
create policy visit_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'visit-photos' and exists (
    select 1 from public.bookings b
     where b.id = public.try_uuid((storage.foldername(name))[1])
       and b.carer_id = auth.uid()
       and b.status in ('confirmed', 'in_progress', 'completed')));
-- No update/delete policy: report photos are part of the audit trail.
