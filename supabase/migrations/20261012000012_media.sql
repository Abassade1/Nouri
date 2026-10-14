-- =============================================================================
-- 0012  Photos people add: service cover images and carer galleries
--
-- Path conventions (first folder decides who may touch a file):
--   service-images  {service_id}/{file}   public read; admins write
--   carer-photos    {carer_id}/{file}     public read; the carer writes their own folder
-- Both buckets are public because what they show is already public (the service catalogue
-- and approved carers' listings); file names are random, so nothing is guessable.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('service-images', 'service-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('carer-photos',   'carer-photos',   true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Service cover image (set by admins in the dashboard; the app falls back to a bundled photo).
alter table public.services add column image_path text;

-- Carer gallery --------------------------------------------------------------
create table public.carer_photos (
  id          uuid primary key default gen_random_uuid(),
  carer_id    uuid not null references public.carer_profiles(user_id) on delete cascade,
  path        text not null check ((storage.foldername(path))[1] = carer_id::text),
  -- Optional: which service the photo shows (e.g. a walk). Null = general.
  service_id  uuid references public.services(id) on delete set null,
  caption     text check (char_length(caption) <= 140),
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);
create index carer_photos_carer on public.carer_photos (carer_id, sort_order, created_at);
alter table public.carer_photos enable row level security;

-- Anyone signed in sees an approved carer's gallery; carers see their own; admins see all.
create policy carer_photos_select on public.carer_photos for select to authenticated
  using (carer_id = auth.uid() or public.is_admin() or public.is_approved_carer(carer_id));
create policy carer_photos_insert on public.carer_photos for insert to authenticated
  with check (carer_id = auth.uid() and public.auth_role() = 'carer');
create policy carer_photos_update on public.carer_photos for update to authenticated
  using (carer_id = auth.uid()) with check (carer_id = auth.uid());
-- Carers remove their own; admins can take down anything inappropriate.
create policy carer_photos_delete on public.carer_photos for delete to authenticated
  using (carer_id = auth.uid() or public.is_admin());

-- At most 12 photos per carer.
create function public.carer_photos_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.carer_photos where carer_id = new.carer_id) >= 12 then
    raise exception 'photo_limit_reached';
  end if;
  return new;
end $$;
create trigger carer_photos_limit before insert on public.carer_photos
  for each row execute function public.carer_photos_limit();

-- Storage policies -------------------------------------------------------------
create policy service_images_public_read on storage.objects for select
  using (bucket_id = 'service-images');
create policy service_images_admin_write on storage.objects for insert to authenticated
  with check (bucket_id = 'service-images' and public.is_admin());
create policy service_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'service-images' and public.is_admin());
create policy service_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'service-images' and public.is_admin());

create policy carer_photos_public_read on storage.objects for select
  using (bucket_id = 'carer-photos');
create policy carer_photos_own_write on storage.objects for insert to authenticated
  with check (bucket_id = 'carer-photos' and (storage.foldername(name))[1] = auth.uid()::text
              and public.auth_role() = 'carer');
create policy carer_photos_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'carer-photos'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Public carer listing: add a cover photo (their first gallery photo) for discover cards.
create or replace view public.carer_directory as
select
  cp.user_id,
  cp.city_id,
  cp.display_name,
  cp.headline,
  cp.bio,
  cp.years_experience,
  cp.languages_spoken,
  cp.specialties,
  cp.service_radius_km,
  split_part(cp.postal_code, ' ', 1)  as postal_area,
  cp.rating_avg,
  cp.rating_count,
  p.avatar_path,
  coalesce((select array_agg(distinct c.type order by c.type)
              from public.credentials c
             where c.carer_id = cp.user_id and c.status = 'verified'
               and (c.expires_on is null or c.expires_on >= current_date)
               and c.type not in ('id_document', 'other')), '{}') as verified_badges,
  coalesce((select jsonb_agg(jsonb_build_object('service_id', cs.service_id, 'rate_cents', cs.rate_cents)
                             order by cs.rate_cents)
              from public.carer_services cs
              join public.services s on s.id = cs.service_id and s.is_active
             where cs.carer_id = cp.user_id and cs.is_active), '[]'::jsonb) as services,
  (select ph.path from public.carer_photos ph
    where ph.carer_id = cp.user_id
    order by ph.sort_order, ph.created_at
    limit 1) as cover_photo_path
from public.carer_profiles cp
join public.profiles p on p.id = cp.user_id
join public.cities ci on ci.id = cp.city_id and ci.is_active
where cp.status = 'approved' and cp.payouts_enabled;
