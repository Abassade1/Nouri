-- =============================================================================
-- 0010  Admin operations: city management, payments overview, waitlist
--  * Money-related settings (tax, commission, refunds, services) are validated in the
--    database, so a typo in a form can never become a wrong charge.
--  * Launching a city requires at least one enabled service.
--  * Every change to a city or its service list is written to an audit log by a trigger
--    (so it can't be skipped) with WHO changed it, and the before/after values.
--  * Waitlist: admins can mark people contacted and delete entries (people may ask us to).
-- =============================================================================

-- ---------- Tax rules must be a list of {code, rate} with 0 <= rate < 1 -------
create function public.valid_tax_components(v jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(v) = 'array'
     and not exists (
       select 1 from jsonb_array_elements(v) e
        where jsonb_typeof(e) <> 'object'
           or coalesce(e->>'code', '') !~ '^[A-Za-z0-9 ._-]{1,12}$'
           or jsonb_typeof(e->'rate') <> 'number'
           or (e->>'rate')::numeric < 0 or (e->>'rate')::numeric >= 1)
$$;
alter table public.cities add constraint cities_tax_components_valid check (public.valid_tax_components(tax_components));

-- ---------- Launching a city ---------------------------------------------------
create function public.cities_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    if not exists (select 1 from public.city_services where city_id = new.id and is_enabled) then
      raise exception 'city_needs_service';
    end if;
    new.launched_at := coalesce(new.launched_at, now());
  end if;
  return new;
end $$;
-- A new city can't be created already-live (it has no services yet), so only updates are guarded:
create trigger cities_guard before update on public.cities
  for each row execute function public.cities_guard();

-- ---------- Audit log ----------------------------------------------------------
create table public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.profiles(id) on delete set null,
  action      text not null,                  -- insert / update / delete
  entity      text not null,                  -- 'city' | 'city_service'
  entity_id   text not null,
  city_id     uuid references public.cities(id) on delete cascade,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index admin_audit_city on public.admin_audit_log (city_id, created_at desc);
alter table public.admin_audit_log enable row level security;
create policy audit_admin_read on public.admin_audit_log for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.admin_audit_log from authenticated, anon;
revoke all on public.admin_audit_log from anon;

create function public.audit_city_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'cities' then
    if tg_op = 'UPDATE' and to_jsonb(new) - 'updated_at' = to_jsonb(old) - 'updated_at' then return new; end if;
    insert into public.admin_audit_log (admin_id, action, entity, entity_id, city_id, before, after)
    values (auth.uid(), lower(tg_op), 'city', new.id::text, new.id,
            case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  else
    insert into public.admin_audit_log (admin_id, action, entity, entity_id, city_id, before, after)
    values (auth.uid(), lower(tg_op), 'city_service',
            coalesce(new.city_id, old.city_id)::text || ':' || coalesce(new.service_id, old.service_id)::text,
            coalesce(new.city_id, old.city_id),
            case when tg_op <> 'INSERT' then to_jsonb(old) end,
            case when tg_op <> 'DELETE' then to_jsonb(new) end);
  end if;
  return coalesce(new, old);
end $$;
create trigger cities_audit after insert or update on public.cities
  for each row execute function public.audit_city_change();
create trigger city_services_audit after insert or update or delete on public.city_services
  for each row execute function public.audit_city_change();

-- ---------- Waitlist: contacted + delete --------------------------------------
alter table public.waitlist add column notified_at timestamptz;
create policy waitlist_admin_update on public.waitlist for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy waitlist_admin_delete on public.waitlist for delete to authenticated using (public.is_admin());
create index waitlist_city on public.waitlist (city_id, created_at desc);

-- ---------- Payments overview needs these reads (admins already see bookings/payouts) ----
create index if not exists bookings_paid on public.bookings (paid_at desc) where paid_at is not null;
