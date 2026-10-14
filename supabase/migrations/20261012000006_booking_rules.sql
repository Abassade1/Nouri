-- =============================================================================
-- 0006  Booking rules (Phase 4)
--  * A request must start inside one of the carer's weekly availability
--    windows (read in the CITY's timezone), at least 2 hours from now.
--  * A carer can never hold two overlapping accepted/confirmed/in-progress
--    bookings: checked when a request is made AND when it is accepted.
-- =============================================================================

create function public.carer_has_conflict(p_carer uuid, p_start timestamptz, p_end timestamptz, p_exclude uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b
     where b.carer_id = p_carer
       and b.status in ('accepted', 'confirmed', 'in_progress')
       and (p_exclude is null or b.id <> p_exclude)
       and tstzrange(b.start_at, b.end_at) && tstzrange(p_start, p_end)
  )
$$;

create or replace function public.bookings_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_city      public.cities;
  v_carer     public.carer_profiles;
  v_rate      integer;
  v_unit      public.rate_unit;
  v_comp      jsonb;
  v_amt       integer;
  v_taxes     jsonb := '[]'::jsonb;
  v_tax_total integer := 0;
  v_local     timestamp;
  v_local_end timestamp;
begin
  if not public.is_privileged() then
    new.owner_id := auth.uid();
    new.status := 'requested';
    new.stripe_payment_intent_id := null; new.stripe_charge_id := null; new.paid_at := null;
    new.refunded_cents := 0;
  end if;

  select * into v_carer from public.carer_profiles where user_id = new.carer_id;
  if not found or v_carer.status <> 'approved' then raise exception 'carer_not_available'; end if;

  select * into v_city from public.cities where id = v_carer.city_id and is_active;
  if not found then raise exception 'city_not_active'; end if;

  if not exists (select 1 from public.city_services where city_id = v_city.id and service_id = new.service_id and is_enabled) then
    raise exception 'service_not_available_in_city';
  end if;

  select cs.rate_cents, s.rate_unit into v_rate, v_unit
    from public.carer_services cs join public.services s on s.id = cs.service_id
   where cs.carer_id = new.carer_id and cs.service_id = new.service_id and cs.is_active;
  if v_rate is null then raise exception 'service_not_offered'; end if;

  if new.start_at <= now() then raise exception 'start_in_past'; end if;

  if not public.is_privileged() then
    -- minimum notice (a platform default; make it a city setting if it needs to vary)
    if new.start_at < now() + interval '2 hours' then raise exception 'start_too_soon'; end if;

    -- must fall inside a weekly window, in the city's local time
    v_local := new.start_at at time zone v_city.timezone;
    v_local_end := new.end_at at time zone v_city.timezone;
    if not exists (
      select 1 from public.availability a
       where a.carer_id = new.carer_id
         and a.weekday = extract(dow from v_local)::int
         and v_local::time >= a.start_time and v_local::time < a.end_time
         and (v_unit = 'per_night'
              or (v_local_end::date = v_local::date and v_local_end::time <= a.end_time))
    ) then
      raise exception 'outside_availability';
    end if;

    if public.carer_has_conflict(new.carer_id, new.start_at, new.end_at, null) then
      raise exception 'carer_unavailable';
    end if;
  end if;

  new.city_id := v_city.id;
  new.currency := v_city.currency;
  new.unit_rate_cents := v_rate;
  new.subtotal_cents := v_rate * new.quantity;

  for v_comp in select * from jsonb_array_elements(v_city.tax_components) loop
    v_amt := round(new.subtotal_cents * (v_comp->>'rate')::numeric)::integer;
    v_taxes := v_taxes || jsonb_build_object('code', v_comp->>'code', 'rate', (v_comp->>'rate')::numeric, 'cents', v_amt);
    v_tax_total := v_tax_total + v_amt;
  end loop;

  new.tax_breakdown := v_taxes;
  new.tax_cents := v_tax_total;
  new.total_cents := new.subtotal_cents + v_tax_total;
  new.commission_rate := v_city.commission_rate;
  new.commission_cents := round(new.subtotal_cents * v_city.commission_rate)::integer;
  new.carer_payout_cents := new.subtotal_cents - new.commission_cents;
  return new;
end $$;

-- Accepting: someone else's overlapping booking may have been accepted in the meantime.
create function public.bookings_accept_overlap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted'
     and public.carer_has_conflict(new.carer_id, new.start_at, new.end_at, new.id) then
    raise exception 'carer_unavailable';
  end if;
  return new;
end $$;
create trigger bookings_accept_overlap before update on public.bookings
  for each row execute function public.bookings_accept_overlap();

-- Booking participants can read each other's basic profile row (already allowed), and
-- owners can see which weekly windows a listed carer offers (already allowed). Index for the agenda:
create index if not exists bookings_carer_status_start on public.bookings (carer_id, status, start_at);
