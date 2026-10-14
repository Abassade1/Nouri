-- =============================================================================
-- 0011  Service catalogue management
--  * A service's short name (slug) never changes, and its billing unit (per walk, per night...)
--    is locked once any carer offers it or any booking used it: changing it would silently
--    change what existing prices mean.
--  * A retired (inactive) service can't be booked, and disappears from carers' public prices.
--    Existing bookings are untouched.
--  * Every change to the catalogue is written to the audit log.
-- =============================================================================

create function public.services_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'service_slug_locked';
  end if;
  if new.rate_unit is distinct from old.rate_unit and (
       exists (select 1 from public.carer_services where service_id = old.id)
    or exists (select 1 from public.bookings where service_id = old.id)) then
    raise exception 'rate_unit_locked';
  end if;
  return new;
end $$;
create trigger services_guard before update on public.services
  for each row execute function public.services_guard();

-- New requests can't use a retired service (the main booking checks cover city + carer; this covers the catalogue).
create function public.bookings_service_active() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_privileged()
     and not exists (select 1 from public.services where id = new.service_id and is_active) then
    raise exception 'service_not_offered';
  end if;
  return new;
end $$;
create trigger bookings_service_active before insert on public.bookings
  for each row execute function public.bookings_service_active();

-- Public carer listing: only show rates for services that are still in the catalogue.
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
             where cs.carer_id = cp.user_id and cs.is_active), '[]'::jsonb) as services
from public.carer_profiles cp
join public.profiles p on p.id = cp.user_id
join public.cities ci on ci.id = cp.city_id and ci.is_active
where cp.status = 'approved' and cp.payouts_enabled;

-- Audit: catalogue changes (reuses the admin audit log; city_id stays empty for these rows).
create function public.audit_service_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(new) = to_jsonb(old) then return new; end if;
  insert into public.admin_audit_log (admin_id, action, entity, entity_id, before, after)
  values (auth.uid(), lower(tg_op), 'service', new.id::text, case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;
create trigger services_audit after insert or update on public.services
  for each row execute function public.audit_service_change();
create index admin_audit_entity on public.admin_audit_log (entity, entity_id, created_at desc);
